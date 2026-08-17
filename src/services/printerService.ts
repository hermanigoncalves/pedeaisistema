export interface PrintItem {
  nome: string;
  quantidade: number;
  preco: number;
  descricao?: string;
}

export interface PrintOrderData {
  id: number | string;
  mesa: number | string;
  created_at: string | Date;
  itens: PrintItem[];
  total: number; // This can be the final total with fee or raw total, depending on usage. We will use specific fields below for clarity.
  subtotal?: number;
  serviceFee?: number; // Value of the service fee (e.g. 10% of subtotal)
  serviceFeePercentage?: number; // e.g. 10
  totalWithFee?: number;
  couvert?: number;
  descricao?: string; // Observações do pedido geral ou "Fechamento de Conta"
  clienteNome?: string; // Nome do cliente (modo comanda)
  divisoes?: number; // Quantidade de divisões da conta
}

// URL do RawBT (geralmente fixo na porta 40213 para localhost)
const RAWBT_URL = 'http://localhost:40213/print';

// --- WEB BLUETOOTH API SUPPORT (NATIVO DO CHROME) ---

// Tipagem para conexões Bluetooth ativas
export interface BluetoothConnection {
  device: any;
  characteristic: any;
}

// Dicionário de conexões ativas indexado por ID da impressora
export const activeBluetoothConnections: Record<string, BluetoothConnection> = {};

// Cache de instâncias de BluetoothDevice conhecidas para reconexão automática
export const knownBluetoothDevices: Record<string, any> = {};

// Mantido para compatibilidade de simulação
let printQueueChain: Promise<any> = Promise.resolve();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retorna o nome do primeiro dispositivo Bluetooth conectado (compatibilidade legada)
 */
export function getConnectedDeviceName(): string | null {
  const activeIds = Object.keys(activeBluetoothConnections);
  if (activeIds.length > 0) {
    const conn = activeBluetoothConnections[activeIds[0]];
    return conn?.device?.name || 'Impressora Bluetooth';
  }
  return null;
}

// Retorna se uma impressora específica está conectada fisicamente
export function isPrinterConnected(printerId: string): boolean {
  return !!activeBluetoothConnections[printerId]?.characteristic;
}

// Retorna o nome do dispositivo de uma impressora específica
export function getConnectedDeviceNameForPrinter(printerId: string): string | null {
  const conn = activeBluetoothConnections[printerId];
  return conn?.device?.name || null;
}

// Comandos ESC/POS básicos
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',
  CUT: GS + 'V' + '\x41' + '\x00', // Cut paper
  TEXT_NORMAL: ESC + '!' + '\x00',
  TEXT_BOLD: ESC + '!' + '\x08',
  TEXT_CENTER: ESC + 'a' + '\x01',
  TEXT_LEFT: ESC + 'a' + '\x00',
  TEXT_DOUBLE: GS + '!' + '\x11', // Double height & width
  TEXT_SMALL: ESC + '!' + '\x01', // Small text
};

/**
 * Conecta na impressora Bluetooth usando o navegador.
 * Deve ser chamado via clique do usuário, passando o ID da impressora que está sendo configurada.
 */
export const connectBluetoothPrinter = async (printerId: string = 'default'): Promise<{ success: boolean; deviceName?: string }> => {
  try {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      alert('Seu navegador não suporta Web Bluetooth. Use o Chrome no Android/PC.');
      return { success: false };
    }

    console.log(`[PrinterService] Solicitando dispositivo Bluetooth com filtro inteligente para #${printerId}...`);
    
    // Filtro inteligente para priorizar a impressora do usuário 'ka1445' e outras impressoras térmicas conhecidas, ocultando ruídos
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { name: 'ka1445' },
        { name: 'KA1445' },
        { namePrefix: 'ka' },
        { namePrefix: 'KA' },
        { namePrefix: '1445' },
        { namePrefix: 'MPT' },
        { namePrefix: 'POS' },
        { namePrefix: 'RT' },
        { namePrefix: 'RP' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'Printer' }
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });

    if (!device || !device.gatt) return { success: false };

    console.log('Conectando ao servidor GATT...');
    const server = await device.gatt.connect();

    console.log('Obtendo serviço de impressão...');
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');

    console.log('Obtendo característica de escrita...');
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    // Salva a conexão ativa
    activeBluetoothConnections[printerId] = {
      device,
      characteristic
    };

    // Salva no cache de dispositivos conhecidos para reconexão silenciosa
    knownBluetoothDevices[printerId] = device;

    const deviceName = device.name || 'Impressora Bluetooth';
    console.log(`Impressora ${deviceName} conectada com id ${printerId}!`);

    device.addEventListener('gattserverdisconnected', () => {
      console.log(`Impressora ${deviceName} (${printerId}) desconectada!`);
      delete activeBluetoothConnections[printerId];
      // Nota: Mantemos no knownBluetoothDevices para permitir reconexão automática
    });

    return { success: true, deviceName };
  } catch (error: any) {
    console.error('Erro ao conectar Bluetooth:', error);
    const isUserCancelled = error.name === 'NotFoundError' || error.message?.includes('cancelled');
    if (!isUserCancelled) {
      alert('Erro ao conectar: ' + (error.message || error));
    }
    return { success: false };
  }
};

