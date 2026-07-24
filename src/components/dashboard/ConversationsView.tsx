import { useState, useMemo, useEffect, useRef } from 'react';
import {
  MessageSquare, Search, User, Bot, Clock,
  Phone, Mail, ChevronRight, Eye, Trash2,
  FileText, Download, Paperclip, Image, Video,
  Mic, Send, X, Loader2
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Interface simplificada para mensagens da Uazapi
interface UazapiMessage {
  id: string;
  chatId: string;
  content: string;
  fromMe: boolean;
  senderName: string;
  timestamp: number;
  type: string;
}

interface UazapiChat {
  id: string;
  jid?: string;
  phone?: string;
  name: string;
  lastMessage?: string;
  timestamp?: number;
  unreadCount: number;
}

const ConversationsView: React.FC = () => {
  console.log('[ConversationsView] Start Render');

  const context = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<UazapiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachMenu, setAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [togglingBot, setTogglingBot] = useState(false);

  // Mapeia o chat selecionado para um usuário com check-in ativo no banco de dados
  const activeUser = useMemo(() => {
    if (!selectedChatId || !context?.usuarios) return null;
    const cleanId = selectedChatId.replace(/\D/g, '');
    return context.usuarios.find((u: any) => u.telefone?.replace(/\D/g, '') === cleanId) || null;
  }, [selectedChatId, context?.usuarios]);

  // Função para alternar o atendimento entre IA e Humano
  const handleToggleBot = async () => {
    if (!selectedChatId || togglingBot) return;
    setTogglingBot(true);
    const currentVal = activeUser ? !!activeUser.chat_humano : false;
    const targetVal = !currentVal;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/toggle-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telefone: selectedChatId,
          chat_humano: targetVal
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao alternar modo de chat');
      }

      toast.success(targetVal ? 'Atendimento humano assumido. IA desativada!' : 'IA reativada com sucesso!');
      if (context?.refetchUsuarios) {
        context.refetchUsuarios();
      }
    } catch (err: any) {
      console.error('[ToggleBot] Erro:', err);
      toast.error('Erro ao mudar modo do atendimento.');
    } finally {
      setTogglingBot(false);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentMessages.length > 0) {
      scrollToBottom();
    }
  }, [currentMessages]);

  // Função para fazer upload de arquivos no Supabase Storage (bucket público "media")
  const uploadFileToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `chats/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      console.error('[Upload] Erro de upload:', error);
      throw error;
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  };

  // Função para chamar a API de envio do Fastify
  const handleSendMessage = async (conteudo: string, tipo: string = 'text', mediaUrl?: string) => {
    if (!selectedChatId) return;

    setSending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          telefone: selectedChatId,
          conteudo,
          tipo,
          mediaUrl,
          fileName: tipo === 'document' ? conteudo : undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao enviar');
      }

      setText('');
      // Forçar atualização do chat
      const WaJid = selectedChat?.jid || `${selectedChatId}@s.whatsapp.net`;
      const msgs = await fetchMessages(selectedChatId, WaJid);
      setCurrentMessages(msgs);
    } catch (err: any) {
      console.error('[SendMsg] Erro ao enviar mensagem:', err.message);
    } finally {
      setSending(false);
    }
  };

  // Gravação nativa de áudio no browser
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        try {
          const file = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
          const publicUrl = await uploadFileToStorage(file);
          await handleSendMessage('', 'audio', publicUrl);
        } catch (err) {
          console.error('[AudioRecord] Erro ao salvar/enviar áudio:', err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('[AudioRecord] Acesso ao microfone negado:', err);
    }
  };

  const stopRecording = (cancel = false) => {
    if (!mediaRecorderRef.current) return;

    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }

    if (cancel) {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current?.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      };
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Seleção e upload de arquivos
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachMenu(false);

    let tipo = 'document';
    if (file.type.startsWith('image/')) tipo = 'image';
    else if (file.type.startsWith('video/')) tipo = 'video';
    else if (file.type.startsWith('audio/')) tipo = 'audio';

    try {
      const publicUrl = await uploadFileToStorage(file);
      await handleSendMessage(file.name, tipo, publicUrl);
    } catch (err) {
      console.error('[FileSelect] Erro ao processar anexo:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Renderizador de mídias na timeline
  const renderMessageContent = (message: any) => {
    const mediaUrl = (message as any).mediaUrl;

    switch (message.type) {
      case 'image':
        return (
          <div className="space-y-1">
            <img
              src={mediaUrl}
              alt="Imagem"
              className="max-w-[200px] md:max-w-[240px] rounded-xl border border-border/30 hover:opacity-95 transition-opacity cursor-pointer shadow-sm"
              onClick={() => window.open(mediaUrl, '_blank')}
            />
            {message.content && !message.content.startsWith('http') && (
              <p className="text-sm leading-relaxed mt-1">{message.content}</p>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="space-y-1">
            <video
              src={mediaUrl}
              controls
              className="max-w-[220px] md:max-w-[260px] rounded-xl border border-border/30 shadow-sm"
            />
            {message.content && !message.content.startsWith('http') && (
              <p className="text-sm leading-relaxed mt-1">{message.content}</p>
            )}
          </div>
        );
      case 'audio':
        return (
          <div className="py-1 min-w-[200px]">
            <audio
              src={mediaUrl}
              controls
              className="w-full h-8 opacity-90 scale-95 origin-left"
            />
          </div>
        );
      case 'document':
        return (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-2.5 bg-background/50 hover:bg-background/80 border border-border/40 rounded-xl transition-colors text-xs font-semibold text-foreground"
          >
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{message.content || 'Visualizar documento'}</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Documento</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
          </a>
        );
      default:
        return <p className="whitespace-pre-line text-sm font-medium leading-relaxed">{message.content || ''}</p>;
    }
  };

  // Guard against missing context or hook data
  if (!context || !context.mensagens) {
    console.warn('[ConversationsView] mensagens object is missing in context');
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center p-8 bg-secondary/20 rounded-3xl border border-border/50">
          <p className="text-muted-foreground animate-pulse font-medium">Conectando ao servidor de mensagens...</p>
        </div>
      </div>
    );
  }

  const { mensagens } = context;
  const { chats = [], loading = false, fetchMessages } = mensagens;

  console.log('[ConversationsView] Data State:', {
    chatsLength: chats?.length,
    loading,
    hasFetchMessages: typeof fetchMessages === 'function'
  });

  const selectedChat = useMemo(() => {
    if (!selectedChatId || !Array.isArray(chats)) return null;
    return chats.find((c: UazapiChat) => c.id === selectedChatId) || null;
  }, [chats, selectedChatId]);

  const filteredConversations = useMemo(() => {
    const safeChats = Array.isArray(chats) ? chats : [];
    return safeChats.filter((conv: UazapiChat) =>
      (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.id || '').includes(searchQuery)
    );
  }, [chats, searchQuery]);

  const handleChatSelect = async (chatId: string) => {
    console.log('[ConversationsView] Chat selected:', chatId);
    if (!chatId) return;
    setSelectedChatId(chatId);
    setLoadingMessages(true);

    const chat = chats.find((c: UazapiChat) => c.id === chatId);
    if (!chat) return;

    if (typeof fetchMessages !== 'function') {
      console.error('[ConversationsView] fetchMessages is not a function!');
      setLoadingMessages(false);
      return;
    }

    try {
      // Passa o ID interno E o JID real para a busca
      const jid = chat.jid || chat.id;
      console.log(`[ConversationsView] Fetching messages: id=${chat.id}, jid=${jid}`);
      const msgs = await fetchMessages(chat.id, jid);
      console.log(`[ConversationsView] Received ${msgs?.length || 0} messages for ${chat.name}`);
      setCurrentMessages(Array.isArray(msgs) ? msgs : []);
    } catch (error) {
      console.error('[ConversationsView] Error fetching messages:', error);
      setCurrentMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  // Realtime: escuta evento global disparado pelo useMensagens quando chega nova mensagem
  useEffect(() => {
    if (!selectedChatId || typeof fetchMessages !== 'function') return;

    const handleNewMessage = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      // Verifica se a nova mensagem pertence ao chat aberto
      const msgPhone = detail.telefone;
      if (msgPhone === selectedChatId) {
        console.log('[ConversationsView] Realtime: nova mensagem no chat ativo, atualizando...');
        try {
          const jid = `${selectedChatId}@s.whatsapp.net`;
          const msgs = await fetchMessages(selectedChatId, jid);
          if (Array.isArray(msgs) && msgs.length > 0) {
            setCurrentMessages(msgs);
          }
        } catch (err) {
          // Silencioso
        }
      }
    };

    window.addEventListener('pedeai-new-message', handleNewMessage);
    return () => window.removeEventListener('pedeai-new-message', handleNewMessage);
  }, [selectedChatId, fetchMessages]);

  // Fallback polling: busca novas mensagens a cada 10 segundos (caso o Realtime falhe)
  useEffect(() => {
    if (!selectedChatId || typeof fetchMessages !== 'function') return;

    const interval = setInterval(async () => {
      try {
        const jid = `${selectedChatId}@s.whatsapp.net`;
        const msgs = await fetchMessages(selectedChatId, jid);
        if (Array.isArray(msgs) && msgs.length > 0) {
          setCurrentMessages(msgs);
        }
      } catch (err) {
        // Silencioso - não interrompe o usuário
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedChatId, fetchMessages]);

  return (
    <div className="flex-1 overflow-hidden bg-background">
      <div className="w-full h-full flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 flex-shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-6 border-b border-border bg-secondary/5">
            <h2 className="text-xl font-black text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Conversas
            </h2>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-background border-border shadow-inner text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden border-t border-border/10 custom-scrollbar">
            <div className="p-3 space-y-2 w-full">
              {loading && chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Carregando lista de contatos...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhuma conversa encontrada.
                </div>
              ) : (
                filteredConversations.map((conv: UazapiChat) => (
                  <button
                    key={conv.id || Math.random().toString()}
                    onClick={() => handleChatSelect(conv.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 group overflow-hidden ${selectedChatId === conv.id
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'hover:bg-secondary'
                      }`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors overflow-hidden ${selectedChatId === conv.id ? 'bg-white/20' : 'bg-secondary-foreground/5 group-hover:bg-primary/10'
                        }`}>
                        {(conv as any).profilePicUrl ? (
                          <img src={(conv as any).profilePicUrl} alt={conv.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className={`w-5 h-5 ${selectedChatId === conv.id ? 'text-white' : 'text-muted-foreground group-hover:text-primary'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold truncate text-sm flex-1 ${selectedChatId === conv.id ? 'text-white' : 'text-foreground'}`}>
                            {conv.name || 'Contato'}
                          </span>
                          {conv.unreadCount > 0 && (
                            <Badge className={`px-1.5 py-0 min-w-[20px] justify-center text-[10px] flex-shrink-0 ${selectedChatId === conv.id ? 'bg-white text-primary' : 'bg-primary'}`}>
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-xs truncate font-medium mt-0.5 ${selectedChatId === conv.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                          {conv.lastMessage || 'Sem mensagens'}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock className={`w-3 h-3 flex-shrink-0 ${selectedChatId === conv.id ? 'text-white/60' : 'text-muted-foreground/50'}`} />
                          <span className={`text-[10px] truncate font-black uppercase tracking-tighter ${selectedChatId === conv.id ? 'text-white/60' : 'text-muted-foreground/50'}`}>
                            {conv.timestamp ? formatTime(conv.timestamp) : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Conversation Detail */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-border bg-card/30 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden flex-shrink-0">
                    {(selectedChat as any).profilePicUrl ? (
                      <img src={(selectedChat as any).profilePicUrl} alt={selectedChat.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">{selectedChat.name || 'Contato'}</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                        <Phone className="w-3 h-3 text-primary/50" />
                        {selectedChat.jid ? selectedChat.jid.split('@')[0] : (selectedChat.id ? selectedChat.id.split('@')[0] : 'Desconhecido')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeUser ? (
                    <button
                      onClick={handleToggleBot}
                      disabled={togglingBot}
                      className={`h-7 px-3 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all duration-200 shadow-sm border border-transparent select-none cursor-pointer ${
                        activeUser.chat_humano
                          ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 active:scale-95'
                          : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 active:scale-95'
                      }`}
                    >
                      {togglingBot ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : activeUser.chat_humano ? (
                        <User className="w-3 h-3 text-amber-500 animate-pulse" />
                      ) : (
                        <Bot className="w-3 h-3 text-emerald-500" />
                      )}
                      <span>
                        {activeUser.chat_humano ? '👤 Atendimento Humano' : '🤖 Bot Inteligente'}
                      </span>
                    </button>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 h-7 px-3 rounded-full text-[10px] font-bold text-muted-foreground border-border bg-transparent select-none">
                      <Bot className="w-3 h-3 text-muted-foreground/60" />
                      <span>Sem Check-in / IA Inativa</span>
                    </Badge>
                  )}

                  <Badge variant="secondary" className="gap-1.5 h-7 px-3 rounded-full border-border/50 bg-secondary text-[10px] font-bold text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    Visão Admin
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-8 bg-[#fdfdfd]">
                <div className="space-y-6 max-w-2xl mx-auto">
                  {loadingMessages ? (
                    <div className="text-center py-20 text-muted-foreground font-medium italic">
                      Carregando mensagens...
                    </div>
                  ) : currentMessages.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground font-medium italic">
                      Nenhuma mensagem encontrada nesta conversa.
                    </div>
                  ) : (
                    currentMessages.map((message: UazapiMessage) => (
                      <div
                        key={message.id || Math.random().toString()}
                        className={`flex items-end gap-3 ${!message.fromMe ? 'justify-start' : 'justify-end'
                          }`}
                      >
                        {!message.fromMe && (
                          <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 border border-border/50 shadow-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm border ${!message.fromMe
                            ? 'bg-white text-foreground border-border/50 rounded-bl-none'
                            : 'bg-primary text-primary-foreground border-primary/10 rounded-br-none'
                            }`}
                        >
                          {renderMessageContent(message)}
                          <div className={`text-[10px] mt-2 font-black uppercase tracking-tighter flex items-center justify-end gap-1 ${!message.fromMe ? 'text-muted-foreground/50' : 'text-primary-foreground/60'
                            }`}>
                            <Clock className="w-3 h-3" />
                            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </div>
                        </div>
                        {message.fromMe && (
                          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Panel de Mensagens (Evolution Go) */}
              <div className="p-4 border-t border-border bg-card flex-shrink-0 relative">
                {/* Alerta de Modo de Atendimento (IA vs Humano) */}
                {activeUser && (
                  <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-300 border ${
                    activeUser.chat_humano 
                      ? 'bg-amber-500/5 text-amber-600 border-amber-500/10' 
                      : 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {activeUser.chat_humano ? (
                        <>
                          <User className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>Você está no controle deste atendimento. A IA está silenciada.</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-emerald-500" />
                          <span>A IA está ativa e responderá automaticamente a este cliente.</span>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={handleToggleBot}
                      disabled={togglingBot}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer select-none active:scale-95 ${
                        activeUser.chat_humano
                          ? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500'
                      }`}
                    >
                      {togglingBot ? 'Processando...' : activeUser.chat_humano ? 'Reativar IA' : 'Assumir Chat'}
                    </button>
                  </div>
                )}

                {/* Menu de Anexos Dropdown */}
                {attachMenu && (
                  <div className="absolute bottom-16 left-4 z-50 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-200">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-secondary/80 rounded-xl transition-colors text-left w-full"
                    >
                      <Image className="w-4 h-4 text-primary" />
                      Imagem / Foto
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-secondary/80 rounded-xl transition-colors text-left w-full"
                    >
                      <Video className="w-4 h-4 text-primary" />
                      Vídeo / Mídia
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-secondary/80 rounded-xl transition-colors text-left w-full"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      Documento / PDF
                    </button>
                  </div>
                )}

                {/* Input Invisível para Upload de Arquivos */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />

                <div className="flex items-center gap-2.5">
                  {isRecording ? (
                    /* Interface de Gravação de Áudio Ativa */
                    <div className="flex-1 flex items-center justify-between bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl px-4 py-3 animate-pulse">
                      <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                        <span className="text-sm font-semibold tracking-tight">
                          Gravando áudio ({recordingSeconds}s)...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => stopRecording(true)}
                          className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary rounded-xl transition-colors uppercase tracking-wider"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => stopRecording(false)}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors uppercase tracking-wider"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Input Padrão de Digitação */
                    <>
                      <button
                        onClick={() => setAttachMenu(!attachMenu)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border border-border/80 bg-background/50 hover:bg-secondary/80 transition-all hover:scale-95 ${attachMenu ? 'rotate-45 border-primary/20 bg-primary/5 text-primary' : ''}`}
                      >
                        <Paperclip className="w-5 h-5 text-muted-foreground" />
                      </button>

                      <div className="flex-1 relative flex items-center">
                        <Input
                          placeholder="Digite uma mensagem para o cliente..."
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && text.trim() && handleSendMessage(text)}
                          disabled={sending}
                          className="w-full h-11 pr-12 rounded-xl border border-border/80 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                        />
                        <button
                          onClick={startRecording}
                          disabled={sending}
                          className="absolute right-2.5 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary/80 transition-colors"
                          title="Gravar áudio"
                        >
                          <Mic className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                      </div>

                      <button
                        onClick={() => text.trim() && handleSendMessage(text)}
                        disabled={sending || !text.trim()}
                        className="w-11 h-11 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground flex items-center justify-center transition-all hover:scale-95 shadow-sm"
                      >
                        {sending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-12 bg-[#F8F9FA]">
              <div className="animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-6 shadow-sm border border-border/50">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight">Suas Conversas</h3>
                <p className="text-muted-foreground max-w-sm mx-auto font-medium text-sm leading-relaxed">
                  Selecione um cliente à esquerda para acompanhar o atendimento da Uazapi em tempo real.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationsView;
