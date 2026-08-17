const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ipyaxotvhahjyrgnkngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWF4b3R2aGFoanlyZ25rbmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk1NDkwMiwiZXhwIjoyMDkzNTMwOTAyfQ.EzUfahzJUXIoUswLaZNmNMDk9fDrNz8G_a8qFaavjfE";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const POLIS_PUB_ID = "875bcd11-b91d-4abc-aae8-ee587df23717";

async function cadastrar() {
  console.log("=== INICIANDO CADASTRO NO POLIS PUB ===");

  // 1. Garantir Estações
  const estacoes = ['Cozinha', 'Bar'];
  for (const nome of estacoes) {
    const { data: existing } = await supabase
      .from('estacoes_restaurante')
      .select('*')
      .eq('restaurante_id', POLIS_PUB_ID)
      .eq('nome', nome)
      .maybeSingle();

    if (!existing) {
      // Buscar max id de estacoes
      const { data: maxEst } = await supabase
        .from('estacoes_restaurante')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      const nextEstId = (maxEst && maxEst.length > 0 && maxEst[0].id ? maxEst[0].id : 0) + 1;

      await supabase
        .from('estacoes_restaurante')
        .insert({ id: nextEstId, restaurante_id: POLIS_PUB_ID, nome });
      console.log(`Estação cadastrada: ${nome}`);
    }
  }

  // 2. Garantir Categorias
  const categorias = ['Salgados Quentes', 'Bebidas'];
  for (const nome of categorias) {
    const { data: existing } = await supabase
      .from('categorias_restaurante')
      .select('*')
      .eq('restaurante_id', POLIS_PUB_ID)
      .eq('nome', nome)
      .maybeSingle();

    if (!existing) {
      // Buscar max id de categorias
      const { data: maxCat } = await supabase
        .from('categorias_restaurante')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      const nextCatId = (maxCat && maxCat.length > 0 && maxCat[0].id ? maxCat[0].id : 0) + 1;

      await supabase
        .from('categorias_restaurante')
        .insert({ id: nextCatId, restaurante_id: POLIS_PUB_ID, nome });
      console.log(`Categoria cadastrada: ${nome}`);
    }
  }

  // 3. Lista de itens da imagem (sem valor -> preco: '0.00')
  const itens = [
    // SALGADOS QUENTES
    {
      nome: 'Porção de coxinha (7 und)',
      preco: '0.00',
      categoria: 'Salgados Quentes',
      estacao: 'kitchen',
      descricao: '7 unidades',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Porção de quibe (7 und)',
      preco: '0.00',
      categoria: 'Salgados Quentes',
      estacao: 'kitchen',
      descricao: '7 unidades',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Porção de bolinha de queijo (7 und)',
      preco: '0.00',
      categoria: 'Salgados Quentes',
      estacao: 'kitchen',
      descricao: '7 unidades',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Porção mista (7 und diversas)',
      preco: '0.00',
      categoria: 'Salgados Quentes',
      estacao: 'kitchen',
      descricao: '7 unidades diversas',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    // BEBIDAS
    {
      nome: 'Refrigerante',
      preco: '0.00',
      categoria: 'Bebidas',
      estacao: 'bar',
      descricao: '',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Água com gás',
      preco: '0.00',
      categoria: 'Bebidas',
      estacao: 'bar',
      descricao: '',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Água sem gás',
      preco: '0.00',
      categoria: 'Bebidas',
      estacao: 'bar',
      descricao: '',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    },
    {
      nome: 'Chopp',
      preco: '0.00',
      categoria: 'Bebidas',
      estacao: 'bar',
      descricao: '',
      estoque: 1000,
      estoque_minimo: 10,
      ativo: true
    }
  ];

  // 4. Inserir produtos calculando o próximo ID
  for (const item of itens) {
    const { data: existing } = await supabase
      .from('Produtos')
      .select('id')
      .eq('restaurante_id', POLIS_PUB_ID)
      .eq('nome', item.nome)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('Produtos')
        .update({
          ...item,
          restaurante_id: POLIS_PUB_ID
        })
        .eq('id', existing.id);
      if (error) console.error(`Erro ao atualizar ${item.nome}:`, error);
      else console.log(`✅ Atualizado: ${item.nome} (ID: ${existing.id})`);
    } else {
      // Obter o maior ID atual
      const { data: maxProd } = await supabase
        .from('Produtos')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      
      const nextId = (maxProd && maxProd.length > 0 && maxProd[0].id ? maxProd[0].id : 0) + 1;

      const { data, error } = await supabase
        .from('Produtos')
        .insert({
          id: nextId,
          ...item,
          restaurante_id: POLIS_PUB_ID
        })
        .select();

      if (error) {
        console.error(`❌ Erro ao inserir ${item.nome}:`, error);
      } else {
        console.log(`✅ Inserido: ${item.nome} (ID: ${nextId})`);
      }
    }
  }

  // 5. Exibir todos os produtos cadastrados do Polis Pub
  const { data: todos } = await supabase
    .from('Produtos')
    .select('id, nome, preco, categoria, estacao, descricao, ativo')
    .eq('restaurante_id', POLIS_PUB_ID);

  console.log("\n=== PRODUTOS ATUAIS NO POLIS PUB ===");
  console.table(todos);
}

cadastrar();
