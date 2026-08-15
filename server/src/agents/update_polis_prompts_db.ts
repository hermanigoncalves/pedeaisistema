import { supabase } from '../adapters/supabaseAdapter';
import {
  SYSTEM_PROMPT_GERAL,
  SYSTEM_PROMPT_VENDAS,
  SYSTEM_PROMPT_SERVICO
} from './pedeaiAgent';

async function updatePolisPromptsInDb() {
  console.log('--- Sincronizando Prompts da Polis Pub no Banco Supabase ---');
  try {
    const { data: updatedConfig, error: updateError } = await supabase.client
      .from('ConfiguracoesGlobais')
      .update({
        prompt_geral: SYSTEM_PROMPT_GERAL,
        prompt_vendas: SYSTEM_PROMPT_VENDAS,
        prompt_servico: SYSTEM_PROMPT_SERVICO,
      })
      .eq('id', 1)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar prompts no Supabase:', updateError.message);
      return;
    }

    console.log('✅ Prompts da Polis Pub sincronizados com sucesso na tabela ConfiguracoesGlobais (id=1)!');
    console.log('prompt_geral tamanho:', updatedConfig.prompt_geral?.length);
    console.log('prompt_vendas tamanho:', updatedConfig.prompt_vendas?.length);
    console.log('prompt_servico tamanho:', updatedConfig.prompt_servico?.length);
  } catch (err: any) {
    console.error('❌ Erro inesperado ao sincronizar prompts:', err.message);
  }
}

updatePolisPromptsInDb();
