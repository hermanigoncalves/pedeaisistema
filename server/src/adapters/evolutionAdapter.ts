import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { supabase } from './supabaseAdapter';
import { normalizePhone } from '../services/phoneNormalizer';

/** Erros de rede que justificam retry automático */
const RETRYABLE_CODES = new Set(['EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']);

/** Retry com backoff exponencial para chamadas à Evolution Go */
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
 * - As ROTAS são sempre as mesmas (/send/text, /message/presence, etc.) independente da instância.
 *   O que muda é apenas o cliente Axios (baseURL + apikey).
 * - Para diferenciar instâncias no mesmo servidor, a instância é passada no campo `instance`
 *   do corpo da requisição (conforme documentação Evolution Go).
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
      timeout: 30000, // 30s — suporta sync pesada pós-reconexão
    });
  }

  /**
   * Retorna o cliente Axios e o nome da instância configurados para o restaurante.
   * Se não houver configurações personalizadas, faz fallback para o .env global.
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
   * Suporta chamadas legadas: sendText(number, text)
   * E chamadas SaaS:  sendText(restauranteId, number, text)
   */
  async sendText(
    restauranteIdOrNumber: string | null | undefined,
    numberOrText?: string,
    text?: string,
    isDelivery: boolean = false,
    overrideInstanceName?: string,
  ): Promise<void> {
    let restauranteId: string | null | undefined;
    let number: string;
    let messageText: string;

    if (text !== undefined) {
      // Chamada SaaS: sendText(restauranteId, number, text)
      restauranteId = restauranteIdOrNumber;
      number = numberOrText || '';
      messageText = text;
    } else {
      // Chamada Legada: sendText(number, text)
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      messageText = numberOrText || '';
    }

    const { axiosClient, instanceName: defaultInstanceName } = await this.getClientForRestaurante(restauranteId, isDelivery);
    let instanceName = defaultInstanceName;

    // Se o webhook forneceu explicitamente o nome da instância que recebeu a mensagem, prioriza ela!
    if (overrideInstanceName && overrideInstanceName.trim()) {
      instanceName = overrideInstanceName.trim();
    }



    const cleanNumber = normalizePhone(number);

    await withRetry(async () => {
      try {
        await axiosClient.post('/send/text', {
          instance: instanceName,
          number: cleanNumber,
          text: messageText,
          delay: 1000,
        });
        console.log(`[Evolution Go] ✅ Texto enviado para ${cleanNumber} (Instância: ${instanceName})`);

      } catch (err: any) {
        console.error(`[Evolution Go] ❌ Erro ao enviar texto:`, err.response?.data || err.message);
        throw err;
      }
    }, `sendText(${cleanNumber})`);  
  }

  /**
   * Envia status "digitando..." ou "gravando..." no chat.
   * Suporta chamadas legadas: sendPresence(number, state)
   * E chamadas SaaS:  sendPresence(restauranteId, number, state)
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
      // Chamada Legada: sendPresence(number, state)
      restauranteId = undefined;
      number = restauranteIdOrNumber || '';
      presenceState = numberOrState;
    } else {
      // Chamada SaaS: sendPresence(restauranteId, number, state)
      restauranteId = restauranteIdOrNumber;
      number = numberOrState || '';
      presenceState = state;
    }

    const cleanNumber = normalizePhone(number);
    const { axiosClient, instanceName } = await this.getClientForRestaurante(restauranteId);

    try {
      await axiosClient.post('/message/presence', {
        number: cleanNumber,
        state: presenceState,
        isAudio: presenceState === 'recording',
      });
    } catch (err: any) {
      console.warn(`[Evolution Go] ⚠️ Presença falhou:`, err.response?.data || err.message);
      // Presença é opcional — não lança erro
    }
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento) via Evolution Go.
   * Suporta chamadas legadas: sendMedia(opts)
   * E chamadas SaaS:  sendMedia(restauranteId, opts)
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
   * Baixa mídia de uma mensagem.
   * Suporta chamadas legadas: downloadMedia(message)
   * E chamadas SaaS:  downloadMedia(restauranteId, message)
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
      console.error(`[Evolution] ❌ Erro ao baixar mídia:`, err.response?.data || err.message);
      throw err;
    }
  }
}

export const evolution = new EvolutionAdapter();
