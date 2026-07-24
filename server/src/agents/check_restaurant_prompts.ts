import { supabase } from '../adapters/supabaseAdapter';

async function checkRestaurant() {
  const sanPioId = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';
  console.log(`--- Buscando dados do Restaurante San Pio (${sanPioId}) ---`);
  
  try {
    const { data: restaurante, error } = await supabase.client
      .from('Restaurantes')
      .select('nome, personalidade_agente, exemplos_conversa, regras_estabelecimento')
      .eq('id', sanPioId)
      .single();

    if (error || !restaurante) {
      console.error('Erro ao buscar restaurante:', error);
      return;
    }

    console.log('Restaurante:', restaurante.nome);
    console.log('\n--- PERSONALIDADE AGENTE ---');
    console.log(restaurante.personalidade_agente || 'Em branco');
    
    console.log('\n--- EXEMPLOS CONVERSA ---');
    console.log(restaurante.exemplos_conversa || 'Em branco');
    
    console.log('\n--- REGRAS ESTABELECIMENTO ---');
    console.log(restaurante.regras_estabelecimento || 'Em branco');

    // Verificar se as chaves {} estao em algum desses campos
    const checkString = (str: string | null) => str && (str.includes('{') || str.includes('}'));
    if (checkString(restaurante.personalidade_agente) || checkString(restaurante.exemplos_conversa) || checkString(restaurante.regras_estabelecimento)) {
      console.log('\n⚠️ ALERTA: Foram encontradas chaves "{}" em um dos campos acima!');
    } else {
      console.log('\nNenhuma chave "{}" encontrada nas configurações do restaurante.');
    }

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

checkRestaurant();
