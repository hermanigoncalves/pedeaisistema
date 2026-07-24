import { runAgent } from './pedeaiAgent';
import { UserData } from '../types';

async function test() {
  console.log('--- Iniciando Simulação do Fechamento de Conta ---');
  
  const mockUser: UserData = {
    id: 9999, // ID fictício de teste
    telefone: '5533999999999',
    id_restaurante: 'a976db0c-c1df-4b21-a836-3671f1a5bba9', // San Pio
    mesa_atual: '7',
    Status: 'ativo',
    nome: 'Hermani',
    quantas_vezes_foi: 33,
  };

  const userMessage = 'fechar a conta';

  console.log(`Cliente: "${userMessage}"`);
  
  try {
    const response = await runAgent(mockUser.telefone, userMessage, mockUser);
    console.log(`\nResposta do Agente:\n"${response}"`);
  } catch (err: any) {
    console.error('Erro durante a execução do agente:', err);
  }
}

test();
