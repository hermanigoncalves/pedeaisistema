import { supabase } from '../adapters/supabaseAdapter';

interface ProductSeed {
  nome: string;
  preco: string;
  categoria: string;
  estacao: string;
  descricao: string;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
}

const PRODUTOS_POLIS_PUB: ProductSeed[] = [
  // SALGADOS QUENTES
  {
    nome: 'Porção de coxinha (7 und)',
    preco: '0.00',
    categoria: 'Salgados Quentes',
    estacao: 'kitchen',
    descricao: '7 unidades de deliciosas coxinhas quentinhas',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Porção de quibe (7 und)',
    preco: '0.00',
    categoria: 'Salgados Quentes',
    estacao: 'kitchen',
    descricao: '7 unidades de quibe frito crocante',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Porção de bolinha de queijo (7 und)',
    preco: '0.00',
    categoria: 'Salgados Quentes',
    estacao: 'kitchen',
    descricao: '7 unidades recheadas com queijo derretido',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Porção mista (7 und diversas)',
    preco: '0.00',
    categoria: 'Salgados Quentes',
    estacao: 'kitchen',
    descricao: '7 unidades sortidas de salgados quentes (coxinhas, quibes e bolinhas de queijo)',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },

  // BEBIDAS
  {
    nome: 'Refrigerante',
    preco: '0.00',
    categoria: 'Bebidas',
    estacao: 'bar',
    descricao: 'Refrigerante lata gelado',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Água com gás',
    preco: '0.00',
    categoria: 'Bebidas',
    estacao: 'bar',
    descricao: 'Água mineral com gás gelada 500ml',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Água sem gás',
    preco: '0.00',
    categoria: 'Bebidas',
    estacao: 'bar',
    descricao: 'Água mineral sem gás 500ml',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
  {
    nome: 'Chopp',
    preco: '0.00',
    categoria: 'Bebidas',
    estacao: 'bar',
    descricao: 'Chopp gelado servido na hora',
    estoque: 1000,
    estoque_minimo: 10,
    ativo: true,
  },
];

async function seedPolisPubProducts() {
  console.log('--- Iniciando Cadastro de Produtos para Polis Pub ---');

  try {
    // 1. Buscar ou criar o restaurante Polis Pub
    let { data: rest, error: restError } = await supabase.client
      .from('Restaurantes')
      .select('id, nome, email')
      .ilike('nome', '%Polis Pub%')
      .maybeSingle();

    if (!rest) {
      console.log('Restaurante "Polis Pub" não encontrado por nome. Buscando por email polispub@gmail.com...');
      const { data: restByEmail } = await supabase.client
        .from('Restaurantes')
        .select('id, nome, email')
        .eq('email', 'polispub@gmail.com')
        .maybeSingle();

      rest = restByEmail;
    }

    let restauranteId: string;

    if (!rest) {
      console.log('Criando registro do restaurante Polis Pub...');
      const { data: newRest, error: createRestErr } = await supabase.client
        .from('Restaurantes')
        .insert({
          id: '875bcd11-b91d-4abc-aae8-ee587df23717',
          nome: 'Polis Pub',
          email: 'polispub@gmail.com',
          senha: 'polispub_senha',
          telefone: '5533991423777',
          quantidade_mesas: '20',
          modo_cobranca: 'comanda',
          waha_session: 'PolisHub',
          evolution_instancia: 'PolisHub',
        })
        .select('id, nome')
        .single();

      if (createRestErr || !newRest) {
        throw new Error(`Falha ao criar Restaurante Polis Pub: ${createRestErr?.message}`);
      }
      restauranteId = newRest.id;
      console.log(`✅ Restaurante Polis Pub criado com ID: ${restauranteId}`);
    } else {
      restauranteId = rest.id;
      console.log(`✅ Restaurante Polis Pub encontrado! ID: ${restauranteId} (${rest.nome})`);
    }

    // 2. Cadastrar / atualizar produtos
    console.log(`Cadastrando ${PRODUTOS_POLIS_PUB.length} produtos para o restaurante ${restauranteId}...`);

    for (const prod of PRODUTOS_POLIS_PUB) {
      // Verificar se o produto já existe
      const { data: existingProd } = await supabase.client
        .from('Produtos')
        .select('id, nome')
        .eq('restaurante_id', restauranteId)
        .ilike('nome', prod.nome)
        .maybeSingle();

      if (existingProd) {
        // Atualizar produto existente
        const { error: updateErr } = await supabase.client
          .from('Produtos')
          .update({
            categoria: prod.categoria,
            estacao: prod.estacao,
            descricao: prod.descricao,
            estoque: prod.estoque,
            estoque_minimo: prod.estoque_minimo,
            ativo: prod.ativo,
          })
          .eq('id', existingProd.id);

        if (updateErr) {
          console.error(`❌ Erro ao atualizar "${prod.nome}":`, updateErr.message);
        } else {
          console.log(`🔄 Atualizado: "${prod.nome}" [${prod.categoria} -> ${prod.estacao}]`);
        }
      } else {
        // Inserir novo produto
        const { error: insertErr } = await supabase.client
          .from('Produtos')
          .insert({
            restaurante_id: restauranteId,
            nome: prod.nome,
            preco: prod.preco,
            categoria: prod.categoria,
            estacao: prod.estacao,
            descricao: prod.descricao,
            estoque: prod.estoque,
            estoque_minimo: prod.estoque_minimo,
            ativo: prod.ativo,
          });

        if (insertErr) {
          console.error(`❌ Erro ao inserir "${prod.nome}":`, insertErr.message);
        } else {
          console.log(`➕ Inserido: "${prod.nome}" [${prod.categoria} -> ${prod.estacao}]`);
        }
      }
    }

    console.log('--- ✅ Todos os produtos da Polis Pub foram cadastrados e sincronizados com sucesso! ---');
  } catch (error: any) {
    console.error('❌ Erro durante o cadastro de produtos:', error.message || error);
  }
}

seedPolisPubProducts();
