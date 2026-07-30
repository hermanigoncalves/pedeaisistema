import cron from 'node-cron';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config';
import { supabase } from '../adapters/supabaseAdapter';
import { waha, evolution } from '../adapters/wahaAdapter';

const LIMITE_ESTOQUE = 10;

/**
 * Controller: Gerenciamento de Estoque (Cron)
 * Equivale ao workflow "IA Gerenciamento de Estoque (PedeAi)"
 * 
 * Roda periodicamente, verifica estoque baixo e envia alerta ao dono.
 */
export function startStockAlertCron() {
  // Roda a cada hora (ajuste conforme necessário)
  cron.schedule('0 * * * *', async () => {
    console.log('[Estoque] ⏰ Verificando estoque...');

    try {
      // 1. Get todos restaurantes
      const restaurantes = await supabase.getAllRestaurantes();

      for (const restaurante of restaurantes) {
        // 2. Get produtos do restaurante
        const produtos = await supabase.getProductsByRestaurante(restaurante.id);

        // 3. Filtra estoque baixo (< LIMITE)
        const produtosBaixo = produtos.filter(
          (p: any) => Number(p.estoque || 0) < LIMITE_ESTOQUE,
        );

        if (produtosBaixo.length === 0) {
          console.log(`[Estoque] ✅ ${restaurante.nome}: estoque OK`);
          continue;
        }

        // 4. Formata lista
        const listaTexto = produtosBaixo
          .map((p: any) => `- ${p.nome}: ${p.estoque || 0} un.`)
          .join('\n');

        const mensagemFinal = `🚨 *ALERTA DE ESTOQUE BAIXO*\n\nOs seguintes produtos precisam de reposição:\n\n${listaTexto}`;

        // 5. Usa GPT para formatar alerta profissional
        const model = new ChatOpenAI({
          model: 'gpt-4.1-mini',
          temperature: 0.3,
          apiKey: config.OPENAI_API_KEY,
        });

        const response = await model.invoke([
          new SystemMessage(
            `Você é o Gestor de Estoque Inteligente da PedeAi. Sua função é enviar alertas urgentes e organizados para o dono do restaurante via WhatsApp.
DIRETRIZES DE ESTILO:
- Tom: Profissional, direto e de urgência (sem ser desesperado).
- Formatação: Otimizada para leitura rápida no celular (use negrito e quebras de linha).
- Emojis: Use emojis estratégicos para destacar a atenção (🚨, 📦, 📉).

SUA TAREFA: Receba a lista de produtos com estoque baixo e gere uma mensagem no seguinte formato:

🚨 *ALERTA DE REPOSIÇÃO - PEDEAI*

Identificamos que os seguintes itens entraram na zona crítica de estoque e precisam de compra imediata:

[Aqui você insere a lista dos itens que recebeu, formatada com bolinhas ou check]

💡 *Sugestão:* Entre em contato com seus fornecedores ainda hoje para evitar ruptura nas vendas.

--- Gerado automaticamente pelo Sistema PedeAi`,
          ),
          new HumanMessage(mensagemFinal),
        ]);

        const alertText = typeof response.content === 'string'
          ? response.content
          : mensagemFinal;

        // 6. Envia para o telefone do dono
        const telefoneDono = restaurante.telefone_dono;
        if (telefoneDono) {
          await evolution.sendText(telefoneDono, alertText);
          console.log(
            `[Estoque] 📤 Alerta enviado para ${restaurante.nome} (${produtosBaixo.length} itens baixos)`,
          );
        } else {
          console.warn(`[Estoque] ⚠️ ${restaurante.nome}: sem telefone_dono configurado`);
        }
      }
    } catch (err: any) {
      console.error('[Estoque] ❌ Erro no cron:', err.message);
    }
  });

  console.log('[Estoque] ⏰ Cron de estoque agendado (a cada hora)');
}
