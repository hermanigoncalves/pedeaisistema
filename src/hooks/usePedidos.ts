import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Pedido {
  id: number;
  mesa: string | null;
  itens: string | null;
  quantidade: string | null;
  Subtotal: string | null;
  status: string | null;
  restaurante_id: string | null;
  descricao?: string | null;
  usuario_telefone?: string | null;
  created_at: string;
}

export interface ParsedPedido {
  id: number;
  mesa: number;
  itens: Array<{ nome: string; quantidade: number; preco: number }>;
  productName: string;
  quantity: number;
  total: number;
  status: string;
  restaurante_id: string | null;
  descricao?: string;
  usuario_telefone: string | null;
  created_at: Date;
}

const parseMesaNumber = (mesa: string | null | undefined): number => {
  const raw = (mesa ?? '').toString().trim();
  if (!raw) return 0;

  // Accept formats like "3", "03", "Mesa 3", "mesa: 3", etc.
  const match = raw.match(/\d+/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
};

const normalizePedidoStatus = (status: string | null | undefined): string => {
  const s = (status ?? 'pendente').toString().trim().toLowerCase();

  // Common variants coming from external integrations / humans
  if (s === 'pendente' || s === 'pending') return 'pendente';
  if (s === 'preparando' || s === 'preparacao' || s === 'preparação' || s === 'preparing') return 'preparando';
  if (s === 'pronto' || s === 'ready') return 'pronto';
  if (s === 'entregue' || s === 'delivered') return 'entregue';

  // Fallback to the normalized string so UI filters are consistent
  return s;
};

const parsePedido = (pedido: Pedido): ParsedPedido => {
  // Debug log to trace data from DB
  console.log(`[parsePedido] ID: ${pedido.id}, Itens raw: "${pedido.itens}", Qtd raw: "${pedido.quantidade}", Subtotal: "${pedido.Subtotal}"`);

  // Parse the product name from itens
  const productName = pedido.itens || '';

  // Parse quantity from DB - ensure it's a number
  const quantity = parseInt(pedido.quantidade || '1', 10) || 1;

  // Parse subtotal - remove "R$ " and convert comma to dot
  let total = 0;
  if (pedido.Subtotal) {
    const cleanSubtotal = pedido.Subtotal.replace('R$', '').replace(',', '.').trim();
    total = parseFloat(cleanSubtotal) || 0;
  }

  let itens: Array<{ nome: string; quantidade: number; preco: number }>;

  // NEW: detect if itens is JSON (new format with per-item prices)
  const rawItens = (pedido.itens || '').trim();
  if (rawItens.startsWith('[')) {
    // NEW JSON FORMAT: [{nome, quantidade, preco}, ...]
    try {
      itens = JSON.parse(rawItens);
      // Recalculate total from JSON items for accuracy
      total = itens.reduce((sum, it) => sum + (it.preco * it.quantidade), 0);
    } catch {
      itens = [];
    }
  } else {
    // LEGACY FORMAT: comma-separated item names
    // Parse items from comma-separated string (e.g. "Burger, Burger, Coke")
    const rawItems = productName ? productName.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Group items by name to calculate quantity per item
    const itemCounts: Record<string, number> = {};
    rawItems.forEach(name => {
      itemCounts[name] = (itemCounts[name] || 0) + 1;
    });

    const uniqueItemNames = Object.keys(itemCounts);
    
    // We must ensure the sum of (quantity * price) for all items equals `total`.
    // Instead of trusting the DB's `quantity` parameter alone (which may be 1 for a combo or multiple items),
    // we use the total number of parsed elements to find an evenly distributed `unitPrice`.
    const totalParsedItems = rawItems.length;
    const unitPrice = totalParsedItems > 0 ? total / totalParsedItems : 0;

    // Create structured items array
    itens = Object.entries(itemCounts).map(([nome, qtd]) => {
      let finalQtd = qtd;
      if (uniqueItemNames.length === 1 && quantity > 1 && totalParsedItems === 1) { // Only override if it really looks like a single item entry
        finalQtd = quantity;
      }
      return {
        nome,
        quantidade: finalQtd,
        preco: unitPrice
      };
    });
  }

  console.log(`[parsePedido] Result for ID ${pedido.id}:`, { quantity, total, itens });

  return {
    id: pedido.id,
    mesa: parseMesaNumber(pedido.mesa),
    itens,
    productName,
    quantity,
    total,
    status: normalizePedidoStatus(pedido.status),
    restaurante_id: pedido.restaurante_id,
    descricao: (pedido.descricao ?? undefined) || undefined,
    usuario_telefone: pedido.usuario_telefone || null,
    created_at: new Date(pedido.created_at),
  };
};

export const usePedidos = (restaurantId: string | null, onInsert?: (pedido: ParsedPedido) => void) => {
  const [pedidos, setPedidos] = useState<ParsedPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPedidos = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      if (!options.silent) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('Pedidos')
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPedidos((data || []).map(parsePedido));
    } catch (err) {
      console.error('Error fetching pedidos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!restaurantId) return;

    fetchPedidos();

    // Set up realtime subscription
    const channel = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Pedidos',
          filter: `restaurante_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('Realtime update:', payload);

          if (payload.eventType === 'INSERT') {
            const newPedido = parsePedido(payload.new as Pedido);
            setPedidos(prev => {
              // Deduplicação: só adiciona se o ID não existe no estado atual
              if (prev.some(p => p.id === newPedido.id)) {
                console.log(`[Realtime] Pedido ${newPedido.id} já existe no estado, ignorando duplicata`);
                return prev;
              }
              return [newPedido, ...prev];
            });
            if (onInsert) {
              onInsert(newPedido);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPedido = parsePedido(payload.new as Pedido);
            setPedidos(prev =>
              prev.map(p => p.id === updatedPedido.id ? updatedPedido : p)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Pedido).id;
            setPedidos(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchPedidos]);

  const updatePedidoStatus = useCallback(async (pedidoId: number, status: string) => {
    try {
      // Optimistic update
      setPedidos(prev =>
        prev.map(p => p.id === pedidoId ? { ...p, status: normalizePedidoStatus(status) } : p)
      );

      const { error } = await supabase
        .from('Pedidos')
        .update({ status })
        .eq('id', pedidoId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error updating pedido:', err);
      // Re-fetch to ensure state is in sync if update failed
      fetchPedidos({ silent: true });
      return { error: err instanceof Error ? err.message : 'Erro ao atualizar pedido' };
    }
  }, [fetchPedidos]);

  const deletePedido = useCallback(async (pedidoId: number) => {
    try {
      // Optimistic update
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));

      const { error } = await supabase
        .from('Pedidos')
        .delete()
        .eq('id', pedidoId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error deleting pedido:', err);
      // Re-fetch to ensure state is in sync if delete failed
      fetchPedidos({ silent: true });
      return { error: err instanceof Error ? err.message : 'Erro ao excluir pedido' };
    }
  }, [fetchPedidos]);

  const updateTablePedidosStatus = useCallback(async (tableId: number, status: string) => {
    if (!restaurantId) return { error: 'No restaurant ID' };

    try {
      // Optimistic update
      const normalizedStatus = normalizePedidoStatus(status);
      setPedidos(prev =>
        prev.map(p => p.mesa === tableId ? { ...p, status: normalizedStatus } : p)
      );

      const { error } = await supabase
        .from('Pedidos')
        .update({ status })
        .eq('restaurante_id', restaurantId)
        .eq('mesa', tableId.toString())
        .neq('status', 'fechado') // Don't re-close already closed orders
        .neq('status', 'dividido');

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error updating table pedidos:', err);
      fetchPedidos({ silent: true });
      return { error: err instanceof Error ? err.message : 'Erro ao atualizar pedidos da mesa' };
    }
  }, [restaurantId, fetchPedidos]);

  // Calculate metrics for a specific date range
  const getMetrics = useCallback((startDate?: Date, endDate?: Date) => {
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const filteredPedidos = pedidos.filter(p => {
      const pedidoDate = new Date(p.created_at);
      return pedidoDate >= start && pedidoDate <= end;
    });

    const totalSales = filteredPedidos.reduce((sum, p) => sum + p.total, 0);
    const pendingOrders = pedidos.filter(p => p.status === 'pendente').length; // Keep global pending count

    // Product sales count
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredPedidos.forEach(pedido => {
      pedido.itens.forEach(item => {
        const key = item.nome;
        if (!productSales[key]) {
          productSales[key] = { name: item.nome, quantity: 0, revenue: 0 };
        }
        productSales[key].quantity += item.quantidade;
        productSales[key].revenue += item.preco * item.quantidade;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSales,
      pendingOrders,
      topProducts,
      totalOrders: filteredPedidos.length,
    };
  }, [pedidos]);

  return {
    pedidos,
    loading,
    error,
    updatePedidoStatus,
    deletePedido,
    updateTablePedidosStatus,
    refetch: fetchPedidos,
    getMetrics,
  };
};
