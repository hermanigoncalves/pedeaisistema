import { FastifyInstance } from 'fastify';
import { MessageType } from '../types';
import { normalizePhone } from '../services/phoneNormalizer';
import { pushToBuffer, waitAndCollect } from '../services/messageBuffer';
import { transcribeAudio, analyzeImage, downloadAndProcess } from '../services/mediaService';
import { sendTypingAndWait } from '../services/presenceService';
import { waha, evolution } from '../adapters/wahaAdapter';
import { supabase } from '../adapters/supabaseAdapter';
import { runAgent } from '../agents/pedeaiAgent';

export function registerWebhookRoutes(app: FastifyInstance) {
  // Webhook Principal PedeAI (Salão / Mesas / Delivery / Geral)
  app.post('/webhook/pedeai', async (request, reply) => {
    return handleWebhookRequest(request, reply);
  });

  // Webhook para compatibilidade Delivery
  app.post('/webhook/delivery', async (request, reply) => {
    return handleWebhookRequest(request, reply);
  });

  // Webhook Genérico (Fallback)
  app.post('/webhook', async (request, reply) => {
    return handleWebhookRequest(request, reply);
  });

  // Endpoint de Despacho de Pedidos acionado pelo Kanban
  app.post('/api/delivery/dispatch', async (request, reply) => {
    const payload = request.body as any;
    request.log.info({ payload }, '[DISPATCH] Notificação de despacho recebida do Kanban');

    // Notifica via WhatsApp o cliente ou entregador se telefone estiver presente
    if (payload.cliente_telefone) {
      const phone = normalizePhone(payload.cliente_telefone);
      const msg = `🛵 *Seu pedido #${payload.pedido_id} saiu para entrega!* \n\nObrigado por comprar conosco. Em breve estará em seu endereço!`;
      try {
        await evolution.sendText(null, phone, msg);
      } catch (err: any) {
        request.log.warn({ err: err.message }, '[DISPATCH] Erro ao enviar WhatsApp do despacho');
      }
    }

    return reply.code(200).send({ success: true, message: 'Despacho processado pelo PedeAí' });
  });
}

