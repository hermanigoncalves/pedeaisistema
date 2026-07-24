import { supabase } from '../adapters/supabaseAdapter';

async function checkDb() {
  console.log('--- Lendo prompt_servico atual diretamente do banco de dados ---');
  try {
    const { data, error } = await supabase.client
      .from('ConfiguracoesGlobais')
      .select('prompt_servico')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.error('Erro ao ler do banco:', error);
      return;
    }

    const prompt = data.prompt_servico || '';
    
    // Procurar por chaves {} na regiao da divisao de conta
    console.log('Tamanho do prompt:', prompt.length);
    
    const startIdx = prompt.indexOf('Segundo Turno');
    if (startIdx !== -1) {
      console.log('\n--- Trecho de Divisão de Conta no Banco ---');
      console.log(prompt.substring(startIdx, startIdx + 500));
    } else {
      console.log('Aviso: Não encontrou trecho "Segundo Turno" no prompt.');
    }

    if (prompt.includes('{ "divisoes"')) {
      console.log('\n⚠️ ERRO: O banco de dados AINDA CONTÉM a chave "{ \\"divisoes\\": N }"!');
    } else {
      console.log('\n✅ Sucesso: O banco de dados NÃO CONTÉM chaves "{ \\"divisoes\\": N }".');
    }

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

checkDb();
