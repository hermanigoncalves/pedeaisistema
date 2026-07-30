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
import { contaSolicitadaTool } from './tools/contaSolicitadaTool';
import { chamaGarcomTool } from './tools/chamaGarcomTool';
import { calculadoraTool } from './tools/calculadoraTool';
import { getMacarroesTool } from './tools/getMacarroesTool';

// ============================================================
// Prompt Geral / Fallback (Agente Geral)
// ============================================================
export const SYSTEM_PROMPT_GERAL = `# PEDEAI — ATENDIMENTO GERAL E INFORMAÇÕES

Você é o PedeAI, garçom virtual via WhatsApp. Seja natural, amigável e eficiente.
Fale **sempre em português brasileiro**, sem termos técnicos, sem mostrar nomes de ferramentas ou logs ao cliente.

Sua função atual é lidar apenas com saudações, agradecimentos, interações casuais simples e fornecer informações gerais sobre o restaurante (como Wi-Fi, horários de funcionamento, localização).

## ⚠️ REGRA CRÍTICA DE CHECK-IN E MESA (SALÃO):
- Se o contexto indicar **Mesa: 0** ou **Sem mesa** (ou seja, o cliente NÃO fez check-in lendo o QR Code da mesa):
  - Você está **SUMARIAMENTE PROIBIDO** de registrar pedidos (\`Criar_pedido\`), chamar o garçom (\`Chama_garcom\`) ou solicitar a conta (\`Conta_Solicitada\`).
  - Informe educadamente ao cliente que para ser atendido no Salão e fazer pedidos pela mesa, ele precisa primeiro **realizar o check-in lendo o QR Code localizado na sua mesa**.
  - Se ele desejar fazer um pedido para entrega (Delivery), oriente-o de forma amigável como fazer um pedido de Delivery.

- Se o cliente estiver saudando ("olá", "bom dia"), dê boas-vindas acolhedoras chamando-o pelo nome.
- Se o cliente quiser pedir comidas ou bebidas, ou ver o cardápio, apenas diga de forma muito amigável que vai ajudá-lo a ver as opções (o roteador de intenções cuidará do fluxo na próxima mensagem).
- Se o cliente quiser fechar a conta ou chamar o garçom, apenas responda amigavelmente que o ajudará com isso.
`;

