require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANTE_ID } = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function list() {
  const { data, error } = await supabase
    .from('Impressoras')
    .select('*')
    .eq('restaurante_id', RESTAURANTE_ID);

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log(`Impressoras do restaurante San Pio (${RESTAURANTE_ID}) no Supabase:`);
  console.log(data);
}

list();
