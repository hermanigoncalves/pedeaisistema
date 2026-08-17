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
 * Retorna todos os formatos possíveis de chatId (JID) para o número no WhatsApp.
 * Cobre números brasileiros com e sem 9º dígito e domínios @c.us e @s.whatsapp.net
 * para contornar falhas de resolução de LID no WAHA.
 */
function getAllCandidateChatIds(number: string): string[] {
  if (!number) return [];
  const clean = normalizePhone(number);
  const numOnly = clean.split('@')[0].replace(/\D/g, '');
  const candidates: string[] = [];

  if (numOnly.startsWith('55')) {
    // Número BR com 13 dígitos: 55 + DDD (2) + 9 (1) + 8 dígitos
    if (numOnly.length === 13) {
      const ddd = numOnly.substring(2, 4);
      const ninth = numOnly.substring(4, 5);
      const rest = numOnly.substring(5);

      if (ninth === '9') {
        const withoutNine = '55' + ddd + rest;
        // Prioriza o formato sem 9 (padrão de contas antigas e modo LID Meta) e com @s.whatsapp.net
        candidates.push(`${withoutNine}@s.whatsapp.net`);
        candidates.push(`${withoutNine}@c.us`);
        candidates.push(`${numOnly}@s.whatsapp.net`);
        candidates.push(`${numOnly}@c.us`);
      } else {
        candidates.push(`${numOnly}@s.whatsapp.net`);
        candidates.push(`${numOnly}@c.us`);
      }
    } else if (numOnly.length === 12) {
      // Número BR com 12 dígitos: 55 + DDD (2) + 8 dígitos
      const ddd = numOnly.substring(2, 4);
      const rest = numOnly.substring(4);
      const withNine = '55' + ddd + '9' + rest;

      candidates.push(`${numOnly}@c.us`);
      candidates.push(`${withNine}@c.us`);
      candidates.push(`${numOnly}@s.whatsapp.net`);
      candidates.push(`${withNine}@s.whatsapp.net`);
    } else {
      candidates.push(`${numOnly}@c.us`);
      candidates.push(`${numOnly}@s.whatsapp.net`);
    }
  } else if (clean.includes('@')) {
    const base = clean.split('@')[0];
    candidates.push(clean);
    candidates.push(clean.includes('@c.us') ? `${base}@s.whatsapp.net` : `${base}@c.us`);
  } else if (numOnly) {
    candidates.push(`${numOnly}@c.us`);
    candidates.push(`${numOnly}@s.whatsapp.net`);
  }

  // Remove duplicatas mantendo a ordem
  return Array.from(new Set(candidates));
}

function toWahaChatId(number: string): string {
  const candidates = getAllCandidateChatIds(number);
  return candidates[0] || `${normalizePhone(number)}@c.us`;
}

