import { FastifyInstance } from 'fastify';
import { evolution } from '../adapters/evolutionAdapter';
import { supabase } from '../adapters/supabaseAdapter';

export function registerChatRoutes(app: FastifyInstance) {
  app.post('/api/chat/send', async (request, reply) => {
    const { telefone, conteudo, tipo, mediaUrl, fileName } = request.body as {
      telefone: string;
      conteudo: string;
      tipo: 'text' | 'audio' | 'image' | 'video' | 'document';
      mediaUrl?: string;
      fileName?: string;
    };

    if (!telefone) {
      return reply.code(400).send({ error: 'Telefone é obrigatório' });
    }

    try {
      // 1. Disparar via Evolution API de acordo com o tipo
      if (tipo === 'text') {
        await evolution.sendText(telefone, conteudo);
      } else {
        if (!mediaUrl) {
          return reply.code(400).send({ error: 'URL de mídia é obrigatória para este tipo' });
        }
        await evolution.sendMedia({
          number: telefone,
          mediatype: tipo,
          media: mediaUrl,
          caption: conteudo,
          fileName: fileName || 'arquivo',
        });
      }

      // 2. Buscar dados do restaurante para salvar
      const userData = await supabase.getUserByPhone(telefone);
      const restauranteId = userData?.id_restaurante || null;

      if (!restauranteId) {
        return reply.code(400).send({ error: 'Restaurante não identificado para este contato' });
      }

      // 3. Salvar na tabela mensagens do Supabase (direcao = 'enviada')
      const savedMsg = await supabase.saveMensagem({
        restaurante_id: restauranteId,
        telefone,
        nome_contato: 'Restaurante',
        conteudo: conteudo || mediaUrl || `[${tipo}]`,
        tipo,
        direcao: 'enviada',
        metadata: mediaUrl ? { mediaUrl, fileName, mimeType: tipo } : undefined,
      });

      return reply.code(200).send({ success: true, message: savedMsg });
    } catch (err: any) {
      request.log.error(err, 'Erro ao enviar mensagem pelo caixa');
      return reply.code(500).send({ error: err.message });
    }
  });

  // Rota para alternar entre atendimento IA e atendimento humano
  app.post('/api/chat/toggle-bot', async (request, reply) => {
    const { telefone, chat_humano } = request.body as {
      telefone: string;
      chat_humano: boolean;
    };

    if (!telefone) {
      return reply.code(400).send({ error: 'Telefone é obrigatório' });
    }

    try {
      const userData = await supabase.getUserByPhone(telefone);
      if (!userData) {
        return reply.code(404).send({ error: 'Usuário não encontrado' });
      }

      // Atualiza flag chat_humano usando service_role (bypass RLS)
      const { error } = await supabase.client
        .from('Usuários')
        .update({ chat_humano })
        .eq('id', userData.id);

      if (error) throw error;

      console.log(`[ToggleBot] ✅ chat_humano=${chat_humano} para telefone ${telefone}`);
      return reply.code(200).send({ success: true, chat_humano });
    } catch (err: any) {
      request.log.error(err, 'Erro ao alternar status do bot');
      return reply.code(500).send({ error: err.message });
    }
  });
}
