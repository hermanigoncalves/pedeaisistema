const net = require('net');
require('dotenv').config();

const host = process.env.PRINTER_KITCHEN_HOST || '192.168.1.169';
const port = parseInt(process.env.PRINTER_KITCHEN_PORT || '9100', 10);

console.log('====================================================');
console.log(' PedeAi - Testador de Conexao Direta com Impressora');
console.log('====================================================');
console.log(`IP de Destino: ${host}`);
console.log(`Porta TCP:     ${port}`);
console.log('----------------------------------------------------');
console.log('Tentando conectar...');

const client = new net.Socket();
client.setTimeout(5000);

client.connect(port, host, () => {
  console.log('  [OK] Conectado com sucesso a impressora!');
  console.log('  Enviando dados brutos de teste (ESC/POS)...');
  
  // Comandos ESC/POS basicos
  const esc = '\x1B';
  const gs = '\x1D';
  const init = esc + '@';
  const cut = gs + 'V' + '\x41' + '\x00';
  
  const text = `${init}\n================================\n     PEDEAI - TESTE DE REDE\n================================\n\nSe voce esta lendo isto, a comunicacao\ndireta via rede funcionou 100%!\n\n\n\n${cut}`;
  
  client.write(text, 'utf-8', () => {
    console.log('  [OK] Dados enviados com sucesso! Cortando papel...');
    client.end();
  });
});

client.on('error', (err) => {
  console.log('\n❌ [ERRO] Falha na conexao:', err.message);
  console.log('\n--- Dicas de Diagnostico ---');
  console.log('1. Confirme se o IP da impressora esta correto no arquivo .env (atual: ' + host + ')');
  console.log('2. Certifique-se de que a impressora esta conectada na mesma rede (Wi-Fi/Cabo) deste computador.');
  console.log('3. Teste dar um ping na impressora no prompt de comando: ping ' + host);
  console.log('4. Verifique se a impressora esta ligada e com papel.');
  console.log('----------------------------');
});

client.on('timeout', () => {
  console.log('\n❌ [TIMEOUT] A impressora demorou muito para responder.');
  console.log('Verifique se o IP esta correto e se a impressora nao esta ocupada.');
  client.destroy();
});

client.on('close', () => {
  console.log('\nConexao encerrada.');
  console.log('Pressione qualquer tecla para fechar...');
});
