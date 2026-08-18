import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { supabase } from './supabaseAdapter';
import { normalizePhone } from '../services/phoneNormalizer';

/** Erros de rede transitórios que justificam retry automático */
const RETRYABLE_CODES = new Set(['EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

/**
 * Verifica se o erro é o Erro 463 (Reachout Timelock) ou restrição crítica de ban da Meta.
 * Nesses casos, o retry imediato é PROIBIDO para não queimar o chip permanentemente.
 */
function isReachoutOrPermanentBanError(err: any): boolean {
  const status = (err as AxiosError)?.response?.status;
  const data = JSON.stringify((err as AxiosError)?.response?.data || '').toLowerCase();
  const msg = (err.message || '').toLowerCase();

  return (
    status === 463 ||
    data.includes('463') ||
    data.includes('reachout') ||
    data.includes('reach-out') ||
    data.includes('nackcallerreachout') ||
    data.includes('restrict_all_companions') ||
    data.includes('timelock') ||
    msg.includes('463') ||
    msg.includes('reachout')
  );
}

/** Retry com backoff exponencial e salvaguarda antiban para Evolution Go */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // ⚠️ SALVAGUARDA ANTIBAN (Erro 463 - Reachout Timelock)
      if (isReachoutOrPermanentBanError(err)) {
        console.error(
          `[Evolution Go] 🚨 BLOQUEIO METADATA REACHOUT TIMELOCK (Erro 463) detectado em ${label}! ` +
          `Abortando retries imediatamente para evitar banimento permanente do chip.`
        );
        throw err;
      }

      const code = (err as AxiosError)?.code || '';
      const isTimeout = code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetworkError = RETRYABLE_CODES.has(code) || isTimeout;

      if (!isNetworkError || attempt === maxRetries) {
        throw err;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.warn(
        `[Evolution Go] ⚠️ ${label} falhou (tentativa ${attempt}/${maxRetries}, code=${code}). ` +
        `Retry em ${delayMs}ms...`,
      );
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Adapter para comunicação com a API Evolution Go.
 *
 * Arquitetura Multi-tenant:
 * - Cada restaurante pode ter sua própria instância Evolution Go (URL + apikey diferentes).
 * - Se o restaurante NÃO tiver configuração própria, usa as variáveis globais do .env.
 * - As ROTAS são sempre as mesmas (/send/text, /send/media, /send/audio, /message/presence, etc.).
 * - O nome da instância é sempre fornecido no corpo da requisição JSON (conforme convenção Go).
 */
class EvolutionAdapter {
  private defaultClient: AxiosInstance;

  constructor() {
    this.defaultClient = axios.create({
      baseURL: config.EVOLUTION_URL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.EVOLUTION_API_KEY,
      },
      timeout: 30000,
    });
  }

  /**
   * Retorna o cliente Axios e o nome da instância configurados para o restaurante.
   */
  private async getClientForRestaurante(restauranteId?: string | null, isDelivery: boolean = false): Promise<{
    axiosClient: AxiosInstance;
    instanceName: string;
  }> {
    const defaultResult = {
      axiosClient: this.defaultClient,
      instanceName: config.EVOLUTION_INSTANCE,
    };

    if (!restauranteId) return defaultResult;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(restauranteId)) return defaultResult;

    try {
      const restaurante = await supabase.getRestauranteById(restauranteId);

      const instName = isDelivery
        ? (restaurante?.evolution_instancia_delivery || restaurante?.evolution_instancia)
        : restaurante?.evolution_instancia;

      if (!instName) return defaultResult;

      const baseURL = config.EVOLUTION_URL;
      const apikey = (isDelivery && restaurante?.evolution_apikey_delivery)
        ? restaurante.evolution_apikey_delivery
        : (restaurante?.evolution_apikey || config.EVOLUTION_API_KEY);

      const customClient = axios.create({
        baseURL,
        headers: {
          'Content-Type': 'application/json',
          'apikey': apikey,
        },
        timeout: 30000,
      });

      return {
        axiosClient: customClient,
        instanceName: instName,
      };
    } catch (err: any) {
      console.warn(`[Evolution Adapter] Erro ao buscar config do restaurante ${restauranteId}, usando fallback:`, err.message);
      return defaultResult;
    }
  }

  /**
   * Envia mensagem de texto via Evolution Go.
   * Suporta chamadas legadas: sendText(number, text, isDelivery?, overrideInstance?, quotedId?)
   * E chamadas SaaS:  sendText(restauranteId, number, text, isDelivery?, overrideInstance?, quotedId?)
   */
  async sendText(
    restauranteIdOrNumber: string | null | undefined,
    numberOrText?: string,
    text?: string,
    isDelivery: boolean = false,
    overrideInstanceName?: string,
    quotedMessageId?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let messageText: string;

    if (text !== undefined) {
      // Chamada SaaS: sendText(restauranteId, number, text, ...)
      restauranteId = restauranteIdOrNumber;
      number = numberOrText || '';
      messageText = text;
    } else {
      // Chamada Legada: sendText(number, text, ...)
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      messageText = numberOrText || '';
    }

    const { axiosClient, instanceName: defaultInstanceName } = await this.getClientForRestaurante(restauranteId, isDelivery);
    let instanceName = overrideInstanceName?.trim() || defaultInstanceName;
    const cleanNumber = normalizePhone(number);

    await withRetry(async () => {
      try {
        const payload: Record<string, any> = {
          instance: instanceName,
          number: cleanNumber,
          text: messageText,
          delay: 1200, // delay humanizado para simular digitação
        };

        if (quotedMessageId) {
          payload.quoted = { messageId: quotedMessageId };
        }

        await axiosClient.post('/send/text', payload);
        console.log(`[Evolution Go] ✅ Texto enviado para ${cleanNumber} (Instância: ${instanceName})`);
      } catch (err: any) {
        console.error(`[Evolution Go] ❌ Erro ao enviar texto:`, err.response?.data || err.message);
        throw err;
      }
    }, `sendText(${cleanNumber})`);
  }

  /**
   * Envia áudio de voz PTT (gravado) via Evolution Go (/send/audio).
   */
  async sendAudio(
    restauranteIdOrNumber: string | null | undefined,
    numberOrUrl?: string,
    url?: string,
    isDelivery: boolean = false,
    overrideInstanceName?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let audioUrl: string;

    if (url !== undefined) {
      restauranteId = restauranteIdOrNumber;
      number = numberOrUrl || '';
      audioUrl = url;
    } else {
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      audioUrl = numberOrUrl || '';
    }

    const { axiosClient, instanceName: defaultInstanceName } = await this.getClientForRestaurante(restauranteId, isDelivery);
    const instanceName = overrideInstanceName?.trim() || defaultInstanceName;
    const cleanNumber = normalizePhone(number);

    await withRetry(async () => {
      try {
        await axiosClient.post('/send/audio', {
          instance: instanceName,
          number: cleanNumber,
          url: audioUrl,
          delay: 1500,
        });
        console.log(`[Evolution Go] 🎙️ Áudio PTT enviado para ${cleanNumber} (Instância: ${instanceName})`);
      } catch (err: any) {
        console.error(`[Evolution Go] ❌ Erro ao enviar áudio:`, err.response?.data || err.message);
        throw err;
      }
    }, `sendAudio(${cleanNumber})`);
  }

  /**
   * Envia status "digitando..." ou "gravando..." no chat (/message/presence).
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

    const cleanNumber = normalizePhone(number);
    const { axiosClient, instanceName } = await this.getClientForRestaurante(restauranteId);

    try {
      await axiosClient.post('/message/presence', {
        instance: instanceName,
        number: cleanNumber,
        state: presenceState,
        isAudio: presenceState === 'recording',
      });
    } catch (err: any) {
      console.warn(`[Evolution Go] ⚠️ Presença falhou:`, err.response?.data || err.message);
    }
  }

  /**
   * Marca mensagem como lida (/message/markread) para simular comportamento humano.
   */
  async markRead(
    restauranteIdOrNumber: string | null | undefined,
    numberOrId?: string,
    messageId?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let msgId: string | undefined;

    if (messageId !== undefined) {
      restauranteId = restauranteIdOrNumber;
      number = numberOrId || '';
      msgId = messageId;
    } else {
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      msgId = numberOrId;
    }

    const cleanNumber = normalizePhone(number);
    const { axiosClient, instanceName } = await this.getClientForRestaurante(restauranteId);

    try {
      await axiosClient.post('/message/markread', {
        instance: instanceName,
        number: cleanNumber,
        messageId: msgId,
      });
    } catch {
      // Opcional
    }
  }

  /**
   * Marca áudio como reproduzido / ouvido (microfone azul) (/message/markplayed).
   */
  async markPlayed(
    restauranteIdOrNumber: string | null | undefined,
    numberOrId?: string,
    messageId?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let msgId: string | undefined;

    if (messageId !== undefined) {
      restauranteId = restauranteIdOrNumber;
      number = numberOrId || '';
      msgId = messageId;
    } else {
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      msgId = numberOrId;
    }

    const cleanNumber = normalizePhone(number);
    const { axiosClient, instanceName } = await this.getClientForRestaurante(restauranteId);

    try {
      await axiosClient.post('/message/markplayed', {
        instance: instanceName,
        number: cleanNumber,
        messageId: msgId,
      });
    } catch {
      // Opcional
    }
  }

  /**
   * Envia mídia (imagem, vídeo, documento) via Evolution Go (/send/media).
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

    const cleanNumber = normalizePhone(mediaOpts?.number || '');
    const { axiosClient, instanceName } = await this.getClientForRestaurante(restauranteId);

    await withRetry(async () => {
      try {
        const payload: Record<string, any> = {
          instance: instanceName,
          number: cleanNumber,
          type: mediaOpts.mediatype,
          url: mediaOpts.media,
          caption: mediaOpts.caption || '',
          delay: 1200,
        };

        if (mediaOpts.mediatype === 'document' && mediaOpts.fileName) {
          payload.caption = mediaOpts.fileName;
        }

        await axiosClient.post('/send/media', payload);
        console.log(`[Evolution Go] ✅ Mídia (${mediaOpts.mediatype}) enviada para ${cleanNumber} (Instância: ${instanceName})`);
      } catch (err: any) {
        console.error(`[Evolution Go] ❌ Erro ao enviar mídia (${mediaOpts?.mediatype}):`, err.response?.data || err.message);
        throw err;
      }
    }, `sendMedia(${cleanNumber})`);
  }

  /**
   * Baixa mídia de uma mensagem (/message/downloadimage).
   */
  async downloadMedia(restauranteIdOrMessage: any, message?: any): Promise<any> {
    let restauranteId: string | null | undefined;
    let rawMessage: any;

    if (message !== undefined) {
      restauranteId = restauranteIdOrMessage;
      rawMessage = message;
    } else {
      restauranteId = undefined;
      rawMessage = restauranteIdOrMessage;
    }

    const { axiosClient } = await this.getClientForRestaurante(restauranteId);

    try {
      const res = await axiosClient.post('/message/downloadimage', { message: rawMessage });
      return res.data;
    } catch (err: any) {
      console.error(`[Evolution Go] ❌ Erro ao baixar mídia:`, err.response?.data || err.message);
      throw err;
    }
  }
}

export const evolution = new EvolutionAdapter();
