import { useState } from 'react';
import { Bell, Receipt } from 'lucide-react';
import { useApp, Table } from '@/contexts/AppContext';
import TableDetailModal from './TableDetailModal';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TableGridProps {
  showTitleAndFilters?: boolean;
}

const TableIcon = ({ number, status, alert }: { number: number; status: string; alert?: string | null }) => {
  // Cores dinâmicas para o tampo da mesa e assento das cadeiras baseadas no status
  let tableFill = "#10b981"; // Livre: verde esmeralda
  let seatFill = "#34d399";  // assentos verde claro
  let strokeColor = "#ffffff";

  if (status === 'occupied') {
    if (alert === 'bill') {
      tableFill = "#3b82f6"; // Pedido de conta: azul
      seatFill = "#60a5fa";
    } else {
      tableFill = "#ef4444"; // Ocupada: vermelho
      seatFill = "#f87171";
    }
  }

  if (alert === 'waiter') {
    tableFill = "#f59e0b"; // Chamar garçom: amarelo
    seatFill = "#fbbf24";
  }

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full max-w-[75px] drop-shadow-md select-none transition-all duration-300">
      {/* Sombreamento sutil sob as cadeiras e pernas */}
      <ellipse cx="60" cy="92" rx="30" ry="8" fill="rgba(0, 0, 0, 0.08)" />
      
      {/* Pernas da mesa */}
      <line x1="50" y1="75" x2="44" y2="95" stroke="#374151" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="60" y1="75" x2="60" y2="98" stroke="#1f2937" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="70" y1="75" x2="76" y2="95" stroke="#374151" strokeWidth="4.5" strokeLinecap="round" />

      {/* Cadeira Superior Esquerda (atrás) */}
      <g>
        {/* Pernas */}
        <line x1="45" y1="35" x2="42" y2="20" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="53" y1="35" x2="55" y2="20" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
        {/* Encosto e Assento */}
        <rect x="42" y="22" width="16" height="15" rx="4" fill="#374151" />
        <rect x="45" y="25" width="10" height="9" rx="2" fill={seatFill} />
      </g>

      {/* Cadeira Superior Direita (atrás) */}
      <g>
        {/* Pernas */}
        <line x1="67" y1="35" x2="65" y2="20" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="35" x2="78" y2="20" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
        {/* Encosto e Assento */}
        <rect x="62" y="22" width="16" height="15" rx="4" fill="#374151" />
        <rect x="65" y="25" width="10" height="9" rx="2" fill={seatFill} />
      </g>

      {/* Tampo da Mesa Redonda */}
      <ellipse cx="60" cy="58" rx="35" ry="25" fill={tableFill} stroke={strokeColor} strokeWidth="2.5" />

      {/* Prato centralizado na mesa (Aumentado para acomodar número maior) */}
      <ellipse cx="60" cy="58" rx="18" ry="13" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1" />
      <ellipse cx="60" cy="58" rx="14" ry="10" fill="none" stroke="#f3f4f6" strokeWidth="1" />
      
      {/* Garfo e Faca ao lado do prato (Reposicionados para fora do prato maior) */}
      {/* Faca à direita */}
      <path d="M 85 52 C 85 50 87 50 87 52 L 87 62 L 85 62 Z" fill="#ffffff" opacity="0.9" />
      <line x1="86" y1="60" x2="86" y2="65" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      {/* Garfo à esquerda */}
      <path d="M 31 52 L 31 56 M 33 52 L 33 56 M 35 52 L 35 56" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
      <path d="M 31 56 L 35 56 L 33 56 L 33 64" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />

      {/* Cadeira Inferior Esquerda (frente) */}
      <g>
        {/* Pernas */}
        <line x1="30" y1="78" x2="26" y2="98" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
        <line x1="40" y1="78" x2="43" y2="98" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
        {/* Encosto e Assento */}
        <path d="M 23 62 C 23 52, 37 52, 37 62 L 37 76 C 37 78, 23 78, 23 76 Z" fill="#1f2937" />
        <path d="M 26 64 C 26 57, 34 57, 34 64 L 34 74 C 34 76, 26 76, 26 74 Z" fill={seatFill} />
      </g>

      {/* Cadeira Inferior Direita (frente) */}
      <g>
        {/* Pernas */}
        <line x1="80" y1="78" x2="77" y2="98" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
        <line x1="90" y1="78" x2="94" y2="98" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
        {/* Encosto e Assento */}
        <path d="M 83 62 C 83 52, 97 52, 97 62 L 97 76 C 97 78, 83 78, 83 76 Z" fill="#1f2937" />
        <path d="M 86 64 C 86 57, 94 57, 94 64 L 94 74 C 94 76, 86 76, 86 74 Z" fill={seatFill} />
      </g>

      {/* Número da Mesa impresso no prato (Aumentado de fontSize 12 para 17) */}
      <text x="60" y="63" textAnchor="middle" fontSize="17" fontWeight="900" fill="#1f2937" fontFamily="sans-serif">
        {number}
      </text>
    </svg>
  );
};

