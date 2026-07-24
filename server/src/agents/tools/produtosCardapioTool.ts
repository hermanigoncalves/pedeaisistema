import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Produtos_cardapio
 * Equivale ao node Supabase "Produtos_cardapio" do n8n.
 * Retorna os produtos do cardápio + sabores de pizza cadastrados dinamicamente.
 */
export function produtosCardapioTool(restauranteIdOrUserData: string | { id_restaurante: string }) {
  return new DynamicStructuredTool({
    name: 'Produtos_cardapio',
    description: 'Busca todos os produtos do cardápio do restaurante atual. Use antes de listar itens ou citar preços ao cliente.',
    schema: z.object({}),
    func: async () => {
      try {
        let restId = typeof restauranteIdOrUserData === 'string' ? restauranteIdOrUserData : restauranteIdOrUserData?.id_restaurante;
        
        // Se for inválido ou "undefined", busca o primeiro restaurante cadastrado como fallback
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!restId || restId === 'undefined' || !uuidRegex.test(restId)) {
          const { data: firstRest } = await supabase.client.from('Restaurantes').select('id').limit(1).single();
          restId = firstRest?.id || '';
        }

        if (!restId) {
          return JSON.stringify({ success: false, message: 'Nenhum restaurante configurado.' });
        }

        const produtos = await supabase.getProductsByRestaurante(restId);
        
        let saboresVirtuais: any[] = [];
        try {
          const { data: sabores, error: saborError } = await supabase.client
            .from('SaboresPizza')
            .select('*')
            .eq('restaurante_id', restId)
            .eq('ativo', true);


          if (saborError) {
            // Ignorar silenciosamente se a tabela ainda não existir no Supabase
            if (saborError.code !== '42P01') throw saborError;
          } else if (sabores) {
            saboresVirtuais = sabores.map((s: any) => ({
              nome: `Pizza ${s.nome}`,
              preco: s.preco,
              categoria: 'Pizza',
              descricao: s.descricao || '',
              disponivel: true,
              quantidade: 999,
            }));
          }
        } catch (errSabor: any) {
          console.warn('[produtosCardapioTool] Erro ao buscar sabores de pizza:', errSabor.message);
        }

        const lista = produtos.map((p: any) => ({
          nome: p.nome,
          preco: p.preco,
          categoria: p.categoria,
          descricao: p.descricao || '',
          disponivel: p.ativo !== false,
          quantidade: p.estoque,
        }));

        const totalProdutos = [...lista, ...saboresVirtuais];

        if (totalProdutos.length === 0) {
          return JSON.stringify({ success: true, message: 'Nenhum produto encontrado no cardápio.' });
        }

        return JSON.stringify({ success: true, produtos: totalProdutos });
      } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
