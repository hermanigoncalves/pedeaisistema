import React, { useState, useEffect, useCallback } from 'react';
import PropagandaCarousel from '@/components/dashboard/PropagandaCarousel';
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

  // Componente SVG idêntico ao TableIcon do sistema principal (Otimizado para Dark Mode)
  const renderTableIcon = (number: number, status: string, alert?: string | null) => {
    let tableFill = "#10b981"; // Livre: verde esmeralda
    let seatFill = "#059669";  // assentos
    let strokeColor = "#34d399";

    if (status === 'occupied') {
      if (alert === 'bill') {
        tableFill = "#2563eb"; // Pedido de conta: azul
        seatFill = "#1d4ed8";
        strokeColor = "#60a5fa";
      } else {
        tableFill = "#dc2626"; // Ocupada: vermelho
        seatFill = "#b91c1c";
        strokeColor = "#f87171";
      }
    }

    if (alert === 'waiter') {
      tableFill = "#d97706"; // Chamar garçom: âmbar
      seatFill = "#b45309";
      strokeColor = "#fbbf24";
    }

    return (
      <svg viewBox="0 0 120 120" className="w-full h-full max-w-[70px] drop-shadow-md select-none transition-all duration-300">
        <ellipse cx="60" cy="92" rx="30" ry="8" fill="rgba(0, 0, 0, 0.4)" />
        <line x1="50" y1="75" x2="44" y2="95" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="60" y1="75" x2="60" y2="98" stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="70" y1="75" x2="76" y2="95" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />
        <g>
          <line x1="45" y1="35" x2="42" y2="20" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="53" y1="35" x2="55" y2="20" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="42" y="22" width="16" height="15" rx="4" fill="#1e293b" />
          <rect x="45" y="25" width="10" height="9" rx="2" fill={seatFill} />
        </g>
        <g>
          <line x1="67" y1="35" x2="65" y2="20" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="75" y1="35" x2="78" y2="20" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="62" y="22" width="16" height="15" rx="4" fill="#1e293b" />
          <rect x="65" y="25" width="10" height="9" rx="2" fill={seatFill} />
        </g>
        <ellipse cx="60" cy="58" rx="35" ry="25" fill={tableFill} stroke={strokeColor} strokeWidth="2" />
        <ellipse cx="60" cy="58" rx="18" ry="13" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        <ellipse cx="60" cy="58" rx="14" ry="10" fill="none" stroke="#1e293b" strokeWidth="1" />
        <path d="M 85 52 C 85 50 87 50 87 52 L 87 62 L 85 62 Z" fill="#ffffff" opacity="0.9" />
        <line x1="86" y1="60" x2="86" y2="65" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M 31 52 L 31 56 M 33 52 L 33 56 M 35 52 L 35 56" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
        <path d="M 31 56 L 35 56 L 33 56 L 33 64" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <g>
          <line x1="30" y1="78" x2="26" y2="98" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <line x1="40" y1="78" x2="43" y2="98" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <path d="M 23 62 C 23 52, 37 52, 37 62 L 37 76 C 37 78, 23 78, 23 76 Z" fill="#1e293b" />
          <path d="M 26 64 C 26 57, 34 57, 34 64 L 34 74 C 34 76, 26 76, 26 74 Z" fill={seatFill} />
        </g>
        <g>
          <line x1="80" y1="78" x2="77" y2="98" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <line x1="90" y1="78" x2="94" y2="98" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <path d="M 83 62 C 83 52, 97 52, 97 62 L 97 76 C 97 78, 83 78, 83 76 Z" fill="#1e293b" />
          <path d="M 86 64 C 86 57, 94 57, 94 64 L 94 74 C 94 76, 86 76, 86 74 Z" fill={seatFill} />
        </g>
        <text x="60" y="63" textAnchor="middle" fontSize="17" fontWeight="900" fill="#ffffff" fontFamily="sans-serif">
          {number}
        </text>
      </svg>
    );
  };

  // Renderizador do card de mesa no estilo Dark Mode
  const renderTableCard = (table: Table) => {
    const isOccupied = table.status === 'occupied';
    const isBill = table.alert === 'bill';
    const isWaiter = table.alert === 'waiter';

    let cardBgClass = 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/50';
    let statusLabel = 'Livre';
    let statusColor = 'text-emerald-400';

    if (isOccupied) {
      if (isBill) {
        cardBgClass = 'bg-blue-950/40 border-blue-500/60 text-blue-300 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.2)]';
        statusLabel = 'Conta';
        statusColor = 'text-blue-400 font-bold';
      } else if (isWaiter) {
        cardBgClass = 'bg-amber-950/40 border-amber-500/60 text-amber-300 animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.2)]';
        statusLabel = 'Garçom';
        statusColor = 'text-amber-400 font-bold';
      } else {
        cardBgClass = 'bg-red-950/30 border-red-500/40 text-red-300 hover:border-red-500/60';
        statusLabel = 'Ocupada';
        statusColor = 'text-red-400 font-bold';
      }
    }

    return (
      <div 
        key={table.id}
        className={`rounded-2xl border p-2.5 flex flex-col items-center justify-between transition-all duration-200 shadow-sm min-w-[95px] max-w-[125px] aspect-[4/4.5] backdrop-blur-sm ${cardBgClass}`}
      >
        <div className="w-full flex justify-center items-center py-1">
          {renderTableIcon(table.number || table.id, table.status, table.alert)}
        </div>

        <span className={`text-[11px] sm:text-xs font-bold tracking-wide capitalize ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070b14] text-slate-100 font-sans overflow-hidden select-none p-3 sm:p-4">
      
      {/* ─────────────────────────────────────────────────────────────
          GRID DE 4 QUADRANTES (MODO NOTURNO / DARK MODE PREMIUM)
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-transparent">

        {/* Grid de Conteúdo Principal (2 Linhas x 2 Colunas + Colunas Auxiliares) */}
        <div className="flex-1 p-4 sm:p-5 overflow-hidden flex flex-col gap-4 bg-[#0a0f1d] rounded-3xl border border-slate-800/80 shadow-2xl">
          
          {/* LINHA SUPERIOR (MESAS + PROMOS/BANNER) */}
          <div className="flex-1 grid grid-cols-12 gap-4 min-h-[44%]">
            
            {/* 1. CARD MESAS (Col 8/12) */}
            <div className="col-span-8 bg-[#111827]/90 rounded-2xl border border-slate-800 shadow-lg p-4 flex flex-col justify-between overflow-hidden backdrop-blur-md">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    <h3 className="text-base font-black text-white tracking-wide">
                      Mesas ({totalMesas})
                    </h3>
                  </div>
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                    <span className="text-red-400 font-bold">{mesasOcupadas} Ocupada(s)</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{mesasLivres} Livre(s)</span>
                  </div>
                </div>

                {/* Grid de Mesas com Scroll */}
                <div className="pt-4 flex flex-wrap gap-3 max-h-[calc(100vh-620px)] min-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                  {tables.length === 0 ? (
                    <div className="w-full text-center py-6 text-slate-500 text-sm">
                      Nenhuma mesa configurada
                    </div>
                  ) : (
                    tables.map(table => renderTableCard(table))
                  )}
                </div>
              </div>

              {/* Legenda inferior */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center gap-6 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                  <span className="font-semibold">Mesa Livre</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
                  <span className="font-semibold">Mesa Ocupada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
                  <span className="font-semibold">Chamando Garçom</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]"></span>
                  <span className="font-semibold">Pedindo Conta</span>
                </div>
              </div>
            </div>

            {/* 2. CARD PROMOS / RESUMO EM TEMPO REAL (Col 4/12) */}
            <div className="col-span-4 bg-[#111827]/90 rounded-2xl border border-slate-800 shadow-lg p-4 flex flex-col justify-between overflow-hidden min-h-0 max-h-full backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black text-sm">📢</span>
                  <h3 className="text-base font-black text-white tracking-wide">
                    Destaques
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Relógio Digital */}
                  <span className="bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-0.5 rounded-full font-mono text-xs font-black text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  {/* Som */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1.5 rounded-full border transition-all ${
                      soundEnabled 
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                    title={soundEnabled ? 'Som Ativo' : 'Som Mudo'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  {/* Fullscreen */}
                  <button 
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                    title="Alternar Tela Cheia"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Conteúdo Central: Vídeos e Imagens de Propaganda em Loop */}
              <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center">
                <PropagandaCarousel 
                  soundEnabled={soundEnabled} 
                  onToggleSound={() => setSoundEnabled(true)} 
                />
              </div>

              <div className="text-[11px] text-center text-slate-500 font-medium pt-1 flex-shrink-0">
                PedeAí Digital • Atendimento Inteligente
              </div>
            </div>

          </div>

          {/* LINHA INFERIOR (FILA COZINHA + FILA BAR + SUPORTE WHATSAPP) */}
          <div className="flex-1 grid grid-cols-12 gap-4 min-h-[50%]">
            
            {/* 3. CARD FILA DE PREPARAÇÃO • COZINHA (Col 5/12) */}
            <div className="col-span-5 bg-[#111827]/90 rounded-2xl border border-slate-800 shadow-lg p-4 flex flex-col backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                  <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                    Fila de Preparação • Cozinha
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                  {cozinhaOrders.length}
                </span>
              </div>

              {/* Lista de Pedidos Cozinha */}
              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1 custom-scrollbar">
                {cozinhaOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium">
                    Nenhum pedido pendente
                  </div>
                ) : (
                  cozinhaOrders.map((pedido) => {
                    const elapsed = getElapsedMinutes(pedido.created_at);
                    const isPrep = pedido.status === 'preparando';
                    return (
                      <div 
                        key={pedido.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 transition-all ${
                          isPrep 
                            ? 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                            : 'bg-slate-900/80 border-slate-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-white">
                              Mesa {pedido.mesa}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              elapsed >= 15 ? 'bg-red-500 text-white' : elapsed >= 8 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {elapsed}m
                            </span>
                          </div>
                          <div className="text-xs text-slate-200 space-y-0.5">
                            {pedido.itens.map((it, i) => (
                              <div key={i} className="font-semibold truncate">
                                {it.quantidade}x {it.nome}
                              </div>
                            ))}
                          </div>
                          {pedido.descricao && (
                            <div className="text-[11px] text-amber-400 italic mt-1 truncate">
                              Obs: {pedido.descricao}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {!isPrep && (
                            <button
                              onClick={() => handleStartPreparing(pedido.id)}
                              disabled={updatingId === pedido.id}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm"
                            >
                              Fazer
                            </button>
                          )}
                          <button
                            onClick={() => handleDeliver(pedido.id)}
                            disabled={updatingId === pedido.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
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
            <div className="col-span-5 bg-[#111827]/90 rounded-2xl border border-slate-800 shadow-lg p-4 flex flex-col backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#06b6d4]"></span>
                  <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                    Fila de Preparação • Bar
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold text-xs">
                  {barOrders.length}
                </span>
              </div>

              {/* Lista de Pedidos Bar */}
              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1 custom-scrollbar">
                {barOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium">
                    Nenhum pedido pendente
                  </div>
                ) : (
                  barOrders.map((pedido) => {
                    const elapsed = getElapsedMinutes(pedido.created_at);
                    const isPrep = pedido.status === 'preparando';
                    return (
                      <div 
                        key={pedido.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 transition-all ${
                          isPrep 
                            ? 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                            : 'bg-slate-900/80 border-slate-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-white">
                              Mesa {pedido.mesa}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              elapsed >= 15 ? 'bg-red-500 text-white' : elapsed >= 8 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {elapsed}m
                            </span>
                          </div>
                          <div className="text-xs text-slate-200 space-y-0.5">
                            {pedido.itens.map((it, i) => (
                              <div key={i} className="font-semibold truncate">
                                {it.quantidade}x {it.nome}
                              </div>
                            ))}
                          </div>
                          {pedido.descricao && (
                            <div className="text-[11px] text-amber-400 italic mt-1 truncate">
                              Obs: {pedido.descricao}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {!isPrep && (
                            <button
                              onClick={() => handleStartPreparing(pedido.id)}
                              disabled={updatingId === pedido.id}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm"
                            >
                              Fazer
                            </button>
                          )}
                          <button
                            onClick={() => handleDeliver(pedido.id)}
                            disabled={updatingId === pedido.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
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

            {/* 5. CARD SUPORTE WHATSAPP COM QR CODE (Col 2/12) */}
            <div className="col-span-2 bg-[#111827]/90 rounded-2xl border border-slate-800 shadow-lg p-3 sm:p-4 flex flex-col justify-between items-center text-center backdrop-blur-md">
              <div>
                <h3 className="text-xs font-black text-white leading-tight tracking-wide">
                  Suporte WhatsApp
                </h3>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  Escaneie o QR Code
                </span>
              </div>

              {/* QR Code Container com alto contraste para leitura rápida em tela */}
              <div className="p-2 bg-white rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.25)] border-2 border-emerald-500/60 my-auto flex flex-col items-center justify-center transition-all duration-300">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('https://wa.me/5533988123747')}&bgcolor=ffffff&color=000000&margin=2`}
                  alt="QR Code WhatsApp Suporte"
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg select-none"
                  loading="eager"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-mono font-bold text-slate-200 block tracking-tight">
                  (33) 98812-3747
                </span>
                <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Online</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

export default TvDashboardPage;
