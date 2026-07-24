import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';
const MESA = '7';

async function listTableUsers() {
  console.log(`=== USUÁRIOS VINCULADOS À MESA ${MESA} NO BANCO ===\n`);

  try {
    const { data: users, error } = await supabase.client
      .from('Usuários')
      .select('id, nome, telefone, mesa_atual, Status, ultimo_checkin, created_at')
      .eq('id_restaurante', RESTAURANTE_ID)
      .eq('mesa_atual', MESA);

    if (error) {
      console.error('Erro ao ler Usuários:', error.message);
      return;
    }

    console.log(`Encontrados ${users.length} usuários com mesa_atual = ${MESA}:`);
    users.forEach((u) => {
      console.log(`- Nome: "${u.nome}" | Telefone: "${u.telefone}" | Status: "${u.Status}" | Check-in: ${u.ultimo_checkin || u.created_at}`);
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

listTableUsers();
