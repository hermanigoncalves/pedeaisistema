import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { isSystemMarkerItem } from '@/lib/utils';
import { Check, Loader2, ChefHat, Wine, Clock, Flame, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const KdsPage: React.FC = () => {
  const { station } = useParams<{ station: string }>();
  const { pedidos, updatePedidoStatus, products, settings, loadingPedidos } = useApp();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stationNorm = (station || 'cozinha').toLowerCase();
  const stationLabel = stationNorm === 'bar' ? 'Bar' : 'Cozinha';
  const StationIcon = stationNorm === 'bar' ? Wine : ChefHat;

  // Resolve estação de preparo de um produto
  const getProductStation = useCallback((itemName: string) => {
    const nameLower = itemName.trim().toLowerCase();
    if (nameLower.includes('pizza')) return 'cozinha';
    const prod = products.find(p => p.name.trim().toLowerCase() === nameLower);
    const s = prod ? (prod.station || 'cozinha') : 'cozinha';
    const normalized = s.trim().toLowerCase();
    if (normalized === 'kitchen' || normalized === 'cozinha') return 'cozinha';
    return normalized;
  }, [products]);

  // Filtra pedidos pendentes/preparando desta estação
  const stationOrders = pedidos
    .filter(p => {
      const status = p.status?.toLowerCase() || '';
      if (status !== 'pendente' && status !== 'preparando') return false;
      if (p.itens.every(item => isSystemMarkerItem(item.nome))) return false;
      // Pelo menos 1 item pertence a esta estação
      return p.itens.some(item => getProductStation(item.nome) === stationNorm);
    })
    .map(p => ({
      ...p,
      // Só mostra itens desta estação
      itens: p.itens.filter(item => getProductStation(item.nome) === stationNorm),
    }))
    .filter(p => p.itens.length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Som de notificação quando novo pedido chega
  useEffect(() => {
    if (stationOrders.length > prevCountRef.current && soundEnabled && prevCountRef.current > 0) {
      try {
        // Gerar beep via Web Audio API
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        // Segundo beep
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1100;
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 350);
      } catch { /* ignore audio errors */ }
    }
    prevCountRef.current = stationOrders.length;
  }, [stationOrders.length, soundEnabled]);

  // Tempo decorrido em minutos
  const getElapsedMinutes = (createdAt: Date) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const getUrgencyClass = (minutes: number) => {
    if (minutes >= 15) return 'border-red-500 bg-red-500/10 shadow-red-500/20';
    if (minutes >= 8) return 'border-amber-500 bg-amber-500/10 shadow-amber-500/20';
    return 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/10';
  };

  const getUrgencyBadge = (minutes: number) => {
    if (minutes >= 15) return 'bg-red-500 text-white animate-pulse';
    if (minutes >= 8) return 'bg-amber-500 text-white';
    return 'bg-emerald-600 text-white';
  };

  const handleDeliver = async (pedidoId: number) => {
    setUpdatingId(pedidoId);
    const result = await updatePedidoStatus(pedidoId, 'entregue');
    setUpdatingId(null);
    if (result.error) {
      toast.error('Erro ao marcar como entregue');
    } else {
      toast.success('✅ Pedido finalizado!');
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

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (loadingPedidos) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg">Carregando fila de pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Header */}
      <header className="flex-shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stationNorm === 'bar' ? 'bg-purple-600' : 'bg-emerald-600'
          }`}>
            <StationIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              KDS — {stationLabel}
            </h1>
            <p className="text-xs text-zinc-500">
              {settings.restaurantName} • Fila de Produção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Contador */}
          <div className={`px-4 py-2 rounded-xl font-black text-2xl ${
            stationOrders.length > 0
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-zinc-500'
          }`}>
            {stationOrders.length}
          </div>

          {/* Toggle Som */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl transition-colors ${
              soundEnabled
                ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            }`}
            title={soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Relógio */}
          <KdsClock />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto p-4">
        {stationOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <StationIcon className="w-20 h-20 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 text-2xl font-bold">Nenhum pedido pendente</p>
              <p className="text-zinc-600 text-sm mt-2">
                Aguardando novos pedidos da {stationLabel.toLowerCase()}...
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {stationOrders.map((pedido, idx) => {
              const elapsed = getElapsedMinutes(pedido.created_at);
              const isPreparing = pedido.status === 'preparando';

              return (
                <div
                  key={pedido.id}
                  className={`relative rounded-2xl border-2 p-4 flex flex-col justify-between shadow-lg transition-all ${getUrgencyClass(elapsed)} ${
                    isPreparing ? 'ring-2 ring-amber-400/50' : ''
                  }`}
                >
                  {/* Número na fila */}
                  <div className="absolute -top-3 -left-3 bg-white text-zinc-900 text-sm font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-zinc-300 shadow-md">
                    #{idx + 1}
                  </div>

                  {/* Header do card */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-xl text-white">
                        Mesa {pedido.mesa}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getUrgencyBadge(elapsed)}`}>
                        {elapsed}min
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 mb-3">
                      {isPreparing ? (
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                          <Flame className="w-3.5 h-3.5" /> Preparando
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                          <Clock className="w-3.5 h-3.5" /> Pendente
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">{formatTime(pedido.created_at)}</span>
                    </div>

                    {/* Itens */}
                    <div className="space-y-1.5 mb-3">
                      {pedido.itens.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-zinc-800/80 rounded-lg px-3 py-2"
                        >
                          <span className="bg-white text-zinc-900 text-xs font-black w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0">
                            {item.quantidade}x
                          </span>
                          <span className="text-sm font-semibold text-white flex-1">
                            {item.nome}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Observação */}
                    {pedido.descricao && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300 mb-3">
                        📝 {pedido.descricao}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 mt-2">
                    {!isPreparing && (
                      <Button
                        onClick={() => handleStartPreparing(pedido.id)}
                        disabled={updatingId === pedido.id}
                        className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold"
                      >
                        {updatingId === pedido.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Flame className="w-5 h-5 mr-1.5" /> Preparar
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeliver(pedido.id)}
                      disabled={updatingId === pedido.id}
                      className={`${isPreparing ? 'flex-1' : 'flex-1'} h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold`}
                    >
                      {updatingId === pedido.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5 mr-1.5" /> Pronto
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

// Relógio digital no header
const KdsClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-800 px-3 py-1.5 rounded-xl text-lg font-mono font-bold text-zinc-300 tabular-nums">
      {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
};

export default KdsPage;
