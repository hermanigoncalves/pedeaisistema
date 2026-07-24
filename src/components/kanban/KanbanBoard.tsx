import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { useApp } from '@/contexts/AppContext';
import { ParsedPedido } from '@/hooks/usePedidos';
import { KanbanColumn } from './KanbanColumn';
import { OrderCard } from './OrderCard';
import { toast } from 'sonner';
import { isSystemMarkerItem } from '@/lib/utils';
import { deliveryAgentService } from '@/services/deliveryAgentService';

export const KanbanBoard: React.FC = () => {
  const {
    pedidos,
    updatePedidoStatus,
    deletePedido,
    reprintOrder,
    filter,
    products,
  } = useApp();

  const [activePedido, setActivePedido] = useState<ParsedPedido | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const columns: {
    id: string;
    title: string;
    badgeColor: string;
    accentColor: string;
  }[] = [
    {
      id: 'pendente',
      title: '⏳ Novo / Pendente',
      badgeColor: 'bg-red-500/20 text-red-600 dark:text-red-400',
      accentColor: 'border-red-500',
    },
    {
      id: 'preparando',
      title: '🔥 Em Preparo',
      badgeColor: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
      accentColor: 'border-amber-500',
    },
    {
      id: 'pronto',
      title: '🚚 Pronto / Em Rota',
      badgeColor: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      accentColor: 'border-blue-500',
    },
    {
      id: 'entregue',
      title: '✅ Entregue',
      badgeColor: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      accentColor: 'border-emerald-500',
    },
  ];

  // Helper local para obter a estação de preparo de um produto
  const getProductStation = (itemName: string) => {
    const nameLower = itemName.trim().toLowerCase();
    if (nameLower.includes('pizza')) return 'cozinha';

    const prod = products.find((p) => p.name.trim().toLowerCase() === nameLower);
    const station = prod ? prod.station || 'cozinha' : 'cozinha';
    const normalized = station.trim().toLowerCase();
    if (normalized === 'kitchen' || normalized === 'cozinha') return 'cozinha';
    return normalized;
  };

  const activeStation = filter.trim().toLowerCase();

  // Filtragem de pedidos
  const validPedidos = pedidos.filter(
    (p) =>
      p.status !== 'garcom_pendente' &&
      !p.itens.every((item) => isSystemMarkerItem(item.nome))
  );

  const filteredPedidos = validPedidos.filter((p) => {
    if (activeStation === 'all') return true;
    return p.itens.some((item) => getProductStation(item.nome) === activeStation);
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const pedido = pedidos.find((p) => String(p.id) === active.id);
    if (pedido) setActivePedido(pedido);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const pedidoId = Number(active.id);
      const newStatus = String(over.id);
      const currentPedido = pedidos.find((p) => p.id === pedidoId);

      if (currentPedido && currentPedido.status !== newStatus) {
        setUpdatingId(pedidoId);
        const result = await updatePedidoStatus(pedidoId, newStatus);
        setUpdatingId(null);

        if (result?.error) {
          toast.error('Erro ao atualizar status do pedido');
        } else {
          toast.success(`Pedido #${pedidoId} movido para ${newStatus.toUpperCase()}`);
          // Sincroniza em segundo plano com o Delivery Agent no EasyPanel
          deliveryAgentService.syncOrderStatus(currentPedido, newStatus);
        }
      }
    }

    setActivePedido(null);
  };

  const handleDeliver = async (pedidoId: number) => {
    setUpdatingId(pedidoId);
    const result = await updatePedidoStatus(pedidoId, 'entregue');
    setUpdatingId(null);

    if (result?.error) {
      toast.error('Erro ao marcar como entregue');
    } else {
      toast.success('Pedido entregue com sucesso!');
    }
  };

  const handleDelete = async (pedidoId: number) => {
    if (!confirm(`Deseja realmente excluir o pedido #${pedidoId}?`)) return;
    const result = await deletePedido(pedidoId);
    if (result?.error) {
      toast.error('Erro ao excluir pedido');
    } else {
      toast.success('Pedido excluído com sucesso');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex gap-4 overflow-x-auto p-4 bg-background h-full touch-pan-x scrollbar-thin">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            badgeColor={col.badgeColor}
            accentColor={col.accentColor}
            pedidos={filteredPedidos.filter((p) => {
              const status = (p.status || 'pendente').toLowerCase();
              if (col.id === 'pronto') {
                return status === 'pronto' || status === 'saiu';
              }
              return status === col.id;
            })}
            onDeliver={handleDeliver}
            onDelete={handleDelete}
            onPrint={reprintOrder}
            updatingId={updatingId}
          />
        ))}
      </div>

      <DragOverlay>
        {activePedido ? (
          <div className="w-[320px] pointer-events-none">
            <OrderCard
              pedido={activePedido}
              onDeliver={() => {}}
              onDelete={() => {}}
              onPrint={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
