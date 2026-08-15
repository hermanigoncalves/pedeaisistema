import { FastifyInstance } from 'fastify';
import { FirstMessagePayload } from '../types';
import { waha, evolution } from '../adapters/wahaAdapter';
import { supabase } from '../adapters/supabaseAdapter';
import { sendTypingAndWait } from '../services/presenceService';
import { clearMemory } from '../agents/pedeaiAgent';
import { normalizePhone } from '../services/phoneNormalizer';

/**
 * Controller: Primeira Mensagem (Saudação de Check-in)
 * Equivale ao workflow "IA Primeira Mensagem (PedeAi)"
 * 
 * Chamado pelo frontend quando o cliente faz check-in na mesa.
 */
export function registerFirstMessageRoutes(app: FastifyInstance) {
  const handleFirstMessage = async (request: any, reply: any) => {
    const payload = request.body as FirstMessagePayload;

    const phone = normalizePhone(payload.telefone || '');

    console.log(`[FirstMsg] 📥 Check-in recebido:`, {
      nome: payload.nome,
      telefone: phone ? phone.slice(0, 6) + '...' : 'vazio',
      mesa: payload.mesaId,
      restaurante: payload.restauranteNome,
      isFirstVisit: payload.isFirstVisit,
      visits: payload.visits,
    });

    // Responde imediatamente ao frontend
    reply.code(200).send({ received: true });

    try {
      // Validar dados obrigatórios
      if (!phone || !payload.nome) {
        console.error(`[FirstMsg] ❌ Payload incompleto: telefone=${payload.telefone}, nome=${payload.nome}`);
        return;
      }

      // Limpar memória do agente para este telefone (nova sessão = conversa limpa)
      clearMemory(phone);

      // Digitando...
      await sendTypingAndWait(payload.restauranteId, phone, 1500);

      const restName = payload.restauranteNome || 'Polis Pub';
      const isPolis = restName.toLowerCase().includes('polis') || (payload.restauranteId === '875bcd11-b91d-4abc-aae8-ee587df23717');

      let mensagem: string;

      if (isPolis) {
        mensagem = `Olá, ${payload.nome}! 👋 Seja muito bem-vindo à Polis Pub — Experiência PedeAI! 🤖💚\n\nVocê está experimentando uma nova forma de fazer pedidos, em uma parceria oficial com a ABRASEL.\n\nAqui você não precisa procurar botões ou seguir opções prontas: é só falar comigo normalmente, por texto ou áudio. 😊\n\nPor exemplo, você pode dizer:\n"Quero duas porções de coxinha e um chopp, por favor."\n\nEu vou entender seu pedido, tirar suas dúvidas e ajudar você durante toda a experiência. 🍽️\n\nE quando estiver satisfeito e quiser encerrar, é só pedir "quero a conta" que vamos dar sequência ao fechamento da sua mesa.\n\nPode começar! O que você gostaria de pedir? 🚀`;
      } else if (payload.isFirstVisit) {
        mensagem = `Olá, ${payload.nome}! 👋 Seja muito bem-vindo(a) ao ${payload.restauranteNome}.\n\nFicamos muito felizes em ter você aqui conosco pela primeira vez! Já abrimos o seu atendimento na Mesa ${payload.mesaId}. 📲\n\nComo posso te ajudar hoje? Se quiser dar uma olhada no nosso cardápio ou fazer um pedido, é só me falar! 🍔🍻`;
      } else {
        mensagem = `Olá, ${payload.nome}! 👋 Que alegria ter você de volta ao ${payload.restauranteNome}!\n\nEsta já é a sua visita número ${payload.visits} conosco! 🏆 Seu atendimento na Mesa ${payload.mesaId} já foi iniciado. 📲\n\nJá sabe o que vai pedir dessa vez ou quer dar mais uma olhadinha no cardápio? Sinta-se em casa! 😊🍔🍻`;
      }

      console.log(`[FirstMsg] 📤 Enviando saudação para ${payload.nome} (${phone.slice(0, 6)}...)`);
      await evolution.sendText(payload.restauranteId, phone, mensagem);
      console.log(`[FirstMsg] ✅ Saudação enviada com sucesso para ${payload.nome}`);

      // Salvar no histórico de mensagens do Supabase
      if (payload.restauranteId) {
        await supabase.saveMensagem({
          restaurante_id: payload.restauranteId,
          telefone: phone,
          nome_contato: 'PedeAI',
          conteudo: mensagem,
          tipo: 'text',
          direcao: 'enviada',
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error(`[FirstMsg] ❌ Erro ao enviar saudação para ${payload.nome}:`, err.message);
      console.error(`[FirstMsg] Stack:`, err.stack);
    }
  };

  app.post('/webhook/leadpedeaichegou', handleFirstMessage);
  app.post('/api/webhook/leadpedeaichegou', handleFirstMessage);
}