/**
 * Converte strings para Uint8Array (bytes) com encoding simples
 */
const encode = (data: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(data);
};

/**
 * Remove acentos básicos para garantir compatibilidade com impressoras chinesas simples
 */
const removeAccents = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Formata o pedido em comandos ESC/POS binários
 */
const generateEscPosData = (
  pedido: PrintOrderData, 
  restaurantName: string,
  larguraBobina: '58mm' | '80mm' = '80mm'
): Uint8Array => {
  const parts: Uint8Array[] = [];
  const add = (str: string) => parts.push(encode(str));
  const addCmd = (cmd: string) => parts.push(encode(cmd));

  const lineCharCount = larguraBobina === '58mm' ? 32 : 42; // Usar 42 caracteres para bobina 80mm (ESC/POS Epson standard)
  const lineStr = '-'.repeat(lineCharCount) + '\n';

  // Reset
  addCmd(COMMANDS.INIT);

  // Cabeçalho
  addCmd(COMMANDS.TEXT_CENTER);
  addCmd(COMMANDS.TEXT_DOUBLE);
  add(removeAccents(restaurantName).toUpperCase() + '\n');
  addCmd(COMMANDS.TEXT_NORMAL);
  add(new Date(pedido.created_at).toLocaleString('pt-BR') + '\n');
  add(lineStr);

  // Mesa e Pedido (ou Conta)
  addCmd(COMMANDS.TEXT_BOLD);
  addCmd(COMMANDS.TEXT_DOUBLE);

  const isConta = pedido.descricao === 'Fechamento de Conta' || pedido.descricao === 'Simulação de Conta' || (pedido.descricao?.includes('Conta') && !pedido.id.toString().startsWith('AutoF'));

  if (isConta) {
    add(`CONTA MESA ${pedido.mesa}\n`);
    if (pedido.clienteNome) {
      addCmd(COMMANDS.TEXT_NORMAL);
      add(`${removeAccents(pedido.clienteNome)}\n`);
    }
  } else {
    // Pedido normal de itens
    add(`MESA ${pedido.mesa}\n`);
    addCmd(COMMANDS.TEXT_NORMAL);
    add(`Pedido #${pedido.id}\n`);
    if (pedido.clienteNome) {
      add(`Cliente: ${removeAccents(pedido.clienteNome)}\n`);
    }
  }
  add(lineStr);

  // Itens
  addCmd(COMMANDS.TEXT_LEFT);
  addCmd(COMMANDS.TEXT_BOLD);
  add('ITENS:\n');
  addCmd(COMMANDS.TEXT_NORMAL);

  pedido.itens.forEach(item => {
    const nome = removeAccents(item.nome);
    const qtd = item.quantidade;
    const totalItem = item.preco * qtd;

    // Linha 1: Qtd x Nome
    add(`${qtd}x ${nome}\n`);

    // Descrição/Observação do item (se houver no item ou no pedido único) - exibido logo abaixo do produto
    const itemObs = item.descricao || (pedido.itens.length === 1 && pedido.descricao && !isConta ? pedido.descricao : '');
    if (itemObs) {
      add(`   (${removeAccents(itemObs)})\n`);
    }

    // Renderiza preços apenas se for Fechamento de Conta / Simulação
    if (isConta) {
      const unitPriceStr = item.preco.toFixed(2).replace('.', ',');
      const totalPriceStr = totalItem.toFixed(2).replace('.', ',');

      if (qtd > 1) {
        add(`   Preco: ${unitPriceStr} | Sub: ${totalPriceStr}\n\n`);
      } else {
        add(`   Subtotal: R$ ${totalPriceStr}\n\n`);
      }
    } else {
      add('\n');
    }
  });

  add(lineStr);

  // Totais (Apenas se for Fechamento de Conta ou tiver totais calculados)
  if (pedido.subtotal !== undefined && pedido.totalWithFee !== undefined) {
    addCmd(COMMANDS.TEXT_LEFT);

    // Subtotal
    add(`Subtotal: R$ ${pedido.subtotal.toFixed(2).replace('.', ',')}\n`);

    // Couvert Artístico
    if (pedido.couvert && pedido.couvert > 0) {
      add(`Couvert Artistico: R$ ${pedido.couvert.toFixed(2).replace('.', ',')}\n`);
    }

    // Taxa de Serviço
    if (pedido.serviceFeePercentage && pedido.serviceFeePercentage > 0) {
      add(`Servico (${pedido.serviceFeePercentage}%): R$ ${(pedido.serviceFee || 0).toFixed(2).replace('.', ',')}\n`);
      add('\n');
      add(lineStr);
      // TOTAL COM TAXA (Em destaque)
      addCmd(COMMANDS.TEXT_CENTER);
      addCmd(COMMANDS.TEXT_DOUBLE);
      addCmd(COMMANDS.TEXT_BOLD);
      add(`TOTAL: R$ ${pedido.totalWithFee.toFixed(2).replace('.', ',')}\n`);
      addCmd(COMMANDS.TEXT_NORMAL);
      addCmd(COMMANDS.TEXT_LEFT); // Reset alignment
      add(lineStr);

      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.totalWithFee / pedido.divisoes;
        addCmd(COMMANDS.TEXT_CENTER);
        addCmd(COMMANDS.TEXT_BOLD);
        add(`Dividido por ${pedido.divisoes}:\n`);
        add(`R$ ${valorDividido.toFixed(2).replace('.', ',')} por pessoa\n`);
        addCmd(COMMANDS.TEXT_NORMAL);
        addCmd(COMMANDS.TEXT_LEFT);
        add(lineStr);
      }

      add('\n');
      // TOTAL SEM TAXA (Opção para o cliente)
      const totalSemTaxa = pedido.subtotal + (pedido.couvert || 0);
      add(`(Total s/ taxa: R$ ${totalSemTaxa.toFixed(2).replace('.', ',')})\n`);
    } else {
      // Sem taxa
      add(lineStr);
      addCmd(COMMANDS.TEXT_CENTER);
      addCmd(COMMANDS.TEXT_DOUBLE);
      addCmd(COMMANDS.TEXT_BOLD);
      add(`TOTAL: R$ ${pedido.totalWithFee.toFixed(2).replace('.', ',')}\n`);
      addCmd(COMMANDS.TEXT_NORMAL);
      addCmd(COMMANDS.TEXT_LEFT); // Reset alignment
      add(lineStr);

      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.totalWithFee / pedido.divisoes;
        addCmd(COMMANDS.TEXT_CENTER);
        addCmd(COMMANDS.TEXT_BOLD);
        add(`Dividido por ${pedido.divisoes}:\n`);
        add(`R$ ${valorDividido.toFixed(2).replace('.', ',')} por pessoa\n`);
        addCmd(COMMANDS.TEXT_NORMAL);
        addCmd(COMMANDS.TEXT_LEFT);
        add(lineStr);
      }
    }

  } else if (isConta) {
    // Fallback para pedidos simples (parciais) apenas se for Conta
    add(lineStr);
    addCmd(COMMANDS.TEXT_CENTER);
    addCmd(COMMANDS.TEXT_DOUBLE);
    addCmd(COMMANDS.TEXT_BOLD);
    add(`TOTAL: R$ ${pedido.total.toFixed(2).replace('.', ',')}\n`);
    addCmd(COMMANDS.TEXT_NORMAL);
    addCmd(COMMANDS.TEXT_LEFT); // Reset alignment
    add(lineStr);

    if (pedido.divisoes && pedido.divisoes > 1) {
      const valorDividido = pedido.total / pedido.divisoes;
      addCmd(COMMANDS.TEXT_CENTER);
      addCmd(COMMANDS.TEXT_BOLD);
      add(`Dividido por ${pedido.divisoes}:\n`);
      add(`R$ ${valorDividido.toFixed(2).replace('.', ',')} por pessoa\n`);
      addCmd(COMMANDS.TEXT_NORMAL);
      addCmd(COMMANDS.TEXT_LEFT);
      add(lineStr);
    }
  }

  // Observações Gerais (imprime se for pedido com múltiplos itens e não tiver sido impresso no item único)
  const isSingleItemObsPrinted = pedido.itens.length === 1 && !isConta && (pedido.itens[0]?.descricao || pedido.descricao);
  if (pedido.descricao && !isConta && pedido.descricao !== 'Fechamento de Conta' && !isSingleItemObsPrinted) {
    add('\nOBS: ' + removeAccents(pedido.descricao) + '\n');
  }

  // Rodapé
  add('\n\n');
  addCmd(COMMANDS.TEXT_CENTER);
  add('Obrigado pela preferencia!\n');
  add('Sistema PedeAi\n\n\n\n');

  // Cortar papel
  addCmd(COMMANDS.CUT);

  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach(part => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
};

