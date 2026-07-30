import { supabase } from '../adapters/supabaseAdapter';
import { SYSTEM_PROMPT_SERVICO } from './pedeaiAgent';

async function updateDbPromptServico() {
  console.log('--- Atualizando prompt_servico na tabela ConfiguracoesGlobais (id = 1) ---');
  try {
    const { data, error } = await supabase.client
      .from('ConfiguracoesGlobais')
      .update({ prompt_servico: SYSTEM_PROMPT_SERVICO })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar prompt_servico no banco:', error);
      return;
    }

    console.log('✅ prompt_servico atualizado com sucesso no Supabase!');
    console.log('Conteúdo atualizado:');
    console.log(data.prompt_servico);
  } catch (err: any) {
    console.error('❌ Erro inesperado:', err.message);
  }
}

updateDbPromptServico();
