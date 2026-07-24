import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';
const TELEFONE = '5533987140460';

async function checkColumns() {
  console.log('=== VERIFICAR COLUNAS DA TABELA Usuários ===\n');

  // Buscar o usuário com select('*') para ver todas as colunas
  const { data, error } = await supabase.client
    .from('Usuários')
    .select('*')
    .eq('id_restaurante', RESTAURANTE_ID)
    .eq('telefone', TELEFONE)
    .single();

  if (error) {
    console.error('Erro:', error.message, error.code);
  } else {
    console.log('Colunas encontradas:');
    const cols = Object.keys(data);
    cols.forEach(col => {
      console.log(`  ${col}: ${JSON.stringify(data[col])}`);
    });
    console.log(`\nTotal: ${cols.length} colunas`);
    console.log(`\nColuna "chat_humano" existe? ${cols.includes('chat_humano') ? 'SIM' : 'NÃO ❌'}`);
    console.log(`Coluna "Status" existe? ${cols.includes('Status') ? 'SIM' : 'NÃO'}`);
    console.log(`Coluna "mesa_atual" existe? ${cols.includes('mesa_atual') ? 'SIM' : 'NÃO'}`);
  }

  // Tentar o update SEM chat_humano
  console.log('\n--- Testando UPDATE sem chat_humano ---');
  const { data: upd, error: updErr } = await supabase.client
    .from('Usuários')
    .update({ mesa_atual: '0', Status: 'Inativo' })
    .eq('id_restaurante', RESTAURANTE_ID)
    .eq('telefone', TELEFONE)
    .select();

  if (updErr) {
    console.error('❌ Update falhou:', updErr.message);
  } else {
    console.log('✅ Update sem chat_humano:', JSON.stringify(upd, null, 2));
  }
}

checkColumns();
