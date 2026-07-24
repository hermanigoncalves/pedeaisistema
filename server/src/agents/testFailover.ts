import { runAgent } from './pedeaiAgent';
import { UserData } from '../types';
import { config } from '../config';
import { supabase } from '../adapters/supabaseAdapter';

async function testFailover() {
  console.log('--- Iniciando Teste de Failover (Chamar Garçom Automático) ---');
  
  const mockUser: UserData = {
    id: 9999, // ID fictício de teste
    telefone: '5533999999999',
    id_restaurante: 'a976db0c-c1df-4b21-a836-3671f1a5bba9', // San Pio
    mesa_atual: '7',
    Status: 'ativo',
    nome: 'Hermani',
    quantas_vezes_foi: 33,
  };

  // Forçar uma chave de API inválida temporariamente para gerar erro técnico no Langchain/OpenAI
  const originalApiKey = config.OPENAI_API_KEY;
  (config as any).OPENAI_API_KEY = 'invalid_key_for_test';

  const userMessage = 'pedi pra fechar a conta';

  console.log(`Cliente: "${userMessage}"`);
  
  try {
    const response = await runAgent(mockUser.telefone, userMessage, mockUser);
    console.log(`\nResposta do Agente (Esperado mensagem amigável sem citar erro técnico):\n"${response}"`);

    // Restaurar a chave API original para podermos consultar o banco de dados
    (config as any).OPENAI_API_KEY = originalApiKey;

    console.log('\nVerificando se o chamado do garçom foi gerado no banco...');
    
    // Buscar o último pedido do usuário para ver se o chamado de garçom com status pendente foi inserido
    const pedidos = await supabase.getPedidosByMesa(7, mockUser.id_restaurante, 'garcom_pendente', mockUser.telefone);
    
    if (pedidos && pedidos.length > 0) {
      const ultimoPedido = pedidos[pedidos.length - 1];
      console.log('✅ Chamado de garçom detectado no banco de dados!');
      console.log('ID do Pedido-Sinal:', ultimoPedido.id);
      console.log('Mesa:', ultimoPedido.mesa);
      console.log('Status:', ultimoPedido.status);
      console.log('Itens:', ultimoPedido.itens);
      console.log('Descrição:', ultimoPedido.descricao);
    } else {
      console.error('❌ Falha: O chamado do garçom não foi encontrado no banco.');
    }

  } catch (err: any) {
    console.error('Erro inesperado fora do fluxo do agente:', err);
  } finally {
    // Garantir a restauração da chave
    (config as any).OPENAI_API_KEY = originalApiKey;
  }
}

testFailover();
