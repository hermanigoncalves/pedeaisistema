import { supabase } from '../adapters/supabaseAdapter';

const RESTAURANTE_ID = 'a976db0c-c1df-4b21-a836-3671f1a5bba9';

async function listPrinters() {
  console.log('=== LISTAGEM DE IMPRESSORAS CADASTRADAS NO BANCO ===\n');

  try {
    const { data: printers, error } = await supabase.client
      .from('Impressoras')
      .select('*')
      .eq('restaurante_id', RESTAURANTE_ID);

    if (error) {
      console.error('Erro ao ler tabela Impressoras:', error.message);
      return;
    }

    console.log(`Encontradas ${printers.length} impressoras cadastradas:`);
    printers.forEach((p) => {
      console.log(`\nID: ${p.id}`);
      console.log(`Nome: "${p.nome}"`);
      console.log(`Tipo/Estações: "${p.tipo}" (ex: kitchen, bar, receipt, all)`);
      console.log(`Conexão: "${p.conexao}"`);
      console.log(`IP: "${p.ip || ''}" | Porta: ${p.porta}`);
      console.log(`USB Path: "${p.usb_path || ''}"`);
      console.log(`Ativa: ${p.ativo}`);
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err.message);
  }
}

listPrinters();
