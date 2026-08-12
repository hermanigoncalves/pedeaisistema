/**
 * PedeAí — Agente Local de Impressão
 *
 * Conecta ao Supabase Realtime e imprime automaticamente:
 * - Novos pedidos → impressora de cozinha ou bar (por estação do item)
 * - Fechamento de conta → impressora de recibo
 *
 * Suporta impressoras de REDE (TCP/IP) e USB (Windows).
 * Sem diálogo — impressão totalmente silenciosa.
 */

const fs = require('fs');
const readline = require('readline');
const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const ws = require('ws');
globalThis.WebSocket = ws;
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');

// Credenciais padrão da plataforma PedeAí (usadas como fallback se não estiverem no .env)
const DEFAULT_SUPABASE_URL = 'https://gpsbydlnbkbofbhmhuvp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM5Nzc3MCwiZXhwIjoyMDk4OTczNzcwfQ.11gOTNAy1fVuZ7LlRJgc8eGsK4IrAb_fjJ9mL6CiXqg';

const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_KEY;

let RESTAURANTE_ID = process.env.RESTAURANTE_ID;

// Outras configurações da impressora vindas do .env
const {
  PRINTER_KITCHEN_TYPE,
  PRINTER_KITCHEN_HOST,
  PRINTER_KITCHEN_PORT = '9100',
  PRINTER_KITCHEN_USB,
  PRINTER_BAR_TYPE,
  PRINTER_BAR_HOST,
  PRINTER_BAR_PORT = '9100',
  PRINTER_BAR_USB,
  PRINTER_RECEIPT_TYPE,
  PRINTER_RECEIPT_HOST,
  PRINTER_RECEIPT_PORT = '9100',
  PRINTER_RECEIPT_USB,
} = process.env;

// Variáveis mutáveis do restaurante atualizadas dinamicamente do banco
let restauranteNome = process.env.RESTAURANTE_NOME || 'Restaurante';
let serviceFee = parseFloat(process.env.SERVICE_FEE) || 0;

// Cliente Supabase instanciado globalmente
let supabase;

/**
 * Pergunta interativa no terminal (para configuração rápida do exe)
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Verifica se o RESTAURANTE_ID está configurado. Se não, solicita interativamente.
 */
async function checkAndPromptConfig() {
  if (RESTAURANTE_ID && RESTAURANTE_ID.trim()) {
    return;
  }

  console.log('\n====================================================');
  console.log(' PedeAí - Configuração Inicial do Agente de Impressão');
  console.log('====================================================\n');
  console.log('⚠️  Nenhum ID de restaurante (RESTAURANTE_ID) foi configurado.');
  console.log('Você pode encontrar este ID no painel web ou nas tabelas do banco de dados.\n');

  let inputId = '';
  while (!inputId.trim() || inputId.trim().length < 32) {
    inputId = await askQuestion('👉 Digite o ID do Restaurante (UUID): ');
    inputId = inputId.trim();
    if (!inputId) {
      console.log('❌ O ID é obrigatório!');
    } else if (inputId.length < 32) {
      console.log('❌ ID inválido. Deve possuir pelo menos 32 caracteres (formato UUID).');
    }
  }

  // Criar ou atualizar o arquivo .env
  let envContent = '';
  if (fs.existsSync('.env')) {
    envContent = fs.readFileSync('.env', 'utf8');
  }

  if (envContent.includes('RESTAURANTE_ID=')) {
    envContent = envContent.replace(/RESTAURANTE_ID=.*/g, `RESTAURANTE_ID=${inputId}`);
  } else {
    envContent += `\nRESTAURANTE_ID=${inputId}\n`;
  }

  // Garantir credenciais de conexão se não estiverem no .env
  if (!envContent.includes('SUPABASE_URL=')) {
    envContent += `SUPABASE_URL=${SUPABASE_URL}\n`;
  }
  if (!envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
    envContent += `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}\n`;
  }

  fs.writeFileSync('.env', envContent, 'utf8');
  console.log('\n✅ Configuração salva no arquivo \'.env\' com sucesso!\n');

  RESTAURANTE_ID = inputId;
}

// Lista de impressoras carregadas dinamicamente do Supabase
let activePrinters = [];

// Cache de estações de preparo por nome e id do produto
const productStationsCache = new Map();

/**
 * Carrega dinamicamente o nome e a taxa de serviço do restaurante a partir do banco.
 */
async function loadRestaurantSettings() {
  if (!RESTAURANTE_ID) return;
  try {
    const { data, error } = await supabase
      .from('Restaurantes')
      .select('nome, taxa_servico')
      .eq('id', RESTAURANTE_ID)
      .single();

    if (error) throw error;
    if (data) {
      restauranteNome = data.nome || restauranteNome;
      serviceFee = parseFloat(data.taxa_servico) || 0;
      console.log(`[PrintAgent] 🏢 Dados do restaurante carregados: "${restauranteNome}" (Taxa de serviço: ${serviceFee}%)`);
    }
  } catch (err) {
    console.warn('[PrintAgent] ⚠️ Não foi possível obter dados dinâmicos do restaurante, usando padrões do .env:', err.message);
  }
}

/**
 * Carrega o cache de estações dos produtos e sabores de pizza cadastrados.
 */
async function loadProductStationsCache() {
  if (!RESTAURANTE_ID) return;
  try {
    productStationsCache.clear();

    // 1. Carregar produtos
    const { data: produtos, error: errProd } = await supabase
      .from('Produtos')
      .select('id, nome, estacao')
      .eq('restaurante_id', RESTAURANTE_ID);

    if (errProd) throw errProd;

    (produtos || []).forEach(p => {
      const estacao = (p.estacao || 'kitchen').toLowerCase();
      if (p.nome) {
        productStationsCache.set(p.nome.toLowerCase().trim(), estacao);
      }
      productStationsCache.set(String(p.id), estacao);
    });

    // 2. Carregar sabores de pizza
    const { data: sabores, error: errSabor } = await supabase
      .from('SaboresPizza')
      .select('id, nome, estacao')
      .eq('restaurante_id', RESTAURANTE_ID);

    if (errSabor) {
      if (errSabor.code !== '42P01') {
        console.error('[PrintAgent] Erro ao carregar sabores de pizza:', errSabor.message);
      }
    } else {
      (sabores || []).forEach(s => {
        const estacao = (s.estacao || 'kitchen').toLowerCase();
        if (s.nome) {
          productStationsCache.set(s.nome.toLowerCase().trim(), estacao);
          // Variações comuns
          productStationsCache.set(`pizza ${s.nome.toLowerCase().trim()}`, estacao);
        }
        productStationsCache.set(String(s.id), estacao);
      });
    }

    console.log(`[PrintAgent] 📦 Cache de estacoes carregado: ${productStationsCache.size} produto(s) mapeado(s) do banco de dados.`);
  } catch (err) {
    console.error('[PrintAgent] ❌ Erro ao carregar cache de produtos:', err.message);
  }
}

/**
 * Carrega as impressoras do banco de dados para o restaurante atual.
 */
async function loadPrintersFromDb() {
  if (!RESTAURANTE_ID) return;
  try {
    const { data, error } = await supabase
      .from('Impressoras')
      .select('*')
      .eq('restaurante_id', RESTAURANTE_ID)
      .eq('ativo', true);

    if (error) throw error;

    activePrinters = data || [];
    console.log(`[PrintAgent] 🖨️  ${activePrinters.length} impressora(s) ativa(s) carregada(s) do banco de dados:`);
    activePrinters.forEach(p => {
      if (p.conexao === 'tcp') {
        console.log(`   - [${p.tipo.toUpperCase()}] ${p.nome}: Rede IP ${p.ip}:${p.porta || 9100}`);
      } else if (p.conexao === 'usb') {
        console.log(`   - [${p.tipo.toUpperCase()}] ${p.nome}: USB Path ${p.usb_path}`);
      }
    });
  } catch (err) {
    console.error('[PrintAgent] ❌ Erro ao carregar impressoras do Supabase:', err.message);
  }
}

