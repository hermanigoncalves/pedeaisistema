import { supabase } from '../adapters/supabaseAdapter';

async function findAllCheckins() {
  console.log('=== BUSCANDO CHECK-INS NA MESA 7 DE FORMA GLOBAL ===\n');

  try {
    const { data: users, error } = await supabase.client
      .from('Usuários')
      .select('id, nome, telefone, mesa_atual, Status, id_restaurante')
      .eq('mesa_atual', '7');

    if (error) {
      console.error('Erro ao ler Usuários:', error.message);
      return;
    }

    console.log(`Encontrados ${users.length} usuários globais na mesa 7:`);
    users.forEach((u) => {
      console.log(`- Nome: "${u.nome}" | Telefone: "${u.telefone}" | Restaurante: "${u.id_restaurante}" | Status: "${u.Status}"`);
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

findAllCheckins();
