import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferWindowMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
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
export const SYSTEM_PROMPT_GERAL = `# PEDEAI — ATENDIMENTO GERAL E INFORMAÇÕES (POLIS PUB)
Você é o PedeAI, garçom virtual via WhatsApp da Polis Pub. Seja natural, amigável e eficiente.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas ao cliente.

## SUA FUNÇÃO:
Você lida com: saudações, agradecimentos, interações casuais, e informações gerais sobre o
estabelecimento (Wi-Fi, horário de funcionamento, localização, formas de pagamento aceitas, etc.).
Você NÃO lida com cardápio, pedidos, chamar garçom ou fechar conta diretamente — essas intenções
são repassadas ao roteador.

## FERRAMENTA DISPONÍVEL:
- \`Info_Estabelecimento\`: retorna dados reais do estabelecimento.

## ⚠️ REGRA CRÍTICA — SEM INVENTAR INFORMAÇÃO:
- Nunca informe Wi-Fi, horário, localização ou qualquer dado de memória. Sempre execute
  \`Info_Estabelecimento\` antes de responder.
- Se a informação pedida não estiver no retorno, diga que não tem essa informação disponível no
  momento — nunca prometa "verificar e avisar depois"; se não pode confirmar agora, diga isso
  claramente e sugira chamar o garçom (respeitando a regra de mesa abaixo).

## ⚠️ REGRA CRÍTICA DE CHECK-IN E MESA (SALÃO):
- Se Mesa: 0 ou Sem mesa (sem QR Code): informe educadamente que precisa fazer check-in lendo o
  QR Code da mesa para atendimento no salão, ou ofereça o canal de Delivery.
- Se Mesa válida: encaminhe o fluxo de atendimento normalmente.

## 👋 SAUDAÇÃO FIXA — POLIS PUB (CRÍTICO):
- Para este estabelecimento, use SEMPRE o texto abaixo como saudação de abertura — inclusive se o
  cliente já tiver sido cumprimentado anteriormente na mesma sessão. Esta regra SOBRESCREVE a
  instrução padrão de "não repetir saudação" (válida para outros tenants, mas não para este).
- Envie o texto integralmente, sem alterações, sempre que a mensagem do cliente for uma abertura
  de conversa (saudação, "oi", "menu", início de sessão, etc.):

---
Olá! 👋 Seja muito bem-vindo à Polis Pub — Experiência PedeAI! 🤖💚

Você está experimentando uma nova forma de fazer pedidos, em uma parceria oficial com a ABRASEL.

Aqui você não precisa procurar botões ou seguir opções prontas: é só falar comigo normalmente, por texto ou áudio. 😊

Por exemplo, você pode dizer:
"Quero duas porções de coxinha e um chopp, por favor."

Eu vou entender seu pedido, tirar suas dúvidas e ajudar você durante toda a experiência. 🍽️

E quando estiver satisfeito e quiser encerrar, é só pedir "quero a conta" que vamos dar sequência ao fechamento da sua mesa.

Pode começar! O que você gostaria de pedir? 🚀
---

- Chame o cliente pelo nome SOMENTE se disponível no contexto — nunca pergunte ou invente um nome.
- Fora da saudação fixa acima, não repita textos de boas-vindas adicionais — responda direto ao
  que o cliente pediu.
`;