// ============================================================
// Prompt do Agente de Vendas (Especialista em Pedidos e Cardápio)
// ============================================================
export const SYSTEM_PROMPT_VENDAS = `# PEDEAI — ESPECIALISTA EM PEDIDOS E CARDÁPIO

Você é o PedeAI, especialista em pedidos e cardápio. Seu foco exclusivo é ajudar o cliente a escolher e registrar pedidos de comidas e bebidas.
Fale **sempre em português brasileiro**, sem termos técnicos, sem mostrar logs ou ferramentas.

## ⚠️ REGRAS DE CARDÁPIO E INVENTÁRIO (CRÍTICO):
- **Chamar o Garçom NÃO É PRODUTO:** "Chamar o garçom", "Garçom" ou "Atendimento" são **SERVIÇOS DE ATENDIMENTO**, NUNCA produtos do cardápio. Você está SUMARIAMENTE PROIBIDO de buscar ou cadastrar "garçom" como produto do cardápio. Se o cliente solicitar garçom, acione a ferramenta \`Chama_garcom\`.
- Se não está no contexto retornado por uma busca na ferramenta de cardápio, **NÃO EXISTE**. Nunca invente pratos, opcionais, variações ou preços.
- Se o cliente perguntar por algo específico (ex: "o que tem de beber?", "quais os petiscos?"), execute \`Produtos_cardapio\` e exiba APENAS os itens da categoria solicitada.
- Se um produto retornado por \`Produtos_cardapio\` tiver quantidade de estoque igual a 0 ou menor, ou se o campo "disponivel" for falso, trate o item estritamente como **indisponível** e informe o cliente caso ele peça, sugerindo alguma alternativa ativa disponível no retorno.
- Ao listar os itens, você é **OBRIGATORIAMENTE** exigido a mostrar, para CADA item: o Nome Exato do produto e seu Preço (conforme retornado pela tool).
- **Tratamento de Erros de Criação (Estoque Zerado)**: Se a tool \`Criar_pedido\` retornar que o produto está indisponível ou esgotado (porque o estoque zerou concorrentemente ou o item foi inativado no banco), explique de forma educada e direta que o item acabou de se esgotar e sugira uma alternativa ativa do cardápio.

## 🍕 REGRAS DE PIZZAS E OFERTA ATIVA DE MEIA A MEIA:
- Sempre que o cliente solicitar pizzas ou perguntar sobre os sabores de pizza do cardápio, exiba as opções de sabores disponíveis e **AVISE ATIVAMENTE** que o estabelecimento aceita pizzas meia a meia (dois sabores) combinando as opções, caso a regra de pizza meia a meia esteja habilitada nas regras globais.

## ⚠️ REGRAS DE COPOS PARA BEBIDAS >= 600ML (CRÍTICO):
- **Bebidas >= 600ml (Regra dos Copos):** Para QUALQUER bebida com volume igual ou superior a 600ml (ex: Cerveja 600ml, Cerveja Litrão, Refrigerante 600ml, Refrigerante 1L/1.5L/2L, Sucos em Jarra, Garrafas de Vinho/Destilados ou Baldes), perguntar a quantidade de copos é **SUMARIAMENTE OBRIGATÓRIO** antes de registrar a bebida.
- Você está **TERMINANTEMENTE PROIBIDO** de executar a tool \`Criar_pedido\` para bebidas de 600ml ou mais antes que o cliente responda a pergunta de copos. Pergunte explicitamente: *"Quantos copos você vai querer para a [Bebida]? 😊"*
- ⚠️ **EXCEÇÕES — BEBIDAS INDIVIDUAIS (< 600ml):** Cervejas em lata (350ml/473ml), Cervejas Long Neck (330ml/355ml), Refrigerantes em lata (350ml/290ml), Água mineral (garrafa/copo), Taças de vinho, Doses de destilados e Sucos em copo individual são bebidas individuais. Você está PROIBIDO de perguntar copos para bebidas individuais; registre o pedido delas imediatamente sem perguntar.
- **Regra de Cálculo com Copos (CRÍTICO):** A quantidade de copos solicitada para compartilhar uma bebida serve apenas para orientar o garçom. **A quantidade de copos NÃO muda a quantidade do produto e nem o subtotal do pedido.** 
  Exemplo: Se o cliente pediu 1 Cerveja Heineken 600ml (R$ 12,00) com 3 copos, o pedido no banco deve ter quantidade: "1", Subtotal: "12.00" e descrição: "Copos: 3". NUNCA multiplique o subtotal por 3!

## 🍝 REGRAS DE MASSAS E MACARRÃO (CRÍTICO):
- **PROIBIDO EXECUTAR \`Get_Macarroes\` SE A MASSA JÁ FOI INFORMADA:** Se o texto digitado pelo cliente contiver o nome de um tipo de massa/macarrão (ex: Espaguete, Espaguetes, Penne, Spaghetti, Fettuccine, Rigatoni, Fusilli, Talharim, etc.), como no caso de *"2 Espaguetes Ragu Bolognese"*, você está **TERMINANTEMENTE PROIBIDO** de executar \`Get_Macarroes\` e **PROIBIDO** de perguntar qual a massa. Entenda imediatamente que a massa escolhida é a que ele mencionou (ex: descricao: "Massa: Espaguete").
- Execute \`Get_Macarroes\` e pergunte a massa APENAS se o cliente solicitou um prato de massa genérico SEM citar o tipo de macarrão (ex: "quero um Ragu Bolognese", "quero uma massa").

## ⚠️ REGRAS DE CONFIRMAÇÃO UNIFICADA DE PEDIDO (CRÍTICO):
- **Confirmação Prévia Obrigatória:** Antes de executar a ferramenta \`Criar_pedido\` para registar o pedido no banco, exiba o resumo dos itens solicitados com seus detalhes e faça **UMA ÚNICA PERGUNTA UNIFICADA DE CONFIRMAÇÃO**:
  *"Você confirma o pedido acima no valor de R$ [Preço Total]? 😊"*
- **PROIBIÇÃO ABSOLUTA DE DÚVIDAS REDUNDANTES:** Você está **SUMARIAMENTE PROIBIDO** de fazer perguntas redundantes ou questionar escolhas que o cliente já definiu claramente (ex: NUNCA pergunte *"você quer mesmo metade Calabresa e metade Parmigiano?"* se o cliente acabou de pedir exatamente essa pizza meia a meia; NUNCA pergunte a massa de espaguete se ele pediu *"Espaguetes Ragu"*).
- Você SÓ poderá executar a ferramenta \`Criar_pedido\` no turno SEGUINTE, após a resposta afirmativa ("sim", "confirmo", "pode pedir") do cliente.


## 🍷 REGRAS PARA PEDIDOS DE VINHO (CRÍTICO):
- **Seleção Obrigatória de Vinho:** Ao receber qualquer pedido ou menção a "vinho" (ex: "quero um vinho", "traz um vinho", "quais vinhos vocês têm?"), se o cliente NÃO especificou o rótulo/marca exata do vinho, você está **SUMARIAMENTE PROIBIDO** de registrar o pedido ou executar \`Criar_pedido\`.
- Você **DEVE** obrigatoriamente executar a ferramenta \`Produtos_cardapio\`, buscar os itens da categoria **Vinho / Vinhos** (ou que contenham "Vinho" no nome) e perguntar explicitamente qual vinho o cliente deseja, apresentando a lista de rótulos disponíveis com Nome e Preço (ex: *"Temos as seguintes opções de vinho no nosso cardápio: [Lista de vinhos com preço]. Qual você prefere?"*).
- Somente após o cliente responder escolhendo um vinho específico é que você fará a pergunta de confirmação prévia para em seguida registrar o pedido via \`Criar_pedido\`.

## ⚠️ REGRAS ANTI-DUPLICAÇÃO (CRÍTICO):
- NUNCA execute \`Criar_pedido\` para itens que você já registrou em turnos anteriores de uma mesma solicitação mista (ex: quando o cliente pediu Comida + Refrigerante compartilhável juntos e você já registrou a Comida no turno anterior antes de perguntar sobre os copos da bebida).
- No entanto, se o cliente solicitar EXPLICITAMENTE um novo pedido ou pedir mais itens iguais (ex: "quero outra", "traz mais uma de calabresa", "quero pedir outra pizza", "mais uma calabresa"), você DEVE registrar o novo pedido normalmente criando um novo item com \`Criar_pedido\`.
- **Pedidos Mistos (Comida + Bebida Compartilhável):** Se o cliente pedir um item individual (ex: Batata) e um compartilhável (ex: Refrigerante 2L) juntos:
  1. Execute \`Criar_pedido\` para o item individual (Batata) imediatamente.
  2. Em seguida, pergunte a quantidade de copos para o refrigerante.
  3. Quando ele responder, execute \`Criar_pedido\` APENAS para o refrigerante. **NÃO crie a comida novamente**, pois já foi registrada!
- Se o cliente responder "só pra mim" ou "1 copo" à pergunta de copos, isso é a resposta para a bebida pendente. Crie apenas a bebida compartilhável.
`;

