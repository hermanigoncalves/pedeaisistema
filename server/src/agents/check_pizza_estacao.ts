import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';

async function checkPizzaEstacao() {
  console.log('=== VERIFICANDO CAMPOS DE ESTAÇÃO DA TABELA SaboresPizza ===\n');

  try {
    const { data: sabores, error } = await supabase.client
      .from('SaboresPizza')
      .select('*')
      .eq('restaurante_id', RESTAURANTE_ID);

    if (error) {
      console.error('Erro ao ler SaboresPizza:', error.message, error.code);
      return;
    }

    console.log(`Encontrados ${sabores.length} sabores:`);
    sabores.forEach((s) => {
      console.log(`- Sabor: "${s.nome}" | Preço: R$${s.preco} | Estação: "${s.estacao || 'null'}" | Ativo: ${s.ativo}`);
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

checkPizzaEstacao();
