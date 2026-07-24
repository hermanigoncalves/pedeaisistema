import { supabase } from '../adapters/supabaseAdapter';

async function updateDbPrompt() {
  console.log('--- Buscando prompt_servico atual no Banco ---');
  try {
    const { data: currentConfig, error: fetchError } = await supabase.client
      .from('ConfiguracoesGlobais')
      .select('prompt_servico')
      .eq('id', 1)
      .single();

    if (fetchError || !currentConfig) {
      console.error('Erro ao buscar prompt atual:', fetchError);
      return;
    }

    const currentPrompt = currentConfig.prompt_servico;
    
    if (!currentPrompt) {
      console.log('Nenhum prompt de serviço encontrado para atualizar.');
      return;
    }

    console.log('Prompt atual carregado com sucesso. Realizando substituição...');

    // Substituir a chave problematica
    const updatedPrompt = currentPrompt.replace(
      /\{ "divisoes": N \}/g,
      'passando o número N de divisões no parâmetro divisoes'
    );

    if (currentPrompt === updatedPrompt) {
      console.log('Aviso: O prompt do banco já estava atualizado ou não continha o padrão de chaves. Nenhuma alteração foi necessária.');
      return;
    }

    const { data: updatedConfig, error: updateError } = await supabase.client
      .from('ConfiguracoesGlobais')
      .update({ prompt_servico: updatedPrompt })
      .eq('id', 1)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar prompt no banco:', updateError);
      return;
    }

    console.log('✅ Prompt de serviço atualizado com sucesso no banco de dados!');
    console.log('Novo trecho alterado:');
    console.log(updatedConfig.prompt_servico.substring(
      updatedConfig.prompt_servico.indexOf('Segundo Turno'),
      updatedConfig.prompt_servico.indexOf('Segundo Turno') + 300
    ));

  } catch (err: any) {
    console.error('Erro inesperado ao rodar a atualização:', err.message);
  }
}

updateDbPrompt();
