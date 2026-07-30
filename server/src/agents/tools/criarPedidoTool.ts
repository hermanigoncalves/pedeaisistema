import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { supabase } from '../../adapters/supabaseAdapter';

// Algoritmo de distância de Levenshtein para busca fuzzy
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

// Interface para unificar Produtos e Sabores de Pizza
interface ProdutoCandidato {
  nome: string;
  preco: number;
  ativo: boolean;
  estoque: number;
  origem: 'Produtos' | 'SaboresPizza';
}

// Encontra o melhor match fuzzy com base no input
function findBestMatch(
  input: string,
  candidates: ProdutoCandidato[],
  threshold = 0.35
): ProdutoCandidato | null {
  let bestCandidate: ProdutoCandidato | null = null;
  let minDistance = Infinity;

  // Normalização básica: minúsculas, remove acentos e caracteres especiais
  const normalize = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '');

  const normalizedInput = normalize(input);

  if (!normalizedInput) return null;

  for (const cand of candidates) {
    const normalizedCandidate = normalize(cand.nome);

    // 1. Match exato pós-normalização
    if (normalizedCandidate === normalizedInput) {
      return cand;
    }

    // 2. Match de substring (se um contém o outro)
    if (
      normalizedCandidate.includes(normalizedInput) ||
      normalizedInput.includes(normalizedCandidate)
    ) {
      const distance = Math.abs(normalizedCandidate.length - normalizedInput.length);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = cand;
      }
      continue;
    }

    // 3. Match de distância de Levenshtein
    const distance = getLevenshteinDistance(normalizedInput, normalizedCandidate);
    const maxLen = Math.max(normalizedInput.length, normalizedCandidate.length);
    const score = distance / maxLen;

    if (score <= threshold && distance < minDistance) {
      minDistance = distance;
      bestCandidate = cand;
    }
  }

  return bestCandidate;
}

/**
 * Tool: Criar_pedido
 * Equivale ao node Supabase "Criar_pedido" do n8n.
 * INSERT na tabela Pedidos com campos $fromAI.
 * 
 * VALIDAÇÃO SERVER-SIDE: busca o preço real no banco (Produtos + SaboresPizza)
 * e corrige automaticamente se a IA passar um valor divergente.
 * Adicionalmente, implementa Fuzzy Match e validação de estoque e disponibilidade.
 */
