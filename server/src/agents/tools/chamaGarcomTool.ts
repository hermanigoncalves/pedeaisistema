import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Chama_garcom
 * Cria um pedido-sinal com status 'garcom_pendente' para acionar
 * o alerta laranja no dashboard do restaurante.
 * 
 * Abordagem: INSERT (cria registro) em vez de UPDATE (que falha se não há pedidos).
 */
export function chamaGarcomTool(userData: { mesa_atual: string; id_restaurante: string; telefone: string }) {
  return new DynamicStructuredTool({
    name: 'Chama_garcom',
    description: 'Chama o garçom até a mesa do cliente. Execute IMEDIATAMENTE quando o cliente pedir garçom, atendente, ajuda humana ou qualquer variação.',
    schema: z.object({}),
    func: async () => {
      try {
        if (!userData.mesa_atual || userData.mesa_atual === '0' || userData.mesa_atual === 'Sem mesa') {
          return JSON.stringify({
            success: false,
            message: 'O cliente não está vinculado a nenhuma mesa (mesa_atual: 0). Oriente-o a realizar o check-in lendo o QR Code da mesa.'
          });
        }

        // Cria um pedido-sinal para o garçom (funciona mesmo sem pedidos na mesa)
        const result = await supabase.createPedido({
          mesa: userData.mesa_atual,
          status: 'garcom_pendente',
          itens: '🔔 Chamado de Garçom',
          Subtotal: '0',
          restaurante_id: userData.id_restaurante,
          quantidade: '0',
          descricao: 'Cliente solicitou garçom via WhatsApp',
          usuario_telefone: userData.telefone,
        });

        return JSON.stringify({
          success: true,
          message: `Garçom chamado com sucesso! Sinal enviado para a mesa ${userData.mesa_atual}.`,
        });
      } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