async function handleWebhookRequest(request: any, reply: any) {
  const payload = request.body as any;
  const log = request.log;

  const rawEvent = (payload.event || payload.type || '').toString();
  const normalizedEvent = rawEvent.toLowerCase();

  // Aceita "Message", "messages.upsert", "messages_upsert", "send.message" ou qualquer variação com "message"
  const isMessageEvent = normalizedEvent === 'message' ||
    normalizedEvent.includes('messages.upsert') ||
    normalizedEvent.includes('messages_upsert') ||
    normalizedEvent === 'send.message' ||
    normalizedEvent.includes('message');

  // 1. Encontra a mensagem em qualquer nível do payload WAHA / Evolution
  const wahaMsg = payload.payload || (payload.data && !payload.data.Info ? payload.data : null) || (payload.from || payload.chatId ? payload : null);

  let rawData = payload.data || {};
  if (Array.isArray(rawData)) {
    rawData = rawData[0] || {};
  } else if (Array.isArray(rawData.messages)) {
    rawData = rawData.messages[0] || {};
  }

  const info = rawData.Info || payload.Info || {};
  const key = rawData.key || payload.key || (wahaMsg?._data?.key) || {};
  const message = rawData.Message || rawData.message || payload.Message || payload.message || {};

  const isGroup = wahaMsg?.from?.endsWith('@g.us') || wahaMsg?.to?.endsWith('@g.us') || wahaMsg?.chatId?.endsWith('@g.us') || info.IsGroup || key.remoteJid?.endsWith('@g.us') || rawData.isGroup || false;
  const isFromMe = wahaMsg?.fromMe ?? info.IsFromMe ?? key.fromMe ?? rawData.fromMe ?? payload.fromMe ?? false;

  // Extração exaustiva de remoteJid (WhatsApp JID do remetente)
  let candidateJid =
    (wahaMsg?.from && !wahaMsg.from.includes('@lid') ? wahaMsg.from : null) ||
    (wahaMsg?.chatId && !wahaMsg.chatId.includes('@lid') ? wahaMsg.chatId : null) ||
    wahaMsg?._data?.key?.remoteJid ||
    wahaMsg?._data?.from ||
    wahaMsg?.author ||
    key.remoteJid ||
    info.Chat ||
    info.Sender ||
    rawData.remoteJid ||
    payload.from ||
    payload.chatId ||
    payload.sender ||
    wahaMsg?.from ||
    '';

  const remoteJid = candidateJid;
  const pushName = wahaMsg?._data?.notifyName || wahaMsg?.notifyName || wahaMsg?._data?.pushName || info.PushName || rawData.pushName || payload.pushName || 'Cliente';

  // LOG diagnóstico
  log.warn({
    rawEvent,
    isMessageEvent,
    remoteJid,
    isFromMe,
    isGroup,
    pushName,
    session: payload.session || payload.instance,
  }, `[WEBHOOK PEDEAI] Evento recebido`);

  // 1. Só processa eventos de mensagem
  if (!isMessageEvent) {
    return reply.code(200).send({ ignored: true, reason: `event=${rawEvent}` });
  }

  // 2. Ignora grupos
  if (isGroup) {
    return reply.code(200).send({ ignored: true, reason: 'group' });
  }

  // 3. Ignora mensagens enviadas por nós
  if (isFromMe) {
    return reply.code(200).send({ ignored: true, reason: 'fromMe' });
  }

  // 4. Extrai remoteJid
  if (!remoteJid) {
    return reply.code(200).send({ ignored: true, reason: 'no jid' });
  }

  // Responde imediatamente ao webhook HTTP 200 OK
  reply.code(200).send({ received: true });

  // 5. Processamento assíncrono em background
  setImmediate(async () => {
    let restauranteId: string | null = null;
    try {
      const phone = normalizePhone(remoteJid);
      const senderName = pushName;

      let messageType: MessageType = 'unknown';
      let rawText = '';
      let mediaUrl = '';
      let fileName = '';

      if (wahaMsg) {
        if (wahaMsg.body) {
          rawText = wahaMsg.body;
          messageType = 'text';
        } else if (typeof wahaMsg.text === 'string') {
          rawText = wahaMsg.text;
          messageType = 'text';
        }
        if (wahaMsg.hasMedia && (wahaMsg.media?.url || wahaMsg.mediaUrl)) {
          mediaUrl = wahaMsg.media?.url || wahaMsg.mediaUrl;
          const mime = (wahaMsg.media?.mimetype || wahaMsg.mimetype || '').toLowerCase();
          if (mime.startsWith('audio/')) {
            messageType = 'audio';
          } else if (mime.startsWith('image/')) {
            messageType = 'image';
            if (wahaMsg.caption) rawText = wahaMsg.caption;
          } else if (mime.startsWith('video/')) {
            messageType = 'video';
            if (wahaMsg.caption) rawText = wahaMsg.caption;
          } else {
            messageType = 'document';
            fileName = wahaMsg.media?.filename || wahaMsg.filename || 'documento';
            if (wahaMsg.caption) rawText = wahaMsg.caption;
          }
        }
      }

      if (messageType === 'unknown') {
        if (message.conversation) {
          messageType = 'text';
          rawText = message.conversation;
        } else if (message.extendedTextMessage?.text) {
          messageType = 'text';
          rawText = message.extendedTextMessage.text;
        } else if (typeof message === 'string') {
          messageType = 'text';
          rawText = message;
        } else if (message.audioMessage) {
          messageType = 'audio';
          mediaUrl = message.audioMessage.url || message.mediaUrl || '';
        } else if (message.imageMessage) {
          messageType = 'image';
          mediaUrl = message.imageMessage.url || message.mediaUrl || '';
          rawText = message.imageMessage.caption || '';
        } else if (message.videoMessage) {
          messageType = 'video';
          mediaUrl = message.videoMessage.url || message.mediaUrl || '';
          rawText = message.videoMessage.caption || '';
        } else if (message.documentMessage) {
          messageType = 'document';
          mediaUrl = message.documentMessage.url || message.mediaUrl || '';
          fileName = message.documentMessage.fileName || message.documentMessage.title || 'documento';
          rawText = message.documentMessage.caption || '';
        }
      }

      if (messageType === 'unknown') {
        log.warn('[PIPELINE] Tipo de mensagem desconhecido. Ignorando.');
        return;
      }

      // Transcrição de áudio se necessário
      if (messageType === 'audio') {
        log.warn({ restauranteId }, '[PIPELINE] Baixando e transcrevendo áudio...');
        rawText = await downloadAndProcess(restauranteId, data, 'audio');
        if (!rawText || rawText.includes('[Áudio') || rawText.includes('[Mídia')) {
          const fallbackInput = message.base64 ? `data:audio/ogg;base64,${message.base64}` : mediaUrl;
          if (fallbackInput) {
            log.warn('[PIPELINE] Tentando fallback de transcrição direta do áudio...');
            rawText = await transcribeAudio(fallbackInput);
          }
        }
      }

      // Análise de Imagem se necessário
      if (messageType === 'image' && mediaUrl) {
        log.warn('[PIPELINE] Analisando imagem...');
        const imageDesc = await analyzeImage(mediaUrl);
        rawText = rawText ? `${rawText} (Imagem: ${imageDesc})` : `(Imagem enviada pelo cliente: ${imageDesc})`;
      }

      if (!rawText.trim()) {
        log.warn('[PIPELINE] Texto final vazio após processar mídias. Ignorando.');
        return;
      }

      // 6. Fila com Redis Buffer
      log.warn({ phone, text: rawText }, '[PIPELINE] Adicionando mensagem ao buffer...');
      await pushToBuffer(phone, rawText);

      log.warn({ phone }, '[PIPELINE] Aguardando janela do buffer...');
      const collectedMessage = await waitAndCollect(phone);

      if (!collectedMessage) {
        log.warn({ phone }, '[PIPELINE] Outra execução já consumiu as mensagens. Encerrando.');
        return;
      }

      log.warn({ phone, collectedMessage }, '[PIPELINE] Mensagem coletada do buffer. Processando...');

      // 7. Resolver restaurante dinamicamente pela Sessão WAHA / Instância Evolution recebida no webhook
      const instanceName = payload.session || payload.instance || payload.instanceId || info.Instance || '';
      let detectedRestaurante = null;

      if (instanceName) {
        log.warn({ instanceName }, '[PIPELINE] Buscando restaurante pela sessão WAHA / instância...');
        detectedRestaurante = await supabase.getRestauranteByWahaSession(instanceName, false);
      }

      // Obter ou criar usuário associado ao restaurante correto
      const targetRestauranteId = detectedRestaurante?.id || undefined;
      let userData = await supabase.getOrCreateUser(phone, senderName, targetRestauranteId);

      // Se a instância pertence a um restaurante diferente do cadastrado no usuário, atualiza o usuário no banco!
      if (detectedRestaurante?.id && userData.id_restaurante !== detectedRestaurante.id) {
        log.warn({ phone, oldRest: userData.id_restaurante, newRest: detectedRestaurante.id }, '[PIPELINE] 🔄 Atualizando id_restaurante do usuário para a instância atual');
        await supabase.client
          .from('Usuários')
          .update({ id_restaurante: detectedRestaurante.id })
          .eq('id', userData.id);
        userData.id_restaurante = detectedRestaurante.id;
      }
      restauranteId = detectedRestaurante?.id || userData.id_restaurante || null;

      // 8. Salvar mensagem recebida
      if (userData.id_restaurante) {
        try {
          await supabase.saveMensagem({
            restaurante_id: userData.id_restaurante,
            telefone: phone,
            nome_contato: senderName,
            conteudo: collectedMessage,
            tipo: messageType,
            direcao: 'recebida',
          });
        } catch (err: any) {
          log.error({ err: err.message }, '[PIPELINE] Erro ao salvar mensagem recebida');
        }
      }

      // 9. Executar o Agente IA PedeAí Unificado
      log.warn('[PIPELINE] Executando Agente IA PedeAí...');
      const agentResponse = await runAgent(phone, collectedMessage, userData);

      log.warn(`[PIPELINE] Resposta IA: "${agentResponse.slice(0, 80)}"`);

      // 10. Enviar resposta via WhatsApp pela instância Evolution recebida
      await sendTypingAndWait(restauranteId, phone, 1000);
      await evolution.sendText(restauranteId, phone, agentResponse, false, instanceName);

      // 11. Salvar resposta da IA no Supabase
      if (userData.id_restaurante) {
        try {
          await supabase.saveMensagem({
            restaurante_id: userData.id_restaurante,
            telefone: phone,
            nome_contato: 'PedeAI',
            conteudo: agentResponse,
            tipo: 'text',
            direcao: 'enviada',
          });
        } catch (err: any) {
          log.error({ err: err.message }, '[PIPELINE] Erro ao salvar resposta IA');
        }
      }

    } catch (err: any) {
      log.error({ err: err.message, stack: err.stack }, '[PIPELINE] ❌ ERRO FATAL');
      try {
        const phone = normalizePhone(remoteJid);
        await evolution.sendText(restauranteId, phone, 'Desculpe, tive um probleminha. Pode repetir?');
      } catch {}
    }
  });
}
