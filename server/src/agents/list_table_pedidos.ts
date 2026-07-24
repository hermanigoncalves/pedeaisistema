import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';
const MESA = '7';

async function listTablePedidos() {
  console.log(`=== TODOS OS PEDIDOS DA MESA ${MESA} NO BANCO ===\n`);

  try {
    const { data: pedidos, error } = await supabase.client
      .from('Pedidos')
      .select('*')
      .eq('restaurante_id', RESTAURANTE_ID)
      .eq('mesa', MESA)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao ler Pedidos:', error.message);
      return;
    }

    console.log(`Encontrados ${pedidos.length} pedidos no total para a Mesa ${MESA}:`);
    pedidos.forEach((p) => {
      console.log(`\nID: ${p.id}`);
      console.log(`Data/Hora: ${p.created_at}`);
      console.log(`Itens: "${p.itens}"`);
      console.log(`Subtotal: R$${p.Subtotal}`);
      console.log(`Quantidade: ${p.quantidade}`);
      console.log(`Status: "${p.status}"`);
      console.log(`Descrição: "${p.descricao || ''}"`);
      console.log(`Telefone do Usuário: "${p.usuario_telefone || ''}"`);
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

listTablePedidos();
