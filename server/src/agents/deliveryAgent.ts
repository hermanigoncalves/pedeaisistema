import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferWindowMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { config } from '../config';
import { UserData } from '../types';
import { supabase } from '../adapters/supabaseAdapter';

// Tools
import { criarPedidoTool } from './tools/criarPedidoTool';
import { produtosCardapioTool } from './tools/produtosCardapioTool';
import { pegarInfoClienteTool } from './tools/pegarInfoClienteTool';
import { getPedidosTool } from './tools/getPedidosTool';
import { calculadoraTool } from './tools/calculadoraTool';

export const SYSTEM_PROMPT_DELIVERY = `# PEDEAI — AGENTE ESPECIALISTA EM DELIVERY E ENTREGAS

Você é a Hannah / PedeAI Delivery, assistente virtual oficial de entregas e delivery via WhatsApp.
Seu objetivo é atender o cliente de forma rápida, educada, eficiente e registrar o pedido de delivery garantindo todos os dados de entrega.

Fale **sempre em português brasileiro**, de forma amigável, clara e objetiva.

## 🛵 FLUXO DE ATENDIMENTO E CHECKLIST DE DELIVERY:

1. **Saudação & Identificação**:
   - Cumprimente o cliente pelo nome amigavelmente.
   - Caso ele peça o cardápio, use a ferramenta \`Produtos_cardapio\` para listar as opções ativas e preços.

2. **Coleta de Endereço de Entrega**:
   - Para pedidos de delivery, confirme o **Endereço Completo de Entrega** (Rua, Número, Bairro, Ponto de Referência).
   - Se o cliente já tiver um endereço salvo no perfil (obtido por \`Pegar_info_cliente\`), confirme se ele deseja entregar no mesmo endereço.

3. **Forma de Pagamento**:
   - Confirme a forma de pagamento: **PIX**, **Cartão de Crédito/Débito na entrega**, ou **Dinheiro**.
   - Se for dinheiro, pergunte se precisará de troco e para quanto (ex: troco para R$ 50,00).

4. **Confirmação e Registro do Pedido**:
   - Mostre o resumo final do pedido (Itens, Subtotal, Endereço de Entrega e Forma de Pagamento).
   - Registre o pedido através da ferramenta \`Criar_pedido\`.

5. **Acompanhamento de Status de Entrega**:
   - Caso o cliente pergunte "onde está meu pedido?" ou "qual o status?", consulte os pedidos ativos do telefone dele usando \`Get_pedidos\` e informe a etapa atual (Pendente, Em Preparo, Saiu para Entrega, Entregue).
`;

// Cache de memórias em memória por telefone
const memories = new Map<string, BufferWindowMemory>();

function getMemory(phone: string): BufferWindowMemory {
  if (!memories.has(phone)) {
    memories.set(
      phone,
      new BufferWindowMemory({
        k: 10,
        memoryKey: 'chat_history',
        returnMessages: true,
        chatHistory: new ChatMessageHistory(),
      })
    );
  }
  return memories.get(phone)!;
}

export async function runDeliveryAgent(
  phone: string,
  userMessage: string,
  userData: UserData
): Promise<string> {
  const memory = getMemory(phone);

  // Busca configurações personalizadas do restaurante para o Delivery
  let dynamicSystemPrompt = SYSTEM_PROMPT_DELIVERY;
  if (userData.id_restaurante) {
    try {
      const resData = await supabase.getRestauranteById(userData.id_restaurante);
      if (resData) {
        if (resData.personalidade_agente_delivery) {
          dynamicSystemPrompt += `\n\n## 🎭 PERSONALIDADE E TOM DE VOZ (PERSONALIZADO):\n${resData.personalidade_agente_delivery}`;
        }
        if (resData.regras_estabelecimento_delivery) {
          dynamicSystemPrompt += `\n\n## 📋 REGRAS DO ESTABELECIMENTO / ENTREGA (PERSONALIZADO):\n${resData.regras_estabelecimento_delivery}`;
        }
        if (resData.exemplos_conversa_delivery) {
          dynamicSystemPrompt += `\n\n## 💬 EXEMPLOS DE DIÁLOGO DO RESTAURANTE (DELIVERY):\n${resData.exemplos_conversa_delivery}`;
        }
      }
    } catch (err: any) {
      console.warn('[DELIVERY AGENT] Erro ao carregar regras personalizadas do restaurante:', err.message);
    }
  }

  const model = new ChatOpenAI({
    openAIApiKey: config.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    temperature: 0.3,
  });

  const tools = [
    criarPedidoTool,
    produtosCardapioTool,
    pegarInfoClienteTool,
    getPedidosTool,
    calculadoraTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', dynamicSystemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({
    llm: model,
    tools,
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: false,
  });

  const historyMessages = await memory.chatHistory.getMessages();

  const response = await executor.invoke({
    input: `[Cliente: ${userData.nome}, Telefone: ${phone}] Mensagem: ${userMessage}`,
    chat_history: historyMessages,
  });

  const outputText = String(response.output || 'Como posso te ajudar com o seu pedido de delivery hoje?');

  await memory.chatHistory.addUserMessage(userMessage);
  await memory.chatHistory.addAIChatMessage(outputText);

  return outputText;
}
