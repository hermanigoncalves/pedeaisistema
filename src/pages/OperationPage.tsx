import React, { useState } from 'react';
import TableGrid from '@/components/dashboard/TableGrid';
import OrderQueue from '@/components/dashboard/OrderQueue';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { isSystemMarkerItem } from '@/lib/utils';
import { LayoutGrid, Kanban as KanbanIcon } from 'lucide-react';

const OperationPage: React.FC = () => {
  const { filter, setFilter, estacoes, tables, products, pedidos, restaurant } = useApp();
  const [activeTab, setActiveTab] = useState<'mesas' | 'kanban'>('mesas');

  const isDeliveryEnabled = restaurant?.delivery_habilitado !== false;
  const currentTab = isDeliveryEnabled ? activeTab : 'mesas';

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

  const isKdsMode = filter !== 'all';
  const activePedidosCount = pedidos.filter(
    (p) =>
      p.status !== 'garcom_pendente' &&
      !p.itens.every((i) => isSystemMarkerItem(i.nome))
  ).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full bg-background">
      {/* Barra Superior de Título, Abas e Filtro de Estações */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card shadow-sm">
        {/* Abas de Navegação: Mesas vs Kanban Delivery */}
        <div className="flex items-center gap-2">
          {isDeliveryEnabled ? (
            <div className="inline-flex items-center p-1 bg-muted rounded-xl border border-border">
              <button
                onClick={() => setActiveTab('mesas')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'mesas'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid size={15} className={currentTab === 'mesas' ? 'text-primary' : ''} />
                <span>Mesas ({tables.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('kanban')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'kanban'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <KanbanIcon size={15} className={currentTab === 'kanban' ? 'text-primary' : ''} />
                <span>Delivery</span>
                {activePedidosCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
                    {activePedidosCount}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              {isKdsMode
                ? `Fila de Preparação • ${filter.charAt(0).toUpperCase() + filter.slice(1)}`
                : `Mesas (${tables.length})`}
            </h2>
          )}
        </div>

        {/* Barra de Filtros Dinâmicos por Estação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-full px-4 text-xs font-semibold transition-all hover:scale-105"
          >
            Ver Todas
          </Button>

          {estacoes.map((est) => {
            const estValue = est.nome.trim().toLowerCase();
            const isActive = filter === estValue;

            const ordersCount = pedidos.filter((p) => {
              if (p.status !== 'pendente' && p.status !== 'preparando') return false;
              if (p.status === 'garcom_pendente') return false;
              if (p.itens.every((item) => isSystemMarkerItem(item.nome))) return false;

              return p.itens.some((item) => getProductStation(item.nome) === estValue);
            }).length;

            return (
              <Button
                key={est.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(estValue)}
                className="rounded-full px-4 text-xs font-semibold gap-1.5 transition-all hover:scale-105"
              >
                {est.nome}
                {ordersCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-primary-foreground text-primary font-bold'
                        : 'bg-primary text-primary-foreground font-bold'
                    }`}
                  >
                    {ordersCount}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex overflow-hidden w-full">
        {currentTab === 'kanban' ? (
          <div className="flex-1 overflow-hidden w-full h-full">
            <KanbanBoard />
          </div>
        ) : !isKdsMode ? (
          <>
            <div className="flex-1 min-w-0" data-tour="mesas">
              <TableGrid showTitleAndFilters={false} />
            </div>
            <div className="w-[320px] flex-shrink-0 lg:w-[380px] border-l border-border/50 bg-secondary/5" data-tour="pedidos">
              <OrderQueue />
            </div>
          </>
        ) : (
          <div className="flex-1 bg-secondary/5 overflow-y-auto" data-tour="pedidos">
            <OrderQueue kdsMode={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationPage;
