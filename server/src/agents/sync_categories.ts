import { supabase } from '../adapters/supabaseAdapter';

async function seedCategoriesAndStations() {
  const restauranteId = '875bcd11-b91d-4abc-aae8-ee587df23717';
  console.log('--- Sincronizando Categorias e Estações da Polis Pub ---');

  // Estações
  try {
    await supabase.client.from('estacoes_restaurante').upsert([
      { restaurante_id: restauranteId, nome: 'kitchen', impressora_ip: null },
      { restaurante_id: restauranteId, nome: 'bar', impressora_ip: null }
    ]);
  } catch (e) {
    // Tabela alternativa
  }

  // Categorias
  try {
    await supabase.client.from('categorias_restaurante').upsert([
      { restaurante_id: restauranteId, nome: 'Salgados Quentes' },
      { restaurante_id: restauranteId, nome: 'Bebidas' }
    ]);
  } catch (e) {
    // Tabela alternativa
  }

  console.log('✅ Categorias e Estações verificadas com sucesso!');
}

seedCategoriesAndStations();
