import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProdutoSupabase {
  id: number;
  restaurante_id: string | null;
  nome: string | null;
  preco: string | null;
  categoria: string | null;
  estacao: string | null;
  estoque: number | null;
  estoque_minimo: number | null;
  descricao: string | null;
  ativo: boolean | null;
  created_at: string;
}

export interface ProdutoInput {
  nome: string;
  preco: number;
  categoria?: string;
  estacao?: string;
  estoque?: number;
  estoque_minimo?: number;
  descricao?: string;
  ativo?: boolean;
}

export const useProdutos = (restaurantId: string | null) => {
  const [produtos, setProdutos] = useState<ProdutoSupabase[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch products from Supabase
  const fetchProdutos = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;

    if (!options.silent) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('Produtos')
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProdutos((data || []) as ProdutoSupabase[]);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Add new product
  const addProduto = useCallback(async (produto: ProdutoInput): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      console.log('Adding product with data:', {
        restaurante_id: restaurantId,
        nome: produto.nome,
        preco: produto.preco.toString(),
      });

      const { error } = await supabase
        .from('Produtos')
        .insert({
          restaurante_id: restaurantId,
          nome: produto.nome,
          preco: produto.preco.toString(),
          categoria: produto.categoria || 'Geral',
          estacao: produto.estacao || 'bar',
          estoque: produto.estoque || 0,
          estoque_minimo: produto.estoque_minimo || 10,
          descricao: produto.descricao || '',
          ativo: produto.ativo ?? true,
        });

      if (error) {
        console.error('Supabase Error adding product:', error);
        toast.error(`Erro do Banco: ${error.message}`);
        return false;
      }

      await fetchProdutos();
      return true;
    } catch (err) {
      console.error('Failed to add product:', err);
      return false;
    }
  }, [restaurantId, fetchProdutos]);

  // Update existing product
  const updateProduto = useCallback(async (id: number, updates: Partial<ProdutoInput>): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      const updateData: any = {};
      if (updates.nome !== undefined) updateData.nome = updates.nome;
      if (updates.preco !== undefined) updateData.preco = updates.preco.toString();
      if (updates.categoria !== undefined) updateData.categoria = updates.categoria;
      if (updates.estacao !== undefined) updateData.estacao = updates.estacao;
      if (updates.estoque !== undefined) updateData.estoque = updates.estoque;
      if (updates.estoque_minimo !== undefined) updateData.estoque_minimo = updates.estoque_minimo;
      if (updates.descricao !== undefined) updateData.descricao = updates.descricao;
      if (updates.ativo !== undefined) updateData.ativo = updates.ativo;

      console.log('Updating product:', id, 'with data:', updateData);

      const { error } = await supabase
        .from('Produtos')
        .update(updateData)
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) {
        console.error('Supabase Error updating product:', error);
        toast.error(`Erro do Banco: ${error.message}`);
        return false;
      }

      await fetchProdutos();
      return true;
    } catch (err) {
      console.error('Failed to update product:', err);
      return false;
    }
  }, [restaurantId, fetchProdutos]);

  // Delete product
  const deleteProduto = useCallback(async (id: number): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      console.log('Deleting product:', id, 'for restaurant:', restaurantId);
      const { error } = await supabase
        .from('Produtos')
        .delete()
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) {
        console.error('Supabase Error deleting product:', error);
        toast.error(`Erro do Banco: ${error.message}`);
        return false;
      }

      await fetchProdutos();
      return true;
    } catch (err) {
      console.error('Failed to delete product:', err);
      return false;
    }
  }, [restaurantId, fetchProdutos]);

  // Fetch products when restaurantId changes
  useEffect(() => {
    if (restaurantId) {
      fetchProdutos();
    }
  }, [restaurantId, fetchProdutos]);

  // Setup real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('produtos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Produtos',
          filter: `restaurante_id=eq.${restaurantId}`,
        },
        () => {
          fetchProdutos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchProdutos]);

  return {
    produtos,
    loading,
    addProduto,
    updateProduto,
    deleteProduto,
    refetch: fetchProdutos,
  };
};
