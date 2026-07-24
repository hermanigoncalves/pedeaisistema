import { FastifyInstance } from 'fastify';
import { MessageType } from '../types';
import { normalizePhone } from '../services/phoneNormalizer';
import { pushToBuffer, waitAndCollect } from '../services/messageBuffer';
import { transcribeAudio, analyzeImage } from '../services/mediaService';
import { sendTypingAndWait } from '../services/presenceService';
import { evolution } from '../adapters/evolutionAdapter';
import { supabase } from '../adapters/supabaseAdapter';
import { runAgent } from '../agents/pedeaiAgent';
import { runDeliveryAgent } from '../agents/deliveryAgent';

export function registerWebhookRoutes(app: FastifyInstance) {
  // Webhook Principal para Salão / Mesas / Atendimento Geral
  app.post('/webhook/pedeai', async (request, reply) => {
    return handleWebhookRequest(request, reply, 'pedeai');
  });

  // Webhook Exclusivo para Delivery e Entregas
  app.post('/webhook/delivery', async (request, reply) => {
    return handleWebhookRequest(request, reply, 'delivery');
  });

  // Webhook Genérico (Fallback)
  app.post('/webhook', async (request, reply) => {
    return handleWebhookRequest(request, reply, 'pedeai');
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

    return reply.code(200).send({ success: true, message: 'Despacho processado pelo Agente de Delivery' });
  });
}

async function handleWebhookRequest(request: any, reply: any, agentType: 'pedeai' | 'delivery') {
  const payload = request.body as any;
  const log = request.log;

  const event = payload.event || '';
  const data = payload.data || {};
  const info = data.Info || {};
  const message = data.Message || {};

  // LOG diagnóstico
  log.warn({
    event,
    agentType,
    hasInfo: !!data.Info,
    sender: info.Sender?.slice(0, 15),
    isFromMe: info.IsFromMe,
    isGroup: info.IsGroup,
    type: info.Type,
    pushName: info.PushName,
  }, `[WEBHOOK ${agentType.toUpperCase()}] Evento recebido`);

  // 1. Só processa evento "Message"
  if (event !== 'Message') {
    return reply.code(200).send({ ignored: true, reason: `event=${event}` });
  }

  // 2. Ignora grupos
  if (info.IsGroup) {
    return reply.code(200).send({ ignored: true, reason: 'group' });
  }

  // 3. Ignora mensagens enviadas por nós
  if (info.IsFromMe) {
    return reply.code(200).send({ ignored: true, reason: 'fromMe' });
  }

  // 4. Extrai remoteJid
  const remoteJid = info.Chat || info.Sender || '';
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
      const senderName = info.PushName || 'Cliente';

      let messageType: MessageType = 'unknown';
      let rawText = '';
      let mediaUrl = '';
      let fileName = '';

      if (message.conversation) {
        messageType = 'text';
        rawText = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        messageType = 'text';
        rawText = message.extendedTextMessage.text;
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

      if (messageType === 'unknown') {
        log.warn('[PIPELINE] Tipo de mensagem desconhecido. Ignorando.');
        return;
      }

      // Transcrição de áudio se necessário
      if (messageType === 'audio') {
        if (!mediaUrl && message.base64) {
          mediaUrl = `data:audio/ogg;base64,${message.base64}`;
        }
        if (mediaUrl) {
          log.warn({ mediaUrl: mediaUrl.slice(0, 50) }, '[PIPELINE] Transcrevendo áudio...');
          rawText = await transcribeAudio(mediaUrl);
        } else {
          log.warn('[PIPELINE] Mensagem de áudio sem URL ou base64.');
          return;
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

      // 7. Resolver restaurante dinamicamente pela Instância Evolution recebida no webhook
      const instanceName = payload.instance || payload.instanceId || info.Instance || '';
      let detectedRestaurante = null;

      if (instanceName) {
        log.warn({ instanceName, isDelivery: agentType === 'delivery' }, '[PIPELINE] Buscando restaurante pela instância Evolution...');
        detectedRestaurante = await supabase.getRestauranteByEvolutionInstance(instanceName, agentType === 'delivery');
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

      // 8.5 Trava de Segurança do Salão: Se for canal de Salão (pedeai) e NÃO tiver mesa ativa, NÃO responde!
      if (agentType === 'pedeai') {
        const mesaAtiva = userData.mesa_atual && userData.mesa_atual !== '0' && userData.mesa_atual !== '';
        if (!mesaAtiva) {
          log.warn({ phone, mesa: userData.mesa_atual }, '[PIPELINE] 🛑 Usuário sem mesa ativa no Salão. Ignorando resposta automática do robô de mesas.');
          return;
        }
      }

      // 9. Executar o Agente IA correspondente (Salão vs Delivery)
      log.warn(`[PIPELINE] Executando agente IA (${agentType.toUpperCase()})...`);

      let agentResponse = '';
      if (agentType === 'delivery') {
        agentResponse = await runDeliveryAgent(phone, collectedMessage, userData);
      } else {
        agentResponse = await runAgent(phone, collectedMessage, userData);
      }

      log.warn(`[PIPELINE] Resposta IA (${agentType}): "${agentResponse.slice(0, 80)}"`);

      // 10. Enviar resposta via WhatsApp pela instância do tipo de agente correspondente
      const isDelivery = agentType === 'delivery';
      await sendTypingAndWait(restauranteId, phone, 1000);
      await evolution.sendText(restauranteId, phone, agentResponse, isDelivery);

      // 11. Salvar resposta da IA no Supabase
      if (userData.id_restaurante) {
        try {
          await supabase.saveMensagem({
            restaurante_id: userData.id_restaurante,
            telefone: phone,
            nome_contato: agentType === 'delivery' ? 'Delivery Agent' : 'PedeAI',
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
