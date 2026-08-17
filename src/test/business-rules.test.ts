import { describe, it, expect } from "vitest";
import { isSystemMarkerItem, filterSystemItems } from "@/lib/utils";

describe("Regras de Negócio - Marcadores de Sistema", () => {
  it("deve identificar corretamente marcadores de sistema que não devem ser impressos ou somados como consumo", () => {
    expect(isSystemMarkerItem("Atendimento Iniciado")).toBe(true);
    expect(isSystemMarkerItem("Mesa aberta")).toBe(true);
    expect(isSystemMarkerItem("MESA ABERTA")).toBe(true);
    expect(isSystemMarkerItem("Chamado de Garçom")).toBe(true);
    expect(isSystemMarkerItem("chamado de garcom")).toBe(true);
    expect(isSystemMarkerItem("Fechamento de Conta")).toBe(true);
    expect(isSystemMarkerItem("fechamento de conta")).toBe(true);
  });

  it("não deve marcar itens reais do cardápio como marcadores de sistema", () => {
    expect(isSystemMarkerItem("Pizza Calabresa")).toBe(false);
    expect(isSystemMarkerItem("Coca-Cola 350ml")).toBe(false);
    expect(isSystemMarkerItem("Hambúrguer Artesanal")).toBe(false);
    expect(isSystemMarkerItem("Cerveja Heineken")).toBe(false);
  });

  it("filterSystemItems deve filtrar corretamente itens de sistema de listas de consumo", () => {
    const rawItems = [
      { productName: "Mesa aberta", price: 0, quantity: 1 },
      { productName: "Pizza Quatro Queijos", price: 60, quantity: 1 },
      { productName: "Chamado de Garçom", price: 0, quantity: 1 },
      { productName: "Suco de Laranja", price: 12, quantity: 2 },
    ];

    const filtered = filterSystemItems(rawItems);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(i => i.productName)).toEqual(["Pizza Quatro Queijos", "Suco de Laranja"]);
  });
});

describe("Regras de Negócio - Cálculo de Contas e Taxas", () => {
  const calculateBill = (
    items: { price: number; quantity: number }[],
    options: {
      serviceFeePercent: number;
      couvertEnabled: boolean;
      couvertValor: number;
      billingMode: "mesa" | "comanda";
      comandasCount: number;
    }
  ) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const serviceFee = options.serviceFeePercent > 0 ? subtotal * (options.serviceFeePercent / 100) : 0;
    
    let couvertTotal = 0;
    if (options.couvertEnabled) {
      couvertTotal = options.billingMode === "comanda"
        ? options.comandasCount * options.couvertValor
        : options.couvertValor;
    }

    const total = subtotal + serviceFee + couvertTotal;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      serviceFee: Number(serviceFee.toFixed(2)),
      couvertTotal: Number(couvertTotal.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  it("deve calcular subtotal e taxa de serviço de 10% com precisão", () => {
    const items = [
      { price: 50.0, quantity: 2 }, // 100.00
      { price: 15.5, quantity: 2 }, // 31.00
    ];

    const bill = calculateBill(items, {
      serviceFeePercent: 10,
      couvertEnabled: false,
      couvertValor: 0,
      billingMode: "mesa",
      comandasCount: 1,
    });

    expect(bill.subtotal).toBe(131.0);
    expect(bill.serviceFee).toBe(13.1);
    expect(bill.total).toBe(144.1);
  });

  it("deve calcular couvert artístico no modo comanda multiplicado pelo número de comandas/clientes", () => {
    const items = [{ price: 40.0, quantity: 1 }];

    const bill = calculateBill(items, {
      serviceFeePercent: 0,
      couvertEnabled: true,
      couvertValor: 10.0,
      billingMode: "comanda",
      comandasCount: 3, // 3 clientes
    });

    expect(bill.subtotal).toBe(40.0);
    expect(bill.couvertTotal).toBe(30.0); // 3 * 10
    expect(bill.total).toBe(70.0);
  });

  it("deve calcular couvert artístico no modo mesa como valor único", () => {
    const items = [{ price: 40.0, quantity: 1 }];

    const bill = calculateBill(items, {
      serviceFeePercent: 0,
      couvertEnabled: true,
      couvertValor: 10.0,
      billingMode: "mesa",
      comandasCount: 3,
    });

    expect(bill.subtotal).toBe(40.0);
    expect(bill.couvertTotal).toBe(10.0); // Valor único por mesa
    expect(bill.total).toBe(50.0);
  });
});

describe("Regras de Negócio - Cobrança de Pizza Meio a Meio", () => {
  const calculatePizzaPrice = (
    precoSabor1: number,
    precoSabor2: number,
    modo: "mais_cara" | "soma_metades"
  ) => {
    if (modo === "mais_cara") {
      return Math.max(precoSabor1, precoSabor2);
    }
    return precoSabor1 / 2 + precoSabor2 / 2;
  };

  it("modo mais_cara deve cobrar pelo sabor de maior valor", () => {
    const preco = calculatePizzaPrice(50.0, 70.0, "mais_cara");
    expect(preco).toBe(70.0);
  });

  it("modo soma_metades deve cobrar a média ponderada / soma das metades", () => {
    const preco = calculatePizzaPrice(50.0, 70.0, "soma_metades");
    expect(preco).toBe(60.0); // 25 + 35 = 60
  });
});

describe("Regras de Negócio - Divisão de Item (Split)", () => {
  const splitOrderItem = (totalItem: number, phones: string[], originalDescricao?: string) => {
    if (phones.length < 2) {
      throw new Error("Divisão requer pelo menos 2 clientes");
    }

    const valorPorCliente = Number((totalItem / phones.length).toFixed(2));
    const divisionMarker = `(÷${phones.length})`;
    const novaDescricao = originalDescricao
      ? `${originalDescricao} ${divisionMarker}`
      : divisionMarker;

    return {
      valorPorCliente,
      novaDescricao,
      totalFracionado: valorPorCliente * phones.length,
    };
  };

  it("deve dividir o item em partes iguais e adicionar marcador de divisão", () => {
    const result = splitOrderItem(60.0, ["5531999999991", "5531999999992", "5531999999993"]);
    expect(result.valorPorCliente).toBe(20.0);
    expect(result.novaDescricao).toBe("(÷3)");
    expect(result.totalFracionado).toBe(60.0);
  });

  it("deve lançar erro ao tentar dividir entre menos de 2 pessoas", () => {
    expect(() => splitOrderItem(50.0, ["5531999999991"])).toThrow("Divisão requer pelo menos 2 clientes");
  });
});