/**
 * Remove acentos e limpa sufixos/marcas de impressora (PRODUCAO, KA-1445, etc)
 */
function cleanObsText(str) {
  if (!str) return '';
  return stripAccents(str)
    .replace(/PRODUCAO:?\s*[^\n]*/gi, '')
    .replace(/PRODUCAO:?/gi, '')
    .replace(/PRODUCAO/gi, '')
    .replace(/KA-\d+/gi, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/**
 * Cria instâncias de ThermalPrinter para todas as impressoras que atendem à estação.
 * Suporta múltiplos destinos separados por vírgula no banco (ex: 'bar,receipt').
 * @param {'kitchen'|'bar'|'receipt'|'all'} station
 */
function createPrintersList(station) {
  // 1. Prioridade: Buscar impressoras ativas cadastradas que atendem a esta estação
  let matchedDbPrinters = activePrinters.filter(p => {
    if (!p.ativo) return false;
    const tipos = p.tipo.split(',').map(t => t.trim().toLowerCase());
    return tipos.includes(station) || tipos.includes('all');
  });

  // Fallback: se não encontrou impressora com a tag específica, mas há impressoras ativas, envia para as impressoras ativas disponíveis
  if (matchedDbPrinters.length === 0 && activePrinters.length > 0) {
    matchedDbPrinters = activePrinters.filter(p => p.ativo);
  }

  if (matchedDbPrinters.length > 0) {
    return matchedDbPrinters.map(dbPrinter => {
      const interfaceAddr = dbPrinter.conexao === 'tcp'
        ? `tcp://${dbPrinter.ip}:${dbPrinter.porta || 9100}`
        : dbPrinter.usb_path;

      const is58mm = dbPrinter.nome.toLowerCase().includes('58mm');
      const printerCols = is58mm ? 32 : 42; // 32 para 58mm, 42 para 80mm

      return {
        name: dbPrinter.nome,
        printer: new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: interfaceAddr,
          characterSet: CharacterSet.PC860_PORTUGUESE,
          breakLine: BreakLine.WORD,
          removeSpecialCharacters: false,
          lineCharacter: '-',
          width: printerCols,
          options: { timeout: 5000 },
        })
      };
    }).filter(Boolean);
  }

  // 2. Fallback: Configurações locais legadas do .env (lidas dinamicamente)
  const cfg = {
    kitchen: {
      type: process.env.PRINTER_KITCHEN_TYPE,
      host: process.env.PRINTER_KITCHEN_HOST,
      port: process.env.PRINTER_KITCHEN_PORT || '9100',
      usb: process.env.PRINTER_KITCHEN_USB,
    },
    bar: {
      type: process.env.PRINTER_BAR_TYPE,
      host: process.env.PRINTER_BAR_HOST,
      port: process.env.PRINTER_BAR_PORT || '9100',
      usb: process.env.PRINTER_BAR_USB,
    },
    receipt: {
      type: process.env.PRINTER_RECEIPT_TYPE,
      host: process.env.PRINTER_RECEIPT_HOST,
      port: process.env.PRINTER_RECEIPT_PORT || '9100',
      usb: process.env.PRINTER_RECEIPT_USB,
    },
  }[station];

  if (!cfg || (!cfg.host && !cfg.usb)) return [];

  const interfaceAddr = cfg.type === 'tcp'
    ? `tcp://${cfg.host}:${cfg.port}`
    : cfg.usb;

  if (!interfaceAddr) return [];

  return [{
    name: `Local Env (${station})`,
    printer: new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: interfaceAddr,
      characterSet: CharacterSet.PC860_PORTUGUESE,
      breakLine: BreakLine.WORD,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      options: { timeout: 5000 },
    })
  }];
}

// ─── Geração de cupom ──────────────────────────────────────────────────────────

/**
 * Remove acentos para compatibilidade com impressoras mais antigas.
 */
function stripAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Geração de cupom e Fila Persistente ──────────────────────────────────────

const QUEUE_FILE_PATH = path.join(__dirname, 'print_queue.json');
let persistentPrintQueue = [];
let isProcessingPrintQueue = false;

/**
 * Carrega a fila de impressão do disco se houver cupons pendentes.
 */
function loadPrintQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE_PATH)) {
      const data = fs.readFileSync(QUEUE_FILE_PATH, 'utf8');
      persistentPrintQueue = JSON.parse(data || '[]');
      if (persistentPrintQueue.length > 0) {
        console.log(`[PrintQueue] 📂 Fila em disco carregada: ${persistentPrintQueue.length} cupom(ns) pendente(s) aguardando impressao.`);
      }
    }
  } catch (err) {
    console.error('[PrintQueue] ❌ Erro ao ler print_queue.json:', err.message);
    persistentPrintQueue = [];
  }
}

/**
 * Salva a fila de impressão no disco de forma atômica.
 */
function savePrintQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE_PATH, JSON.stringify(persistentPrintQueue, null, 2), 'utf8');
  } catch (err) {
    console.error('[PrintQueue] ❌ Erro ao salvar print_queue.json:', err.message);
  }
}

/**
 * Adiciona uma tarefa de impressão à fila persistente.
 */
function enqueuePrintTask(station, pedido, itens, isBill = false, divisoes = undefined, itemIndex = 0) {
  const firstItemName = (itens && itens[0] && (itens[0].nome || itens[0].productName)) || 'item';
  const taskId = `${pedido.id}_${station}_${isBill ? 'bill' : 'prod'}_${firstItemName}_idx${itemIndex}`;

  // Evita duplicata idêntica na fila ativa
  const exists = persistentPrintQueue.some(t => t.taskId === taskId);
  if (exists) {
    console.log(`[PrintQueue] ⚠️ Cupom "${taskId}" ja esta na fila. Ignorando inclusao duplicada.`);
    return;
  }

  const task = {
    taskId,
    station,
    pedido,
    itens,
    isBill,
    divisoes,
    addedAt: new Date().toISOString(),
    retryCount: 0
  };

  persistentPrintQueue.push(task);
  savePrintQueue();
  console.log(`[PrintQueue] 📥 Cupom retido/enfileirado (Total na fila: ${persistentPrintQueue.length}) — ${isBill ? 'Conta' : 'Pedido #' + pedido.id} (${firstItemName})`);

  // Tenta processar a fila imediatamente
  processPrintQueue();
}

/**
 * Processa sequencialmente as tarefas da fila de impressão.
 */
async function processPrintQueue() {
  if (isProcessingPrintQueue) return;
  if (persistentPrintQueue.length === 0) return;

  isProcessingPrintQueue = true;

  try {
    while (persistentPrintQueue.length > 0) {
      const currentTask = persistentPrintQueue[0];
      console.log(`[PrintQueue] 🖨️ Processando cupom (${currentTask.retryCount + 1}ª tentativa) — Pedido #${currentTask.pedido.id} [${currentTask.station.toUpperCase()}]...`);

      const success = await executeSinglePrintTask(currentTask);

      if (success) {
        // Sucesso! Remove da fila e atualiza o arquivo
        persistentPrintQueue.shift();
        savePrintQueue();
        console.log(`[PrintQueue] ✅ Impressao concluida com sucesso! Fila restante: ${persistentPrintQueue.length}`);
      } else {
        // Falha de conexão/impressora -> Mantém na fila e interrompe o loop para tentar novamente em 5s
        currentTask.retryCount = (currentTask.retryCount || 0) + 1;
        savePrintQueue();
        console.warn(`[PrintQueue] ⚠️ Impressora offline, desconectada ou em erro. Cupom do Pedido #${currentTask.pedido.id} MANTIDO NA FILA. Tentativa em 5s...`);
        break;
      }
    }
  } catch (err) {
    console.error('[PrintQueue] ❌ Erro ao processar fila de impressao:', err.message);
  } finally {
    isProcessingPrintQueue = false;
  }
}

