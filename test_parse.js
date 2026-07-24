const parseMesaNumber = (mesa) => {
    const raw = (mesa ?? '').toString().trim();
    if (!raw) return 0;
    const match = raw.match(/\d+/);
    if (!match) return 0;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : 0;
};

const normalizePedidoStatus = (status) => {
    return (status ?? 'pendente').toString().trim().toLowerCase();
};

const parsePedido = (pedido) => {
    console.log(`[parsePedido] ID: ${pedido.id}, Itens raw: "${pedido.itens}", Qtd raw: "${pedido.quantidade}", Subtotal: "${pedido.Subtotal}"`);
    const productName = pedido.itens || '';
    const quantity = parseInt(pedido.quantidade || '1', 10) || 1;
    let total = 0;
    if (pedido.Subtotal) {
        const cleanSubtotal = pedido.Subtotal.replace('R$', '').replace(',', '.').trim();
        total = parseFloat(cleanSubtotal) || 0;
    }
    const unitPrice = quantity > 0 ? total / quantity : 0;
    const rawItems = productName ? productName.split(',').map(s => s.trim()).filter(Boolean) : [];
    const itemCounts = {};
    rawItems.forEach(name => {
        itemCounts[name] = (itemCounts[name] || 0) + 1;
    });
    const uniqueItemNames = Object.keys(itemCounts);
    const itens = Object.entries(itemCounts).map(([nome, qtd]) => {
        let finalQtd = qtd;
        console.log(`Processing item ${nome}, Initial qtd: ${qtd}, uniqueItemNames.length: ${uniqueItemNames.length}, quantity: ${quantity}`);
        if (uniqueItemNames.length === 1 && quantity > 1) {
            finalQtd = quantity;
            console.log(`Setting finalQtd to ${quantity} for ${nome}`);
        }
        return {
            nome,
            quantidade: finalQtd,
            preco: unitPrice
        };
    });
    return { id: pedido.id, itens, quantity, total, unitPrice };
};

const testPedido = {
    id: 87,
    mesa: '13',
    itens: 'Suco Natural 500 ml',
    quantidade: '4',
    Subtotal: '32,00',
    status: 'pendente',
    restaurante_id: 'test',
    descricao: '4 copos',
    created_at: new Date().toISOString()
};

console.dir(parsePedido(testPedido), { depth: null });
