import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Get_Macarroes
 * Permite ao bot ler a lista de macarrões ativos cadastrados no Supabase para o restaurante atual.
 */
export function getMacarroesTool(userData: { id_restaurante: string }) {
  return new DynamicStructuredTool({
    name: 'Get_Macarroes',
    description: 'Busca os tipos de macarrão (massas) disponíveis e ativos no restaurante atual (ex: Espaguete, Penne). Sempre execute esta ferramenta quando o cliente solicitar algum item da categoria de Massas (macarrões/pastas).',
    schema: z.object({}),
    func: async () => {
      try {
        const { data, error } = await supabase.client
          .from('Macarroes')
          .select('nome')
          .eq('restaurante_id', userData.id_restaurante)
          .eq('ativo', true);

        if (error) {
          // Se a tabela ainda não existir, retornamos uma lista vazia/erro amigável
          if (error.code === '42P01') {
            return JSON.stringify({ success: true, macarroes: [] });
          }
          throw error;
        }

        const list = (data || []).map((m: any) => m.nome);
        return JSON.stringify({ success: true, macarroes: list });
      } catch (err: any) {
        console.error('[getMacarroesTool] Erro:', err.message);
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
