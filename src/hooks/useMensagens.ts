import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UazapiMessage {
    id: string;
    chatId: string;
    content: string;
    fromMe: boolean;
    senderName: string;
    timestamp: number;
    type: string;
    mediaUrl?: string;
    fileName?: string;
}

export interface UazapiChat {
    id: string; // telefone como ID
    jid: string; // telefone@s.whatsapp.net
    phone: string;
    name: string;
    profilePicUrl?: string;
    lastMessage?: string;
    timestamp?: number;
    unreadCount: number;
}

/**
 * Hook que busca mensagens do Supabase (persistidas pelo webhook da Evolution Go).
 * Mantém interfaces UazapiChat / UazapiMessage por compatibilidade com ConversationsView.
 */
export const useMensagens = (restaurantId: string | null, allowedContacts: { phone: string, name: string }[] = []) => {
    const [chats, setChats] = useState<UazapiChat[]>([]);
    const [loading, setLoading] = useState(false);

    // Mapa de telefone -> nome (dos contatos cadastrados no DB)
    const contactMap = useMemo(() => {
        const map = new Map<string, string>();
        allowedContacts.forEach(c => {
            if (c.phone) {
                // Armazena com e sem 55 para facilitar lookup
                const clean = c.phone.replace(/\D/g, '');
                map.set(clean, c.name);
                if (clean.startsWith('55') && clean.length > 11) {
                    map.set(clean.substring(2), c.name);
                }
            }
        });
        return map;
    }, [allowedContacts]);

    const findContactName = useCallback((telefone: string): string => {
        if (!telefone) return 'Contato';
        const clean = telefone.replace(/\D/g, '');
        return contactMap.get(clean) || contactMap.get(clean.startsWith('55') ? clean.substring(2) : `55${clean}`) || 'Contato';
    }, [contactMap]);

    // Formata o número de telefone de forma elegante para exibição
    const formatPhoneNumber = (phone: string): string => {
        const clean = phone.replace(/\D/g, '');
        if (clean.startsWith('55') && clean.length >= 10) {
            const ddd = clean.substring(2, 4);
            const rest = clean.substring(4);
            if (rest.length === 9) {
                return `(${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
            } else if (rest.length === 8) {
                return `(${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
            }
        }
        if (clean.length === 11) {
            return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
        } else if (clean.length === 10) {
            return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
        }
        return phone;
    };

    // Busca lista de chats (agrupado por telefone, última mensagem de cada)
    const fetchChats = useCallback(async () => {
        if (!restaurantId) return;

        setLoading(true);
        try {
            // Buscar todas as mensagens do restaurante, ordenadas por data desc
            const { data, error } = await (supabase as any)
                .from('mensagens')
                .select('*')
                .eq('restaurante_id', restaurantId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[useMensagens] Erro ao buscar chats:', error.message);
                setChats([]);
                return;
            }

            if (!data || data.length === 0) {
                setChats([]);
                return;
            }

            // Agrupar por telefone — pegar a última mensagem de cada
            const chatMap = new Map<string, UazapiChat>();

            for (const msg of data) {
                if (chatMap.has(msg.telefone)) continue; // Já pegamos o mais recente (está ordenado desc)

                // 1. Tentar buscar o nome real nas mensagens históricas recebidas desse cliente
                let contactName = '';
                const clientMsgs = data.filter((m: any) => m.telefone === msg.telefone);
                for (const m of clientMsgs) {
                    if (m.nome_contato && m.nome_contato !== 'Contato' && m.direcao === 'recebida') {
                        contactName = m.nome_contato;
                        break;
                    }
                }

                // 2. Se não achou na mensagem recebida, buscar na agenda/CRM
                if (!contactName) {
                    const crmName = findContactName(msg.telefone);
                    if (crmName && crmName !== 'Contato') {
                        contactName = crmName;
                    }
                }

                // 3. Fallback: Exibir o número de telefone formatado em vez de "Contato"
                if (!contactName) {
                    contactName = formatPhoneNumber(msg.telefone);
                }

                chatMap.set(msg.telefone, {
                    id: msg.telefone,
                    jid: `${msg.telefone}@s.whatsapp.net`,
                    phone: msg.telefone,
                    name: contactName,
                    lastMessage: msg.conteudo?.substring(0, 80) || '',
                    timestamp: new Date(msg.created_at).getTime(),
                    unreadCount: 0,
                });
            }

            // Exibir todas as conversas do restaurante sem filtros restritivos de CRM
            const finalChats = Array.from(chatMap.values());

            console.log(`[useMensagens] ${finalChats.length} conversas encontradas no Supabase.`);
            setChats(finalChats);
        } catch (err) {
            console.error('[useMensagens] Erro:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, findContactName, allowedContacts]);

    // Busca mensagens de um chat específico (por telefone)
    const fetchMessages = useCallback(async (chatId: string, _chatJid?: string): Promise<UazapiMessage[]> => {
        if (!restaurantId) return [];

        try {
            const telefone = chatId.split('@')[0].replace(/\D/g, '') || chatId;

            const { data, error } = await (supabase as any)
                .from('mensagens')
                .select('*')
                .eq('restaurante_id', restaurantId)
                .eq('telefone', telefone)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[useMensagens] Erro ao buscar mensagens:', error.message);
                return [];
            }

            if (!data || data.length === 0) return [];

            const mapped: UazapiMessage[] = data.map((msg: any) => {
                const metadata = msg.metadata || {};
                return {
                    id: String(msg.id),
                    chatId: msg.telefone,
                    content: msg.conteudo || '',
                    fromMe: msg.direcao === 'enviada',
                    senderName: msg.nome_contato || '',
                    timestamp: new Date(msg.created_at).getTime(),
                    type: msg.tipo || 'text',
                    mediaUrl: metadata.mediaUrl || metadata.media_url || metadata.url || (msg.tipo !== 'text' && msg.conteudo && msg.conteudo.startsWith('http') ? msg.conteudo : undefined),
                    fileName: metadata.fileName || undefined
                };
            });

            console.log(`[useMensagens] ${mapped.length} mensagens para ${telefone}`);
            return mapped;
        } catch (err) {
            console.error('[useMensagens] Erro ao buscar mensagens:', err);
            return [];
        }
    }, [restaurantId]);

    // Carregar chats na montagem
    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    // Supabase Realtime — atualiza automaticamente quando nova mensagem chega
    useEffect(() => {
        if (!restaurantId) return;

        const channel = (supabase as any)
            .channel('mensagens-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mensagens',
                    filter: `restaurante_id=eq.${restaurantId}`,
                },
                (payload: any) => {
                    console.log('[useMensagens] Nova mensagem via Realtime — atualizando chats...');
                    fetchChats();

                    // Dispara evento global para que ConversationsView atualize o chat ativo instantaneamente
                    try {
                        window.dispatchEvent(new CustomEvent('pedeai-new-message', {
                            detail: payload.new
                        }));
                    } catch (e) {
                        // Silencioso — não interrompe o fluxo
                    }
                }
            )
            .subscribe();

        return () => {
            (supabase as any).removeChannel(channel);
        };
    }, [restaurantId, fetchChats]);

    return useMemo(() => ({
        chats,
        loading,
        fetchMessages,
        refetch: fetchChats
    }), [chats, loading, fetchMessages, fetchChats]);
};
