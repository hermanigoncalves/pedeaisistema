import { ParsedPedido } from "./src/hooks/usePedidos"; // Wait, I can't easily import the un-exported `parsePedido`! 

const parsePedidoTest = (pedido: any) => {
  const productName = pedido.itens || '';
  const quantity = parseInt(pedido.quantidade || '1', 10) || 1;
  
  let total = 0;
  if (pedido.Subtotal) {
    const cleanSubtotal = pedido.Subtotal.replace('R$', '').replace(',', '.').trim();
    total = parseFloat(cleanSubtotal) || 0;
  }

  const rawItems = productName ? productName.split(',').map(s => s.trim()).filter(Boolean) : [];

  const itemCounts: Record<string, number> = {};
  rawItems.forEach(name => {
    itemCounts[name] = (itemCounts[name] || 0) + 1;
  });

  const uniqueItemNames = Object.keys(itemCounts);
  
  const totalParsedItems = rawItems.length;
  const unitPrice = totalParsedItems > 0 ? total / totalParsedItems : 0;

  const itens = Object.entries(itemCounts).map(([nome, qtd]) => {
    let finalQtd = qtd;
    if (uniqueItemNames.length === 1 && quantity > 1 && totalParsedItems === 1) { 
      finalQtd = quantity;
    }
    return {
      nome,
      quantidade: finalQtd,
      preco: unitPrice
    };
  });

  return { quantity, total, items: itens, rawItemsCount: totalParsedItems, originalQuantity: pedido.quantidade };
};

console.log("TEST 1: 1 Coca, 6 Copos (Bot format)");
let res = parsePedidoTest({
  itens: "Coca Cola, copo, copo, copo, copo, copo, copo",
  quantidade: "1",
  Subtotal: "15,00"
});
console.log(res);

console.log("\nTEST 2: Multiple same item parsing (like 2x Burger)");
res = parsePedidoTest({
  itens: "Burger, Burger",
  quantidade: "2",
  Subtotal: "30,00"
});
console.log(res);

console.log("\nTEST 3: Legacy simple 1 item");
res = parsePedidoTest({
  itens: "Pizza",
  quantidade: "1",
  Subtotal: "50,00"
});
console.log(res);

console.log("\nTEST 4: Frontend JSON Format fallback logic bypass - tested inside src instead");

