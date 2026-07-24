
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gpsbydlnbkbofbhmhuvp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTc3NzAsImV4cCI6MjA5ODk3Mzc3MH0.13ezDWGrO6AKTib_-l7HjqamN_9oI7etpJaoNN4bB7k";

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
