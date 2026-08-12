import net from 'net';
import { supabase } from '../adapters/supabaseAdapter';

/**
 * Módulo de Impressão na Nuvem Embutido no Servidor (EasyPanel / Docker)
 * Suporta Múltiplos Restaurantes isolados por restaurante_id.
 */

// Armazena fila em memória de trabalhos CloudPRNT / Polling HTTP por restaurante
const cloudPrntJobsMap = new Map<string, Array<{ id: string; ticket: string; createdAt: string }>>();

/**
 * Remove acentos e caracteres especiais para impressão térmica limpa.
 */
function stripAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\x0A\x0D]/g, '');
}

/**
 * Constrói os bytes brutos ESC/POS para um produto ou conta.
 */
function buildEscPosBuffer(
  restauranteNome: string,
  pedido: any,
  item: any,
  isBill: boolean = false,
  allItensBill: any[] = []
): Buffer {
  const parts: Buffer[] = [];

  const write = (str: string) => parts.push(Buffer.from(stripAccents(str), 'ascii'));
  const writeRaw = (bytes: number[]) => parts.push(Buffer.from(bytes));

  // Inicializar impressora ESC/POS
  writeRaw([0x1b, 0x40]);

  // Alinhamento Centralizado + Negrito
  writeRaw([0x1b, 0x61, 0x01]);
  writeRaw([0x1b, 0x45, 0x01]);
  write(`${(restauranteNome || 'RESTAURANTE').toUpperCase()}\n`);
  writeRaw([0x1b, 0x45, 0x00]);
  
  const dataStr = new Date().toLocaleString('pt-BR');
  write(`${dataStr}\n`);
  write('------------------------------------------------\n');

  // Alinhamento à Esquerda
  writeRaw([0x1b, 0x61, 0x00]);
  writeRaw([0x1b, 0x45, 0x01]);
  if (isBill) {
    write(`CONTA -- MESA ${pedido.mesa || '?'}\n`);
  } else {
    write(`MESA ${pedido.mesa || '?'} -- Pedido #${pedido.id}\n`);
  }
  writeRaw([0x1b, 0x45, 0x00]);

  if (pedido.usuario_nome) {
    write(`Cliente: ${pedido.usuario_nome}\n`);
  }
  write('------------------------------------------------\n');

  // Conteúdo
  if (isBill && allItensBill.length > 0) {
    let subtotal = 0;
    for (const it of allItensBill) {
      const qty = it.quantidade || 1;
      const nome = it.nome || '?';
      const preco = (it.preco || 0).toFixed(2);
      const totalItem = (it.preco || 0) * qty;
      subtotal += totalItem;

      write(`${qty}x ${nome} - R$ ${preco}\n`);
      if (it.descricao) {
        write(`  (${it.descricao})\n`);
      }
    }
    write('------------------------------------------------\n');
    writeRaw([0x1b, 0x45, 0x01]);
    write(`TOTAL: R$ ${subtotal.toFixed(2)}\n`);
    writeRaw([0x1b, 0x45, 0x00]);
  } else if (item) {
    const qty = item.quantidade || 1;
    const nome = item.nome || item.productName || '?';
    const obs = item.descricao || item.description || pedido.descricao || '';

    writeRaw([0x1b, 0x45, 0x01]);
    write(`${qty}x ${nome}\n`);
    writeRaw([0x1b, 0x45, 0x00]);

    if (obs) {
      write(`  (${obs})\n`);
    }
  }

  write('------------------------------------------------\n');
  writeRaw([0x1b, 0x61, 0x01]);
  write('Obrigado pela preferencia!\n');
  write('Sistema PedeAi\n\n\n\n');

  // Corte de papel ESC/POS (GS V A 0)
  writeRaw([0x1d, 0x56, 0x41, 0x00]);

  return Buffer.concat(parts);
}

/**
 * Envia o buffer ESC/POS diretamente para o IP:Porta da impressora de rede via TCP.
 */
function sendToNetworkPrinter(host: string, port: number, buffer: Buffer, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isFinished = false;

    const cleanup = () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(buffer, () => {
        socket.end();
        cleanup();
        resolve(true);
      });
    });

    socket.on('error', (err) => {
      console.error(`[CloudPrint] ❌ Erro de conexao com impressora ${host}:${port}:`, err.message);
      cleanup();
      resolve(false);
    });

    socket.on('timeout', () => {
      console.error(`[CloudPrint] ⚠️ Timeout ao conectar na impressora ${host}:${port}`);
      cleanup();
      resolve(false);
    });
  });
}