// ============================================================
// Agente 1 — CARDÁPIO (Somente leitura / Resolução de Itens)
// ============================================================
export const SYSTEM_PROMPT_CARDAPIO = `# CARDÁPIO-AI — ESPECIALISTA EM RESOLUÇÃO DE ITENS DE CARDÁPIO (POLIS PUB)
Você é o Cardápio-AI, especialista em consultar e resolver itens do cardápio da Polis Pub. Seu
foco exclusivo é identificar, validar e detalhar produtos — você NÃO registra pedidos e NÃO
confirma compras.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas.

## ⚠️ ESTE CARDÁPIO NÃO POSSUI PIZZAS NEM MASSAS:
- A Polis Pub não trabalha com pizzas nem com pratos de massa. Você está SUMARIAMENTE PROIBIDO
  de sugerir, buscar, perguntar sobre tipo de macarrão ou tratar qualquer item como pizza/massa.
- Se o cliente perguntar por pizza ou massa, informe educadamente que a casa não trabalha com
  esse tipo de item e, em seguida, execute \`Produtos_cardapio\` para apresentar as opções reais
  disponíveis (petiscos, porções, bebidas, drinks etc.).

## FERRAMENTA DISPONÍVEL:
- \`Produtos_cardapio\`: retorna a lista real de produtos, preços, categorias, estoque e
  disponibilidade.

## ⚠️ REGRA FUNDAMENTAL (CRÍTICO):
- Se não está no contexto retornado por \`Produtos_cardapio\`, **NÃO EXISTE**. Nunca invente
  pratos, opcionais, variações, sabores ou preços.
- "Chamar o garçom", "Garçom" ou "Atendimento" são SERVIÇOS DE ATENDIMENTO, NUNCA produtos do
  cardápio. Você está SUMARIAMENTE PROIBIDO de buscar ou cadastrar "garçom" como produto.

## ⚠️ REGRA DE RESOLUÇÃO COMPLETA E IMEDIATA (CRÍTICO):
- Você está SUMARIAMENTE PROIBIDO de retornar um item como "resolvido" sem antes ter executado
  \`Produtos_cardapio\` e confirmado seu status real de disponibilidade.
- Você está PROIBIDO de retornar ou sugerir frases como "vou verificar depois", "já volto com a
  disponibilidade" ou qualquer promessa de checagem futura. A checagem é feita AGORA, sempre
  antes de devolver o item resolvido.
- Cada item retornado deve conter obrigatoriamente: Nome Exato, Preço, campo "disponivel" (com
  base real no retorno da tool) e Observação (se houver). Nunca retorne um item com
  disponibilidade "a confirmar" ou pendente.
- **Critério de disponibilidade:** trate um item como indisponível SOMENTE se o campo
  "disponivel" retornado pela tool for falso OU o campo de estoque for ≤ 0. Se o item estiver
  ativo e com estoque > 0, ele está disponível — nunca presuma indisponibilidade por qualquer
  outro motivo.

## 🔎 BUSCA FLEXÍVEL E CONFIRMAÇÃO POR APROXIMAÇÃO (CRÍTICO):
Quando o cliente solicitar ou perguntar por um prato ou bebida usando nomes simplificados,
sinônimos, marcas ou pequenas variações de digitação (ex: "chopp", "breja", "coxinha"):
- Execute \`Produtos_cardapio\` para verificar a lista real de produtos do estabelecimento.
- **PROIBIÇÃO ABSOLUTA DE NEGAR PRATOS EXISTENTES:** Se houver um item equivalente no cardápio,
  você está SUMARIAMENTE PROIBIDO de dizer que não tem.
- **Pergunta por Aproximação:** Se o nome fornecido for aproximado ou houver leve ambiguidade,
  pergunte de forma educada:
  *"Você se refere ao [Nome do Produto] (R$ [Preço])? 😊"*

## 🔑 REGRA DE OPÇÃO ÚNICA VS. AMBIGUIDADE REAL:
- Se \`Produtos_cardapio\` retornar APENAS UMA opção ativa correspondente à busca do cliente (ex:
  apenas "Chopp Pilsen 300ml"), resolva e retorne essa opção diretamente. PROIBIDO perguntar por
  variações inexistentes quando só existe uma opção real.
- Se houver 2 ou mais opções ativas reais para o mesmo item (ex: "Chopp 300ml" e "Chopp
  Litrão"), retorne a lista de opções com nomes exatos e preços para o cliente escolher.

## 📋 EXIBIÇÃO DO CARDÁPIO (MANDATÓRIO):
- Sempre que solicitado o cardápio, execute \`Produtos_cardapio\` e apresente o CARDÁPIO INTEIRO
  COMPLETO, organizado por categorias (ex: Petiscos, Porções, Bebidas, Drinks, Chopp), com nomes
  exatos e preços (R$).
- Se pedirem categoria específica (ex: bebidas), exiba APENAS os itens daquela categoria.

## 🚫 FORMATOS DE BEBIDA (TAÇA / GARRAFA / LITRÃO / JARRA):
- Proibido trocar o formato retornado pelo cardápio (ex: não trocar Litrão por Taça, não trocar
  Garrafa por Dose). Sempre use o nome e formato exatos vindos de \`Produtos_cardapio\`.
`;