const TableGrid: React.FC<TableGridProps> = ({ showTitleAndFilters = true }) => {
  const { tables, settings, filter, setFilter, orders, closeTable, closeComanda, requestBill, pedidos, estacoes } = useApp();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmPaidTableId, setConfirmPaidTableId] = useState<number | null>(null);

  const getTableOrders = (tableId: number) => {
    return orders.filter(o => o.tableId === tableId);
  };



  const filteredTables = tables.filter(table => {
    if (filter === 'all') return true;
    const tableOrders = getTableOrders(table.id);
    return tableOrders.some(o => o.station.trim().toLowerCase() === filter.trim().toLowerCase());
  });

  const getAlertClass = (table: Table) => {
    if (!settings.flashingEnabled || !table.alert) return '';
    if (table.alert === 'waiter') return 'animate-flash-yellow';
    if (table.alert === 'bill') return 'animate-flash-blue';
    return '';
  };

  const legendItems = [
    { color: 'bg-free', borderColor: 'border-free', label: 'Mesa Livre' },
    { color: 'bg-occupied', borderColor: 'border-occupied', label: 'Mesa Ocupada' },
    { color: 'bg-warning/50', borderColor: 'border-warning', label: 'Chamar Garçom', icon: Bell },
    { color: 'bg-info/50', borderColor: 'border-info', label: 'Pedir Conta', icon: Receipt },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto">
        {showTitleAndFilters && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Mesas ({tables.length})
            </h2>
            
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
                
                // Conta quantos pedidos ativos existem nessa estação
                const ordersCount = orders.filter(o => o.station.trim().toLowerCase() === estValue).length;
                
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-primary-foreground text-primary font-bold' : 'bg-primary text-primary-foreground font-bold'
                      }`}>
                        {ordersCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Responsive Grid - Optimized for tables */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 touch-pan-y">
          {filteredTables.map((table) => (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`
                relative p-2 rounded-xl bg-card border border-border/60 transition-all duration-200 
                hover:shadow-md hover:scale-[1.03] active:scale-[0.97]
                touch-manipulation select-none
                flex flex-col items-center justify-center gap-1.5
                min-h-[110px] sm:min-h-[120px]
                ${table.status === 'occupied'
                  ? table.alert === 'bill' ? 'border-info bg-info/5' : 'border-occupied bg-occupied/5'
                  : 'border-free bg-free/5'}
                ${getAlertClass(table)}
              `}
            >
              {/* Alert Icons */}
              {table.alert && (
                <div className="absolute top-2 right-2 z-10">
                  {table.alert === 'waiter' && (
                    <div className="bg-warning/20 p-1 rounded-full">
                      <Bell className="w-3.5 h-3.5 text-warning animate-pulse" />
                    </div>
                  )}
                  {table.alert === 'bill' && (
                    <div className="bg-info/20 p-1 rounded-full">
                      <Receipt className="w-3.5 h-3.5 text-info animate-pulse" />
                    </div>
                  )}
                </div>
              )}

              {/* Mesa Gráfica SVG */}
              <div className="w-full flex justify-center items-center py-1">
                <TableIcon number={table.id} status={table.status} alert={table.alert} />
              </div>

              {/* Status Text */}
              <p className={`text-[10px] sm:text-xs font-semibold ${table.status === 'occupied' ? 'text-occupied' : 'text-free'}`}>
                {table.status === 'occupied' ? 'Ocupada' : 'Livre'}
              </p>

              {/* Quick action: Conta paga (only when bill was requested) */}
              {table.alert === 'bill' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmPaidTableId(table.id);
                  }}
                  className="absolute bottom-2 right-2 z-20 rounded-md bg-secondary border border-border px-2 py-0.5 text-[9px] sm:text-xs text-foreground hover:bg-secondary/80 font-medium"
                >
                  Conta paga
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Fixed Legend Footer */}
      <div className="flex-shrink-0 bg-card border-t border-border px-4 py-3">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {legendItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md border-2 ${item.borderColor} ${item.color} flex items-center justify-center shadow-sm`}>
                {item.icon && <item.icon className="w-3 h-3" />}
              </div>
              <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
            </div>
          ))}

        </div>
      </div>

      {selectedTable && (
        <TableDetailModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}

      {/* Confirmação: conta paga (na aba Operação) */}
      <AlertDialog
        open={confirmPaidTableId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPaidTableId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {settings.billingMode === 'comanda'
                ? 'Fechar comanda(s) com conta pendente?'
                : 'Conta foi paga?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {settings.billingMode === 'comanda'
                ? 'Apenas as comandas que pediram a conta serão fechadas. As demais continuarão ativas.'
                : 'Confirmando, a mesa será liberada e os pedidos dessa mesa serão removidos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmPaidTableId) {
                  await closeTable(confirmPaidTableId);
                }
                setConfirmPaidTableId(null);
              }}
            >
              {settings.billingMode === 'comanda' ? 'Sim, fechar comanda(s)' : 'Sim, liberar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TableGrid;