/**
 * Imprime via Web Bluetooth (Nativo) - Permite especificar o ID da impressora
 */
export const printViaWebBluetooth = async (
  pedido: PrintOrderData, 
  restaurantName: string = 'PedeAí', 
  printerId: string = 'default',
  larguraBobina: '58mm' | '80mm' = '80mm'
) => {
  // Procura a conexão ativa correspondente
  let conn = activeBluetoothConnections[printerId];

  // Caso não exista conexão ativa, tenta pegar a primeira conexão ativa existente como fallback
  if (!conn) {
    const activeIds = Object.keys(activeBluetoothConnections);
    if (activeIds.length > 0) {
      conn = activeBluetoothConnections[activeIds[0]];
    }
  }

  // Se não temos conexão ativa, mas o dispositivo foi pareado anteriormente nesta sessão, reconecta silenciosamente
  if ((!conn || !conn.characteristic) && knownBluetoothDevices[printerId]) {
    const cachedDevice = knownBluetoothDevices[printerId];
    console.log(`[PrinterService] Impressora Bluetooth inativa, reconectando silenciosamente a: ${cachedDevice.name || 'Impressora'}`);
    try {
      if (!cachedDevice.gatt.connected) {
        await cachedDevice.gatt.connect();
      }
      const service = await cachedDevice.gatt.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      conn = { device: cachedDevice, characteristic };
      activeBluetoothConnections[printerId] = conn;
      console.log('[PrinterService] Reconexão automática realizada com sucesso!');
    } catch (reconnectErr) {
      console.error('[PrinterService] Erro ao reconectar silenciosamente via cache:', reconnectErr);
    }
  }

  // Se ainda não temos a conexão, tenta buscar entre os dispositivos autorizados pelo navegador
  const nav = navigator as any;
  if ((!conn || !conn.characteristic) && nav.bluetooth && nav.bluetooth.getDevices) {
    try {
      const devices = await nav.bluetooth.getDevices();
      // Filtra dispositivo correspondente (por nome ou ID)
      const matchedDevice = devices.find((d: any) => 
        d.name?.toLowerCase().includes('ka1445') || 
        d.name?.toLowerCase().includes('1445') ||
        d.name?.toLowerCase().includes('mpt') || 
        d.name?.toLowerCase().includes('pos')
      );
      
      if (matchedDevice) {
        console.log(`[PrinterService] Reconectando silenciosamente a dispositivo pré-autorizado: ${matchedDevice.name}`);
        if (!matchedDevice.gatt.connected) {
          await matchedDevice.gatt.connect();
        }
        const service = await matchedDevice.gatt.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        
        conn = { device: matchedDevice, characteristic };
        activeBluetoothConnections[printerId] = conn;
        knownBluetoothDevices[printerId] = matchedDevice;
        console.log('[PrinterService] Reconectado com sucesso via API getDevices!');
      }
    } catch (getDevicesErr) {
      console.warn('[PrinterService] Erro ao obter dispositivos pré-autorizados do navegador:', getDevicesErr);
    }
  }

  if (!conn || !conn.characteristic) {
    console.warn(`[PrinterService] Nenhuma impressora pareada ou conectada sob o id: "${printerId}"`);
    return false;
  }

  // Garantir execução sequencial atômica da fila de impressão (Mutex Lock)
  return new Promise<boolean>((resolve) => {
    printQueueChain = printQueueChain.then(async () => {
      try {
        const data = generateEscPosData(pedido, restaurantName, larguraBobina);
        const CHUNK_SIZE = 128; // Reduzido de 200 para 128 bytes para evitar estouro de buffer Bluetooth
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          await conn.characteristic.writeValue(chunk);
          await sleep(60);
        }
        // Delay térmico entre cupons para o corte e avanço do papel
        await sleep(300);
        resolve(true);
      } catch (error) {
        console.error(`Erro ao escrever na impressora #${printerId}:`, error);
        delete activeBluetoothConnections[printerId];
        resolve(false);
      }
    });
  });
};