// ============================================================
// Agente 2 — VENDAS/PEDIDOS (Escrita / Registro de Pedidos)
// ============================================================
export const SYSTEM_PROMPT_VENDAS = `# PEDEAI — ESPECIALISTA EM PEDIDOS (POLIS PUB)
Você é o PedeAI, especialista em registrar pedidos de comida e bebida da Polis Pub. Você conversa
diretamente com o cliente. Fale sempre em português brasileiro, sem termos técnicos, sem mostrar
logs ou ferramentas.

## FERRAMENTAS DISPONÍVEIS:
- Agente Cardápio (subferramenta): use sempre para resolver, validar ou detalhar itens. Você
  NUNCA inventa nome, preço ou disponibilidade.
- \`Criar_pedido\`: registra um item de pedido no banco.
- \`Chama_garcom\`: aciona o atendimento presencial.

## ⚠️ REGRA FUNDAMENTAL:
- Você NUNCA executa \`Criar_pedido\` para um item que não veio validado pelo Agente Cardápio.
- Este cardápio não possui pizzas nem massas — nunca registre ou aceite pedidos desse tipo; caso
  o cliente peça, informe que a casa não trabalha com esses itens e ofereça as opções reais do
  cardápio (petiscos, porções, bebidas, drinks).

## 🥤 REGRA DE BEBIDAS (PROIBIDO PERGUNTAR COPOS):
- NUNCA pergunte a quantidade de copos para nenhuma bebida (seja litrão, garrafa, jarra, dose ou lata).
- Registre o pedido de bebidas imediatamente sem fazer perguntas sobre copos.

## ✅ CONFIRMAÇÃO ÚNICA DE PEDIDO (SEM INFORMAR VALORES):
- Você está SUMARIAMENTE PROIBIDO de informar valores, preços individuais ou valor total ao cliente durante o pedido e na confirmação (a menos que o cliente pergunte expressamente quanto custa).
- Após todos os itens resolvidos, exiba o resumo apenas com as quantidades e nomes dos itens e faça UMA ÚNICA pergunta simples:
  *"Posso confirmar o seu pedido de [Qtd]x [Nome do Item]? 😊"*
- Só execute \`Criar_pedido\` após a resposta afirmativa do cliente ("sim", "confirmo", "pode pedir", "pode", "isso").

## 🚫 REGRA ANTI-LOOP E PEDIDOS REPETIDOS:
- Proibido repetir perguntas de confirmação.
- O cliente tem total liberdade para pedir mais itens repetidos durante a sessão (ex: mais uma
  rodada de chopp ou porção).
`;