// Iniciar verificador periódico da fila (a cada 5 segundos)
setInterval(() => {
  if (persistentPrintQueue.length > 0 && !isProcessingPrintQueue) {
    processPrintQueue();
  }
}, 5000);

// Carregar fila existente ao iniciar a aplicação
loadPrintQueue();

/**
 * Executa fisicamente a impressão do cupom de uma tarefa da fila.
 * Retorna true se a impressão foi bem-sucedida, false se falhou.
 */
async function executeSinglePrintTask(task) {
  const { station, pedido, itens, isBill, divisoes } = task;
  const printers = createPrintersList(station);

  if (printers.length === 0) {
    console.log(`[PrintAgent] Nenhuma impressora ativa para a estacao [${station.toUpperCase()}] — aguardando conexao.`);
    return false;
  }

  let allSuccess = true;

  for (const { name, printer } of printers) {
    const dataStr = new Date().toLocaleString('pt-BR');
    const mesaLabel = isBill
      ? `CONTA — MESA ${pedido.mesa}`
      : `MESA ${pedido.mesa} — Pedido #${pedido.id}`;

    printer.alignCenter();
    printer.bold(true);
    printer.println(stripAccents(restauranteNome.toUpperCase()));
    printer.bold(false);
    printer.println(dataStr);
    printer.drawLine();

    printer.alignLeft();
    printer.bold(true);
    printer.println(stripAccents(mesaLabel));
    printer.bold(false);

    if (pedido.usuario_nome) {
      printer.println(stripAccents(`Cliente: ${pedido.usuario_nome}`));
    }

    printer.drawLine();

    // Itens
    for (const item of itens) {
      const qty = item.quantidade || item.quantity || 1;
      const nome = stripAccents(item.nome || item.productName || '?');
      const preco = (item.preco || item.price || 0).toFixed(2);
      let obs = item.descricao || item.description || (!isBill && pedido.descricao ? pedido.descricao : '');

      if (obs) {
        obs = cleanObsText(obs);
      }

      if (isBill) {
        printer.leftRight(`${qty}x ${nome}`, `R$${preco}`);
      } else {
        printer.println(`${qty}x ${nome}`);
      }

      if (obs) {
        printer.println(`  (${obs})`);
      }
    }

    // Totais (apenas no recibo/conta)
    if (isBill) {
      const subtotal = itens.reduce((s, i) => s + (i.preco || i.price || 0) * (i.quantidade || i.quantity || 1), 0);
      const feeRate = serviceFee;
      const fee = (subtotal * feeRate) / 100;
      const total = subtotal + fee;

      printer.drawLine();
      if (feeRate > 0) {
        printer.leftRight('Subtotal:', `R$${subtotal.toFixed(2)}`);
        printer.leftRight(`Servico (${feeRate}%):`, `R$${fee.toFixed(2)}`);
      }
      printer.bold(true);
      printer.leftRight('TOTAL:', `R$${total.toFixed(2)}`);
      printer.bold(false);

      if (divisoes && divisoes > 1) {
        const valorDividido = total / divisoes;
        printer.drawLine();
        printer.alignCenter();
        printer.bold(true);
        printer.println(`Dividido por ${divisoes}:`);
        printer.println(`R$ ${valorDividido.toFixed(2)} por pessoa`);
        printer.bold(false);
        printer.alignLeft();
      }
    }

    const cleanGeneralObs = cleanObsText(pedido.descricao || '');

    const isSingleItemObsPrinted = itens.length === 1 && !isBill;
    if (cleanGeneralObs && !isBill && cleanGeneralObs !== 'Fechamento de Conta' && !isSingleItemObsPrinted) {
      printer.drawLine();
      printer.println(stripAccents(`OBS: ${cleanGeneralObs}`));
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('Obrigado pela preferenca!');
    printer.println('Sistema PedeAi');
    printer.cut();

    try {
      await printer.execute();
      console.log(`[PrintAgent] ✅ Impresso em "${name}" (${station}) — ${mesaLabel}`);
    } catch (err) {
      console.error(`[PrintAgent] ❌ Erro ao imprimir em "${name}" (${station}):`, err.message);
      allSuccess = false;
    }
  }

  return allSuccess;
}

// ─── Parser de itens vindo do Banco de Dados (Suporta JSON e Legado) ─────────

function parseItens(pedido) {
  const rawItens = (pedido.itens || '').trim();
  let itens = [];

  if (rawItens.startsWith('[')) {
    try {
      itens = JSON.parse(rawItens);
    } catch (e) {
      console.error('[PrintAgent] ❌ Erro ao processar JSON de itens:', e.message);
      itens = [];
    }
  } else {
    // Formato legado: nomes separados por vírgula (ex: Pizza, Coca, Pizza)
    const rawItemsList = rawItens ? rawItens.split(',').map(s => s.trim()).filter(Boolean) : [];
    const itemCounts = {};
    rawItemsList.forEach(name => {
      itemCounts[name] = (itemCounts[name] || 0) + 1;
    });

    let total = 0;
    if (pedido.Subtotal) {
      const cleanSubtotal = pedido.Subtotal.replace('R$', '').replace(',', '.').trim();
      total = parseFloat(cleanSubtotal) || 0;
    }
    const unitPrice = rawItemsList.length > 0 ? total / rawItemsList.length : 0;

    itens = Object.entries(itemCounts).map(([nome, qtd]) => ({
      nome,
      quantidade: qtd,
      preco: unitPrice
    }));
  }

  return itens;
}

// ─── Classificação dos itens por estação ──────────────────────────────────────

const KITCHEN_KEYWORDS = ['pizza', 'massa', 'macarrao', 'prato', 'sopa', 'salada', 'carne', 'frango', 'peixe', 'burger', 'lanche', 'entrada', 'carbonara'];
const BAR_KEYWORDS = ['cerveja', 'chopp', 'drink', 'cocktail', 'agua', 'suco', 'refrigerante', 'vinho', 'whisky', 'vodka', 'caipirinha', 'dose'];

/**
 * Classifica a estação de preparo de um item do pedido.
 * Busca no cache carregado do banco de dados e cai na heurística caso não ache.
 */
function getItemStation(itemName, productId) {
  const cleanName = (itemName || '').trim().toLowerCase();
  
  // 1. Tentar buscar pelo nome exato no cache
  if (productStationsCache.has(cleanName)) {
    return productStationsCache.get(cleanName);
  }

  // 2. Tentar buscar pelo ID do produto no cache
  if (productId && productStationsCache.has(String(productId))) {
    return productStationsCache.get(String(productId));
  }

  // 3. Suporte especial a pizzas meias a meias
  if (cleanName.includes('/') || cleanName.includes('meia') || cleanName.includes('metade')) {
    for (const [key, station] of productStationsCache.entries()) {
      if (isNaN(Number(key)) && cleanName.includes(key)) {
        return station;
      }
    }
  }

  // 4. Fallback: heurística de palavras-chave
  return classifyItemLegacy(itemName);
}

function classifyItemLegacy(itemName) {
  const lower = (itemName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (BAR_KEYWORDS.some(k => lower.includes(k))) return 'bar';
  return 'kitchen'; // default para cozinha
}

// ─── Handler de novo pedido ────────────────────────────────────────────────────

async function handleNewOrder(pedido) {
  console.log(`[PrintAgent] 🆕 Novo pedido #${pedido.id} — Mesa ${pedido.mesa}`);

  const itens = parseItens(pedido);
  if (itens.length === 0) {
    console.log('[PrintAgent] Nenhum item valido para imprimir.');
    return;
  }

  // Limpa sufixos de impressora como "(KA-1445)" ou "PRODUCAO:" da observação do pedido
  const cleanPedidoDesc = cleanObsText(pedido.descricao || '');

  // Para pedidos de produção, IMPRIME OBRIGATORIAMENTE 1 CUPOM INDIVIDUAL SEPARADO PARA CADA PRODUTO
  const hasAllPrinter = activePrinters.some(p => p.tipo === 'all' && p.ativo === true);

  if (hasAllPrinter) {
    for (let idx = 0; idx < itens.length; idx++) {
      const item = itens[idx];
      const itemObs = item.descricao || item.description || cleanPedidoDesc;
      enqueuePrintTask('all', { ...pedido, descricao: cleanPedidoDesc }, [{ ...item, descricao: itemObs }], false, undefined, idx);
    }
    return; // Se impresso na estação geral 'all', finaliza para evitar duplicidade
  }

  // Caso contrário, direcionar especificamente item por item para as estações individuais (Cozinha / Bar)
  for (let idx = 0; idx < itens.length; idx++) {
    const item = itens[idx];
    const station = getItemStation(item.nome || item.productName, item.productId || item.id);
    const itemObs = item.descricao || item.description || cleanPedidoDesc;

    // Enfileira cada produto em seu próprio cupom individual com corte de papel
    enqueuePrintTask(station, { ...pedido, descricao: cleanPedidoDesc }, [{ ...item, descricao: itemObs }], false, undefined, idx);
  }
}

// ─── Handler de fechamento de conta ───────────────────────────────────────────

async function handleBillClosed(pedido) {
  console.log(`[PrintAgent] 🧾 Fechamento de conta — Mesa ${pedido.mesa}`);
  
  let itens = [];
  let divisoes = undefined;

  try {
    // 1. Buscar todos os pedidos da mesa do banco com status 'pagamento_pendente'
    const { data: pedidosMesa, error } = await supabase
      .from('Pedidos')
      .select('*')
      .eq('mesa', String(pedido.mesa))
      .eq('restaurante_id', RESTAURANTE_ID)
      .eq('status', 'pagamento_pendente');

    if (error) throw error;

    if (pedidosMesa && pedidosMesa.length > 0) {
      // 2. Extrair itens e divisões de todos os pedidos encontrados
      for (const p of pedidosMesa) {
        // Verificar se é o pedido marcador de divisão
        if (p.descricao && p.descricao.includes('Dividido por')) {
          const match = p.descricao.match(/Dividido por (\d+)/);
          if (match) {
            divisoes = parseInt(match[1], 10);
          }
        }

        const rawItens = parseItens(p);
        for (const item of rawItens) {
          // Ignorar item marcador de sistema
          const lowerNome = (item.nome || '').toLowerCase();
          if (
            lowerNome.includes('fechamento de conta') ||
            lowerNome.includes('mesa aberta') ||
            lowerNome.includes('chamado de garco') ||
            lowerNome.includes('chamado de garçom') ||
            lowerNome.includes('atendimento iniciado')
          ) {
            continue;
          }
          itens.push(item);
        }
      }
    } else {
      // Fallback para o pedido original recebido
      itens = parseItens(pedido);
      if (pedido.descricao && pedido.descricao.includes('Dividido por')) {
        const match = pedido.descricao.match(/Dividido por (\d+)/);
        if (match) {
          divisoes = parseInt(match[1], 10);
        }
      }
    }
  } catch (err) {
    console.error('[PrintAgent] Erro ao buscar pedidos da mesa no fechamento:', err.message);
    // Fallback em caso de erro de rede
    itens = parseItens(pedido);
  }

  // Agrupar itens iguais (para consolidar a conta no papel)
  const itensAgrupados = [];
  for (const item of itens) {
    const existing = itensAgrupados.find(i => i.nome === item.nome && i.preco === item.preco);
    if (existing) {
      existing.quantidade = (existing.quantidade || 1) + (item.quantidade || 1);
    } else {
      itensAgrupados.push({ ...item });
    }
  }

  if (itensAgrupados.length === 0) {
    console.log('[PrintAgent] Nenhum item para imprimir na conta.');
    return;
  }

  // 1. Imprimir a conta se houver impressora do tipo 'all' (Caixa / Imprimir Tudo)
  const hasAllPrinter = activePrinters.some(p => p.tipo === 'all' && p.ativo === true);
  if (hasAllPrinter) {
    enqueuePrintTask('all', pedido, itensAgrupados, true, divisoes);
  }

  // 2. Imprimir na de recibo específica se houver
  enqueuePrintTask('receipt', pedido, itensAgrupados, true, divisoes);
}

// ─── Sincronização Automática de Pedidos do Banco (Recuperação Offline) ────────

const processedOrdersHistory = new Set();

/**
 * Busca pedidos recentes no banco que ainda não foram processados ou impressos.
 * Garante recuperação total em caso de queda de internet, impressora offline ou reinício do agent.
 */
async function syncMissedOrders() {
  if (!RESTAURANTE_ID) return;
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // últimos 2h
    const { data: recentOrders, error } = await supabase
      .from('Pedidos')
      .select('*')
      .eq('restaurante_id', RESTAURANTE_ID)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (recentOrders && recentOrders.length > 0) {
      let syncCount = 0;
      for (const p of recentOrders) {
        if (processedOrdersHistory.has(String(p.id))) continue;
        
        // Registrar como conhecido para não reprocessar repetidamente
        processedOrdersHistory.add(String(p.id));

        if (p.status === 'Pendente' || p.status === 'pendente') {
          syncCount++;
          await handleNewOrder(p);
        } else if (p.status === 'pagamento_pendente' || p.descricao === 'Fechamento de Conta') {
          syncCount++;
          await handleBillClosed(p);
        }
      }
      if (syncCount > 0) {
        console.log(`[PrintAgent] 🔄 Sincronizacao de banco: ${syncCount} pedido(s) recente(s) recuperado(s) e enfileirado(s).`);
      }
    }
  } catch (err) {
    console.error('[PrintAgent] ⚠️ Erro ao sincronizar pedidos recentes do banco:', err.message);
  }
}

// ─── Supabase Realtime ────────────────────────────────────────────────────────

// Canais globais de realtime
let ordersChannel, printersChannel, productsChannel, pizzaChannel, settingsChannel;
let isListenerActive = false;

/**
 * Registra todos os canais de realtime do Supabase para o restaurante configurado.
 */
function setupChannels() {
  // Canal para pedidos
  ordersChannel = supabase
    .channel('print-agent-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Pedidos',
        filter: RESTAURANTE_ID ? `restaurante_id=eq.${RESTAURANTE_ID}` : undefined,
      },
      async (payload) => {
        const pedido = payload.new;
        if (pedido && pedido.id) {
          processedOrdersHistory.add(String(pedido.id));
        }
        try {
          if (pedido.status === 'pagamento_pendente' || pedido.descricao === 'Fechamento de Conta') {
            await handleBillClosed(pedido);
          } else {
            await handleNewOrder(pedido);
          }
        } catch (err) {
          console.error('[PrintAgent] Erro ao processar pedido:', err);
        }
      }
    )
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[PrintAgent] ✅ Conectado aos Pedidos Realtime!');
        await syncMissedOrders();
      }
    });

  // Canal para alteração de impressoras
  printersChannel = supabase
    .channel('print-agent-printers')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Impressoras',
        filter: RESTAURANTE_ID ? `restaurante_id=eq.${RESTAURANTE_ID}` : undefined,
      },
      async (payload) => {
        console.log(`[PrintAgent] 🔄 Atualização de impressora detectada na nuvem (${payload.eventType}). Sincronizando...`);
        await loadPrintersFromDb();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[PrintAgent] ✅ Conectado às Impressoras Realtime!');
      }
    });

  // Canal para alteração de produtos (atualiza o cache)
  productsChannel = supabase
    .channel('print-agent-products')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Produtos',
        filter: RESTAURANTE_ID ? `restaurante_id=eq.${RESTAURANTE_ID}` : undefined,
      },
      async () => {
        console.log('[PrintAgent] 🔄 Atualização de produtos detectada no banco. Recarregando cache...');
        await loadProductStationsCache();
      }
    )
    .subscribe();

  // Canal para alteração de sabores de pizza (atualiza o cache)
  pizzaChannel = supabase
    .channel('print-agent-pizza-flavors')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'SaboresPizza',
        filter: RESTAURANTE_ID ? `restaurante_id=eq.${RESTAURANTE_ID}` : undefined,
      },
      async () => {
        console.log('[PrintAgent] 🔄 Atualização de sabores de pizza detectada no banco. Recarregando cache...');
        await loadProductStationsCache();
      }
    )
    .subscribe();

  // Canal para alteração de dados do restaurante (atualiza o nome e taxa)
  settingsChannel = supabase
    .channel('print-agent-settings')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Restaurantes',
        filter: RESTAURANTE_ID ? `id=eq.${RESTAURANTE_ID}` : undefined,
      },
      async () => {
        console.log('[PrintAgent] 🔄 Alteração cadastral detectada no restaurante. Atualizando dados...');
        await loadRestaurantSettings();
      }
    )
    .subscribe();
}

