import { FastifyInstance } from 'fastify';
import { CloseBillPayload } from '../types';
import { evolution } from '../adapters/evolutionAdapter';
import { supabase } from '../adapters/supabaseAdapter';

/**
 * Controller: Conta Fechada
 * Chamado pelo frontend quando o admin fecha uma mesa ou comanda individual.
 * Realiza as atualizações de banco de dados no Supabase usando service_role (ignora RLS)
 * e opcionalmente envia mensagem de fechamento para o WhatsApp do cliente.
 */
export function registerCloseBillRoutes(app: FastifyInstance) {
  app.post('/webhook/Envia-conta', async (request, reply) => {
    const payload = request.body as CloseBillPayload;

    console.log(`[CloseBill] 📥 Fechamento solicitado para Mesa ${payload.numero_mesa} — Telefone: ${payload.telefone}`);

    try {
      // 1. Identificar o ID do restaurante (SaaS Multi-tenant)
      let restauranteId = payload.restaurante_id || null;
      if (!restauranteId && payload.telefone && payload.telefone !== 'Não informado') {
        const u = await supabase.getUserByPhone(payload.telefone, restauranteId);
        restauranteId = u?.id_restaurante || null;
      }
      
      if (!restauranteId) {
        const { config } = await import('../config');
        restauranteId = config.RESTAURANTE_ID || null;
      }

      if (!restauranteId) {
        const rList = await supabase.getAllRestaurantes();
        if (rList.length > 0) {
          restauranteId = rList[0].id;
        }
      }

      if (restauranteId) {
        // Buscar o restaurante para saber o modo de cobrança
        const { data: restData } = await supabase.client
          .from('Restaurantes')
          .select('modo_cobranca')
          .eq('id', restauranteId)
          .single();

        const isComanda = restData?.modo_cobranca === 'comanda';
        const tableStr = payload.numero_mesa.toString();

        if (isComanda && payload.telefone && payload.telefone !== 'Não informado' && payload.telefone !== 'mesa') {
          console.log(`[CloseBill] Modo Comanda: Gravando fechamento de ${payload.telefone} na mesa ${payload.numero_mesa}`);
          
          // A. Atualizar pedidos deste usuário na mesa para 'fechado'
          const { error: pedErr } = await supabase.client
            .from('Pedidos')
            .update({ status: 'fechado' })
            .eq('restaurante_id', restauranteId)
            .eq('mesa', tableStr)
            .eq('usuario_telefone', payload.telefone)
            .neq('status', 'fechado')
            .neq('status', 'dividido');

          if (pedErr) console.error('[CloseBill] Erro ao fechar pedidos da comanda:', pedErr.message);

          // B. Liberar check-in deste usuário
          const { error: userErr } = await supabase.client
            .from('Usuários')
            .update({ mesa_atual: '0', Status: 'Inativo' })
            .eq('id_restaurante', restauranteId)
            .eq('telefone', payload.telefone)
            .eq('mesa_atual', tableStr);

          if (userErr) console.error('[CloseBill] Erro ao liberar check-in da comanda:', userErr.message);

        } else {
          console.log(`[CloseBill] Modo Mesa (ou comanda geral): Gravando fechamento total da mesa ${payload.numero_mesa}`);

          // A. Atualizar todos os pedidos ativos da mesa para 'fechado'
          const { error: pedErr } = await supabase.client
            .from('Pedidos')
            .update({ status: 'fechado' })
            .eq('restaurante_id', restauranteId)
            .eq('mesa', tableStr)
            .neq('status', 'fechado')
            .neq('status', 'dividido');

          if (pedErr) console.error('[CloseBill] Erro ao fechar pedidos da mesa:', pedErr.message);

          // B. Liberar check-in de todos os usuários sentados nessa mesa
          const { error: userErr } = await supabase.client
            .from('Usuários')
            .update({ mesa_atual: '0', Status: 'Inativo' })
            .eq('id_restaurante', restauranteId)
            .eq('mesa_atual', tableStr);

          if (userErr) console.error('[CloseBill] Erro ao liberar check-in da mesa:', userErr.message);
        }
      }

      // Responde com sucesso ao frontend após a persistência segura no banco
      reply.code(200).send({ success: true });

      // 2. Enviar a mensagem para o WhatsApp em background de forma assíncrona (se não for skipWhatsApp)
      if (!payload.skipWhatsApp && payload.telefone && payload.telefone !== 'Não informado' && payload.telefone !== 'mesa') {
        const couvertLine = payload.couvert && parseFloat(payload.couvert) > 0
          ? `Couvert Artístico: R$ ${parseFloat(payload.couvert).toFixed(2).replace('.', ',')}\n`
          : '';
        const taxaLine = payload.taxa && parseFloat(payload.taxa) > 0
          ? `Taxa de Serviço: R$ ${parseFloat(payload.taxa).toFixed(2).replace('.', ',')}\n`
          : '';

        const mensagem = `Olá, ${payload.nome}! 👋\n\nSua conta da *Mesa ${payload.numero_mesa}* foi fechada com sucesso.\nEsperamos que sua experiência tenha sido incrível! 🥂\n\n---\n📋 *RESUMO DO CONSUMO*\n${payload.itens}\n\n---\n💰 *DETALHES DA CONTA*\nSubtotal: R$ ${parseFloat(payload.subtotal).toFixed(2).replace('.', ',')}\n${couvertLine}${taxaLine}*Total Final: R$ ${parseFloat(payload.total).toFixed(2).replace('.', ',')}*\n\nAgradecemos a preferência e esperamos te ver em breve!\nTenha um excelente dia! 😊✨`;

        evolution.sendText(restauranteId, payload.telefone, mensagem)
          .then(() => console.log(`[CloseBill] ✅ Mensagem de conta enviada para ${payload.nome} (Restaurante: ${restauranteId})`))
          .catch((err) => console.error(`[CloseBill] ❌ Erro ao enviar mensagem de WhatsApp:`, err.message));
      }

    } catch (err: any) {
      console.error(`[CloseBill] ❌ Erro no fechamento:`, err.message);
      reply.code(500).send({ error: err.message });
    }
  });
}
