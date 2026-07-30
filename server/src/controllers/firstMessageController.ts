import { FastifyInstance } from 'fastify';
import { FirstMessagePayload } from '../types';
import { waha, evolution } from '../adapters/wahaAdapter';
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
  app.post('/webhook/leadpedeaichegou', async (request, reply) => {
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

    // Responde imediatamente
    reply.code(200).send({ received: true });

    try {
      // Validar dados obrigatórios
      if (!phone || !payload.nome) {
        console.error(`[FirstMsg] ❌ Payload incompleto: telefone=${payload.telefone}, nome=${payload.nome}`);
        return;
      }

      // Limpar memória do agente para este telefone (nova sessão = conversa limpa)
      clearMemory(phone);

      // Digitando... (equivale ao Digitando...1 + Wait2)
      await sendTypingAndWait(payload.restauranteId, phone, 1500);

      let mensagem: string;

      if (payload.isFirstVisit) {
        // Primeira vez — equivale ao node "primeiraVez"
        mensagem = `Olá ${payload.nome}! 👋 Seja muito bem-vindo(a) ao ${payload.restauranteNome}.\n\nFicamos muito felizes em ter você aqui conosco pela primeira vez! Já abrimos o seu atendimento na Mesa ${payload.mesaId}. 📲\n\nComo posso te ajudar hoje? Se quiser dar uma olhada no nosso cardápio ou fazer um pedido, é só me falar! 🍔🍻`;
      } else {
        // Recorrente — equivale ao node "usuarioAntigo"
        mensagem = `Olá ${payload.nome}! 👋 Que alegria ter você de volta ao ${payload.restauranteNome}!\n\nEsta já é a sua visita número ${payload.visits} conosco! 🏆 Seu atendimento na Mesa ${payload.mesaId} já foi iniciado. 📲\n\nJá sabe o que vai pedir dessa vez ou quer dar mais uma olhadinha no cardápio? Sinta-se em casa! 😊🍔🍻`;
      }

      console.log(`[FirstMsg] 📤 Enviando saudação para ${payload.nome} (${payload.telefone.slice(0, 6)}...)`);
      await evolution.sendText(payload.restauranteId, payload.telefone, mensagem);
      console.log(`[FirstMsg] ✅ Saudação enviada com sucesso para ${payload.nome}`);
    } catch (err: any) {
      console.error(`[FirstMsg] ❌ Erro ao enviar saudação para ${payload.nome}:`, err.message);
      console.error(`[FirstMsg] Stack:`, err.stack);
    }
  });
}
