import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { supabase } from './supabaseAdapter';
import { normalizePhone } from '../services/phoneNormalizer';

/** Erros de rede que justificam retry automático */
const RETRYABLE_CODES = new Set(['EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

/** Retry com backoff exponencial para chamadas à WAHA */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = (err as AxiosError)?.code || '';
      const isTimeout = code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetworkError = RETRYABLE_CODES.has(code) || isTimeout;

      if (!isNetworkError || attempt === maxRetries) {
        throw err;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.warn(
        `[WAHA API] ⚠️ ${label} falhou (tentativa ${attempt}/${maxRetries}, code=${code}). ` +
        `Retry em ${delayMs}ms...`,
      );
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Converte número limpo para formato WAHA JID/chatId (ex: 5511999999999@c.us)
 */
function toWahaChatId(number: string): string {
  const clean = normalizePhone(number);
  if (clean.includes('@')) return clean;
  return `${clean}@c.us`;
}

function getAlternateChatId(chatId: string): string | null {
  if (!chatId) return null;
  const numOnly = chatId.split('@')[0].replace(/\D/g, '');
  const domain = chatId.includes('@s.whatsapp.net') ? '@s.whatsapp.net' : '@c.us';

  if (!numOnly.startsWith('55')) return null;

  // Se tem 13 dígitos (55 + DDD + 9 + 8 dígitos), tenta sem o 9 (12 dígitos)
  if (numOnly.length === 13) {
    const ddd = numOnly.substring(2, 4);
    const ninth = numOnly.substring(4, 5);
    if (ninth === '9') {
      const altNum = '55' + ddd + numOnly.substring(5);
      return `${altNum}${domain}`;
    }
  }

  // Se tem 12 dígitos (55 + DDD + 8 dígitos), tenta com o 9 (13 dígitos)
  if (numOnly.length === 12) {
    const ddd = numOnly.substring(2, 4);
    const altNum = '55' + ddd + '9' + numOnly.substring(4);
    return `${altNum}${domain}`;
  }

  return null;
}

/**
 * Adapter para comunicação com a API WAHA (WhatsApp HTTP API).
 * Docs: https://waha.devlike.pro/docs/
 */
class WahaAdapter {
  private defaultClient: AxiosInstance;
  private activeSessionsCache: { name: string; pushName: string; status: string }[] | null = null;
  private lastCacheTime = 0;

  constructor() {
    const baseURL = config.WAHA_URL || config.EVOLUTION_URL;
    const apiKey = config.WAHA_API_KEY || config.EVOLUTION_API_KEY;

    this.defaultClient = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      timeout: 30000,
    });
  }

  /**
   * Auto-resolução inteligente de sessão no WAHA.
   * Se a sessão solicitada não bater exatamente, busca sessões ativas no WAHA por:
   * 1. Nome exato
   * 2. Case-insensitive
   * 3. PushName do WhatsApp
   * 4. Única sessão WORKING no container
   */
  private async getWorkingSession(requestedSession: string, axiosClient: AxiosInstance, forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (forceRefresh || !this.activeSessionsCache || (now - this.lastCacheTime > 30000)) {
      try {
        const res = await axiosClient.get('/api/sessions?all=true');
        if (Array.isArray(res.data)) {
          this.activeSessionsCache = res.data.map((s: any) => ({
            name: s.name || '',
            pushName: s.me?.pushName || '',
            status: s.status || '',
          }));
          this.lastCacheTime = Date.now();
        }
      } catch (err: any) {
        console.warn('[WAHA Adapter] ⚠️ Não foi possível listar /api/sessions:', err.message);
      }
    }

    if (!this.activeSessionsCache || this.activeSessionsCache.length === 0) {
      return requestedSession;
    }

    const working = this.activeSessionsCache.filter(s => s.status === 'WORKING' || s.status === 'STARTING' || s.status === 'CONNECTED');
    const pool = working.length > 0 ? working : this.activeSessionsCache;

    // 1. Exato
    const exact = pool.find(s => s.name === requestedSession);
    if (exact) return exact.name;

    // 2. Case-insensitive
    const caseMatch = pool.find(s => s.name.toLowerCase() === requestedSession.toLowerCase());
    if (caseMatch) {
      console.log(`[WAHA API] 🔄 Ajuste case-insensitive: '${requestedSession}' -> '${caseMatch.name}'`);
      return caseMatch.name;
    }

    // 3. Match por PushName do WhatsApp
    const pushMatch = pool.find(s => s.pushName && (s.pushName.toLowerCase() === requestedSession.toLowerCase() || requestedSession.toLowerCase().includes(s.pushName.toLowerCase()) || s.pushName.toLowerCase().includes(requestedSession.toLowerCase())));
    if (pushMatch) {
      console.log(`[WAHA API] 🔄 Auto-detectada sessão por pushName: '${requestedSession}' -> '${pushMatch.name}'`);
      return pushMatch.name;
    }

    // 4. Se houver apenas 1 sessão ativa no WAHA, usa ela automaticamente!
    if (pool.length === 1 && pool[0].name) {
      console.log(`[WAHA API] 🔄 Usando única sessão ativa no WAHA: '${pool[0].name}' em vez de '${requestedSession}'`);
      return pool[0].name;
    }

    return requestedSession;
  }

  /**
   * Retorna o cliente Axios e o nome da sessão configurados para o restaurante.
   */
  private async getClientForRestaurante(restauranteId?: string | null, isDelivery: boolean = false): Promise<{
    axiosClient: AxiosInstance;
    sessionName: string;
  }> {
    const defaultResult = {
      axiosClient: this.defaultClient,
      sessionName: config.WAHA_SESSION || config.EVOLUTION_INSTANCE || 'default',
    };

    if (!restauranteId) return defaultResult;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(restauranteId)) return defaultResult;

    try {
      const restaurante = await supabase.getRestauranteById(restauranteId);

      const rawSessionName = isDelivery
        ? (restaurante?.waha_session_delivery || restaurante?.waha_session || restaurante?.evolution_instancia_delivery || restaurante?.evolution_instancia)
        : (restaurante?.waha_session || restaurante?.evolution_instancia);

      const targetSession = rawSessionName || config.WAHA_SESSION || config.EVOLUTION_INSTANCE || 'default';

      const baseURL = config.WAHA_URL || config.EVOLUTION_URL;
      const apiKey = (isDelivery && (restaurante?.waha_apikey_delivery || restaurante?.evolution_apikey_delivery))
        ? (restaurante?.waha_apikey_delivery || restaurante?.evolution_apikey_delivery)
        : (restaurante?.waha_apikey || restaurante?.evolution_apikey || config.WAHA_API_KEY || config.EVOLUTION_API_KEY);

      const customClient = axios.create({
        baseURL,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        timeout: 30000,
      });

      const resolvedSession = await this.getWorkingSession(targetSession, customClient);

      return {
        axiosClient: customClient,
        sessionName: resolvedSession,
      };
    } catch (err: any) {
      console.warn(`[WAHA Adapter] Erro ao buscar config do restaurante ${restauranteId}, usando fallback:`, err.message);
      return defaultResult;
    }
  }

  /**
   * Envia mensagem de texto via WAHA (POST /api/sendText).
   */
  async sendText(
    restauranteIdOrNumber: string | null | undefined,
    numberOrText?: string,
    text?: string,
    isDelivery: boolean = false,
    overrideSessionName?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let messageText: string;

    if (text !== undefined) {
      restauranteId = restauranteIdOrNumber;
      number = numberOrText || '';
      messageText = text;
    } else {
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      messageText = numberOrText || '';
    }

    let { axiosClient, sessionName } = await this.getClientForRestaurante(restauranteId, isDelivery);

    if (overrideSessionName && overrideSessionName.trim()) {
      sessionName = await this.getWorkingSession(overrideSessionName.trim(), axiosClient);
    }

    const chatId = toWahaChatId(number);

    await withRetry(async () => {
      try {
        await axiosClient.post('/api/sendText', {
          session: sessionName,
          chatId: chatId,
          text: messageText,
        });
        console.log(`[WAHA API] ✅ Texto enviado para ${chatId} (Sessão: ${sessionName})`);
      } catch (err: any) {
        const errObj = err.response?.data;
        const errMsg = JSON.stringify(errObj || err.message || '');

        // 1. Se deu erro 'no LID found' (incompatibilidade do 9º dígito no WhatsApp), tenta o formato alternativo
        if (errMsg.includes('no LID found')) {
          const altChatId = getAlternateChatId(chatId);
          if (altChatId) {
            console.warn(`[WAHA API] ⚠️ Erro 'no LID found' para ${chatId}. Tentando número alternativo: ${altChatId}...`);
            await axiosClient.post('/api/sendText', {
              session: sessionName,
              chatId: altChatId,
              text: messageText,
            });
            console.log(`[WAHA API] ✅ Texto enviado com sucesso para número alternativo ${altChatId} (Sessão: ${sessionName})`);
            return;
          }
        }

        // 2. Se deu erro de sessão inexistente, força atualização de cache e tenta 1x mais com a sessão ativa
        if (errObj?.error && typeof errObj.error === 'string' && errObj.error.includes('does not exist')) {
          console.warn(`[WAHA API] ⚠️ Sessão '${sessionName}' não encontrada. Buscando sessões ativas do container...`);
          const resolved = await this.getWorkingSession(sessionName, axiosClient, true);
          if (resolved !== sessionName) {
            console.log(`[WAHA API] 🔄 Re-enviando mensagem com a sessão ativa resolvida: '${resolved}'`);
            await axiosClient.post('/api/sendText', {
              session: resolved,
              chatId: chatId,
              text: messageText,
            });
            console.log(`[WAHA API] ✅ Texto enviado com sucesso para ${chatId} (Sessão: ${resolved})`);
            return;
          }
        }
        console.error(`[WAHA API] ❌ Erro ao enviar texto:`, errObj || err.message);
        throw err;
      }
    }, `sendText(${chatId})`);
  }

  /**
   * Envia indicação "digitando..." ou "gravando..." via WAHA.
   */
  async sendPresence(
    restauranteIdOrNumber: string | null | undefined,
    numberOrState?: string,
    state: 'composing' | 'paused' | 'recording' = 'composing',
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let presenceState: 'composing' | 'paused' | 'recording';

    if (numberOrState === 'composing' || numberOrState === 'paused' || numberOrState === 'recording') {
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      presenceState = numberOrState;
    } else {
      restauranteId = restauranteIdOrNumber;
      number = numberOrState || '';
      presenceState = state;
    }

    const chatId = toWahaChatId(number);
    const { axiosClient, sessionName } = await this.getClientForRestaurante(restauranteId);

    try {
      const endpoint = presenceState === 'paused' ? '/api/stopTyping' : '/api/startTyping';
      await axiosClient.post(endpoint, {
        session: sessionName,
        chatId: chatId,
      });
    } catch (err: any) {
      console.warn(`[WAHA API] ⚠️ Presença (${presenceState}) falhou:`, err.response?.data || err.message);
    }
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento) via WAHA.
   */
  async sendMedia(
    restauranteIdOrOpts: any,
    opts?: {
      number: string;
      mediatype: 'image' | 'video' | 'audio' | 'document';
      media: string;
      caption?: string;
      fileName?: string;
    },
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let mediaOpts: any;

    if (opts !== undefined) {
      restauranteId = restauranteIdOrOpts;
      mediaOpts = opts;
    } else {
      restauranteId = undefined;
      mediaOpts = restauranteIdOrOpts;
    }

    const chatId = toWahaChatId(mediaOpts?.number || '');
    const { axiosClient, sessionName } = await this.getClientForRestaurante(restauranteId);

    await withRetry(async () => {
      try {
        let endpoint = '/api/sendFile';
        if (mediaOpts.mediatype === 'image') {
          endpoint = '/api/sendImage';
        } else if (mediaOpts.mediatype === 'audio') {
          endpoint = '/api/sendVoice';
        }

        const payload: Record<string, any> = {
          session: sessionName,
          chatId: chatId,
          file: {
            url: mediaOpts.media,
            filename: mediaOpts.fileName || 'arquivo',
          },
          caption: mediaOpts.caption || '',
        };

        await axiosClient.post(endpoint, payload);
        console.log(`[WAHA API] ✅ Mídia (${mediaOpts.mediatype}) enviada para ${chatId} (Sessão: ${sessionName})`);
      } catch (err: any) {
        console.error(`[WAHA API] ❌ Erro ao enviar mídia (${mediaOpts?.mediatype}):`, err.response?.data || err.message);
        throw err;
      }
    }, `sendMedia(${chatId})`);
  }

  /**
   * Baixa mídia do WAHA se necessário.
   */
  async downloadMedia(restauranteId: string | null, rawMessage: any): Promise<Buffer | null> {
    try {
      const mediaUrl =
        rawMessage?.media?.url ||
        rawMessage?.mediaUrl ||
        rawMessage?.url ||
        rawMessage?.file?.url ||
        rawMessage?._data?.Message?.audioMessage?.url ||
        rawMessage?._data?.Message?.imageMessage?.url ||
        rawMessage?._data?.Message?.videoMessage?.url ||
        rawMessage?._data?.Message?.documentMessage?.url;

      if (!mediaUrl) {
        console.warn(`[WAHA API] ⚠️ Nenhuma URL de mídia encontrada no payload`);
        return null;
      }

      const { axiosClient } = await this.getClientForRestaurante(restauranteId);
      const res = await axiosClient.get(mediaUrl, { responseType: 'arraybuffer' });
      return Buffer.from(res.data);
    } catch (err: any) {
      console.error(`[WAHA API] ❌ Erro ao baixar mídia:`, err.message);
      return null;
    }
  }
}

export const waha = new WahaAdapter();
// Exporta alias 'evolution' para manter retrocompatibilidade transparente
export const evolution = waha;