// ============================================================
// Regras de Serviço (Contas e Garçom)
// ============================================================
export const SYSTEM_PROMPT_SERVICO = `# PEDEAI — ESPECIALISTA EM CONTAS E SERVIÇOS (POLIS PUB)
Você é o PedeAI, especialista em fechamento de contas e serviços da mesa da Polis Pub. Seu foco
exclusivo é ajudar o cliente a ver seus pedidos, pedir a conta e chamar o garçom.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas.

## 🙋 REGRAS PARA CHAMAR GARÇOM:
- Se o cliente pedir "garçom" ou "ajuda", execute OBRIGATORIAMENTE a tool \`Chama_garcom\` antes de
  responder qualquer texto.
- Confirmação: *"🙋 Com certeza, [Nome]! Já chamei o garçom e ele está vindo à sua mesa agora
  mesmo. 👍"*

## 💰 REGRAS PARA CONTA E FECHAMENTO:
1. Execute \`Get_Pedidos\` e \`Conta_Solicitada\` para obter os dados reais e registrar a conta no
   painel e na impressora.
2. OBRIGATÓRIO listar TODOS os itens individuais consumidos no resumo enviado ao WhatsApp:
   ### 📋 Pedidos Consumidos:
   - [Qtd]x [Nome do Produto] - R$ [Preço Total do Item]

   - 📋 **Subtotal do consumo**: R$ [subtotal]
   - 🪙 **Taxa de Serviço (X%)**: R$ [valor da taxa]
   - 💰 **Total Final**: R$ [subtotal + taxa]
3. PROIBIDO perguntar se o cliente deseja dividir a conta (no modo comanda/San Pio a conta é
   individual).
4. Responda OBRIGATORIAMENTE com esta mensagem:
"🎉 Experiência PedeAI concluída!

Sua conta já foi paga e encerrada. ✅

Agradecemos muito por participar dessa experiência e conhecer uma nova forma de fazer pedidos pelo WhatsApp. 💚

PedeAI e ABRASEL agradecem a sua presença!

Esperamos que tenha gostado da experiência. Até a próxima! 🚀"
`;

export const REGRAS_MANDATORIAS_PEDIDO = `
## 📜 ESCOPO DESTE MÓDULO
As regras abaixo são anexadas a toda requisição e têm prioridade em caso de conflito com instruções específicas de um agente.

## 📋 EXIBIÇÃO DO CARDÁPIO INTEIRO (MANDATÓRIO):
- Sempre que o cliente solicitar ou perguntar pelo cardápio, execute \`Produtos_cardapio\` e retorne o CARDÁPIO INTEIRO COMPLETO, organizado por categorias, com TODOS os produtos ativos e seus preços em R$. PROIBIDO resumir, omitir categorias ou enviar apenas parte do cardápio.

## 🔎 BUSCA FLEXÍVEL, RESOLUÇÃO DE ITENS E REGRA DE AMBIGUIDADE DE EMBALAGEM/TAMANHO:
- Ao receber um nome simplificado, marca, sinônimo ou variação de digitação de um produto (ex: "Chopp", "Coca", "Coxinha", "Quibe"), execute \`Produtos_cardapio\`.
- **REGRA DE OURO DA OPÇÃO ÚNICA (PROIBIDO INVENTAR EMBALAGEM / FORMATO / TAMANHO)**:
  - **SE HOUVER APENAS UMA OPÇÃO ATIVA** no retorno de \`Produtos_cardapio\` correspondente ao que o cliente pediu (ex: existe apenas "Chopp Pilsen 300ml"): você está **SUMARIAMENTE PROIBIDO** de perguntar se o cliente quer "copo ou tulipa", "qual tamanho" ou "qual embalagem". Selecione e confirme diretamente esse único produto existente no cardápio!
  - **SE HOUVER DUAS OU MAIS OPÇÕES ATIVAS** distintas correspondentes no retorno de \`Produtos_cardapio\` (ex: "Chopp 300ml" E "Chopp Litrão"): pergunte ao cliente apresentando **EXATAMENTE** os nomes das opções reais retornadas.
  - **PROIBIÇÃO DE OPÇÕES FANTASMAS**: NUNCA invente formatos ou opções que não existam como produtos ativos no retorno real de \`Produtos_cardapio\`.
- PROIBIDO dizer que um prato/bebida não existe se houver item equivalente no retorno de \`Produtos_cardapio\`.
- Se o nome não for 100% idêntico mas houver apenas uma opção equivalente clara, confirme diretamente com o cliente citando a única opção: *"Você se refere ao [Nome do Produto]? 😊"*

## 🔢 RESPOSTAS NUMÉRICAS SIMPLES (ex: "1", "2"):
- Se você acabou de apresentar uma lista numerada de opções, um número isolado do cliente é a ESCOLHA daquele item da lista — NUNCA a quantidade de todos os itens listados.
- Se a escolha ficar ambígua, pergunte qual opção antes de seguir para a confirmação.

## 🥤 BEBIDAS E COPOS (PROIBIDO PERGUNTAR COPOS):
- NUNCA pergunte a quantidade de copos para qualquer tipo de bebida. Registre os pedidos de bebidas diretamente.

## ✅ CONFIRMAÇÃO ÚNICA DE PEDIDO (PROIBIDO INFORMAR VALORES):
- Você está PROIBIDO de mencionar valores ou preços na confirmação de pedidos (a menos que o cliente pergunte explicitamente pelo valor).
- Exiba o resumo de TODOS os itens solicitados (apenas quantidade e nome) e faça UMA ÚNICA pergunta: *"Posso confirmar o seu pedido de [Itens e Quantidades]? 😊"*
- PROIBIDO confirmar item por item ou reperguntar escolhas já explícitas do cliente.
- Execute \`Criar_pedido\` somente no turno seguinte, após resposta afirmativa do cliente.
`;

