import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ipyaxotvhahjyrgnkngu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWF4b3R2aGFoanlyZ25rbmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk1NDkwMiwiZXhwIjoyMDkzNTMwOTAyfQ.EzUfahzJUXIoUswLaZNmNMDk9fDrNz8G_a8qFaavjfE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createTestRestaurant() {
    console.log('--- CREATING TEST RESTAURANT ---');

    const testRestaurant = {
        nome: 'Restaurante Teste',
        email: 'teste@pedeai.com',
        senha: '123', // Senha simples para teste, conforme lógica de comparação direta
        quantidade_mesas: '10',
        quantidade_max_mesas: '20',
        horario_fecha_cozinha: '23:00'
    };

    const { data, error } = await supabase
        .from('Restaurantes')
        .insert(testRestaurant)
        .select();

    if (error) {
        console.log('RESULT: ERROR');
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log('RESULT: SUCCESS');
        console.log(JSON.stringify(data, null, 2));
    }

    console.log('--- FINISHED ---');
}

createTestRestaurant();