/**
 * Remove todos os canais de realtime ativos do Supabase.
 */
function teardownChannels() {
  if (supabase && supabase.realtime) {
    try {
      supabase.realtime.disconnect();
      console.log('[PrintAgent] 🔌 Conexão realtime antiga desconectada com sucesso.');
    } catch (err) {
      console.error('[PrintAgent] Erro ao desconectar realtime antigo:', err.message);
    }
  }
  ordersChannel = null;
  printersChannel = null;
  productsChannel = null;
  pizzaChannel = null;
  settingsChannel = null;
}

/**
 * Reinicia as conexões com o Supabase com base nas configurações atuais.
 */
async function restartRealtimeListeners() {
  teardownChannels();

  if (!RESTAURANTE_ID || !RESTAURANTE_ID.trim() || RESTAURANTE_ID.length < 32) {
    console.log('[PrintAgent] ⚠️ Sem RESTAURANTE_ID configurado. Aguardando configuração em http://localhost:3001...');
    return;
  }

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      realtime: { websocket: ws },
    });

    await loadRestaurantSettings();
    await loadPrintersFromDb();
    await loadProductStationsCache();

    setupChannels();
    console.log(`[PrintAgent] 🚀 Agente de Impressão iniciado em segundo plano para "${restauranteNome}"`);
  } catch (err) {
    console.error('[PrintAgent] ❌ Erro ao inicializar listeners:', err.message);
  }
}

