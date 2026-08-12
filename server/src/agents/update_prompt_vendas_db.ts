import { supabase } from '../adapters/supabaseAdapter';
import { SYSTEM_PROMPT_VENDAS } from './pedeaiAgent';

async function updateDbPromptVendas() {
  console.log('--- Atualizando prompt_vendas na tabela ConfiguracoesGlobais (id = 1) ---');
  try {
    const { data, error } = await supabase.client
      .from('ConfiguracoesGlobais')
      .update({ prompt_vendas: SYSTEM_PROMPT_VENDAS })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar prompt_vendas no banco:', error);
      process.exit(1);
    }

    console.log('✅ prompt_vendas atualizado com sucesso no Supabase!');
    console.log('Conteúdo atualizado:');
    console.log(data.prompt_vendas ? data.prompt_vendas.slice(0, 300) + '...' : 'Vazio');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Erro inesperado:', err.message);
    process.exit(1);
  }
}

updateDbPromptVendas();