/**
 * Legado: Imprime via RawBT App (HTTP POST)
 */
export const printToRawBT = async (content: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(RAWBT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Falha ao conectar com RawBT:', error);
    return false;
  }
};

/**
 * Imprime via RawBT Deep Link
 */
export const printViaDeepLink = (content: string) => {
  const base64 = btoa(unescape(encodeURIComponent(content)));
  window.location.href = `rawbt:base64,${base64}`;
  return true;
};

/**
 * Gera a versão texto legível do cupom (para RawBT e outros canais texto)
 */
export const generateTextCupom = (
  pedido: PrintOrderData, 
  restaurantName: string,
  larguraBobina: '58mm' | '80mm' = '80mm'
): string => {
  const isConta = pedido.descricao === 'Fechamento de Conta' || pedido.descricao === 'Simulação de Conta' || (pedido.descricao?.includes('Conta') && !pedido.id.toString().startsWith('AutoF'));
  
  const lineCharCount = larguraBobina === '58mm' ? 32 : 48;
  const lineStr = '-'.repeat(lineCharCount) + '\n';

  let out = "";
  out += `${removeAccents(restaurantName).toUpperCase()}\n`;
  out += `${new Date(pedido.created_at).toLocaleString('pt-BR')}\n`;
  out += lineStr;
  
  if (isConta) {
    out += `CONTA MESA ${pedido.mesa}\n`;
    if (pedido.clienteNome) out += `${removeAccents(pedido.clienteNome)}\n`;
  } else {
    out += `MESA ${pedido.mesa}\n`;
    out += `Pedido #${pedido.id}\n`;
    if (pedido.clienteNome) out += `Cliente: ${removeAccents(pedido.clienteNome)}\n`;
  }
  out += lineStr;
  out += `ITENS:\n`;
  
  pedido.itens.forEach(item => {
    out += `${item.quantidade}x ${removeAccents(item.nome)}\n`;
    const itemObs = item.descricao || (pedido.itens.length === 1 && pedido.descricao && !isConta ? pedido.descricao : '');
    if (itemObs) {
      out += `   (${removeAccents(itemObs)})\n`;
    }
    if (isConta) {
      const totalItem = item.preco * item.quantidade;
      out += `   Preco: R$ ${item.preco.toFixed(2)} | Sub: R$ ${totalItem.toFixed(2)}\n`;
    }
  });
  out += lineStr;
  
  if (pedido.subtotal !== undefined && pedido.totalWithFee !== undefined) {
    out += `Subtotal: R$ ${pedido.subtotal.toFixed(2)}\n`;
    if (pedido.couvert && pedido.couvert > 0) {
      out += `Couvert Artistico: R$ ${pedido.couvert.toFixed(2)}\n`;
    }
    if (pedido.serviceFeePercentage && pedido.serviceFeePercentage > 0) {
      out += `Servico (${pedido.serviceFeePercentage}%): R$ ${(pedido.serviceFee || 0).toFixed(2)}\n`;
      out += lineStr;
      out += `TOTAL: R$ ${pedido.totalWithFee.toFixed(2)}\n`;
      out += lineStr;
      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.totalWithFee / pedido.divisoes;
        out += `Dividido por ${pedido.divisoes}: R$ ${valorDividido.toFixed(2)} p/ pessoa\n`;
        out += lineStr;
      }
      const totalSemTaxa = pedido.subtotal + (pedido.couvert || 0);
      out += `(Total s/ taxa: R$ ${totalSemTaxa.toFixed(2)})\n`;
    } else {
      out += `TOTAL: R$ ${pedido.totalWithFee.toFixed(2)}\n`;
      out += lineStr;
      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.totalWithFee / pedido.divisoes;
        out += `Dividido por ${pedido.divisoes}: R$ ${valorDividido.toFixed(2)} p/ pessoa\n`;
        out += lineStr;
      }
    }
  } else if (isConta) {
    out += `TOTAL: R$ ${pedido.total.toFixed(2)}\n`;
    out += lineStr;
    if (pedido.divisoes && pedido.divisoes > 1) {
      const valorDividido = pedido.total / pedido.divisoes;
      out += `Dividido por ${pedido.divisoes}: R$ ${valorDividido.toFixed(2)} p/ pessoa\n`;
      out += lineStr;
    }
  }
  
  const isSingleItemObsPrintedText = pedido.itens.length === 1 && !isConta && (pedido.itens[0]?.descricao || pedido.descricao);
  if (pedido.descricao && !isConta && pedido.descricao !== 'Fechamento de Conta' && !isSingleItemObsPrintedText) {
    out += `\nOBS: ${removeAccents(pedido.descricao)}\n`;
  }
  
  out += `\nObrigado pela preferencia!\n`;
  out += `Sistema PedeAi\n\n\n\n`;
  return out;
};