// ─── Servidor Web Local e HTML de Configuração ───────────────────────────────

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PedeAí — Agente de Impressão Local</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500/30">
  <!-- Header -->
  <header class="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-50 px-6 py-4">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
          <i data-lucide="printer" class="w-6 h-6"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight">PedeAí</h1>
          <p class="text-xs text-slate-400">Agente Local de Impressão</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div id="status-badge" class="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 bg-slate-800 text-slate-400 border border-slate-700/50">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse"></span>
          Carregando...
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
    <!-- Card Status Inicial -->
    <div class="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-base font-semibold text-slate-200">Restaurante Atual</h2>
        <p id="rest-name-display" class="text-2xl font-bold text-emerald-400 mt-1">Carregando...</p>
        <p id="rest-id-display" class="text-xs text-slate-400 font-mono mt-1">ID: -</p>
      </div>
      <div class="text-right">
        <p class="text-xs text-slate-400">Taxa de Serviço Ativa</p>
        <p id="rest-fee-display" class="text-2xl font-bold text-slate-200 mt-1">-%</p>
      </div>
    </div>

    <!-- Formulário de Configuração -->
    <form id="config-form" class="space-y-6">
      <!-- Seção Restaurante -->
      <section class="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div class="flex items-center gap-2.5">
            <i data-lucide="store" class="w-5 h-5 text-emerald-400"></i>
            <h3 class="font-bold text-slate-200">Credenciais do Restaurante</h3>
          </div>
          <button type="button" id="toggle-manual-mode" onclick="toggleManualMode()" class="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors flex items-center gap-1">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Digitar ID manualmente
          </button>
        </div>
        
        <!-- Bloco de Seleção Automática (Dropdown) -->
        <div id="dropdown-mode-block" class="space-y-2">
          <label class="text-xs uppercase tracking-wider font-bold text-slate-400">Escolha o Restaurante Cadastrado</label>
          <select id="restaurant-select" onchange="onRestaurantSelected()" class="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50 transition-all">
            <option value="">Carregando restaurantes...</option>
          </select>
        </div>

        <!-- Bloco de Inserção Manual (Hidden por padrão) -->
        <div id="manual-mode-block" class="space-y-2 hidden">
          <label class="text-xs uppercase tracking-wider font-bold text-slate-400">RESTAURANTE_ID (UUID do Banco de Dados)</label>
          <div class="flex gap-2">
            <input type="text" id="RESTAURANTE_ID" name="RESTAURANTE_ID" placeholder="Ex: a976db0c-c1df-4b21-a836-3671f1a5bba9" 
              class="flex-1 bg-slate-950 border border-slate-805 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all font-mono">
            <button type="button" id="btn-validate" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-5 rounded-2xl text-sm font-semibold transition-all flex items-center gap-2">
              <i data-lucide="shield-check" class="w-4 h-4"></i> Validar ID
            </button>
          </div>
        </div>
      </section>

      <!-- Seção Impressoras -->
      <section class="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 space-y-6">
        <div class="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
          <i data-lucide="cpu" class="w-5 h-5 text-emerald-400"></i>
          <h3 class="font-bold text-slate-200">Configuração das Impressoras Locais (Fallback)</h3>
        </div>
        <p class="text-xs text-slate-400 leading-relaxed">
          💡 <strong>Nota:</strong> Estas configurações locais servem como fallback. As impressoras cadastradas diretamente no painel web da nuvem possuem prioridade de execução.
        </p>

        <!-- Grade de Impressoras -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <!-- Impressora Cozinha -->
          <div class="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-xs uppercase tracking-wider font-bold text-emerald-400">🍽️ Cozinha</span>
              <button type="button" onclick="testPrint('kitchen')" class="text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors">
                <i data-lucide="play" class="w-3.5 h-3.5"></i> Testar
              </button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-[11px] text-slate-400 font-medium">Método</label>
                <select name="PRINTER_KITCHEN_TYPE" id="PRINTER_KITCHEN_TYPE" onchange="toggleFields('kitchen')" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                  <option value="tcp">Rede Local (TCP/IP)</option>
                  <option value="usb">Porta USB / COM</option>
                </select>
              </div>
              <div id="kitchen-tcp" class="space-y-3">
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Endereço IP</label>
                  <input type="text" name="PRINTER_KITCHEN_HOST" id="PRINTER_KITCHEN_HOST" placeholder="Ex: 192.168.1.169" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Porta</label>
                  <input type="text" name="PRINTER_KITCHEN_PORT" id="PRINTER_KITCHEN_PORT" placeholder="9100" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
              </div>
              <div id="kitchen-usb" class="hidden">
                <label id="label-kitchen-usb" class="text-[11px] text-slate-400 font-medium">Caminho USB/COM</label>
                <input type="text" name="PRINTER_KITCHEN_USB" id="PRINTER_KITCHEN_USB" placeholder="Ex: \\\\.\\USB001" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
              </div>
            </div>
          </div>

          <!-- Impressora Bar -->
          <div class="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-xs uppercase tracking-wider font-bold text-emerald-400">🍺 Bar</span>
              <button type="button" onclick="testPrint('bar')" class="text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors">
                <i data-lucide="play" class="w-3.5 h-3.5"></i> Testar
              </button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-[11px] text-slate-400 font-medium">Método</label>
                <select name="PRINTER_BAR_TYPE" id="PRINTER_BAR_TYPE" onchange="toggleFields('bar')" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                  <option value="tcp">Rede Local (TCP/IP)</option>
                  <option value="usb">Porta USB / COM</option>
                </select>
              </div>
              <div id="bar-tcp" class="space-y-3">
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Endereço IP</label>
                  <input type="text" name="PRINTER_BAR_HOST" id="PRINTER_BAR_HOST" placeholder="Ex: 192.168.1.169" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Porta</label>
                  <input type="text" name="PRINTER_BAR_PORT" id="PRINTER_BAR_PORT" placeholder="9100" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
              </div>
              <div id="bar-usb" class="hidden">
                <label id="label-bar-usb" class="text-[11px] text-slate-400 font-medium">Caminho USB/COM</label>
                <input type="text" name="PRINTER_BAR_USB" id="PRINTER_BAR_USB" placeholder="Ex: \\\\.\\USB001" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
              </div>
            </div>
          </div>

          <!-- Impressora Recibo -->
          <div class="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-xs uppercase tracking-wider font-bold text-emerald-400">🧾 Caixa/Recibo</span>
              <button type="button" onclick="testPrint('receipt')" class="text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-colors">
                <i data-lucide="play" class="w-3.5 h-3.5"></i> Testar
              </button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-[11px] text-slate-400 font-medium">Método</label>
                <select name="PRINTER_RECEIPT_TYPE" id="PRINTER_RECEIPT_TYPE" onchange="toggleFields('receipt')" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                  <option value="tcp">Rede Local (TCP/IP)</option>
                  <option value="usb">Porta USB / COM</option>
                </select>
              </div>
              <div id="receipt-tcp" class="space-y-3">
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Endereço IP</label>
                  <input type="text" name="PRINTER_RECEIPT_HOST" id="PRINTER_RECEIPT_HOST" placeholder="Ex: 192.168.1.169" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
                <div>
                  <label class="text-[11px] text-slate-400 font-medium">Porta</label>
                  <input type="text" name="PRINTER_RECEIPT_PORT" id="PRINTER_RECEIPT_PORT" placeholder="9100" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
                </div>
              </div>
              <div id="receipt-usb" class="hidden">
                <label id="label-receipt-usb" class="text-[11px] text-slate-400 font-medium">Caminho USB/COM</label>
                <input type="text" name="PRINTER_RECEIPT_USB" id="PRINTER_RECEIPT_USB" placeholder="Ex: \\\\.\\USB001" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none">
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- Botão Salvar -->
      <div class="flex justify-end">
        <button type="submit" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-8 py-4 rounded-2xl shadow-xl hover:shadow-emerald-500/10 transition-all flex items-center gap-2 text-base">
          <i data-lucide="save" class="w-5 h-5"></i> Salvar Configurações e Conectar
        </button>
      </div>
    </form>
  </main>

  <!-- Notification Toast -->
  <div id="toast" class="fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 bg-slate-900/90 text-sm font-semibold flex items-center gap-2 transform translate-y-24 opacity-0 transition-all duration-300 z-50">
    <span id="toast-icon" class="text-emerald-400"></span>
    <span id="toast-text" class="text-slate-100"></span>
  </div>

  <script>
    // Inicia os ícones do Lucide
    lucide.createIcons();

    // Toggle fields
    function toggleFields(station) {
      const type = document.getElementById('PRINTER_' + station.toUpperCase() + '_TYPE').value;
      const tcpBlock = document.getElementById(station + '-tcp');
      const usbBlock = document.getElementById(station + '-usb');
      
      if (type === 'tcp') {
        tcpBlock.classList.remove('hidden');
        usbBlock.classList.add('hidden');
      } else {
        tcpBlock.classList.add('hidden');
        usbBlock.classList.remove('hidden');
      }
    }

    function setupLocalPrintersDropdown(printers, config) {
      const stations = ['kitchen', 'bar', 'receipt'];
      
      stations.forEach(station => {
        const usbDiv = document.getElementById(station + '-usb');
        if (!usbDiv) return;
        
        const inputId = 'PRINTER_' + station.toUpperCase() + '_USB';
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        
        // Evita duplicar seletor se o container já existir
        const oldContainer = document.getElementById(station + '-usb-select-container');
        if (oldContainer) {
          oldContainer.remove();
        }
        
        if (printers.length === 0) return;
        
        const selectContainer = document.createElement('div');
        selectContainer.className = "mt-2 space-y-1";
        selectContainer.id = station + '-usb-select-container';
        
        const selectLabel = document.createElement('label');
        selectLabel.className = "text-[11px] text-emerald-400 font-semibold block mt-1";
        selectLabel.innerText = "Selecione a Impressora Instalada";
        
        const selectEl = document.createElement('select');
        selectEl.className = "w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none";
        
        selectEl.innerHTML = '<option value="">-- Escolha uma impressora física --</option>';
        
        let hasMatched = false;
        const currentValue = inputEl.value;
        
        printers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.Name;
          opt.innerText = '🖨️ ' + p.Name + ' (' + p.PortName + ')';
          if (p.Name === currentValue) {
            opt.selected = true;
            hasMatched = true;
          }
          selectEl.appendChild(opt);
        });
        
        const manualOpt = document.createElement('option');
        manualOpt.value = "__MANUAL__";
        manualOpt.innerText = "✏️ Digitar caminho manual...";
        if (currentValue && !hasMatched) {
          manualOpt.selected = true;
        }
        selectEl.appendChild(manualOpt);
        
        const labelEl = document.getElementById('label-' + station + '-usb');
        
        selectEl.onchange = function() {
          if (selectEl.value === '__MANUAL__') {
            inputEl.classList.remove('hidden');
            if (labelEl) labelEl.classList.remove('hidden');
            inputEl.focus();
          } else {
            inputEl.classList.add('hidden');
            if (labelEl) labelEl.classList.add('hidden');
            inputEl.value = selectEl.value;
          }
        };
        
        if (currentValue && !hasMatched) {
          inputEl.classList.remove('hidden');
          if (labelEl) labelEl.classList.remove('hidden');
        } else {
          inputEl.classList.add('hidden');
          if (labelEl) labelEl.classList.add('hidden');
          if (hasMatched) {
            inputEl.value = selectEl.value;
          }
        }
        
        selectContainer.appendChild(selectLabel);
        selectContainer.appendChild(selectEl);
        
        usbDiv.appendChild(selectContainer);
      });
    }

    // Exibir Toast
    function showToast(text, isError = false) {
      const toast = document.getElementById('toast');
      const textEl = document.getElementById('toast-text');
      const iconEl = document.getElementById('toast-icon');

      textEl.innerText = text;
      if (isError) {
        toast.className = toast.className.replace('border-slate-800', 'border-red-500/20').replace('text-slate-100', 'text-red-400');
        iconEl.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5"></i>';
      } else {
        toast.className = toast.className.replace('border-red-500/20', 'border-slate-800').replace('text-red-400', 'text-slate-100');
        iconEl.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-400"></i>';
      }
      
      lucide.createIcons();

      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';

      setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
      }, 4000);
    }

    let isManualMode = false;

    function toggleManualMode() {
      isManualMode = !isManualMode;
      const dropdownBlock = document.getElementById('dropdown-mode-block');
      const manualBlock = document.getElementById('manual-mode-block');
      const toggleBtn = document.getElementById('toggle-manual-mode');

      if (isManualMode) {
        dropdownBlock.classList.add('hidden');
        manualBlock.classList.remove('hidden');
        toggleBtn.innerHTML = '<i data-lucide="list" class="w-3.5 h-3.5"></i> Usar lista de restaurantes';
      } else {
        dropdownBlock.classList.remove('hidden');
        manualBlock.classList.add('hidden');
        toggleBtn.innerHTML = '<i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Digitar ID manualmente';
      }
      lucide.createIcons();
    }

    function onRestaurantSelected() {
      const select = document.getElementById('restaurant-select');
      const input = document.getElementById('RESTAURANTE_ID');
      input.value = select.value;
    }

    // Carregar configurações
    async function loadConfig() {
      try {
        // 1. Carregar lista de restaurantes do banco
        const restRes = await fetch('/api/restaurants');
        const restaurants = await restRes.json();
        
        const select = document.getElementById('restaurant-select');
        select.innerHTML = '<option value="">-- Selecione o seu restaurante --</option>';
        
        restaurants.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.innerText = r.nome;
          select.appendChild(opt);
        });

        // 2. Carregar valores atuais do .env
        const res = await fetch('/api/config');
        const config = await res.json();
        
        // Popular form
        for (const [key, value] of Object.entries(config)) {
          const el = document.getElementById(key);
          if (el) {
            el.value = value || '';
          }
        }

        // Selecionar no dropdown se o ID do .env corresponder a algum da lista
        const inputId = config.RESTAURANTE_ID;
        if (inputId) {
          const matched = restaurants.some(r => r.id === inputId);
          if (matched) {
            select.value = inputId;
          } else {
            // Se o ID atual não está na lista (ex: UUID customizado), liga o modo manual
            toggleManualMode();
          }
        }

        // 3. Buscar e configurar impressoras locais do Windows
        try {
          const printerRes = await fetch('/api/printers');
          const printerData = await printerRes.json();
          if (printerData.success) {
            setupLocalPrintersDropdown(printerData.printers || [], config);
          }
        } catch (e) {
          console.warn('Erro ao buscar impressoras para o seletor local:', e);
        }

        // Toggles
        toggleFields('kitchen');
        toggleFields('bar');
        toggleFields('receipt');
      } catch (err) {
        showToast('Erro ao carregar configurações locais', true);
      }
    }

    // Atualizar Status do Painel
    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        const badge = document.getElementById('status-badge');
        const restName = document.getElementById('rest-name-display');
        const restId = document.getElementById('rest-id-display');
        const restFee = document.getElementById('rest-fee-display');

        if (data.supabaseConnected) {
          badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Conectado Realtime';
          badge.className = badge.className.replace('text-slate-400 bg-slate-800', 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20');
        } else {
          badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> Desconectado';
          badge.className = badge.className.replace('text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 'text-slate-400 bg-slate-800 border-slate-700/50');
        }

        restName.innerText = data.restaurantName || 'ID não configurado';
        restId.innerText = 'ID: ' + (data.restaurantId || 'Nenhum');
        restFee.innerText = (data.serviceFee || '0') + '%';
      } catch (err) {
        console.error(err);
      }
    }

    // Validar ID
    document.getElementById('btn-validate').addEventListener('click', async () => {
      const id = document.getElementById('RESTAURANTE_ID').value.trim();
      if (!id) {
        showToast('Por favor, digite o ID do Restaurante antes', true);
        return;
      }
      try {
        const res = await fetch('/api/validate-id?id=' + id);
        const data = await res.json();
        if (data.success) {
          showToast('ID Válido! Restaurante: ' + data.name);
          updateStatus();
        } else {
          showToast('ID Inválido ou restaurante não encontrado.', true);
        }
      } catch (err) {
        showToast('Falha na validação. Impressora offline?', true);
      }
    });

    // Testar Impressão
    async function testPrint(station) {
      const form = document.getElementById('config-form');
      const formData = new FormData(form);
      const data = {};
      
      data.station = station;
      data.type = document.getElementById('PRINTER_' + station.toUpperCase() + '_TYPE').value;
      data.host = document.getElementById('PRINTER_' + station.toUpperCase() + '_HOST').value;
      data.port = document.getElementById('PRINTER_' + station.toUpperCase() + '_PORT').value;
      data.usb = document.getElementById('PRINTER_' + station.toUpperCase() + '_USB').value;

      try {
        showToast('Enviando teste para a impressora...');
        const res = await fetch('/api/test-print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          showToast('Impressão de teste enviada com sucesso!');
        } else {
          showToast('Erro: ' + result.message, true);
        }
      } catch (err) {
        showToast('Falha de rede ao tentar testar impressão.', true);
      }
    }

    // Submit Config
    document.getElementById('config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {};
      formData.forEach((value, key) => { data[key] = value; });

      // Pegar ID do seletor ou do input manual
      if (!isManualMode) {
        data.RESTAURANTE_ID = document.getElementById('restaurant-select').value;
      } else {
        data.RESTAURANTE_ID = document.getElementById('RESTAURANTE_ID').value.trim();
      }

      if (!data.RESTAURANTE_ID) {
        showToast('Por favor, selecione ou digite o ID do restaurante!', true);
        return;
      }

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          showToast('Configurações salvas e aplicadas em tempo real!');
          setTimeout(() => {
            updateStatus();
          }, 1500);
        } else {
          showToast('Erro ao salvar configurações', true);
        }
      } catch (err) {
        showToast('Falha ao salvar configurações', true);
      }
    });

    // Inicialização
    loadConfig();
    updateStatus();
    setInterval(updateStatus, 5000);
  </script>
