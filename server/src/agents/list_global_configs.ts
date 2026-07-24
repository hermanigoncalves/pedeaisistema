import { supabase } from '../adapters/supabaseAdapter';

async function listConfigs() {
  console.log('--- Listando todos os registros de ConfiguracoesGlobais ---');
  try {
    const { data, error } = await supabase.client
      .from('ConfiguracoesGlobais')
      .select('id, prompt_servico');

    if (error) {
      console.error('Erro ao listar do banco:', error);
      return;
    }

    console.log(`Encontrados ${data.length} registros:`);
    data.forEach((row) => {
      console.log(`\nID: ${row.id}`);
      const prompt = row.prompt_servico || '';
      if (prompt.includes('{ "divisoes"')) {
        console.log(`⚠️  Contém chaves "{}" no prompt de serviço deste ID!`);
      } else {
        console.log(`✅ Não contém chaves "{}" no prompt de serviço deste ID.`);
      }
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

listConfigs();
