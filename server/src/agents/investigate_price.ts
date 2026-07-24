import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';

async function investigarPreco() {
  console.log('=== INVESTIGAÇÃO DO PREÇO DA PIZZA CALABRESA ===\n');

  // 1. Buscar o preço da calabresa na tabela Produtos
  console.log('--- 1. Tabela Produtos (cardápio) ---');
  const { data: produtos } = await supabase.client
    .from('Produtos')
    .select('id, nome, preco, categoria, disponivel')
    .eq('restaurante_id', RESTAURANTE_ID)
    .ilike('nome', '%calabres%');

  if (produtos && produtos.length > 0) {
    produtos.forEach((p: any) => {
      console.log(`  Produto: "${p.nome}" | Preço: R$${p.preco} | Categoria: ${p.categoria} | Disponível: ${p.disponivel}`);
    });
  } else {
    console.log('  Nenhum produto "calabresa" encontrado na tabela Produtos');
  }

  // 2. Buscar na tabela SaboresPizza
  console.log('\n--- 2. Tabela SaboresPizza ---');
  try {
    const { data: sabores, error } = await supabase.client
      .from('SaboresPizza')
      .select('id, nome, preco, ativo')
      .eq('restaurante_id', RESTAURANTE_ID)
      .ilike('nome', '%calabres%');

    if (error) {
      console.log(`  Erro ao buscar SaboresPizza: ${error.message}`);
    } else if (sabores && sabores.length > 0) {
      sabores.forEach((s: any) => {
        console.log(`  Sabor: "${s.nome}" | Preço: R$${s.preco} | Ativo: ${s.ativo}`);
      });
    } else {
      console.log('  Nenhum sabor "calabresa" encontrado na tabela SaboresPizza');
    }
  } catch (e: any) {
    console.log(`  Tabela SaboresPizza não existe ou erro: ${e.message}`);
  }

  // 3. Buscar pedidos recentes (últimas 2h) para ver o que foi registrado
  console.log('\n--- 3. Pedidos recentes (últimas 2h) ---');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: pedidos } = await supabase.client
    .from('Pedidos')
    .select('id, itens, Subtotal, quantidade, descricao, status, created_at, mesa, usuario_telefone')
    .eq('restaurante_id', RESTAURANTE_ID)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (pedidos && pedidos.length > 0) {
    pedidos.forEach((p: any) => {
      console.log(`  Pedido #${p.id} | Mesa: ${p.mesa} | Itens: "${p.itens}" | Subtotal: R$${p.Subtotal} | Qtd: ${p.quantidade} | Status: ${p.status} | Desc: "${p.descricao || ''}" | ${p.created_at}`);
    });
  } else {
    console.log('  Nenhum pedido encontrado nas últimas 2h');
  }

  // 4. Buscar TODOS os produtos com pizza para comparar preços
  console.log('\n--- 4. Todos os itens "Pizza" no cardápio ---');
  const { data: pizzas } = await supabase.client
    .from('Produtos')
    .select('nome, preco, categoria')
    .eq('restaurante_id', RESTAURANTE_ID)
    .ilike('categoria', '%pizza%');

  if (pizzas && pizzas.length > 0) {
    pizzas.forEach((p: any) => {
      console.log(`  "${p.nome}" | R$${p.preco} | Categoria: ${p.categoria}`);
    });
  } else {
    console.log('  Nenhum produto na categoria "Pizza" na tabela Produtos');
  }

  // 5. Listar TODOS os sabores de pizza cadastrados
  console.log('\n--- 5. Todos os SaboresPizza cadastrados ---');
  try {
    const { data: todosSabores, error } = await supabase.client
      .from('SaboresPizza')
      .select('nome, preco, ativo')
      .eq('restaurante_id', RESTAURANTE_ID);

    if (error) {
      console.log(`  Erro: ${error.message}`);
    } else if (todosSabores && todosSabores.length > 0) {
      todosSabores.forEach((s: any) => {
        console.log(`  "${s.nome}" | R$${s.preco} | Ativo: ${s.ativo}`);
      });
    } else {
      console.log('  Nenhum sabor cadastrado');
    }
  } catch (e: any) {
    console.log(`  Tabela SaboresPizza não existe: ${e.message}`);
  }
}

investigarPreco();
