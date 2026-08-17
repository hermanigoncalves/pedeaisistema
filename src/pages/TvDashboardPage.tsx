import React, { useState, useEffect, useCallback } from 'react';
import { useApp, Table, Pedido } from '@/contexts/AppContext';
import { isSystemMarkerItem } from '@/lib/utils';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  ChefHat, 
  Wine, 
  Clock, 
  Flame, 
  Check, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  QrCode, 
  HelpCircle, 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  Plus, 
  TrendingUp, 
  MessageSquare,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const TvDashboardPage: React.FC = () => {
  const { 
    tables, 
    pedidos, 
    products, 
    restaurant, 
    settings, 
    updatePedidoStatus, 
    loadingPedidos, 
    loadingData 
  } = useApp();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'orders' | 'kitchen' | 'bar' | 'reports'>('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Relógio digital em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Alternar tela cheia
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Helper para identificar a estação de preparo de cada item
  const getProductStation = useCallback((itemName: string) => {
    const nameLower = itemName.trim().toLowerCase();
    if (nameLower.includes('pizza')) return 'cozinha';
    const prod = products.find(p => p.name.trim().toLowerCase() === nameLower);
    const s = prod ? (prod.station || 'cozinha') : 'cozinha';
    const normalized = s.trim().toLowerCase();
    if (normalized === 'kitchen' || normalized === 'cozinha') return 'cozinha';
    return normalized;
  }, [products]);

  // Pedidos válidos (exclui marcadores de sistema)
  const validPedidos = pedidos.filter(p => 
    !p.itens.every(item => isSystemMarkerItem(item.nome))
  );

  // Fila Cozinha (Pendentes e Preparando)
  const cozinhaOrders = validPedidos
    .filter(p => {
      const status = p.status?.toLowerCase() || '';
      if (status !== 'pendente' && status !== 'preparando') return false;
      return p.itens.some(item => getProductStation(item.nome) === 'cozinha');
    })
    .map(p => ({
      ...p,
      itens: p.itens.filter(item => getProductStation(item.nome) === 'cozinha'),
    }))
    .filter(p => p.itens.length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Fila Bar (Pendentes e Preparando)
  const barOrders = validPedidos
    .filter(p => {
      const status = p.status?.toLowerCase() || '';
      if (status !== 'pendente' && status !== 'preparando') return false;
      return p.itens.some(item => getProductStation(item.nome) === 'bar');
    })
    .map(p => ({
      ...p,
      itens: p.itens.filter(item => getProductStation(item.nome) === 'bar'),
    }))
    .filter(p => p.itens.length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Ações de pedido
  const handleDeliver = async (pedidoId: number) => {
    setUpdatingId(pedidoId);
    const result = await updatePedidoStatus(pedidoId, 'entregue');
    setUpdatingId(null);
    if (result.error) {
      toast.error('Erro ao marcar como entregue');
    } else {
      toast.success('Pedido finalizado!');
    }
  };

  const handleStartPreparing = async (pedidoId: number) => {
    setUpdatingId(pedidoId);
    const result = await updatePedidoStatus(pedidoId, 'preparando');
    setUpdatingId(null);
    if (result.error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const getElapsedMinutes = (createdAt: Date) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  // Contadores de mesas
  const totalMesas = tables.length;
  const mesasOcupadas = tables.filter(t => t.status === 'occupied').length;
  const mesasLivres = totalMesas - mesasOcupadas;

  // Renderizador do ícone de mesa estilizado conforme mockup
  const renderTableCard = (table: Table) => {
    const isOccupied = table.status === 'occupied';
    const isBill = table.alert === 'bill';
    const isWaiter = table.alert === 'waiter';

    let cardBorder = 'border-emerald-700/60 bg-emerald-950/10 text-emerald-800';
    let iconColor = '#047857';
    let statusText = 'Livre';
    let statusTextColor = 'text-emerald-700 font-medium';

    if (isOccupied) {
      if (isBill) {
        cardBorder = 'border-blue-500 bg-blue-500/10 text-blue-800 animate-pulse';
        iconColor = '#2563eb';
        statusText = 'Pedindo Conta';
        statusTextColor = 'text-blue-700 font-bold';
      } else if (isWaiter) {
        cardBorder = 'border-amber-500 bg-amber-500/10 text-amber-800 animate-bounce';
        iconColor = '#d97706';
        statusText = 'Chamando Garçom';
        statusTextColor = 'text-amber-700 font-bold';
      } else {
        cardBorder = 'border-red-400 bg-red-50 text-red-800';
        iconColor = '#dc2626';
        statusText = 'Ocupada';
        statusTextColor = 'text-red-600 font-semibold';
      }
    }

    return (
      <div 
        key={table.id}
        className={`rounded-2xl border-2 p-3 sm:p-4 flex flex-col items-center justify-between transition-all duration-200 shadow-sm min-w-[90px] max-w-[130px] aspect-[4/5] ${cardBorder}`}
      >
        {/* Ícone de Mesa com visual do mockup */}
        <div className="w-12 h-10 flex items-center justify-center my-auto">
          <svg viewBox="0 0 64 48" className="w-full h-full drop-shadow-sm">
            {/* Cadeira Esquerda */}
            <rect x="6" y="10" width="8" height="24" rx="2" fill={iconColor} opacity="0.85" />
            <line x1="10" y1="34" x2="10" y2="44" stroke={iconColor} strokeWidth="3" strokeLinecap="round" />
            {/* Cadeira Direita */}
            <rect x="50" y="10" width="8" height="24" rx="2" fill={iconColor} opacity="0.85" />
            <line x1="54" y1="34" x2="54" y2="44" stroke={iconColor} strokeWidth="3" strokeLinecap="round" />
            {/* Tampo da Mesa */}
            <rect x="12" y="14" width="40" height="10" rx="3" fill={iconColor} />
            {/* Pernas da Mesa */}
            <line x1="20" y1="24" x2="16" y2="44" stroke={iconColor} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="44" y1="24" x2="48" y2="44" stroke={iconColor} strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Número da Mesa */}
        <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
          {table.number}
        </span>

        {/* Status Text */}
        <span className={`text-[11px] sm:text-xs uppercase tracking-wide ${statusTextColor}`}>
          {statusText}
        </span>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f0f4f9] text-slate-800 font-sans overflow-hidden select-none p-3 sm:p-4">
      
      {/* ─────────────────────────────────────────────────────────────
          GRID DE 4 QUADRANTES (100% DA TELA SEM BARRAS)
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-transparent">

        {/* Grid de Conteúdo Principal (2 Linhas x 2 Colunas + Colunas Auxiliares) */}
        <div className="flex-1 p-5 overflow-hidden flex flex-col gap-4 bg-[#f8fafc]">
          
          {/* LINHA SUPERIOR (MESAS + PROMOS/BANNER) */}
          <div className="flex-1 grid grid-cols-12 gap-4 min-h-[44%]">
            
            {/* 1. CARD MESAS (Col 8/12) */}
            <div className="col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <h3 className="text-base font-black text-slate-800">
                      Mesas ({totalMesas})
                    </h3>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    {mesasOcupadas} Ocupada(s) • {mesasLivres} Livre(s)
                  </div>
                </div>

                {/* Grid de Mesas com Scroll Horizontal ou Wrap */}
                <div className="pt-4 flex flex-wrap gap-3 max-h-[calc(100vh-620px)] min-h-[120px] overflow-y-auto pr-1">
                  {tables.length === 0 ? (
                    <div className="w-full text-center py-6 text-slate-400 text-sm">
                      Nenhuma mesa configurada
                    </div>
                  ) : (
                    tables.map(table => renderTableCard(table))
                  )}
                </div>
              </div>

              {/* Legenda inferior */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#047857]"></span>
                  <span className="font-semibold">Mesa Livre</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#dc2626]"></span>
                  <span className="font-semibold">Mesa Ocupada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#d97706]"></span>
                  <span className="font-semibold">Chamando Garçom</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#2563eb]"></span>
                  <span className="font-semibold">Pedindo Conta</span>
                </div>
              </div>
            </div>

            {/* 2. CARD PROMOS / RESUMO EM TEMPO REAL (Col 4/12) */}
            <div className="col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 font-black">📢</span>
                  <h3 className="text-base font-black text-slate-800">
                    Destaques
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Relógio Digital */}
                  <span className="bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-0.5 rounded-full font-mono text-xs font-black text-[#15803d]">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  {/* Som */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1.5 rounded-full border transition-all ${
                      soundEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                    title={soundEnabled ? 'Som Ativo' : 'Som Mudo'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  {/* Fullscreen */}
                  <button 
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
                    title="Alternar Tela Cheia"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Conteúdo Central Promos / QR Code */}
              <div className="flex-1 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/40 my-3 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-700 mb-2">
                  <QrCode className="w-10 h-10" />
                </div>
                <h4 className="font-black text-sm text-emerald-900">
                  Faça seu Pedido pelo WhatsApp
                </h4>
                <p className="text-xs text-slate-500 max-w-[200px] mt-1">
                  Aponte a câmera para o QR Code da mesa e abra sua comanda instantaneamente.
                </p>
              </div>

              <div className="text-[11px] text-center text-slate-400 font-medium">
                PedeAí Digital • Atendimento Inteligente
              </div>
            </div>

          </div>

          {/* LINHA INFERIOR (FILA COZINHA + FILA BAR + SUPORTE WHATSAPP) */}
          <div className="flex-1 grid grid-cols-12 gap-4 min-h-[50%]">
            
            {/* 3. CARD FILA DE PREPARAÇÃO • COZINHA (Col 5/12) */}
            <div className="col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#065f46]"></span>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">
                    Fila de Preparação • Cozinha
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                  {cozinhaOrders.length}
                </span>
              </div>

              {/* Lista de Pedidos Cozinha */}
              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
                {cozinhaOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                    Nenhum pedido pendente
                  </div>
                ) : (
                  cozinhaOrders.map((pedido, idx) => {
                    const elapsed = getElapsedMinutes(pedido.created_at);
                    const isPrep = pedido.status === 'preparando';
                    return (
                      <div 
                        key={pedido.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 transition-all ${
                          isPrep ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-slate-900">
                              Mesa {pedido.mesa}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              elapsed >= 15 ? 'bg-red-500 text-white' : elapsed >= 8 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {elapsed}m
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 space-y-0.5">
                            {pedido.itens.map((it, i) => (
                              <div key={i} className="font-semibold truncate">
                                {it.quantidade}x {it.nome}
                              </div>
                            ))}
                          </div>
                          {pedido.descricao && (
                            <div className="text-[11px] text-amber-700 italic mt-1 truncate">
                              Obs: {pedido.descricao}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {!isPrep && (
                            <button
                              onClick={() => handleStartPreparing(pedido.id)}
                              disabled={updatingId === pedido.id}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all"
                            >
                              Fazer
                            </button>
                          )}
                          <button
                            onClick={() => handleDeliver(pedido.id)}
                            disabled={updatingId === pedido.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                          >
                            Pronto
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. CARD FILA DE PREPARAÇÃO • BAR (Col 5/12) */}
            <div className="col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#065f46]"></span>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">
                    Fila de Preparação • Bar
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-xs">
                  {barOrders.length}
                </span>
              </div>

              {/* Lista de Pedidos Bar */}
              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
                {barOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                    Nenhum pedido pendente
                  </div>
                ) : (
                  barOrders.map((pedido, idx) => {
                    const elapsed = getElapsedMinutes(pedido.created_at);
                    const isPrep = pedido.status === 'preparando';
                    return (
                      <div 
                        key={pedido.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 transition-all ${
                          isPrep ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-slate-900">
                              Mesa {pedido.mesa}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              elapsed >= 15 ? 'bg-red-500 text-white' : elapsed >= 8 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {elapsed}m
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 space-y-0.5">
                            {pedido.itens.map((it, i) => (
                              <div key={i} className="font-semibold truncate">
                                {it.quantidade}x {it.nome}
                              </div>
                            ))}
                          </div>
                          {pedido.descricao && (
                            <div className="text-[11px] text-amber-700 italic mt-1 truncate">
                              Obs: {pedido.descricao}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {!isPrep && (
                            <button
                              onClick={() => handleStartPreparing(pedido.id)}
                              disabled={updatingId === pedido.id}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all"
                            >
                              Fazer
                            </button>
                          )}
                          <button
                            onClick={() => handleDeliver(pedido.id)}
                            disabled={updatingId === pedido.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                          >
                            Pronto
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 5. CARD SUPORTE WHATSAPP (Col 2/12) */}
            <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between items-center text-center">
              <h3 className="text-xs font-black text-slate-800 leading-tight">
                Suporte<br/>WhatsApp
              </h3>

              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center my-auto shadow-inner">
                <MessageSquare className="w-8 h-8 text-emerald-600 animate-pulse" />
              </div>

              <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Online</span>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

export default TvDashboardPage;
