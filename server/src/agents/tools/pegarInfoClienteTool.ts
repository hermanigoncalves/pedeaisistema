import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Pegar_info_cliente
 * Equivale ao node Supabase "Pegar_info_cliente" do n8n.
 * GET Usuários WHERE telefone = X
 */
export function pegarInfoClienteTool(phone: string, restauranteId?: string | null) {
  return new DynamicStructuredTool({
    name: 'Pegar_info_cliente',
    description: 'Busca informações do cliente atual pelo telefone. Retorna mesa, restaurante, status.',
    schema: z.object({}),
    func: async () => {
      try {
        const user = await supabase.getUserByPhone(phone, restauranteId);
        if (user) {
          return JSON.stringify({ success: true, cliente: user });
        }
        return JSON.stringify({ success: false, message: 'Cliente não encontrado' });
      } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