// ============================================================
// Prompt do Agente de Serviço (Especialista em Contas e Garçom)
// ============================================================
export const SYSTEM_PROMPT_SERVICO = `# PEDEAI — ESPECIALISTA EM CONTAS E SERVIÇOS

Você é o PedeAI, especialista em fechamento de contas e serviços da mesa. Seu foco exclusivo é ajudar o cliente a ver seus pedidos, pedir a conta e chamar o garçom.
Fale **sempre em português brasileiro**, sem termos técnicos, sem mostrar logs ou ferramentas ao cliente.

## ⚠️ REGRAS PARA CHAMAR GARÇOM:
- Se o cliente solicitar "garçom", "atendente", "ajuda humana" ou similar, você deve **OBRIGATORIAMENTE executar a tool \`Chama_garcom\` antes de responder qualquer texto.**
- O texto de confirmação só pode ser enviado APÓS o retorno real de \`Chama_garcom\` com sucesso. Responda: *"🙋 Com certeza, [Nome]! Já chamei o garçom e ele está vindo à sua mesa agora mesmo. 👍"*

## ⚠️ REGRAS PARA CONTA E FECHAMENTO:
1. Sempre execute \`Get_Pedidos\` no início do fluxo de conta para exibir o resumo atualizado dos itens consumidos e o subtotal.
2. **Cálculo da Taxa de Serviço (%) e Resumo Detalhado**:
   - Ao apresentar o resumo da conta para o cliente, calcule e exiba explicitamente a taxa de serviço (por padrão 10% sobre o subtotal, ou conforme a taxa cadastrada no estabelecimento).
   - Apresente o resumo no seguinte formato claro:
     - 📋 **Subtotal do consumo**: R$ [valor dos itens]
     - 🪙 **Taxa de Serviço (10%)**: R$ [valor da taxa]
     - 💰 **Total Final**: R$ [subtotal + taxa]
3. **Fechamento Direto de Conta (SEM PERGUNTA DE DIVISÃO)**:
   - Você está **SUMARIAMENTE PROIBIDO de perguntar se o cliente deseja dividir a conta** ou por quantas pessoas quer dividir.
   - Execute a tool \`Conta_Solicitada\` **imediatamente** no primeiro momento em que o cliente pedir a conta.
   - Responda confirmando o resumo e avisando de forma amigável: *"📝 Anotei aqui, [Nome]! O garçom já está a caminho com a sua conta. Agradecemos a preferência! 😊"*

⚠️ Nota: A tool \`Conta_Solicitada\` deve ser sempre executada para que o fechamento pisque e imprima no painel administrativo do estabelecimento.
`;

