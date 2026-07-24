import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Get_Pedidos
 * Equivale ao node Supabase "Get Pedidos" do n8n.
 * GET Pedidos WHERE mesa = X AND status != 'fechado' AND restaurante_id = Y AND usuario_telefone = Z
 * 
 * No modo comanda, filtra apenas os pedidos do usuario que esta pedindo a conta.
 * Busca TODOS os pedidos ativos (pendente, preparando, pronto, entregue, pagamento_pendente).
 */
export function getPedidosTool(userData: { mesa_atual: string; id_restaurante: string; telefone: string }) {
  return new DynamicStructuredTool({
    name: 'Get_Pedidos',
    description: 'Busca os pedidos ativos do CLIENTE ATUAL na mesa (todos os status exceto "fechado"). Use no início do fluxo de conta para saber o que o cliente consumiu. Retorna apenas os itens do cliente que está perguntando, não de toda a mesa.',
    schema: z.object({}),
    func: async () => {
      try {
        const pedidos = await supabase.getPedidosByMesaExcluindo(
          Number(userData.mesa_atual),
          userData.id_restaurante,
          'fechado',
          userData.telefone, // filtrar apenas pedidos deste usuario
        );

        if (pedidos.length === 0) {
          return JSON.stringify({ success: true, message: 'Nenhum pedido ativo encontrado para você nesta mesa.' });
        }

        const resumo = pedidos.map((p: any) => ({
          id: p.id,
          itens: p.itens,
          quantidade: p.quantidade,
          subtotal: p.Subtotal,
          descricao: p.descricao,
        }));

        const total = pedidos.reduce((acc: number, p: any) => {
          const val = parseFloat(p.Subtotal?.replace(',', '.') || '0');
          return acc + val;
        }, 0);

        return JSON.stringify({ success: true, pedidos: resumo, total: total.toFixed(2) });
      } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
