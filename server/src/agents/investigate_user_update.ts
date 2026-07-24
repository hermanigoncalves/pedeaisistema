import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';
const TELEFONE = '5533987140460'; // Hermani

async function investigarUsuario() {
  console.log('=== INVESTIGAÇÃO DO ESTADO DO USUÁRIO APÓS FECHAMENTO DE CONTA ===\n');

  // 1. Buscar estado atual do usuário
  console.log('--- 1. Estado atual do usuário na tabela Usuários ---');
  const { data: user, error: e1 } = await supabase.client
    .from('Usuários')
    .select('id, nome, telefone, mesa_atual, Status, id_restaurante, chat_humano')
    .eq('id_restaurante', RESTAURANTE_ID)
    .eq('telefone', TELEFONE)
    .single();

  if (e1) {
    console.error('Erro ao buscar na tabela "Usuários":', e1.message, e1.code, e1.details);
    
    // Tentar sem acento
    console.log('\n  Tentando com tabela "Usuarios" (sem acento)...');
    const { data: user2, error: e2 } = await supabase.client
      .from('Usuarios')
      .select('id, nome, telefone, mesa_atual, Status, id_restaurante, chat_humano')
      .eq('id_restaurante', RESTAURANTE_ID)
      .eq('telefone', TELEFONE)
      .single();
    
    if (e2) {
      console.error('  Também falhou com "Usuarios":', e2.message, e2.code);
    } else {
      console.log('  ✅ Encontrou na tabela "Usuarios" (sem acento)!');
      console.log('  Dados:', JSON.stringify(user2, null, 2));
    }
  } else {
    console.log('  Dados:', JSON.stringify(user, null, 2));
    console.log(`  mesa_atual: "${user.mesa_atual}" (esperado: "0")`);
    console.log(`  Status: "${user.Status}" (esperado: "Inativo")`);
  }

  // 2. Verificar se o update funciona corretamente
  console.log('\n--- 2. Testando UPDATE manual ---');
  const { data: updateResult, error: updateErr, count } = await supabase.client
    .from('Usuários')
    .update({ mesa_atual: '0', Status: 'Inativo', chat_humano: false })
    .eq('id_restaurante', RESTAURANTE_ID)
    .eq('telefone', TELEFONE)
    .select();

  if (updateErr) {
    console.error('  ❌ Erro no update "Usuários":', updateErr.message, updateErr.code, updateErr.details);
  } else {
    console.log('  Resultado do update:', JSON.stringify(updateResult, null, 2));
    console.log(`  Linhas afetadas: ${updateResult?.length || 0}`);
  }

  // 3. Re-ler o estado após o update
  console.log('\n--- 3. Estado após update ---');
  const { data: userAfter } = await supabase.client
    .from('Usuários')
    .select('mesa_atual, Status, chat_humano')
    .eq('id_restaurante', RESTAURANTE_ID)
    .eq('telefone', TELEFONE)
    .single();
  
  if (userAfter) {
    console.log(`  mesa_atual: "${userAfter.mesa_atual}"`);
    console.log(`  Status: "${userAfter.Status}"`);
    console.log(`  chat_humano: ${userAfter.chat_humano}`);
  }

  // 4. Verificar o toolUserData que o agente passa
  console.log('\n--- 4. Dados que a contaSolicitadaTool recebe ---');
  console.log('  No modo COMANDA (San Pio):');
  console.log(`    userData.telefone = "${TELEFONE}" (telefone real)`);
  console.log('  No modo MESA:');
  console.log('    userData.telefone = "" (string vazia - filtro desligado)');
  console.log('\n  O filter .eq("telefone", "") com string vazia pode não encontrar nenhum registro!');
}

investigarUsuario();