</body>
</html>
`;

/**
 * Grava as variáveis do objeto de config no arquivo .env
 */
function saveConfigToEnv(config) {
  let envContent = '';
  
  // Se já existe, lê para preservar chaves de conexão legadas
  if (fs.existsSync('.env')) {
    envContent = fs.readFileSync('.env', 'utf8');
  }

  // Atualiza cada chave fornecida
  for (const [key, val] of Object.entries(config)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    const line = `${key}=${val}`;
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `\n${line}`;
    }
  }

  // Garantir credenciais de fallback Supabase
  if (!envContent.includes('SUPABASE_URL=')) {
    envContent += `\nSUPABASE_URL=${SUPABASE_URL}`;
  }
  if (!envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
    envContent += `\nSUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}`;
  }

  fs.writeFileSync('.env', envContent, 'utf8');
}

/**
 * Inicializa o mini-servidor local de configuração na porta 3001
 */
function startConfigServer() {
  const server = http.createServer((req, res) => {
    // Habilitar CORS para permitir que o frontend da Web se comunique com o agente local
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Responder requisições OPTIONS de preflight imediatamente
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 0. Endpoint: GET /api/printers (Retorna as impressoras físicas instaladas no Windows)
    if (req.url === '/api/printers' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      const psCommand = `powershell -Command "Get-Printer | Select-Object Name, PortName, Type | ConvertTo-Json"`;
      exec(psCommand, (err, stdout, stderr) => {
        if (err) {
          console.error('[ConfigServer] Erro ao listar impressoras do Windows:', err.message);
          res.end(JSON.stringify({ success: false, message: err.message, printers: [] }));
          return;
        }
        try {
          const printers = JSON.parse(stdout || '[]');
          const printersList = Array.isArray(printers) ? printers : [printers].filter(Boolean);
          res.end(JSON.stringify({ success: true, printers: printersList }));
        } catch (parseErr) {
          console.error('[ConfigServer] Erro ao fazer parse do JSON de impressoras:', parseErr.message);
          res.end(JSON.stringify({ success: false, message: 'Erro ao processar lista de impressoras', printers: [] }));
        }
      });
      return;
    }

    // 1. Endpoint: Servir página web (HTML)
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_TEMPLATE);
      return;
    }

    // 2. API: GET /api/config
    if (req.url === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const currentConfig = {
        RESTAURANTE_ID: RESTAURANTE_ID || '',
        PRINTER_KITCHEN_TYPE: process.env.PRINTER_KITCHEN_TYPE || 'tcp',
        PRINTER_KITCHEN_HOST: process.env.PRINTER_KITCHEN_HOST || '',
        PRINTER_KITCHEN_PORT: process.env.PRINTER_KITCHEN_PORT || '9100',
        PRINTER_KITCHEN_USB: process.env.PRINTER_KITCHEN_USB || '',
        PRINTER_BAR_TYPE: process.env.PRINTER_BAR_TYPE || 'tcp',
        PRINTER_BAR_HOST: process.env.PRINTER_BAR_HOST || '',
        PRINTER_BAR_PORT: process.env.PRINTER_BAR_PORT || '9100',
        PRINTER_BAR_USB: process.env.PRINTER_BAR_USB || '',
        PRINTER_RECEIPT_TYPE: process.env.PRINTER_RECEIPT_TYPE || 'tcp',
        PRINTER_RECEIPT_HOST: process.env.PRINTER_RECEIPT_HOST || '',
        PRINTER_RECEIPT_PORT: process.env.PRINTER_RECEIPT_PORT || '9100',
        PRINTER_RECEIPT_USB: process.env.PRINTER_RECEIPT_USB || '',
      };
      res.end(JSON.stringify(currentConfig));
      return;
    }

    // 2.5 API: GET /api/restaurants
    if (req.url === '/api/restaurants' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const tempClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        realtime: { websocket: ws },
      });
      tempClient.from('Restaurantes')
        .select('id, nome')
        .order('nome', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            res.end(JSON.stringify([]));
          } else {
            res.end(JSON.stringify(data || []));
          }
        })
        .catch(err => {
          res.end(JSON.stringify([]));
        });
      return;
    }

    // 3. API: GET /api/status
    if (req.url === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        supabaseConnected: isListenerActive,
        restaurantName: restauranteNome,
        restaurantId: RESTAURANTE_ID,
        serviceFee: serviceFee,
      }));
      return;
    }

    // 4. API: GET /api/validate-id (com query param)
    if (req.url.startsWith('/api/validate-id') && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const idToValidate = urlObj.searchParams.get('id');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      if (!idToValidate) {
        res.end(JSON.stringify({ success: false, message: 'ID ausente' }));
        return;
      }

      // Validar no Supabase
      const tempClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        realtime: { websocket: ws },
      });

      tempClient.from('Restaurantes')
        .select('nome')
        .eq('id', idToValidate)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            res.end(JSON.stringify({ success: false, message: error ? error.message : 'Não encontrado' }));
          } else {
            res.end(JSON.stringify({ success: true, name: data.nome }));
          }
        })
        .catch(err => {
          res.end(JSON.stringify({ success: false, message: err.message }));
        });
      return;
    }

    // 5. API: POST /api/config (Grava e re-inicia o listener)
    if (req.url === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const config = JSON.parse(body);

          // Atualizar variáveis locais e process.env
          for (const [key, val] of Object.entries(config)) {
            process.env[key] = val;
          }
          RESTAURANTE_ID = config.RESTAURANTE_ID;

          // Gravar no arquivo .env
          saveConfigToEnv(config);

          // Configurar inicialização automática no Windows Startup
          setupWindowsStartup();

          // Reiniciar canais do Supabase com as novas credenciais
          await restartRealtimeListeners();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // 6. API: POST /api/test-print
    if (req.url === '/api/test-print' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          
          await printTestCupom(data, data.station);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Rota não encontrada');
  });

  let port = 3001;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[ConfigServer] ⚠️  Porta ${port} em uso. Tentando a porta ${port + 1}...`);
      port++;
      server.listen(port);
    }
  });

  server.listen(port, () => {
    console.log(`\n💻 Servidor de configuracao rodando em http://localhost:${port}`);
    // Abrir o navegador automaticamente
    exec(`start http://localhost:${port}`, (err) => {
      if (err) console.warn('[PrintAgent] ⚠️  Não foi possível abrir o navegador automaticamente.');
    });
  });
}