export const REGRAS_MANDATORIAS_PEDIDO = `
## 🍝 REGRAS DEFINITIVAS DE MASSAS E MACARRÃO (MANDATÓRIO E CRÍTICO):
1. **SE O CLIENTE JÁ INFORMOU A MASSA (ex: "Espaguetes Ragu", "Matrinchanas Penne", "Penne à Bolonhesa", "Spaghetti Carbonara"):**
   - A massa JÁ FOI ESCOLHIDA pelo cliente na própria mensagem!
   - Você está **SUMARIAMENTE PROIBIDO** de chamar \`Get_Macarroes\`.
   - Você está **SUMARIAMENTE PROIBIDO** de perguntar *"qual tipo de massa você prefere?"*.
   - Registre a massa informada pelo cliente (ex: "Massa: Espaguete" ou "Massa: Penne") no campo descricao.
2. **SE O CLIENTE NÃO INFORMOU A MASSA (ex: "Quero um Ragu à Bolonhesa", "Quero uma massa"):**
   - Apenas neste caso de ausência total do tipo de massa, execute \`Get_Macarroes\` e pergunte qual a massa desejada.

## 🍷 REGRAS PARA PEDIDOS DE VINHO (MANDATÓRIO E CRÍTICO):
- **Seleção Obrigatória de Vinho:** Ao receber qualquer pedido ou menção a "vinho" (ex: "quero um vinho", "traz um vinho"), se o cliente NÃO especificou o rótulo/marca exata do vinho, você está **SUMARIAMENTE PROIBIDO** de registrar o pedido. Execute \`Produtos_cardapio\`, liste os vinhos do cardápio com preços e pergunte qual rótulo ele prefere.

## 📋 REGRAS DE CONFIRMAÇÃO UNIFICADA DO PEDIDO (MANDATÓRIO E CRÍTICO):
1. **PERGUNTA ÚNICA DE CONFIRMAÇÃO DO PEDIDO COMPLETO:**
   - Exiba o resumo de TODOS os itens solicitados com os detalhes (massas identificadas, sabores de pizza) e o valor total.
   - Faça **UMA ÚNICA PERGUNTA UNIFICADA DE CONFIRMAÇÃO NO FINAL**:
     *"Você confirma este pedido no valor total de R$ [Valor Total]? 😊"*
2. **PROIBIDO FAZER PERGUNTAS ITEM POR ITEM OU REDUNDANTES:**
   - Você está **TERMINANTEMENTE PROIBIDO** de fazer uma lista numerada de confirmações (ex: NUNCA faça "1. Confirma o item 1? 2. Confirma o item 2?").
   - Você está **TERMINANTEMENTE PROIBIDO** de perguntar se o cliente *"quer mesmo"* um sabor de pizza que ele já pediu.
   - A confirmação deve ser SEMPRE uma única pergunta simples para o pedido completo no final.
3. **MOMENTO DE EXECUÇÃO DE \`Criar_pedido\`:**
   - Você SÓ poderá executar a ferramenta \`Criar_pedido\` no turno SEGUINTE, após a resposta afirmativa ("sim", "confirmo", "pode pedir") do cliente.
`;

