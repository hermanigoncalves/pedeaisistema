
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ipcawfdvdwcvrcdbegny.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwY2F3ZmR2ZHdjdnJjZGJlZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTM3NzYsImV4cCI6MjEwMTA2OTc3Nn0.qx4WnUwQnWoIOmpie5bBjwVXJzO_XF2Zk5_l_RsF2No";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testPedidos() {
    console.log('--- TESTING PEDIDOS ---');
    const { data, error } = await supabase
        .from('Pedidos')
        .select('id')
        .limit(1);

    if (error) {
        console.log('RESULT PEDIDOS: ERROR');
        console.error(JSON.stringify(error));
    } else {
        console.log('RESULT PEDIDOS: SUCCESS');
    }
}

testPedidos();