/**
 * Função utilitária de impressão de teste (usando configurações temporárias do form)
 */
async function printTestCupom(printerConfig, stationName) {
  const interfaceAddr = printerConfig.type === 'tcp'
    ? `tcp://${printerConfig.host}:${printerConfig.port || '9100'}`
    : printerConfig.usb;

  if (!interfaceAddr) {
    throw new Error('Endereço/Caminho da impressora não especificado');
  }

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: interfaceAddr,
    characterSet: CharacterSet.PC860_PORTUGUESE,
    breakLine: BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    options: { timeout: 5000 },
  });

  const dataStr = new Date().toLocaleString('pt-BR');

  printer.alignCenter();
  printer.bold(true);
  printer.println('PEDEAI - TESTE DE IMPRESSAO');
  printer.bold(false);
  printer.println(dataStr);
  printer.drawLine();

  printer.alignLeft();
  printer.bold(true);
  printer.println(`IMPRESSORA: ${stationName.toUpperCase()}`);
  printer.bold(false);
  printer.println(`Conexao: ${printerConfig.type.toUpperCase()}`);
  printer.println(`Endereço: ${interfaceAddr}`);
  printer.drawLine();

  printer.println('Se voce esta lendo esta mensagem, a sua');
  printer.println('impressora local foi configurada com');
  printer.println('sucesso no Agente de Impressão PedeAí!');
  printer.drawLine();

  printer.alignCenter();
  printer.println('Obrigado!');
  printer.cut();

  await printer.execute();
}

