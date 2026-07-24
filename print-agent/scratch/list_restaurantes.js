require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function list() {
  const { data, error } = await supabase
    .from('Restaurantes')
    .select('id, nome, email');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log('Restaurantes cadastrados no Supabase:');
  console.log(data);
}

list();