/**
 * Imprime via diálogo nativo do navegador (impressoras instaladas no PC/Windows/Mac)
 * Usa um iframe oculto com layout térmico 80mm para não imprimir o painel inteiro
 */
export const printViaBrowser = (
  pedido: PrintOrderData, 
  restaurantName: string,
  printer?: { larguraBobina?: '58mm' | '80mm' }
): boolean => {
  try {
    const isConta = pedido.descricao === 'Fechamento de Conta' || pedido.descricao === 'Simulação de Conta';
    const dataStr = new Date(pedido.created_at).toLocaleString('pt-BR');
    
    // Obter o tamanho e estilização corretos da bobina
    const largura = printer?.larguraBobina === '58mm' ? '58mm' : '80mm';
    const padding = printer?.larguraBobina === '58mm' ? '1mm 2mm' : '3mm 4mm';
    const fontSize = printer?.larguraBobina === '58mm' ? '11px' : '12px';

    const itensHtml = pedido.itens.map(item => {
      const sub = isConta ? `<br><small style="margin-left:12px;">R$ ${item.preco.toFixed(2)} × ${item.quantidade} = R$ ${(item.preco * item.quantidade).toFixed(2)}</small>` : '';
      const itemObs = item.descricao || (pedido.itens.length === 1 && pedido.descricao && !isConta ? pedido.descricao : '');
      const obs = itemObs ? `<br><small style="margin-left:12px;color:#333;font-weight:bold;">(${itemObs})</small>` : '';
      return `<tr>
        <td style="padding:2px 0;vertical-align:top;">${item.quantidade}x</td>
        <td style="padding:2px 4px;width:100%;">${item.nome}${obs}${sub}</td>
      </tr>`;
    }).join('');

    let totalHtml = '';
    if (pedido.subtotal !== undefined && pedido.totalWithFee !== undefined) {
      totalHtml += `<tr><td colspan="2"><hr style="border:none;border-top:1px dashed #000;margin:4px 0"></td></tr>`;
      if (pedido.serviceFeePercentage && pedido.serviceFeePercentage > 0) {
        totalHtml += `<tr><td colspan="2" style="text-align:right;">Subtotal: R$ ${pedido.subtotal.toFixed(2)}</td></tr>`;
        if (pedido.couvert && pedido.couvert > 0) {
          totalHtml += `<tr><td colspan="2" style="text-align:right;">Couvert Artístico: R$ ${pedido.couvert.toFixed(2)}</td></tr>`;
        }
        totalHtml += `<tr><td colspan="2" style="text-align:right;">Serviço (${pedido.serviceFeePercentage}%): R$ ${(pedido.serviceFee || 0).toFixed(2)}</td></tr>`;
        totalHtml += `<tr><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.1em;">TOTAL: R$ ${pedido.totalWithFee.toFixed(2)}</td></tr>`;
      } else {
        if (pedido.couvert && pedido.couvert > 0) {
          totalHtml += `<tr><td colspan="2" style="text-align:right;">Subtotal: R$ ${pedido.subtotal.toFixed(2)}</td></tr>`;
          totalHtml += `<tr><td colspan="2" style="text-align:right;">Couvert Artístico: R$ ${pedido.couvert.toFixed(2)}</td></tr>`;
        }
        totalHtml += `<tr><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.1em;">TOTAL: R$ ${pedido.totalWithFee.toFixed(2)}</td></tr>`;
      }
      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.totalWithFee / pedido.divisoes;
        totalHtml += `<tr><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.0em;padding-top:4px;">Dividido por ${pedido.divisoes}: R$ ${valorDividido.toFixed(2)} por pessoa</td></tr>`;
      }
    } else if (isConta) {
      totalHtml += `<tr><td colspan="2"><hr style="border:none;border-top:1px dashed #000;margin:4px 0"></td></tr>`;
      totalHtml += `<tr><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.1em;">TOTAL: R$ ${pedido.total.toFixed(2)}</td></tr>`;
      if (pedido.divisoes && pedido.divisoes > 1) {
        const valorDividido = pedido.total / pedido.divisoes;
        totalHtml += `<tr><td colspan="2" style="text-align:right;font-weight:bold;font-size:1.0em;padding-top:4px;">Dividido por ${pedido.divisoes}: R$ ${valorDividido.toFixed(2)} por pessoa</td></tr>`;
      }
    }

    const isSingleItemObsPrintedHtml = pedido.itens.length === 1 && !isConta && (pedido.itens[0]?.descricao || pedido.descricao);
    const obsHtml = (pedido.descricao && !isConta && !isSingleItemObsPrintedHtml)
      ? `<p style="margin:6px 0;font-size:0.85em;">OBS: ${pedido.descricao}</p>`
      : '';

    const mesaLabel = isConta ? `CONTA — MESA ${pedido.mesa}` : `MESA ${pedido.mesa} — Pedido #${pedido.id}`;
    const clienteHtml = pedido.clienteNome ? `<div style="font-size:0.85em;">${pedido.clienteNome}</div>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'Courier New', monospace; 
    font-size: ${fontSize}; 
    width: ${largura}; 
    padding: ${padding}; 
    color: #000; 
  }
  h1 { font-size: 1.1em; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
  .sub { font-size: 0.8em; text-align: center; color: #333; margin-bottom: 4px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { font-size: 0.85em; vertical-align: top; }
  .footer { text-align: center; font-size: 0.75em; margin-top: 8px; color: #555; }
  @media print { 
    @page { 
      margin: 0; 
      size: ${largura} auto; 
    } 
  }
</style>
</head>
<body>
  <h1>${restaurantName}</h1>
  <div class="sub">${dataStr}</div>
  <hr>
  <div style="font-weight:bold;text-align:center;">${mesaLabel}</div>
  ${clienteHtml}
  <hr>
  <table>${itensHtml}${totalHtml}</table>
  ${obsHtml}
  <div class="footer">Obrigado pela preferência!<br>Sistema PedeAí</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);

    return true;
  } catch (err) {
    console.error('[PrinterService] Erro ao imprimir via navegador:', err);
    return false;
  }
};

const PRINT_AGENT_URL = import.meta.env.VITE_PRINT_AGENT_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Trata envio para Impressoras de Rede (TCP/IP) ou USB:
 * Tenta enviar via Agente Local/Remoto de Impressão (Node.js).
 * Não abre a janela do navegador em conexões TCP/USB para evitar popups.
 */
const printViaTcpOrUsb = async (
  pedido: PrintOrderData, 
  restaurantName: string, 
  printer: { ipAddress?: string; port?: number; usbPath?: string; connectionType?: string; type?: string; name?: string; larguraBobina?: '58mm' | '80mm' }
): Promise<boolean> => {
  try {
    const agentUrl = PRINT_AGENT_URL.replace(/\/$/, '');
    const res = await fetch(`${agentUrl}/api/test-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: printer.connectionType || 'tcp',
        host: printer.ipAddress || '192.168.1.169',
        port: printer.port || 9100,
        usb: printer.usbPath || '',
        station: printer.type || 'kitchen',
        pedido
      }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) return true;
  } catch {
    // Agente de impressão indisponível
  }

  // Retorna false em conexões TCP/USB para NÃO abrir a janela de diálogo do Chrome
  return false;
};

