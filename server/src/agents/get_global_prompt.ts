import { supabase } from '../adapters/supabaseAdapter';

async function getPrompts() {
  console.log('--- Buscando Prompts da tabela ConfiguracoesGlobais (id=1) ---');
  try {
    const { data, error } = await supabase.client
      .from('ConfiguracoesGlobais')
      .select('prompt_geral, prompt_vendas, prompt_servico')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Erro ao buscar dados:', error);
      return;
    }

    console.log('\n--- PROMPT DE VENDAS ATUAL NO BANCO ---');
    console.log(data.prompt_vendas ? data.prompt_vendas.slice(0, 1000) + '\n... (truncado)' : 'Nenhum prompt de vendas no banco');
    
    console.log('\n--- PROMPT DE SERVICO ATUAL NO BANCO ---');
    console.log(data.prompt_servico ? data.prompt_servico.slice(0, 1000) + '\n... (truncado)' : 'Nenhum prompt de serviço no banco');
  } catch (err) {
    console.error('Erro inesperado:', err);
  }
}

getPrompts();