function parseItens(pedido: any): any[] {
  if (!pedido || !pedido.itens) return [];

  let rawItens = pedido.itens;
  if (Array.isArray(rawItens)) return rawItens;

  if (typeof rawItens === 'object') return [rawItens];

  const str = String(rawItens).trim();
  if (!str) return [];

  // 1. Se for JSON Array [ ... ]
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // ignora e faz fallback
    }
  }

  // 2. Se for JSON Object { ... }
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (e) {
      // ignora e faz fallback
    }
  }

  // 3. String simples (ex: "Pizza Calabresa", "Soda Italiana Tangerina")
  const qtd = Math.max(1, parseInt(pedido.quantidade, 10) || 1);
  const subtotal = parseFloat(String(pedido.Subtotal || '0').replace('R$', '').replace(',', '.').trim()) || 0;
  const unitPrice = subtotal > 0 ? subtotal / qtd : 0;

  return [{
    nome: str,
    quantidade: qtd,
    preco: unitPrice,
    descricao: pedido.descricao || ''
  }];
}

/**
 * Processa um pedido vindo do Supabase Realtime de forma isolada por restaurante_id.
 */
async function processOrderForCloudPrint(pedido: any) {
  const restauranteId = pedido.restaurante_id;
  if (!restauranteId) return;

  try {
    // 1. Buscar impressoras ativas deste restaurante específico
    const { data: impressoras, error: impError } = await supabase.client
      .from('Impressoras')
      .select('*')
      .eq('restaurante_id', restauranteId)
      .eq('ativo', true);

    if (impError || !impressoras || impressoras.length === 0) {
      return; // Nenhuma impressora cadastrada ou ativa para este restaurante
    }

    // 2. Buscar nome do restaurante para o cabeçalho
    const { data: restData } = await supabase.client
      .from('Restaurantes')
      .select('nome')
      .eq('id', restauranteId)
      .single();

    const restauranteNome = restData?.nome || 'RESTAURANTE';

    // 3. Extrair itens do pedido
    const itens = parseItens(pedido);
    if (itens.length === 0) return;

    // 4. Identificar impressoras de rede TCP (ex: 192.168.1.200:9100 ou IP preenchido no campo interface)
    const networkPrinters = impressoras.filter(p => p.interface && p.interface.includes('.'));

    const isBill = pedido.status === 'pagamento_pendente' || pedido.descricao === 'Fechamento de Conta';

    for (const printerConfig of networkPrinters) {
      const parts = printerConfig.interface.split(':');
      const host = parts[0].trim();
      const port = parseInt(parts[1] || '9100', 10);

      if (isBill) {
        // Envia cupom consolidado de conta
        const buffer = buildEscPosBuffer(restauranteNome, pedido, null, true, itens);
        await sendToNetworkPrinter(host, port, buffer);
      } else {
        // Pedido de produção: 1 CUPOM INDIVIDUAL POR PRODUTO COM CORTE DE PAPEL
        for (const item of itens) {
          const buffer = buildEscPosBuffer(restauranteNome, pedido, item, false);
          await sendToNetworkPrinter(host, port, buffer);
        }
      }
    }

    // 5. Adicionar aos trabalhos de polling HTTP/CloudPRNT se houver leitores configurados
    if (!cloudPrntJobsMap.has(restauranteId)) {
      cloudPrntJobsMap.set(restauranteId, []);
    }
    const jobsList = cloudPrntJobsMap.get(restauranteId)!;
    
    for (const item of itens) {
      jobsList.push({
        id: `${pedido.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ticket: buildEscPosBuffer(restauranteNome, pedido, item, isBill, itens).toString('base64'),
        createdAt: new Date().toISOString()
      });
    }

  } catch (err: any) {
    console.error(`[CloudPrint] ❌ Erro ao processar impressao para o restaurante ${restauranteId}:`, err.message);
  }
}

/**
 * Inicia o Serviço de Impressão na Nuvem Multi-Tenant no EasyPanel.
 */
export function startCloudPrintService() {
  console.log('[CloudPrint] ☁️ Iniciando Servico de Impressao na Nuvem Multi-Tenant no EasyPanel...');

  supabase.client
    .channel('server-cloud-print-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Pedidos',
      },
      async (payload) => {
        const pedido = payload.new;
        if (pedido) {
          await processOrderForCloudPrint(pedido);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[CloudPrint] ✅ Servidor EasyPanel escutando Pedidos Realtime para TODOS os restaurantes!');
      }
    });
}

/**
 * Endpoints HTTP para Polling / CloudPRNT por Restaurante.
 */
export function getPendingCloudJobs(restauranteId: string) {
  return cloudPrntJobsMap.get(restauranteId) || [];
}

export function completeCloudJob(restauranteId: string, jobId: string) {
  const list = cloudPrntJobsMap.get(restauranteId);
  if (!list) return false;
  const idx = list.findIndex(j => j.id === jobId);
  if (idx !== -1) {
    list.splice(idx, 1);
    return true;
  }
  return false;
}