function getAlternateChatId(chatId: string): string | null {
  const candidates = getAllCandidateChatIds(chatId);
  const alt = candidates.find(c => c !== chatId);
  return alt || null;
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
   * Verifica se o contato existe no WhatsApp e resolve o LID no WAHA.
   * Isso força o container WAHA (especialmente engine GOWS/Baileys) a buscar o LID
   * oficial nos servidores do WhatsApp antes de enviar mensagem para contatos novos.
   */
  async checkContactExists(
    number: string,
    sessionName: string,
    axiosClient: AxiosInstance,
  ): Promise<{ exists: boolean; chatId?: string } | null> {
    const cleanNumber = number.split('@')[0].replace(/\D/g, '');
    const endpoints = [
      `/api/contacts/check-exists?phone=${cleanNumber}&session=${sessionName}`,
      `/api/contacts/check-number-status?phone=${cleanNumber}&session=${sessionName}`,
      `/api/${sessionName}/contacts/check-exists?phone=${cleanNumber}`,
      `/api/contacts/check-exists?chatId=${cleanNumber}%40c.us&session=${sessionName}`,
    ];

    for (const ep of endpoints) {
      try {
        const res = await axiosClient.get(ep);
        if (res.data) {
          const numberExists = res.data.numberExists ?? res.data.exists ?? (res.data.isBusiness !== undefined);
          const resolvedChatId = res.data.chatId || res.data.jid || (numberExists ? `${cleanNumber}@c.us` : undefined);
          if (numberExists && resolvedChatId) {
            console.log(`[WAHA API] 🔍 Contato verificado com sucesso via ${ep}: ${resolvedChatId}`);
            return { exists: true, chatId: resolvedChatId };
          }
        }
      } catch {
        // Tenta o próximo endpoint
      }
    }
    return null;
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

    const { axiosClient, sessionName: defaultSessionName } = await this.getClientForRestaurante(restauranteId, isDelivery);
    let sessionName = defaultSessionName;

    if (overrideSessionName && overrideSessionName.trim()) {
      sessionName = await this.getWorkingSession(overrideSessionName.trim(), axiosClient);
    }

    const candidateChatIds = getAllCandidateChatIds(number);
    const primaryChatId = candidateChatIds[0] || toWahaChatId(number);

    await withRetry(async () => {
      // 1. Tentar primeiro o primaryChatId
      try {
        await axiosClient.post('/api/sendText', {
          session: sessionName,
          chatId: primaryChatId,
          text: messageText,
        });
        console.log(`[WAHA API] ✅ Texto enviado para ${primaryChatId} (Sessão: ${sessionName})`);
        return;
      } catch (err: any) {
        const errObj = err.response?.data;
        const errMsg = JSON.stringify(errObj || err.message || '');
        const isLidOrNotFoundError =
          errMsg.includes('no LID found') ||
          errMsg.includes('LID') ||
          errMsg.includes('not found') ||
          errMsg.includes('Contact not found') ||
          err.response?.status === 500;

        // 2. Se falhar com no LID found, tenta verificar existência do contato para forçar o WAHA a sincronizar o LID
        if (isLidOrNotFoundError) {
          console.warn(`[WAHA API] ⚠️ Contato ${primaryChatId} retornou erro de LID. Verificando cadastro no WhatsApp...`);
          
          for (const cand of candidateChatIds) {
            const checkResult = await this.checkContactExists(cand, sessionName, axiosClient);
            if (checkResult?.exists && checkResult.chatId) {
              try {
                console.log(`[WAHA API] 🔄 Tentando enviar para o chatId verificado: ${checkResult.chatId}...`);
                await axiosClient.post('/api/sendText', {
                  session: sessionName,
                  chatId: checkResult.chatId,
                  text: messageText,
                });
                console.log(`[WAHA API] ✅ Texto enviado com sucesso após resolução de LID para ${checkResult.chatId}`);
                return;
              } catch (retryErr: any) {
                console.warn(`[WAHA API] ⚠️ Envio para ${checkResult.chatId} falhou após verificação:`, retryErr.response?.data || retryErr.message);
              }
            }
          }
        }

        // 3. Se ainda não enviou, tenta TODOS os outros formatos candidatos
        if (isLidOrNotFoundError && candidateChatIds.length > 1) {
          for (const altChatId of candidateChatIds) {
            if (altChatId === primaryChatId) continue;
            try {
              console.warn(`[WAHA API] ⚠️ Tentando formato alternativo: ${altChatId} (Sessão: ${sessionName})...`);
              await axiosClient.post('/api/sendText', {
                session: sessionName,
                chatId: altChatId,
                text: messageText,
              });
              console.log(`[WAHA API] ✅ Texto enviado com sucesso para formato alternativo ${altChatId} (Sessão: ${sessionName})`);
              return;
            } catch (altErr: any) {
              console.warn(`[WAHA API] ⚠️ Formato alternativo ${altChatId} falhou:`, altErr.response?.data?.message || altErr.message);
            }
          }
        }

        // 4. Se deu erro de sessão inexistente, força atualização de cache e tenta com a sessão ativa
        if (errObj?.error && typeof errObj.error === 'string' && errObj.error.includes('does not exist')) {
          console.warn(`[WAHA API] ⚠️ Sessão '${sessionName}' não encontrada. Buscando sessões ativas do container...`);
          const resolved = await this.getWorkingSession(sessionName, axiosClient, true);
          if (resolved !== sessionName) {
            console.log(`[WAHA API] 🔄 Re-enviando mensagem com a sessão ativa resolvida: '${resolved}'`);
            await axiosClient.post('/api/sendText', {
              session: resolved,
              chatId: primaryChatId,
              text: messageText,
            });
            console.log(`[WAHA API] ✅ Texto enviado com sucesso para ${primaryChatId} (Sessão: ${resolved})`);
            return;
          }
        }

        if (isLidOrNotFoundError) {
          console.error(`[WAHA API] ❌ Número não encontrado nos servidores do WhatsApp: ${number} (verifique se o número possui WhatsApp ativo ou se foi digitado corretamente)`);
        } else {
          console.error(`[WAHA API] ❌ Erro ao enviar texto para ${primaryChatId} (formatos tentados: ${candidateChatIds.join(', ')}):`, errObj || err.message);
        }
        throw err;
      }
    }, `sendText(${primaryChatId})`);
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

    const candidateChatIds = getAllCandidateChatIds(mediaOpts?.number || '');
    const primaryChatId = candidateChatIds[0] || toWahaChatId(mediaOpts?.number || '');
    const { axiosClient, sessionName } = await this.getClientForRestaurante(restauranteId);

    await withRetry(async () => {
      let endpoint = '/api/sendFile';
      let defaultMime = 'application/octet-stream';

      if (mediaOpts.mediatype === 'image') {
        endpoint = '/api/sendImage';
        defaultMime = 'image/jpeg';
      } else if (mediaOpts.mediatype === 'audio') {
        endpoint = '/api/sendVoice';
        defaultMime = mediaOpts.media.includes('.webm') ? 'audio/webm' : 'audio/ogg';
      }

      const buildPayload = (targetChatId: string) => {
        const payload: Record<string, any> = {
          session: sessionName,
          chatId: targetChatId,
          file: {
            url: mediaOpts.media,
            filename: mediaOpts.fileName || (mediaOpts.mediatype === 'audio' ? 'audio.ogg' : 'arquivo'),
            mimetype: defaultMime,
          },
        };

        if (mediaOpts.caption && mediaOpts.mediatype !== 'audio') {
          payload.caption = mediaOpts.caption;
        }
        return payload;
      };

      try {
        await axiosClient.post(endpoint, buildPayload(primaryChatId));
        console.log(`[WAHA API] ✅ Mídia (${mediaOpts.mediatype}) enviada para ${primaryChatId} (Sessão: ${sessionName})`);
        return;
      } catch (err: any) {
        const errObj = err.response?.data;
        const errMsg = JSON.stringify(errObj || err.message || '');
        const isLidOrNotFoundError =
          errMsg.includes('no LID found') ||
          errMsg.includes('LID') ||
          errMsg.includes('not found') ||
          err.response?.status === 500;

        if (isLidOrNotFoundError && candidateChatIds.length > 1) {
          for (const altChatId of candidateChatIds) {
            if (altChatId === primaryChatId) continue;
            try {
              console.warn(`[WAHA API] ⚠️ Tentando enviar mídia para formato alternativo: ${altChatId}...`);
              await axiosClient.post(endpoint, buildPayload(altChatId));
              console.log(`[WAHA API] ✅ Mídia enviada com sucesso para ${altChatId} (Sessão: ${sessionName})`);
              return;
            } catch (altErr: any) {
              console.warn(`[WAHA API] ⚠️ Mídia para ${altChatId} falhou:`, altErr.response?.data?.message || altErr.message);
            }
          }
        }

        console.error(`[WAHA API] ❌ Erro ao enviar mídia (${mediaOpts?.mediatype}):`, errObj || err.message);
        throw err;
      }
    }, `sendMedia(${primaryChatId})`);
  }

  /**
   * Baixa mídia do WAHA se necessário.
   */
  async downloadMedia(restauranteId: string | null, rawMessage: any): Promise<Buffer | null> {
    try {
      const rawUrl =
        rawMessage?.media?.url ||
        rawMessage?.mediaUrl ||
        rawMessage?.url ||
        rawMessage?.file?.url ||
        rawMessage?._data?.Message?.audioMessage?.url ||
        rawMessage?._data?.Message?.imageMessage?.url ||
        rawMessage?._data?.Message?.videoMessage?.url ||
        rawMessage?._data?.Message?.documentMessage?.url;

      if (!rawUrl) {
        console.warn(`[WAHA API] ⚠️ Nenhuma URL de mídia encontrada no payload`);
        return null;
      }

      // Se a URL do WAHA contiver 'localhost:3000' ou a URL pública, extrai o caminho relativo /api/files/...
      // para forçar a requisição através da rede interna do Docker (http://polis_waha:3000)
      let downloadPath = rawUrl;
      if (rawUrl.includes('/api/files/')) {
        downloadPath = '/api/files/' + rawUrl.split('/api/files/')[1];
      }

      const { axiosClient } = await this.getClientForRestaurante(restauranteId);
      console.log(`[WAHA API] 🌐 Baixando mídia do WAHA via rota interna: ${downloadPath}`);
      const res = await axiosClient.get(downloadPath, { responseType: 'arraybuffer' });
      return Buffer.from(res.data);
    } catch (err: any) {
      console.error(`[WAHA API] ❌ Erro ao baixar mídia (${err.config?.url || 'URL desconhecida'}):`, err.message);
      return null;
    }
  }
}

export const waha = new WahaAdapter();
// Exporta alias 'evolution' para manter retrocompatibilidade transparente
export const evolution = waha;
