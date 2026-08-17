const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../print-agent/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESTAURANTE_ID = process.env.RESTAURANTE_ID;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log('RESTAURANTE_ID:', RESTAURANTE_ID);
  
  const { data: printers, error } = await supabase
    .from('Impressoras')
    .select('*')
    .eq('restaurante_id', RESTAURANTE_ID);
    
  console.log('Printers Error:', error);
  console.log('Printers:', printers);

  const { data: orders, error: ordersErr } = await supabase
    .from('Pedidos')
    .select('*')
    .eq('restaurante_id', RESTAURANTE_ID)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Recent Orders:', orders);
}
check();
