
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gpsbydlnbkbofbhmhuvp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTc3NzAsImV4cCI6MjA5ODk3Mzc3MH0.13ezDWGrO6AKTib_-l7HjqamN_9oI7etpJaoNN4bB7k";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function runMigration() {
    console.log('--- RUNNING MIGRATION ---');

    // Note: Supabase JS client doesn't support DDL directly without a service role key or RPC.
    // However, we can try to insert the restaurant. If the column doesn't exist, it will fail.
    
    const restaurantData = {
        nome: 'Liderança',
        email: 'fernandolidercachorroquente@gmail.com',
        senha: 'lideranca2026',
        quantidade_mesas: '10',
        quantidade_max_mesas: '10',
        gerencia_estoque: false
    };

    console.log('Inserting restaurant "Liderança"...');
    const { data, error } = await supabase
        .from('Restaurantes')
        .upsert(restaurantData, { onConflict: 'email' })
        .select();

    if (error) {
        console.log('RESULT: ERROR');
        console.error(JSON.stringify(error, null, 2));
        console.log('\nIMPORTANT: A coluna "gerencia_estoque" pode não existir ainda. Por favor, execute o arquivo SQL de migração no painel do Supabase.');
    } else {
        console.log('RESULT: SUCCESS');
        console.log(JSON.stringify(data, null, 2));
    }

    console.log('--- FINISHED ---');
}

runMigration();
