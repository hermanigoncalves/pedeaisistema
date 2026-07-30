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

/**
 * Adapter para comunicação com a API WAHA (WhatsApp HTTP API).
 * Docs: https://waha.devlike.pro/docs/
 */
class WahaAdapter {
  private defaultClient: AxiosInstance;

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
   * Retorna o cliente Axios e o nome da sessão configurados para o restaurante.
   * Se não houver configurações personalizadas, faz fallback para as variáveis globais.
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

      const sessionName = isDelivery
        ? (restaurante?.waha_session_delivery || restaurante?.waha_session || restaurante?.evolution_instancia_delivery || restaurante?.evolution_instancia)
        : (restaurante?.waha_session || restaurante?.evolution_instancia);

      if (!sessionName) return defaultResult;

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

      return {
        axiosClient: customClient,
        sessionName: sessionName,
      };
    } catch (err: any) {
      console.warn(`[WAHA Adapter] Erro ao buscar config do restaurante ${restauranteId}, usando fallback:`, err.message);
      return defaultResult;
    }
  }

  /**
   * Envia mensagem de texto via WAHA (POST /api/sendText).
   * Suporta chamadas legadas: sendText(number, text)
   * E chamadas SaaS: sendText(restauranteId, number, text)
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
      sessionName = overrideSessionName.trim();
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
        console.error(`[WAHA API] ❌ Erro ao enviar texto:`, err.response?.data || err.message);
        throw err;
      }
    }, `sendText(${chatId})`);
  }

  /**
   * Envia indicação "digitando..." ou "gravando..." via WAHA (POST /api/startTyping e /api/stopTyping).
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
   * Rota /api/sendImage, /api/sendVoice ou /api/sendFile
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
      const mediaUrl = rawMessage?.media?.url || rawMessage?.url || rawMessage?.file?.url;
      if (!mediaUrl) return null;

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
