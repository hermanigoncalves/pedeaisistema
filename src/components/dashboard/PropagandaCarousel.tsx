import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Play, Pause, SkipForward, Film, Image as ImageIcon } from 'lucide-react';

export interface MediaItem {
  id: string;
  type: 'video' | 'image';
  src: string;
  title?: string;
  durationSeconds?: number; // Para imagens (padrão: 8 segundos)
}

// Lista padrão de mídias da pasta /propaganda/
const DEFAULT_MEDIA_LIST: MediaItem[] = [
  {
    id: 'video-1',
    type: 'video',
    src: '/propaganda/WhatsApp%20Video%202026-08-17%20at%2011.29.58.mp4',
    title: 'Vídeo Promocional 1'
  },
  {
    id: 'video-2',
    type: 'video',
    src: '/propaganda/WhatsApp%20Video%202026-08-17%20at%2012.28.42.mp4',
    title: 'Vídeo Promocional 2'
  }
];

export const PropagandaCarousel: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaItem[]>(DEFAULT_MEDIA_LIST);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentMedia = mediaList[currentIndex];

  const handleNext = () => {
    if (mediaList.length === 0) return;
    setHasError(false);
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handlePrev = () => {
    if (mediaList.length === 0) return;
    setHasError(false);
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  // Gerenciamento de ciclo para Imagens e Vídeos
  useEffect(() => {
    if (!currentMedia || !isPlaying) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (currentMedia.type === 'image') {
      // Se for imagem, exibe por X segundos e avança para a próxima
      const duration = (currentMedia.durationSeconds || 8) * 1000;
      timerRef.current = setTimeout(() => {
        handleNext();
      }, duration);
    } else if (currentMedia.type === 'video') {
      // Para vídeo, tenta dar play automático com som mudo
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          // Se o navegador bloquear autoplay, avança após fallback
          timerRef.current = setTimeout(() => {
            handleNext();
          }, 10000);
        });
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isPlaying, currentMedia]);

  // Se o vídeo terminar naturalmente, avança para o próximo
  const handleVideoEnded = () => {
    handleNext();
  };

  // Em caso de erro ao carregar arquivo de mídia
  const handleMediaError = () => {
    console.warn(`[Propaganda] Erro ao reproduzir mídia: ${currentMedia?.src}`);
    setHasError(true);
    // Pula para a próxima mídia após 3 segundos
    timerRef.current = setTimeout(() => {
      handleNext();
    }, 3000);
  };

  // Fallback se não houver mídias válidas
  if (!currentMedia || mediaList.length === 0) {
    return (
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
    );
  }

  return (
    <div className="flex-1 relative rounded-xl overflow-hidden bg-black/90 my-2 flex items-center justify-center shadow-inner group">
      {/* Player de Vídeo */}
      {currentMedia.type === 'video' && (
        <video
          ref={videoRef}
          key={currentMedia.src}
          src={currentMedia.src}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          onError={handleMediaError}
          className="w-full h-full object-contain"
        />
      )}

      {/* Exibição de Imagem */}
      {currentMedia.type === 'image' && (
        <img
          key={currentMedia.src}
          src={currentMedia.src}
          alt={currentMedia.title || 'Propaganda'}
          onError={handleMediaError}
          className="w-full h-full object-contain transition-all duration-500 animate-fade-in"
        />
      )}

      {/* Overlay de erro sutil */}
      {hasError && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-amber-300 text-xs p-3 text-center">
          <span>⚠️ Carregando próxima mídia...</span>
        </div>
      )}

      {/* Indicadores de slides e tipo no rodapé */}
      <div className="absolute bottom-2 left-0 right-0 px-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] text-white/90">
          {currentMedia.type === 'video' ? (
            <Film className="w-3 h-3 text-emerald-400" />
          ) : (
            <ImageIcon className="w-3 h-3 text-blue-400" />
          )}
          <span className="font-semibold">{currentIndex + 1}/{mediaList.length}</span>
        </div>

        {/* Bolinhas de navegação */}
        <div className="flex items-center gap-1">
          {mediaList.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'w-4 bg-emerald-400' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PropagandaCarousel;
