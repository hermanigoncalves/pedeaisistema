import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ParsedPedido } from '@/hooks/usePedidos';
import { OrderCard } from './OrderCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  badgeColor: string;
  accentColor: string;
  pedidos: ParsedPedido[];
  onDeliver: (id: number) => void;
  onDelete: (id: number) => void;
  onPrint: (id: string) => void;
  updatingId?: number | null;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  badgeColor,
  accentColor,
  pedidos,
  onDeliver,
  onDelete,
  onPrint,
  updatingId,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const columnTotal = pedidos.reduce((sum, p) => sum + p.total, 0);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col h-full min-w-[290px] sm:min-w-[320px] w-[320px] flex-shrink-0 
        bg-secondary/30 rounded-2xl border transition-colors overflow-hidden
        ${isOver ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/60'}
      `}
    >
      {/* Header da Coluna */}
      <div className={`p-3.5 border-b border-border/60 bg-card flex items-center justify-between border-t-4 ${accentColor}`}>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm uppercase tracking-wide text-foreground">{title}</h3>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {pedidos.length.toString().padStart(2, '0')}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-muted-foreground">
          R$ {columnTotal.toFixed(2)}
        </span>
      </div>

      {/* Área Droppable de Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
        {pedidos.map((pedido) => (
          <OrderCard
            key={pedido.id}
            pedido={pedido}
            onDeliver={onDeliver}
            onDelete={onDelete}
            onPrint={onPrint}
            isUpdating={updatingId === pedido.id}
          />
        ))}

        {pedidos.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border/80 rounded-xl bg-background/50 uppercase tracking-widest text-center p-4">
            <span className="font-semibold text-muted-foreground/70">Sem pedidos nesta etapa</span>
            <span className="text-[10px] text-muted-foreground/40 mt-1">Arraste um pedido para cá</span>
          </div>
        )}
      </div>
    </div>
  );
};