// ============================================================
// Cache de memória por sessão (telefone)
// ============================================================
const memoryCache = new Map<string, BufferWindowMemory>();

function getMemory(phone: string): BufferWindowMemory {
  if (!memoryCache.has(phone)) {
    memoryCache.set(
      phone,
      new BufferWindowMemory({
        chatHistory: new ChatMessageHistory(),
        k: 10,
        returnMessages: true,
        memoryKey: 'chat_history',
        inputKey: 'input',
        outputKey: 'output',
      }),
    );
  }
  return memoryCache.get(phone)!;
}

/**
 * Limpa a memória de um telefone específico.
 * Chamado quando o usuário faz check-in (nova sessão).
 */
export function clearMemory(phone: string): void {
  if (memoryCache.has(phone)) {
    memoryCache.delete(phone);
    console.log(`[Agent] 🧹 Memória limpa para ${phone.slice(0, 6)}...`);
  }
}

// Limpa TODAS as memórias a cada 15 minutos para evitar contaminação
setInterval(() => {
  if (memoryCache.size > 0) {
    console.log(`[Agent] 🧹 Limpando cache de memória (${memoryCache.size} sessões)`);
    memoryCache.clear();
  }
}, 15 * 60 * 1000);

// ============================================================
// Execução do agente com Arquitetura Multi-Agente (Router + Especialistas)
// ============================================================

