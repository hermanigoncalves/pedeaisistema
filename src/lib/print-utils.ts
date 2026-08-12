import { ParsedPedido } from '@/hooks/usePedidos';

/**
 * Gera o HTML formatado para impressão térmica (bobina 58mm ou 80mm)
 */
export const generatePrintHTML = (
  pedido: ParsedPedido, 
  restaurantName: string = 'PedeAí',
  larguraBobina: '58mm' | '80mm' = '80mm'
) => {
  const dateStr = new Date(pedido.created_at).toLocaleString('pt-BR');
  
  const largura = larguraBobina === '58mm' ? '58mm' : '80mm';
  const padding = larguraBobina === '58mm' ? '2mm 3mm' : '5px';
  const fontSize = larguraBobina === '58mm' ? '11px' : '12px';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: ${fontSize};
          width: ${largura};
          padding: ${padding};
          color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .item { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .total { display: flex; justify-content: space-between; margin-top: 5px; font-size: 14px; font-weight: bold; }
        .obs { font-style: italic; margin-top: 5px; font-size: 10px; }
        @media print {
          @page { 
            margin: 0; 
            size: ${largura} auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="center bold" style="font-size: 16px;">${restaurantName}</div>
      <div class="center">${dateStr}</div>
      <div class="divider"></div>
      
      <div class="center bold" style="font-size: 14px;">MESA ${pedido.mesa}</div>
      <div class="center">Pedido #${pedido.id}</div>
      <div class="divider"></div>
      
      <div class="bold">ITENS:</div>
      ${pedido.itens.map(item => `
        <div class="item">
          <span>${item.quantidade}x ${item.nome}</span>
          ${(pedido.descricao?.includes('Conta')) ? `<span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span>` : ''}
        </div>
      `).join('')}
      
      ${(pedido.descricao?.includes('Conta')) ? `
        <div class="divider"></div>
        <div class="total">
          <span>TOTAL</span>
          <span>R$ ${pedido.total.toFixed(2)}</span>
        </div>
      ` : ''}
      
      ${pedido.descricao ? `
        <div class="divider"></div>
        <div class="obs">
          <span class="bold">OBS:</span> ${pedido.descricao}
        </div>
      ` : ''}
      
      <div class="divider"></div>
      <div class="center" style="margin-top: 10px; font-size: 10px;">
        Obrigado pela preferência!
      </div>
      
      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `;
};

/**
 * Dispara a impressão de um pedido de forma "silenciosa" (sem abrir novas abas)
 */
export const printOrder = (
  pedido: ParsedPedido, 
  restaurantName: string = 'PedeAí',
  larguraBobina: '58mm' | '80mm' = '80mm'
) => {
  const html = generatePrintHTML(pedido, restaurantName, larguraBobina);

  // Tenta encontrar ou criar um iframe oculto para impressão
  let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
};