export function criarPedidoTool(userData: { mesa_atual: string; id_restaurante: string; telefone: string }) {
  return new DynamicStructuredTool({
    name: 'Criar_pedido',
    description: 'Cria um novo pedido para o cliente na mesa atual. IMPORTANTE: o campo "itens" deve conter o nome EXATO do produto como aparece no cardápio (retorno de Produtos_cardapio). Customizações (tipo de massa, molho, copos, sabores) vão no campo "descricao".',
    schema: z.object({
      itens: z.string().describe('Nome EXATO do produto como aparece no cardápio (Produtos_cardapio). NUNCA coloque customizações aqui. Exemplo: "Skol 600ml", "Pizza Meia a Meia", "Massa Putanesca"'),
      Subtotal: z.string().describe('O valor total do pedido calculado exclusivamente como (quantidade física do produto * preço unitário do cardápio). Exemplo: 1 cerveja de R$12.00 com 3 copos = Subtotal: "12.00". NUNCA multiplique o subtotal pela quantidade de copos, pois os copos extras são gratuitos!'),
      quantidade: z.string().describe('A quantidade física de produtos que o usuário quer pedir (exemplo: se ele pediu 2 cervejas, passe "2"). IMPORTANTE: A quantidade de copos solicitada para compartilhar uma bebida NÃO é a quantidade do produto! Se o cliente pediu 1 cerveja 600ml com 3 copos, a quantidade do produto é "1" (e "Copos: 3" vai no campo descricao).'),
      descricao: z.string().describe('Observações e customizações do pedido: tipo de massa (ex: Penne, Spaghetti), sabores de pizza (ex: Metade Calabresa + Metade Branca), quantidade de copos, ingredientes extras. Exemplo: "Massa: Penne" ou "3 Copos" ou "Metade Calabresa + Metade Branca"'),
    }),
    func: async ({ itens, Subtotal, quantidade, descricao }) => {
      try {
        if (!userData.mesa_atual || userData.mesa_atual === '0' || userData.mesa_atual === 'Sem mesa') {
          return JSON.stringify({
            success: false,
            message: 'O cliente não possui check-in em nenhuma mesa (mesa_atual: 0). Oriente-o a ler o QR Code da mesa para realizar o check-in.'
          });
        }

        let precoUnitarioReal: number | null = null;
        let nomeItemCorrigido = itens.trim();

        // 1. Obter as configurações do Restaurante (gerencia_estoque e meia_pizza_habilitada)
        const { data: restData } = await supabase.client
          .from('Restaurantes')
          .select('gerencia_estoque, meia_pizza_habilitada')
          .eq('id', userData.id_restaurante)
          .single();

        const gerenciaEstoque = restData?.gerencia_estoque !== false; // Padrão true
        const meiaPizzaHabilitada = restData?.meia_pizza_habilitada ?? false;

        // 2. Verificar se é Pizza Meia a Meia (Item virtual permitido se ativo no restaurante)
        if (nomeItemCorrigido.toLowerCase() === 'pizza meia a meia') {
          if (!meiaPizzaHabilitada) {
            return JSON.stringify({
              success: false,
              message: 'Pizza meia a meia não é permitida neste estabelecimento.'
            });
          }

          // Validar individualmente cada sabor da meia a meia informada na descrição
          // Descrição esperada: "Metade Sabor 1 + Metade Sabor 2"
          const saboresDesc = descricao
            .replace(/metade\s+/gi, '')
            .split('+')
            .map(s => s.trim())
            .filter(Boolean);

          const { data: saboresPizza } = await supabase.client
            .from('SaboresPizza')
            .select('nome, preco, ativo')
            .eq('restaurante_id', userData.id_restaurante);

          const saboresCadastrados = saboresPizza || [];

          for (const saborSolicitado of saboresDesc) {
            const candidates = saboresCadastrados.map((s: any) => ({
              nome: s.nome,
              preco: Number(s.preco),
              ativo: s.ativo !== false,
              estoque: 999,
              origem: 'SaboresPizza' as const
            }));

            const matchSabor = findBestMatch(saborSolicitado, candidates, 0.4);

            if (!matchSabor) {
              return JSON.stringify({
                success: false,
                message: `O sabor de pizza "${saborSolicitado}" não foi encontrado no cardápio de sabores deste estabelecimento. Por favor, consulte as opções disponíveis.`
              });
            }

            if (!matchSabor.ativo) {
              return JSON.stringify({
                success: false,
                message: `O sabor de pizza "${matchSabor.nome}" está indisponível no momento.`
              });
            }
          }

          // Aceita o subtotal calculado pela IA
          precoUnitarioReal = parseFloat(Subtotal) / Math.max(1, parseInt(quantidade, 10) || 1);
        } else {
          // 3. Buscar Produtos e Sabores de Pizza do restaurante para fazer Fuzzy Match
          const { data: dbProdutos } = await supabase.client
            .from('Produtos')
            .select('nome, preco, ativo, estoque')
            .eq('restaurante_id', userData.id_restaurante);

          const { data: dbSabores } = await supabase.client
            .from('SaboresPizza')
            .select('nome, preco, ativo')
            .eq('restaurante_id', userData.id_restaurante)
            .eq('ativo', true);

          const candidatos: ProdutoCandidato[] = [];

          if (dbProdutos) {
            candidatos.push(
              ...dbProdutos.map((p: any) => ({
                nome: p.nome,
                preco: Number(p.preco),
                ativo: p.ativo !== false,
                estoque: p.estoque === null || p.estoque === undefined ? 999 : Number(p.estoque),
                origem: 'Produtos' as const
              }))
            );
          }

          if (dbSabores) {
            candidatos.push(
              ...dbSabores.map((s: any) => ({
                nome: `Pizza ${s.nome}`,
                preco: Number(s.preco),
                ativo: s.ativo !== false,
                estoque: 999, // Sabores virtuais não controlam estoque individual
                origem: 'SaboresPizza' as const
              }))
            );
          }

          // Procurar o melhor candidato fuzzy
          const melhorCandidato = findBestMatch(nomeItemCorrigido, candidatos, 0.35);

          if (!melhorCandidato) {
            return JSON.stringify({
              success: false,
              message: `O produto "${nomeItemCorrigido}" não foi encontrado no cardápio deste estabelecimento. Por favor, consulte Produtos_cardapio e ofereça apenas itens disponíveis.`
            });
          }

          // Corrigir o nome do item no pedido para o nome real do banco
          nomeItemCorrigido = melhorCandidato.nome;
          precoUnitarioReal = melhorCandidato.preco;

          // 4. Validar disponibilidade (ativo)
          if (!melhorCandidato.ativo) {
            return JSON.stringify({
              success: false,
              message: `O produto "${nomeItemCorrigido}" está indisponível no momento.`
            });
          }

          // 5. Validar estoque real se gerenciado pelo restaurante
          const qtdSolicitada = Math.max(1, parseInt(quantidade, 10) || 1);
          if (gerenciaEstoque && melhorCandidato.origem === 'Produtos') {
            if (melhorCandidato.estoque < qtdSolicitada) {
              return JSON.stringify({
                success: false,
                message: `O produto "${nomeItemCorrigido}" está esgotado ou possui estoque insuficiente (estoque atual: ${melhorCandidato.estoque} un.). Por favor, avise o cliente e recomende uma alternativa.`
              });
            }
          }
        }

        // 6. Calcular subtotal correto e corrigir se divergente
        let subtotalFinal = Subtotal;
        const qtdFinal = Math.max(1, parseInt(quantidade, 10) || 1);
        const subtotalCorreto = (precoUnitarioReal * qtdFinal).toFixed(2);
        const subtotalIA = parseFloat(Subtotal).toFixed(2);

        if (subtotalCorreto !== subtotalIA && nomeItemCorrigido.toLowerCase() !== 'pizza meia a meia') {
          console.warn(`[criarPedido] ⚠️ Preço divergente para "${nomeItemCorrigido}": IA enviou R$${subtotalIA}, banco tem R$${precoUnitarioReal}/un × ${qtdFinal} = R$${subtotalCorreto}. Corrigindo para preço do banco.`);
          subtotalFinal = subtotalCorreto;
        }

        // 7. Inserir no banco
        const result = await supabase.createPedido({
          mesa: Number(userData.mesa_atual).toString(),
          status: 'Pendente',
          itens: nomeItemCorrigido,
          Subtotal: subtotalFinal,
          restaurante_id: userData.id_restaurante,
          quantidade: qtdFinal.toString(),
          descricao,
          usuario_telefone: userData.telefone,
        });

        if (result?.id) {
          return JSON.stringify({ success: true, id: result.id, message: `Pedido #${result.id} criado com sucesso` });
        }
        return JSON.stringify({ success: false, message: 'Não foi possível criar o pedido no banco de dados.' });
      } catch (err: any) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });
}