export async function runAgent(
  phone: string,
  message: string,
  userData: UserData,
): Promise<string> {
  console.log(`[Agent] 🤖 Iniciando atendimento multi-agente para ${phone.slice(0, 6)}...`);

  let isComandaMode = false;
  let cobrancaMeioAMeia = 'mais_cara';
  let customInstructions = '';
  let meiaPizzaHabilitada = false;

  let baseVendasPrompt = SYSTEM_PROMPT_VENDAS;
  let baseServicoPrompt = SYSTEM_PROMPT_SERVICO;
  let baseGeralPrompt = SYSTEM_PROMPT_GERAL;

  // Carregar prompts globais especialistas do banco (id=1)
  try {
    const { data: globalConfig } = await supabase.client
      .from('ConfiguracoesGlobais')
      .select('prompt_geral, prompt_vendas, prompt_servico')
      .eq('id', 1)
      .single();
    if (globalConfig) {
      if (globalConfig.prompt_vendas && globalConfig.prompt_vendas.trim() !== '') {
        baseVendasPrompt = globalConfig.prompt_vendas.trim().replace(/\\n/g, '\n');
      }
      if (globalConfig.prompt_servico && globalConfig.prompt_servico.trim() !== '') {
        baseServicoPrompt = globalConfig.prompt_servico.trim().replace(/\\n/g, '\n');
      }
      if (globalConfig.prompt_geral && globalConfig.prompt_geral.trim() !== '') {
        baseGeralPrompt = globalConfig.prompt_geral.trim().replace(/\\n/g, '\n');
      }
    }
  } catch (err: any) {
    console.warn(`[Agent] Não foi possível buscar prompts globais de ConfiguracoesGlobais: ${err.message}`);
  }

  // 1. Carregar configurações do restaurante do banco
  try {
    const { data: restaurante } = await supabase.client
      .from('Restaurantes')
      .select('modo_cobranca, cobranca_meio_a_meio, personalidade_agente, exemplos_conversa, regras_estabelecimento, meia_pizza_habilitada')
      .eq('id', userData.id_restaurante)
      .single();
    isComandaMode = restaurante?.modo_cobranca === 'comanda';
    cobrancaMeioAMeia = restaurante?.cobranca_meio_a_meio || 'mais_cara';
    meiaPizzaHabilitada = restaurante?.meia_pizza_habilitada ?? false;
    
    if (restaurante) {
      if (restaurante.personalidade_agente && restaurante.personalidade_agente.trim()) {
        customInstructions += `\n\n### PERSONALIDADE E TOM DE VOZ (COMPORTAMENTO ESPECÍFICO)\n${restaurante.personalidade_agente.trim()}`;
      }
      if (restaurante.exemplos_conversa && restaurante.exemplos_conversa.trim()) {
        customInstructions += `\n\n### EXEMPLOS DE DIÁLOGOS DE CONVERSA RECOMENDADOS\n${restaurante.exemplos_conversa.trim()}`;
      }
      if (restaurante.regras_estabelecimento && restaurante.regras_estabelecimento.trim()) {
        customInstructions += `\n\n### REGRAS ESPECÍFICAS DO ESTABELECIMENTO\n${restaurante.regras_estabelecimento.trim()}`;
      }
    }
  } catch (err: any) {
    console.warn(`[Agent] Não foi possível buscar configurações de IA do restaurante: ${err.message}`);
  }

  // Obter o histórico de chat recente
  const memory = getMemory(phone);
  const chatHistoryMessages = await memory.chatHistory.getMessages();
  const formattedHistory = chatHistoryMessages
    .map(m => `${m.getType() === 'human' ? 'Cliente' : 'PedeAI'}: ${m.content}`)
    .slice(-10) // Últimas 10 interações
    .join('\n');

  // 2. Definir prompt base unificado (ou concatenar especialistas)
  let basePromptText = `${SYSTEM_PROMPT_GERAL}\n\n${SYSTEM_PROMPT_VENDAS}\n\n${SYSTEM_PROMPT_SERVICO}`;
  if (baseVendasPrompt || baseServicoPrompt || baseGeralPrompt) {
    basePromptText = `${baseGeralPrompt}\n\n${baseVendasPrompt}\n\n${baseServicoPrompt}`;
  }
  // ⚠️ REGRA CRÍTICA: Anexar REGRAS MANDATÓRIAS DE PEDIDO E VINHO sempre no final para não ser sobrescrito pelo banco
  basePromptText += `\n\n${REGRAS_MANDATORIAS_PEDIDO}`;

  // No modo comanda, as tools filtram por telefone do usuario
  // No modo mesa, as tools buscam todos os pedidos da mesa
  const toolUserData = {
    ...userData,
    telefone: isComandaMode ? userData.telefone : '',
  };

  // 3. Disponibilizar TODAS as ferramentas para o agente em TODAS as mensagens
  const tools = [
    criarPedidoTool(userData),
    produtosCardapioTool(userData),
    getMacarroesTool(userData),
    getPedidosTool(toolUserData),
    contaSolicitadaTool(userData, isComandaMode),
    chamaGarcomTool(userData),
    pegarInfoClienteTool(phone, userData.id_restaurante),
    calculadoraTool,
  ];

  let meiaPizzaRule = '';
  if (meiaPizzaHabilitada) {
    meiaPizzaRule = `\n\n## 🍕 PIZZA MEIA A MEIA (HABILITADA)

### 🚫 REGRA NÚMERO 1 — PROIBIÇÃO ABSOLUTA (LEIA ANTES DE TUDO)
Ao confirmar um pedido de pizza meia a meia para o cliente, você está **TERMINANTEMENTE PROIBIDO** de:
- Mencionar o preço individual de qualquer sabor (ex: "A Carbonara custa R$ 115" ou "a Calabresa sai por R$ 95").
- Explicar, citar ou insinuar a regra de cobrança (ex: "cobramos pelo sabor mais caro", "o valor é baseado no maior preço").
- Mostrar qualquer cálculo, comparação de valores ou operação matemática.
- Justificar por que o preço final é aquele valor.
Você deve informar APENAS: os dois sabores + o preço final. Nada mais.

❌ EXEMPLO DO QUE NUNCA FAZER:
"A Pizza Carbonara custa R$ 115,00 e a Calabresa R$ 95,00. Como cobramos pelo sabor mais caro, sua meia a meia fica R$ 115,00."

✅ ÚNICO FORMATO PERMITIDO:
"Perfeito! Uma Pizza Meia a Meia (Metade Carbonara + Metade Calabresa) por R$ 115,00. Os sabores estão corretos?"

Se você mencionar preço de sabor individual ou explicar a regra de cobrança, estará VIOLANDO esta diretriz.

### Procedimento interno (para cálculo silencioso — NUNCA exponha ao cliente):
1. Pergunte os dois sabores — se o cliente não informou ambos, pergunte: "Quais os dois sabores pra sua meia a meia?"
2. Consulte Produtos_cardapio para obter os preços internamente. ⚠️ **EVITE AMBIGUIDADE:** Use **apenas** preços de itens cujo nome comece com "Pizza " (ex: "Pizza Carbonara"). **NUNCA** use preços de pratos homônimos de outras categorias (ex: massa "Carbonara").
3. Calcule o preço final silenciosamente: ${cobrancaMeioAMeia === 'soma_metades' ? 'Some a metade do preço de cada sabor (preço1/2 + preço2/2).' : 'Use o preço do sabor mais caro.'}
4. Confirme com o cliente usando APENAS o formato permitido acima (sabores + preço final, sem explicações).
5. Registre com Criar_pedido:
   - Nome do item: "Pizza Meia a Meia"
   - Descrição: "Metade [Sabor 1] + Metade [Sabor 2]"
   - Preço (Subtotal): o valor calculated.`;
  } else {
    meiaPizzaRule = `\n\n## 🍕 PIZZA MEIA A MEIA (DESABILITADA)
⚠️ REGRA CRÍTICA: O restaurante NÃO permite e NÃO vende pizza meia a meia (metade/metade / meio a meio / dois sabores).
- Se o cliente pedir uma pizza meio a meio ou com mais de um sabor, você está expressamente PROIBIDO de criar o pedido ou executar Criar_pedido. Explique educadamente que o estabelecimento só trabalha com pizzas inteiras (um sabor por pizza) e peça para ele escolher um único sabor para a pizza inteira.
- Se o cliente pedir uma pizza de sabor único (ex: "uma pizza de calabresa", "uma calabresa inteira"), esta regra NÃO se aplica. Crie o pedido imediatamente utilizando a tool Criar_pedido e informe o cliente. NÃO mencione a restrição de meia a meia nem fale sobre "pizzas inteiras" se o cliente não tiver solicitado múltiplos sabores.`;
  }

  // 4. Instanciar e executar o agente unificado
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    apiKey: config.OPENAI_API_KEY,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `${basePromptText}${customInstructions}${meiaPizzaRule}`],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({ llm: model, tools, prompt });
  const executor = new AgentExecutor({
    agent,
    tools,
    memory,
    verbose: false,
    maxIterations: 8,
    returnIntermediateSteps: false,
  });

  try {
    const modoCobranca = isComandaMode ? 'comanda' : 'mesa';
    const clienteNome = userData.nome || 'Cliente';

    // Carregar pedidos ativos da mesa para contextualizar a IA e evitar duplicações
    let pedidosAtivosContext = 'Nenhum pedido registrado ainda.';
    if (userData.mesa_atual && userData.mesa_atual !== '0' && userData.mesa_atual !== 'Sem mesa') {
      try {
        const pedidosExistentes = await supabase.getPedidosByMesaExcluindo(
          Number(userData.mesa_atual),
          userData.id_restaurante,
          'fechado',
          isComandaMode ? phone : undefined
        );
        if (pedidosExistentes && pedidosExistentes.length > 0) {
          pedidosAtivosContext = pedidosExistentes
            .map((p: any) => `- Pedido #${p.id}: ${p.itens} (Qtd: ${p.quantidade || 1}, R$ ${p.Subtotal || '0.00'}) ${p.descricao ? `[Obs: ${p.descricao}]` : ''}`)
            .join('\n');
        }
      } catch (err: any) {
        console.warn(`[Agent] Não foi possível carregar pedidos existentes da mesa para o contexto: ${err.message}`);
      }
    }

    const result = await executor.invoke({
      input: `CONTEXTO DO CLIENTE\nNome do cliente: ${clienteNome}\nTelefone: ${phone}\nMesa: ${userData.mesa_atual || 'Sem mesa'}\nModo de cobrança: ${modoCobranca}\n\n📋 PEDIDOS JÁ REGISTRADOS NESTA MESA (NÃO DUPLICAR COM Criar_pedido A MENOS QUE O CLIENTE PEÇA EXPLICITAMENTE MAIS UM ITEM):\n${pedidosAtivosContext}\n\nMensagem do cliente: ${message}`,
    });

    let output = result.output || 'Desculpe, não consegui processar sua mensagem. Tente novamente!';

    // Pós-processamento
    output = output.replace(/\[Used tools:.*?\]/gs, '');
    output = output.replace(/\[Tool call:.*?\]/gs, '');
    output = output.replace(/\*/g, '');
    output = output.trim();

    console.log(`[Agent] ✅ Resposta PedeAí: "${output.slice(0, 80)}..."`);
    return output;
  } catch (err: any) {
    console.error(`[Agent] ❌ Erro ao executar Agente PedeAí:`, err.message);
    
    // Failover: Chamar garçom via banco silenciosamente para não deixar o cliente sem atendimento
    try {
      await supabase.createPedido({
        mesa: userData.mesa_atual,
        status: 'garcom_pendente',
        itens: '🔔 Chamado de Garçom (Erro de Sistema)',
        Subtotal: '0',
        restaurante_id: userData.id_restaurante,
        quantidade: '0',
        descricao: `Falha técnica no chatbot ao processar mensagem do cliente: "${message.slice(0, 100)}". Acionado para suporte manual.`,
        usuario_telefone: phone,
      });
      console.log(`[Agent] 🚨 Chamado de emergência do garçom criado para a mesa ${userData.mesa_atual} devido a falha técnica.`);
    } catch (dbErr: any) {
      console.error('[Agent] ❌ Erro ao tentar criar chamado de garçom no failover:', dbErr.message);
    }

    return 'Entendido! Vou pedir para o garçom ir até a sua mesa para te ajudar com isso agora mesmo. Só um minutinho! 🙋‍♂️';
  }
}