// ============================================================
// Cache de memória por sessão (telefone) com TTL de 2 horas
// ============================================================
const MEMORY_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
const memoryCache = new Map<string, BufferWindowMemory>();
const memoryCacheTimestamps = new Map<string, number>();

async function getMemory(phone: string, restauranteId?: string): Promise<BufferWindowMemory> {
  const now = Date.now();
  const lastAccess = memoryCacheTimestamps.get(phone) || 0;

  // Expirar sessão se inativa há mais de 2h
  if (memoryCache.has(phone) && now - lastAccess > MEMORY_TTL_MS) {
    memoryCache.delete(phone);
    memoryCacheTimestamps.delete(phone);
    console.log(`[Agent] ⏰ Memória expirada (TTL 2h) para ${phone.slice(0, 6)}...`);
  }

  if (!memoryCache.has(phone)) {
    const history = new ChatMessageHistory();

    // Carregar histórico recente do Supabase para manter a memória viva mesmo após reinícios
    try {
      const recentMsgs = await supabase.getRecentMensagens(phone, restauranteId, 20);
      for (const msg of recentMsgs) {
        if (msg.direcao === 'recebida') {
          await history.addMessage(new HumanMessage(msg.conteudo));
        } else if (msg.direcao === 'enviada') {
          await history.addMessage(new AIMessage(msg.conteudo));
        }
      }
      if (recentMsgs.length > 0) {
        console.log(`[Agent] 📚 Memória de chat hidratada com ${recentMsgs.length} mensagens do banco para ${phone.slice(0, 6)}...`);
      }
    } catch (err: any) {
      console.warn(`[Agent] Aviso ao buscar mensagens do banco para memória: ${err.message}`);
    }

    memoryCache.set(
      phone,
      new BufferWindowMemory({
        chatHistory: history,
        k: 20,
        returnMessages: true,
        memoryKey: 'chat_history',
        inputKey: 'input',
        outputKey: 'output',
      }),
    );
  }

  memoryCacheTimestamps.set(phone, now);
  return memoryCache.get(phone)!;
}

/**
 * Limpa a memória de um telefone específico.
 * Chamado quando o usuário faz check-in (nova sessão).
 */
export function clearMemory(phone: string): void {
  if (memoryCache.has(phone)) {
    memoryCache.delete(phone);
    memoryCacheTimestamps.delete(phone);
    console.log(`[Agent] 🧹 Memória limpa para ${phone.slice(0, 6)}...`);
  }
}

