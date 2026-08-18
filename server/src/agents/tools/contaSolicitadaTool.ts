import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';
import { evolution } from '../../adapters/evolutionAdapter';

function isSystemMarkerItem(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('chamar garçom') || n.includes('fechamento de conta') || n.includes('chamar_garcom') || n.includes('pedir conta');
}

/**
 * Tool: Conta_Solicitada
 * Marca os pedidos do cliente/mesa como pagamento_pendente, aciona o alerta de conta,
 * calcula o consumo e envia o resumo da conta via WhatsApp imediatamente para o cliente.
 */
export function contaSolicitadaTool(
  userData: { id: number; telefone: string; id_restaurante: string; mesa_atual: string; nome?: string },
  isComandaMode: boolean
) {
  return new DynamicStructuredTool({
    name: 'Conta_Solicitada',
    description: 'Marca os pedidos do cliente como pagamento pendente e aciona o alerta de CONTA no painel do restaurante. OBRIGATÓRIO executar sempre que o cliente pedir a conta. NÃO confunda com Chama_garcom — esta tool é SOMENTE para a conta.',
    schema: z.object({
      divisoes: z.number().nullable().optional().describe('Quantidade de pessoas para dividir a conta (opcional). Use apenas se o cliente tiver especificado o número de pessoas para dividir no modo mesa.'),
    }),
    func: async ({ divisoes }) => {
      try {
        console.log(`[Conta_Solicitada] Processando pedido de conta para Mesa ${userData.mesa_atual} (Modo Comanda: ${isComandaMode})`);

        // 1. Buscar configurações do restaurante
        const { data: restData } = await supabase.client
          .from('Restaurantes')
          .select('modo_cobranca, taxa_servico, couvert_habilitado, couvert_valor')
          .eq('id', userData.id_restaurante)
          .single();

        const taxaServicoPercentage = Number(restData?.taxa_servico || 0);
        const couvertHabilitado = !!restData?.couvert_habilitado;
        const couvertValor = Number(restData?.couvert_valor || 0);

        // No modo comanda, filtramos apenas os pedidos do cliente que solicitou a conta
        const usuarioTelefoneFiltro = isComandaMode ? userData.telefone : undefined;

        // 2. Atualizar status dos pedidos ativos para 'pagamento_pendente'
        const updatedPedidos = await supabase.updatePedidosStatus(
          userData.mesa_atual,
          userData.id_restaurante,
          'pagamento_pendente',
          'fechado', // excluir pedidos já fechados
          usuarioTelefoneFiltro
        );

        // 3. Insere um pedido marcador especial de fechamento de conta
        const desc = divisoes ? `Fechamento de Conta | Dividido por ${divisoes}` : 'Fechamento de Conta';
        await supabase.client.from('Pedidos').insert({
          mesa: userData.mesa_atual,
          restaurante_id: userData.id_restaurante,
          status: 'pagamento_pendente',
          itens: JSON.stringify([{ nome: 'Fechamento de Conta', quantidade: 1, preco: 0 }]),
          Subtotal: '0.00',
          descricao: desc,
          usuario_telefone: userData.telefone
        });

        // 4. Buscar os pedidos atualizados e pendentes para calcular o resumo
        const pedidosMesa = await supabase.getPedidosByMesa(
          Number(userData.mesa_atual),
          userData.id_restaurante,
          undefined, // status
          usuarioTelefoneFiltro // usuarioTelefone
        );

        const pedidosPagamento = pedidosMesa.filter(p => p.status === 'pagamento_pendente');

        // 5. Calcular itens e subtotal
        const itemsToProcess: { nome: string; quantidade: number; preco: number }[] = [];
        let subtotal = 0;

        for (const p of pedidosPagamento) {
          const rawItens = (p.itens || '').trim();
          let itemsArray: any[] = [];

          if (rawItens.startsWith('[')) {
            try {
              itemsArray = JSON.parse(rawItens);
            } catch (e) {
              console.error('[Conta_Solicitada] Erro ao fazer parse do JSON de itens:', rawItens, e);
              itemsArray = [];
            }
          } else if (rawItens !== '') {
            // Formato legado / string simples (nome do produto)
            const quantidade = parseInt(p.quantidade || '1', 10) || 1;
            let total = 0;
            if (p.Subtotal) {
              const cleanSubtotal = p.Subtotal.replace('R$', '').replace(',', '.').trim();
              total = parseFloat(cleanSubtotal) || 0;
            }
            const precoUnitario = total / quantidade;
            
            itemsArray = [{
              nome: rawItens,
              quantidade: quantidade,
              preco: precoUnitario
            }];
          }

          for (const it of itemsArray) {
            const nome = it.nome || it.productName || '';
            if (isSystemMarkerItem(nome)) continue;

            const qtd = Number(it.quantidade || it.quantity || 1);
            const preco = Number(it.preco || it.price || 0);

            itemsToProcess.push({ nome, quantidade: qtd, preco });
            subtotal += (qtd * preco);
          }
        }

        if (itemsToProcess.length > 0) {
          // Agrupar itens iguais
          const groupedItems = itemsToProcess.reduce((acc, item) => {
            const existing = acc.find(i => i.nome === item.nome && i.preco === item.preco);
            if (existing) {
              existing.quantidade += item.quantidade;
            } else {
              acc.push({ ...item });
            }
            return acc;
          }, [] as typeof itemsToProcess);

          // Calcular taxa e couvert
          const serviceFeeValue = (subtotal * taxaServicoPercentage) / 100;
          
          let couvertValue = 0;
          if (couvertHabilitado && subtotal > 0) {
            if (isComandaMode) {
              couvertValue = couvertValor;
            } else {
              // No modo mesa, cobrar couvert por check-in ativo na mesa
              const { data: activeUsers } = await supabase.client
                .from('Usuários')
                .select('id')
                .eq('id_restaurante', userData.id_restaurante)
                .eq('mesa_atual', userData.mesa_atual)
                .eq('Status', 'Ativo');

              const numPessoas = activeUsers && activeUsers.length > 0 ? activeUsers.length : 1;
              couvertValue = couvertValor * numPessoas;
            }
          }

          const totalFinal = subtotal + serviceFeeValue + couvertValue;

          // Formatar itens para mensagem
          const itensFormatados = groupedItems
            .map(i => {
              const itemTotal = i.preco * i.quantidade;
              if (itemTotal === 0) {
                return `• ${i.quantidade}x ${i.nome} - Cortesia / Incluso`;
              }
              return `• ${i.quantidade}x ${i.nome} - R$ ${itemTotal.toFixed(2).replace('.', ',')}`;
            })
            .join('\n');

          const subtotalText = subtotal > 0
            ? `• 📋 Subtotal do consumo: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`
            : `• 📋 Consumo: Experiência Degustação (Incluso)\n`;

          const couvertLine = couvertValue > 0
            ? `• 🎵 Couvert Artístico: R$ ${couvertValue.toFixed(2).replace('.', ',')}\n`
            : '';
          const taxaLine = serviceFeeValue > 0
            ? `• 🪙 Taxa de Serviço (${taxaServicoPercentage}%): R$ ${serviceFeeValue.toFixed(2).replace('.', ',')}\n`
            : '';

          const totalLine = totalFinal > 0
            ? `• 💰 *Total Final: R$ ${totalFinal.toFixed(2).replace('.', ',')}*`
            : `• 💰 *Total Final: R$ 0,00 (Cortesia)*`;

          const divisaoLine = (divisoes && totalFinal > 0)
            ? `👥 Conta dividida por ${divisoes} pessoas: *R$ ${(totalFinal / divisoes).toFixed(2).replace('.', ',')} por pessoa*\n\n`
            : '';

          return JSON.stringify({
            success: true,
            mesa: userData.mesa_atual,
            pedidosAtualizados: updatedPedidos.length,
            subtotal: subtotal.toFixed(2),
            taxaServico: (subtotal * taxaServicoPercentage / 100).toFixed(2),
            totalFinal: totalFinal.toFixed(2),
            itensFormatados,
            subtotalText,
            couvertLine,
            taxaLine,
            totalLine,
            divisaoLine,
            itens: itemsToProcess.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco, total: i.quantidade * i.preco })),
            message: `Conta solicitada com sucesso para Mesa ${userData.mesa_atual}! ${updatedPedidos.length} pedido(s) atualizados.`
          });
        } else {
          return JSON.stringify({
            success: true,
            mesa: userData.mesa_atual,
            pedidosAtualizados: 0,
            subtotal: '0.00',
            taxaServico: '0.00',
            totalFinal: '0.00',
            itens: [],
            message: `Nenhum pedido ativo encontrado para a Mesa ${userData.mesa_atual}.`
          });
        }
      } catch (err: any) {
        console.error('[Conta_Solicitada] Erro geral na tool:', err.message);
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
