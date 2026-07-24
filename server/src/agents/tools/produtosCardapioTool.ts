import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

/**
 * Tool: Produtos_cardapio
 * Equivale ao node Supabase "Produtos_cardapio" do n8n.
 * Retorna os produtos do cardápio + sabores de pizza cadastrados dinamicamente.
 */
export function produtosCardapioTool(userData: { id_restaurante: string }) {
  return new DynamicStructuredTool({
    name: 'Produtos_cardapio',
    description: 'Busca todos os produtos do cardápio do restaurante atual. Use antes de listar itens ou citar preços ao cliente.',
    schema: z.object({}),
    func: async () => {
      try {
        const produtos = await supabase.getProductsByRestaurante(userData.id_restaurante);
        
        let saboresVirtuais: any[] = [];
        try {
          const { data: sabores, error: saborError } = await supabase.client
            .from('SaboresPizza')
            .select('*')
            .eq('restaurante_id', userData.id_restaurante)
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