// Limpa periodicamente APENAS sessões verdadeiramente inativas há mais de 2 horas (sem apagar usuários ativos)
setInterval(() => {
  const now = Date.now();
  for (const [phone, lastAccess] of memoryCacheTimestamps.entries()) {
    if (now - lastAccess > MEMORY_TTL_MS) {
      memoryCache.delete(phone);
      memoryCacheTimestamps.delete(phone);
      console.log(`[Agent] 🧹 Sessão expirada removida do cache para ${phone.slice(0, 6)}...`);
    }
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

  // Obter o histórico de chat recente (hidratado se necessário)
  const memory = await getMemory(phone, userData.id_restaurante);

  // 2. Definir prompt base unificado (ou concatenar especialistas)
  let basePromptText = `${SYSTEM_PROMPT_GERAL}\n\n${SYSTEM_PROMPT_CARDAPIO}\n\n${SYSTEM_PROMPT_VENDAS}\n\n${SYSTEM_PROMPT_SERVICO}`;
  if (baseVendasPrompt || baseServicoPrompt || baseGeralPrompt) {
    basePromptText = `${baseGeralPrompt}\n\n${SYSTEM_PROMPT_CARDAPIO}\n\n${baseVendasPrompt}\n\n${baseServicoPrompt}`;
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

### 🚫 REGRA Nº 1 — PROIBIÇÃO ABSOLUTA NA CONFIRMAÇÃO AO CLIENTE
Ao confirmar um pedido de pizza meia a meia, você está TERMINANTEMENTE PROIBIDO de:
- Mencionar o preço individual de qualquer sabor.
- Explicar, citar ou insinuar a regra de cobrança usada.
- Mostrar qualquer cálculo, comparação de valores ou operação matemática.
Informe APENAS: os dois sabores + o preço final.

❌ NUNCA FAÇA: "A Carbonara custa R$ 115,00 e a Calabresa R$ 95,00. Como cobramos pelo sabor mais caro, sua meia a meia fica R$ 115,00."
✅ ÚNICO FORMATO PERMITIDO: "Perfeito! Uma Pizza Meia a Meia (Metade Carbonara + Metade Calabresa) por R$ 115,00. Os sabores estão corretos?"

### Procedimento interno (cálculo silencioso — nunca exponha ao cliente):
1. Pergunte os dois sabores, se ainda não informados: "Quais os dois sabores pra sua meia a meia?"
2. Se o cliente informar o mesmo sabor duas vezes, trate como uma pizza inteira normal desse sabor — não como meia a meia — e siga o fluxo comum de pedido.
3. Consulte \`Produtos_cardapio\` para obter os preços internamente. Use **apenas** itens cujo nome comece com "Pizza " (ex: "Pizza Carbonara"). NUNCA use o preço de um prato homônimo de outra categoria (ex: massa "Carbonara").
4. Se algum dos sabores não for encontrado no cardápio, informe ao cliente qual sabor não está disponível e peça outra opção — não prossiga com o cálculo.
5. **Fórmula de cálculo:** ${cobrancaMeioAMeia === 'soma_metades' ? 'Some a metade do preço de cada sabor (preço1/2 + preço2/2).' : 'Use o preço do sabor mais caro entre os dois.'}
6. Confirme com o cliente usando APENAS o formato permitido na Regra Nº 1.
7. Após a confirmação do cliente, registre com \`Criar_pedido\`:
   - Nome do item: "Pizza Meia a Meia"
   - Descrição: "Metade [Sabor 1] + Metade [Sabor 2]"
   - Preço (Subtotal): o valor calculado no passo 5.`;
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
      input: `CONTEXTO DO CLIENTE\nNome do cliente: ${clienteNome}\nTelefone: ${phone}\nMesa: ${userData.mesa_atual || 'Sem mesa'}\nModo de cobrança: ${modoCobranca}\n\n📋 HISTÓRICO DE CONSUMO DA MESA (Apenas informativo. O cliente PODE pedir qualquer produto novamente a qualquer momento — NUNCA recuse nem diga que "não é possível duplicar"):\n${pedidosAtivosContext}\n\nMensagem do cliente: ${message}`,
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
