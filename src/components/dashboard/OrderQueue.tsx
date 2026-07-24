import { useState } from 'react';
import { Check, Trash2, Edit2, X, Loader2, Printer } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
} from '@/components/ui/alert-dialog';
import { isSystemMarkerItem } from '@/lib/utils';

export interface OrderQueueProps {
  kdsMode?: boolean;
}

const OrderQueue: React.FC<OrderQueueProps> = ({ kdsMode = false }) => {
  const { 
    pedidos, 
    updatePedidoStatus, 
    deletePedido, 
    loadingPedidos: loading, 
    reprintOrder,
    filter,
    products
  } = useApp();

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Helper function to resolve the station of a product by name
  const getProductStation = (itemName: string) => {
    const nameLower = itemName.trim().toLowerCase();
    
    // Se contiver a palavra pizza, vai por padrão para a cozinha
    if (nameLower.includes('pizza')) {
      return 'cozinha';
    }
    
    const prod = products.find(p => p.name.trim().toLowerCase() === nameLower);
    const station = prod ? (prod.station || 'cozinha') : 'cozinha';
    const normalized = station.trim().toLowerCase();
    if (normalized === 'kitchen' || normalized === 'cozinha') return 'cozinha';
    return normalized;
  };

  const activeStation = filter.trim().toLowerCase();

  // Filter and map pedidos based on active station and status
  const pendingPedidos = pedidos
    .filter(p =>
      (p.status === 'pendente' || p.status === 'preparando') &&
      p.status !== 'garcom_pendente' &&
      !p.itens.every(item => isSystemMarkerItem(item.nome))
    )
    .map(p => {
      if (activeStation === 'all') return p;

      // Filter only items that belong to the active station
      const filteredItens = p.itens.filter(item => getProductStation(item.nome) === activeStation);
      
      // Calculate total price only for active station items
      const stationTotal = filteredItens.reduce((sum, item) => sum + (item.preco * item.quantity || item.preco * item.quantidade), 0);

      return {
        ...p,
        itens: filteredItens,
        total: stationTotal
      };
    })
    // Exclude orders that do not contain any items for the active station
    .filter(p => p.itens.length > 0);

  const handleDeliver = async (pedidoId: number) => {
    setUpdatingId(pedidoId);
    const result = await updatePedidoStatus(pedidoId, 'entregue');
    setUpdatingId(null);

    if (result.error) {
      toast.error('Erro ao marcar como entregue');
    } else {
      toast.success('Pedido marcado como entregue!');
    }
  };

  const handleDelete = async (pedidoId: number) => {
    setDeletingId(pedidoId);
    const result = await deletePedido(pedidoId);
    setDeletingId(null);

    if (result.error) {
      toast.error('Erro ao excluir pedido');
    } else {
      toast.success('Pedido excluído!');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="h-full bg-card border-l border-border p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full p-4 overflow-y-auto bg-card ${kdsMode ? '' : 'border-l border-border'}`}>
      {!kdsMode && (
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-warning"></span>
          Fila de Pedidos {activeStation !== 'all' ? `(${activeStation.charAt(0).toUpperCase() + activeStation.slice(1)})` : ''} ({pendingPedidos.length})
        </h2>
      )}

      {pendingPedidos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className={kdsMode 
          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 touch-pan-y pb-8" 
          : "space-y-2"
        }>
          {pendingPedidos.map((pedido, idx) => (
            <div
              key={pedido.id}
              className="relative bg-secondary/50 rounded-lg p-3 animate-fade-in flex flex-col justify-between"
            >
              {/* Sequência / Número da Fila (Apenas no KDS) */}
              {kdsMode && (
                <div className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-background shadow-md">
                  #{idx + 1}
                </div>
              )}

              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold text-foreground text-base">Mesa {pedido.mesa}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {formatTime(pedido.created_at)}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${pedido.status === 'preparando'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-info/20 text-info'
                    }`}>
                    {pedido.status === 'preparando' ? '🔥 Preparando' : '⏳ Pendente'}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-0.5 mb-2">
                  {pedido.itens.map((item, idxItem) => (
                    <div key={idxItem} className="text-xs text-muted-foreground flex justify-between">
                      <span>{item.quantidade}x {item.nome}</span>
                      <span>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Descrição / Observação */}
                {pedido.descricao && (
                  <div className="mb-2 rounded bg-secondary/70 px-2 py-1 text-xs">
                    <span className="text-muted-foreground">Obs:</span>{' '}
                    <span className="text-foreground">{pedido.descricao}</span>
                  </div>
                )}
              </div>

              <div>
                {/* Total */}
                <div className="flex items-center justify-between text-xs font-semibold border-t border-border pt-1.5 mb-2">
                  <span className="text-foreground">{activeStation !== 'all' ? 'Total (Estação)' : 'Total'}</span>
                  <span className="text-primary">R$ {pedido.total.toFixed(2)}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1.5">
                  <Button
                    onClick={() => handleDeliver(pedido.id)}
                    disabled={updatingId === pedido.id}
                    size="sm"
                    className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs"
                  >
                    {updatingId === pedido.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Entregue
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => reprintOrder(pedido.id.toString())}
                    className="h-8 w-8 rounded-md text-info hover:text-info hover:bg-info/10"
                    title="Re-imprimir pedido"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(pedido.id)}
                    disabled={deletingId === pedido.id}
                    className="h-8 w-8 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingId === pedido.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderQueue;