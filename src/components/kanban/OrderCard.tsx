import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, Printer, Check, Trash2, Phone, AlertCircle, ChefHat, Bike, CheckCircle2, Bot } from 'lucide-react';
import { ParsedPedido } from '@/hooks/usePedidos';
import { Button } from '@/components/ui/button';
import { dispatchToDeliveryAgent } from '@/services/deliveryAdminService';
import { toast } from 'sonner';

interface OrderCardProps {
  pedido: ParsedPedido;
  onDeliver: (id: number) => void;
  onDelete: (id: number) => void;
  onPrint: (id: string) => void;
  isUpdating?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  pedido,
  onDeliver,
  onDelete,
  onPrint,
  isUpdating = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(pedido.id),
    data: { pedido },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const [elapsed, setElapsed] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(pedido.created_at).getTime();
      const now = new Date().getTime();
      const diffMins = Math.floor((now - start) / 60000);

      if (diffMins < 1) setElapsed('Agora mesmo');
      else if (diffMins < 60) setElapsed(`${diffMins} min atrás`);
      else setElapsed(`${Math.floor(diffMins / 60)}h ${diffMins % 60}m atrás`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [pedido.created_at]);

  const handleDispatchAgent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDispatching(true);
    const res = await dispatchToDeliveryAgent(pedido);
    setIsDispatching(false);
    toast.success(res.message);
  };

  const getStatusBadge = () => {
    switch (pedido.status) {
      case 'pendente':
        return <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle size={10} /> Pendente</span>;
      case 'preparando':
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><ChefHat size={10} /> Preparando</span>;
      case 'pronto':
      case 'saiu':
        return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Bike size={10} /> Em Rota</span>;
      case 'entregue':
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Entregue</span>;
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        group relative bg-card border border-border/80 rounded-xl shadow-sm cursor-grab active:cursor-grabbing 
        hover:border-primary/50 transition-all overflow-hidden flex flex-col justify-between select-none
        ${isDragging ? 'opacity-90 rotate-2 scale-105 z-50 ring-2 ring-primary shadow-xl bg-card' : ''}
      `}
    >
      {/* Header do Ticket */}
      <div className="flex justify-between items-center bg-muted/40 px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-black text-primary">#{pedido.id}</span>
          <span className="text-xs font-bold text-foreground bg-background/80 px-2 py-0.5 rounded border border-border">
            Mesa {pedido.mesa || 'Delivery'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <Clock size={11} />
          {elapsed}
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="p-3 space-y-2.5">
        {/* Telefone/Cliente se houver */}
        {pedido.usuario_telefone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Phone size={11} className="text-primary" />
            <span>{pedido.usuario_telefone}</span>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="space-y-1 my-1.5">
          {pedido.itens.slice(0, 4).map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs items-center">
              <span className="text-foreground leading-snug font-medium truncate pr-2">
                <span className="font-black text-primary mr-1.5 font-mono">{item.quantidade}x</span>
                {item.nome}
              </span>
              <span className="text-muted-foreground font-mono text-[11px] flex-shrink-0">
                R$ {(item.preco * item.quantidade).toFixed(2)}
              </span>
            </div>
          ))}
          {pedido.itens.length > 4 && (
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-t border-dashed border-border pt-1">
              + {pedido.itens.length - 4} outros itens...
            </p>
          )}
        </div>

        {/* Observações */}
        {pedido.descricao && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold">Obs:</span> {pedido.descricao}
          </div>
        )}

        {/* Rodapé com Total e Status */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div>{getStatusBadge()}</div>
          <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
            R$ {pedido.total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Botões de Ação Rápida */}
      <div className="flex flex-col border-t border-border/60 bg-muted/20">
        {/* Botão de Chamar Agente de Delivery do EasyPanel */}
        {pedido.status !== 'entregue' && (
          <button
            onClick={handleDispatchAgent}
            disabled={isDispatching}
            className="w-full py-1.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border-b border-border/40"
          >
            <Bot size={13} className={isDispatching ? 'animate-bounce' : ''} />
            {isDispatching ? 'Enviando ao Agente...' : 'Chamar Agente Delivery'}
          </button>
        )}

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPrint(pedido.id.toString());
            }}
            className="flex-1 h-8 text-[11px] font-semibold text-muted-foreground hover:text-info hover:bg-info/10 rounded-none border-r border-border/60"
            title="Reimprimir Pedido"
          >
            <Printer size={12} className="mr-1.5" /> Impressão
          </Button>

          {pedido.status !== 'entregue' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeliver(pedido.id);
              }}
              disabled={isUpdating}
              className="flex-1 h-8 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-none border-r border-border/60"
              title="Concluir / Entregue"
            >
              <Check size={12} className="mr-1.5 text-emerald-500" /> Concluir
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(pedido.id);
            }}
            className="h-8 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-none"
            title="Excluir Pedido"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
};