/**
 * Função roteadora universal de impressão para qualquer canal configurado
 * (Bluetooth, RawBT App, RawBT Deep Link, Rede TCP, USB ou Impressora do PC/Sistema)
 */
export const printToDevice = async (
  pedido: PrintOrderData,
  restaurantName: string,
  printer: { 
    id: string; 
    name?: string;
    connectionType?: 'bluetooth' | 'rawbt' | 'deeplink' | 'browser' | 'tcp' | 'usb'; 
    ipAddress?: string;
    port?: number;
    usbPath?: string;
    larguraBobina?: '58mm' | '80mm';
    type?: string;
  }
): Promise<boolean> => {
  const type = printer.connectionType || 'bluetooth';
  const isConta = pedido.descricao === 'Fechamento de Conta' || pedido.descricao === 'Simulação de Conta' || (pedido.descricao?.includes('Conta') && !pedido.id.toString().startsWith('AutoF'));

  // Para pedidos de produção (!isConta): IMPRIME 1 CUPOM SEPARADO PARA CADA PRODUTO COM CORTE INDIVIDUAL
  if (!isConta && pedido.itens && pedido.itens.length > 0) {
    let allSuccess = true;
    for (let index = 0; index < pedido.itens.length; index++) {
      const item = pedido.itens[index];
      // A observação pertence ao item individual ou é a observação do pedido único
      const itemDesc = item.descricao || (pedido.itens.length === 1 ? pedido.descricao : (pedido.descricao && index === 0 ? pedido.descricao : ''));
      const singleItemOrder: PrintOrderData = {
        ...pedido,
        itens: [{ ...item, descricao: itemDesc }],
        descricao: itemDesc || undefined,
      };

      let success = false;
      if (type === 'bluetooth') {
        success = await printViaWebBluetooth(singleItemOrder, restaurantName, printer.id, printer.larguraBobina);
      } else if (type === 'rawbt') {
        const textContent = generateTextCupom(singleItemOrder, restaurantName, printer.larguraBobina);
        success = await printToRawBT(textContent);
      } else if (type === 'deeplink') {
        const textContent = generateTextCupom(singleItemOrder, restaurantName, printer.larguraBobina);
        success = printViaDeepLink(textContent);
      } else if (type === 'browser') {
        success = printViaBrowser(singleItemOrder, restaurantName, printer);
      } else if (type === 'tcp' || type === 'usb') {
        success = await printViaTcpOrUsb(singleItemOrder, restaurantName, printer);
      }

      if (!success) allSuccess = false;

      // Pequena pausa entre transmissões bluetooth de cupons individuais para a impressora realizar o corte e processar
      if (pedido.itens.length > 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
    return allSuccess;
  }

  // Para fechamento de conta / mesa, imprime cupom consolidado único
  if (type === 'bluetooth') {
    return printViaWebBluetooth(pedido, restaurantName, printer.id, printer.larguraBobina);
  }

  if (type === 'rawbt') {
    const textContent = generateTextCupom(pedido, restaurantName, printer.larguraBobina);
    return printToRawBT(textContent);
  }

  if (type === 'deeplink') {
    const textContent = generateTextCupom(pedido, restaurantName, printer.larguraBobina);
    return printViaDeepLink(textContent);
  }

  if (type === 'browser') {
    return printViaBrowser(pedido, restaurantName, printer);
  }

  if (type === 'tcp' || type === 'usb') {
    return printViaTcpOrUsb(pedido, restaurantName, printer);
  }

  return false;
};