/**
 * Registra a inicialização automática do executável (oculto em segundo plano) no Windows Startup.
 */
function setupWindowsStartup() {
  try {
    const exePath = process.execPath;
    
    // Se estiver rodando via node diretamente (desenvolvimento), não registra o startup
    if (exePath.endsWith('node.exe') || exePath.endsWith('node')) {
      console.log('[Startup] Execução via Node detectada. Atalho do Windows ignorado em desenvolvimento.');
      return;
    }

    const workingDir = path.dirname(exePath);
    const vbsPath = path.join(workingDir, 'iniciar_invisivel.vbs');

    // 1. Criar o arquivo iniciar_invisivel.vbs se não existir
    if (!fs.existsSync(vbsPath)) {
      const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run chr(34) & "${exePath.replace(/\\/g, '\\\\')}" & chr(34), 0, False\n`;
      fs.writeFileSync(vbsPath, vbsContent, 'utf8');
      console.log('[Startup] Arquivo iniciar_invisivel.vbs criado com sucesso em:', vbsPath);
    }

    // 2. Criar atalho (.lnk) na pasta Startup do Windows
    const startupDir = path.join(
      process.env.APPDATA,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup'
    );

    if (!fs.existsSync(startupDir)) {
      console.warn('[Startup] ⚠️ Pasta Startup do Windows não encontrada:', startupDir);
      return;
    }

    const shortcutPath = path.join(startupDir, 'PedeAiPrintAgent.lnk');
    const psCommand = `powershell -Command "$s = New-Object -ComObject WScript.Shell; $g = $s.CreateShortcut('${shortcutPath}'); $g.TargetPath = '${vbsPath}'; $g.WorkingDirectory = '${workingDir}'; $g.Save()"`;

    exec(psCommand, (err) => {
      if (err) {
        console.error('[Startup] ❌ Erro ao criar atalho no Startup do Windows:', err.message);
      } else {
        console.log('[Startup] ✅ Atalho criado com sucesso em:', shortcutPath);
      }
    });
  } catch (err) {
    console.error('[Startup] ❌ Falha crítica ao configurar inicialização automática:', err.message);
  }
}

/**
 * Inicia o Agente de Impressão Local
 */
async function startAgent() {
  console.log('\n====================================================');
  console.log(' PedeAí - Agente Local de Impressão');
  console.log('====================================================');

  // Iniciar servidor web de configuração
  startConfigServer();

  // Iniciar comunicação e listeners do Supabase
  await restartRealtimeListeners();
}

startAgent().catch(console.error);
