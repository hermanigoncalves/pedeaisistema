import { useState } from 'react';
import { X, Plus, CreditCard, Search, Minus, Edit2, Trash2, Receipt, Printer, Unlock, Users, Divide } from 'lucide-react';
import { useApp, Table, OrderItem, Comanda, ComandaItem } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { filterSystemItems } from '@/lib/utils';
import { PrinterSimulator } from '@/components/debug/PrinterSimulator';

interface TableDetailModalProps {
  table: Table;
  onClose: () => void;
}

const TableDetailModal: React.FC<TableDetailModalProps> = ({ table, onClose }) => {
  const {
    products, addItemToTable, closeTable, updateTableAlert, tables, settings,
    requestBill, closeComanda, splitItem, unsplitItem, pedidos, macarroes, saboresPizza
  } = useApp();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [itemDescription, setItemDescription] = useState('');
  // Pasta selection states
  const [selectedPastaProduct, setSelectedPastaProduct] = useState<any | null>(null);
  const [pastaSelectionOpen, setPastaSelectionOpen] = useState(false);
  // Pizza flavor assembly states
  const [pizzaAssemblyOpen, setPizzaAssemblyOpen] = useState(false);
  const [pizzaMode, setPizzaMode] = useState<'inteira' | 'meia'>('inteira');
  const [sabor1Id, setSabor1Id] = useState<number | null>(null);
  const [sabor2Id, setSabor2Id] = useState<number | null>(null);
  // Comanda mode states
  const [selectedComandaTelefone, setSelectedComandaTelefone] = useState<string | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitPedidoId, setSplitPedidoId] = useState<number | null>(null);
  const [splitSelectedPhones, setSplitSelectedPhones] = useState<string[]>([]);
  const [confirmCloseComandaOpen, setConfirmCloseComandaOpen] = useState(false);
  const [closingComandaTelefone, setClosingComandaTelefone] = useState<string>('');
  const [closingComandaNome, setClosingComandaNome] = useState<string>('');

  // Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorData, setSimulatorData] = useState<any>(null);

  // Get fresh table data
  const currentTable = tables.find(t => t.id === table.id) || table;
  // Filter out system marker items (like "Atendimento Iniciado")
  const consumption = filterSystemItems(currentTable.consumption || []);
  const subtotal = consumption.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const serviceFee = settings.serviceFee > 0 ? subtotal * (settings.serviceFee / 100) : 0;
  const isComandaMode = settings.billingMode === 'comanda';
  const comandas = currentTable.comandas || [];
  const couvertArtísticoTotal = settings.couvertHabilitado
    ? (isComandaMode ? (comandas.filter(c => c.telefone !== 'mesa').length * settings.couvertValor) : settings.couvertValor)
    : 0;
  const total = subtotal + serviceFee + couvertArtísticoTotal;

  const activeSabores = saboresPizza.filter(s => s.ativo);
  const hasPizzaFlavors = activeSabores.length > 0;

  const baseFilteredProducts = products.filter(p =>
    p.isActive && (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredProducts = [...baseFilteredProducts];

  if (hasPizzaFlavors && (searchQuery === '' || 'pizza'.includes(searchQuery.toLowerCase()) || 'montar'.includes(searchQuery.toLowerCase()))) {
    filteredProducts.unshift({
      id: 'pizza-virtual-builder',
      name: '🍕 Pizza (Montar)',
      price: 0,
      category: 'Pizza',
      station: 'kitchen',
      isActive: true,
      stock: 999
    } as any);
  }

  const executeAddItem = (product: typeof products[0], macarraoNome?: string) => {
    const desc = [
      itemDescription.trim(),
      macarraoNome ? `Massa: ${macarraoNome}` : ''
    ].filter(Boolean).join(' - ');

    const item: OrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      price: product.price,
      description: desc || undefined,
    };
    // In comanda mode, if a comanda is selected, add with usuario_telefone
    // The addItemToTable already creates a Pedido — we need to pass telefone
    addItemToTable(currentTable.id, item, isComandaMode ? selectedComandaTelefone || undefined : undefined);
    setIsAddingItem(false);
    setSearchQuery('');
    setItemDescription('');
    setSelectedComandaTelefone(null);
    setSelectedPastaProduct(null);
  };

  const handleAddItem = (product: typeof products[0]) => {
    if (product.id === 'pizza-virtual-builder') {
      setPizzaAssemblyOpen(true);
      return;
    }
    if (product.category === 'Massas') {
      const activeMacarroes = macarroes.filter(m => m.ativo);
      if (activeMacarroes.length > 0) {
        setSelectedPastaProduct(product);
        setPastaSelectionOpen(true);
        return;
      }
    }
    executeAddItem(product);
  };

  const handleRequestBill = () => {
    requestBill(currentTable.id, true);
  };

  const handleSimulatePrint = () => {
    const simData = {
      id: `SIM-${currentTable.id}-${Date.now()}`,
      mesa: currentTable.id,
      created_at: new Date(),
      itens: consumption.map(i => ({
        nome: i.productName,
        quantidade: i.quantity,
        preco: i.price,
        descricao: i.description
      })),
      subtotal: subtotal,
      serviceFee: serviceFee,
      couvert: couvertArtísticoTotal,
      totalWithFee: total,
      descricao: 'Simulação de Conta'
    };
    setSimulatorData(simData);
    setShowSimulator(true);
  };

  const handleCloseTable = () => {
    setConfirmPaidOpen(true);
  };

  const confirmPaid = async () => {
    await closeTable(currentTable.id);
    setConfirmPaidOpen(false);
    onClose();
  };

  const handleResolveAlert = () => {
    updateTableAlert(currentTable.id, null);
  };

  const startEditItem = (index: number, currentQuantity: number) => {
    setEditingItem(index);
    setEditQuantity(currentQuantity);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditQuantity(1);
  };

  const handleSaveEdit = (originalItem: OrderItem, newQuantity: number) => {
    if (newQuantity > originalItem.quantity) {
      const diff = newQuantity - originalItem.quantity;
      addItemToTable(currentTable.id, { ...originalItem, quantity: diff });
      toast.success(`Adicionado mais ${diff}x ${originalItem.productName}`);
    } else if (newQuantity < originalItem.quantity) {
      toast.info("Para remover itens, utilize a função de exclusão ou chame o suporte.");
    }
    cancelEdit();
  };

  // Split dialog handlers
  const openSplitDialog = (pedidoId: number) => {
    setSplitPedidoId(pedidoId);
    // Pre-select all comanda phones
    setSplitSelectedPhones(comandas.map(c => c.telefone));
    setSplitDialogOpen(true);
  };

  const confirmSplit = () => {
    if (splitPedidoId && splitSelectedPhones.length >= 2) {
      splitItem(splitPedidoId, splitSelectedPhones);
      setSplitDialogOpen(false);
      setSplitPedidoId(null);
      setSplitSelectedPhones([]);
    } else {
      toast.error('Selecione pelo menos 2 pessoas para dividir');
    }
  };

  const toggleSplitPhone = (phone: string) => {
    setSplitSelectedPhones(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  const handleCloseComanda = (telefone: string, nome: string) => {
    setClosingComandaTelefone(telefone);
    setClosingComandaNome(nome);
    setConfirmCloseComandaOpen(true);
  };

  const confirmCloseComanda = () => {
    closeComanda(currentTable.id, closingComandaTelefone);
    setConfirmCloseComandaOpen(false);
  };

  // Start add item flow for a specific comanda
  const startAddItemForComanda = (telefone: string) => {
    setSelectedComandaTelefone(telefone);
    setIsAddingItem(true);
  };

  // Group consumption items by product (for mesa mode)
  const groupedConsumption = consumption.reduce((acc, item) => {
    const existing = acc.find(i => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, [] as OrderItem[]);

  // --- RENDER ITEM ROW (shared) ---
  const renderItemRow = (item: OrderItem, idx: number, showSplitButton = false, pedidoId?: number) => (
    <div
      key={`${item.productId}-${idx}`}
      className="flex items-center justify-between bg-secondary/40 border border-border/50 rounded-xl p-3 shadow-sm"
    >
      <div className="flex-1">
        <span className="font-bold text-foreground block tracking-tight text-sm">
          {item.productName}
          {(item as ComandaItem).isDivided && (
            <span className="text-xs font-normal text-blue-500 ml-1">
              (÷{(item as ComandaItem).divisionCount})
            </span>
          )}
        </span>
        {item.description && (
          <span className="text-xs text-muted-foreground block mt-0.5">📝 {item.description}</span>
        )}
        <div className="flex items-center gap-2 mt-1">
          {editingItem === idx && !isComandaMode ? (
            <div className="flex items-center gap-2 bg-background p-1 rounded-lg border border-border">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md"
                onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="w-8 text-center font-bold text-sm">{editQuantity}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md"
                onClick={() => setEditQuantity(editQuantity + 1)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button size="sm" variant="default" className="h-7 px-3 text-xs" onClick={() => handleSaveEdit(item, editQuantity)}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={cancelEdit}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-md border border-border/30">
                {item.quantity}x R$ {item.price.toFixed(2)}
              </span>
              {!isComandaMode && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => startEditItem(idx, item.quantity)}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
              {/* Dividir item: aparece em ambos os modos (mesa e comanda) */}
              {showSplitButton && pedidoId && comandas.length >= 2 && !(item as ComandaItem).isDivided && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                  onClick={() => openSplitDialog(pedidoId)}
                  title="Dividir item"
                >
                  <Divide className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="text-right pl-3">
        <span className="font-black text-primary text-sm">
          R$ {(item.price * item.quantity).toFixed(2)}
        </span>
      </div>
    </div>
  );

  // --- RENDER COMANDA SECTION ---
  const renderComandaSection = (comanda: Comanda) => (
    <div key={comanda.telefone} className="space-y-2">
      <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">👤</span>
          <div>
            <span className="font-bold text-sm text-foreground">{comanda.nome}</span>
            {comanda.telefone !== 'mesa' && (
              <span className="text-xs text-muted-foreground block">{comanda.telefone}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary text-sm">R$ {comanda.subtotal.toFixed(2)}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => startAddItemForComanda(comanda.telefone)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Item
          </Button>
          {comanda.telefone !== 'mesa' && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => handleCloseComanda(comanda.telefone, comanda.nome)}
            >
              Fechar
            </Button>
          )}
        </div>
      </div>

      {comanda.items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum item</p>
      ) : (
        <div className="space-y-2 pl-2">
          {comanda.items.map((item, idx) => renderItemRow(item, idx, true, item.pedidoId))}
        </div>
      )}
    </div>
  );

  // Get split item info for dialog
  const splitItemInfo = splitPedidoId ? pedidos.find(p => p.id === splitPedidoId) : null;
  const splitPreview = splitSelectedPhones.length >= 2 && splitItemInfo
    ? (splitItemInfo.total / splitSelectedPhones.length)
    : 0;

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden bg-card flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center justify-between">
              <span>
                Mesa {currentTable.id}
                {isComandaMode && comandas.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    📋 {comandas.length} comanda{comandas.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex items-center gap-1"
                  onClick={handleSimulatePrint}
                >
                  <Printer className="w-3 h-3" />
                  Simular
                </Button>
                <span className={`text-sm px-3 py-1 rounded-full ${currentTable.status === 'occupied'
                  ? 'bg-occupied/20 text-occupied'
                  : 'bg-free/20 text-free'
                  }`}>
                  {currentTable.alert === 'bill'
                    ? 'Pagamento Pendente'
                    : currentTable.status === 'occupied' ? 'Ocupada' : 'Livre'
                  }
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Alert Banner */}
          {currentTable.alert && (
            <div className={`p-3 rounded-lg flex items-center justify-between ${currentTable.alert === 'waiter' ? 'bg-warning/20 text-warning-foreground' : 'bg-info/20 text-info-foreground'
              }`}>
              <span className="font-medium">
                {currentTable.alert === 'waiter' ? '🔔 Garçom chamado' : '💳 Conta solicitada'}
              </span>
              <Button size="sm" variant="outline" onClick={handleResolveAlert}>
                Resolver
              </Button>
            </div>
          )}

          {/* CONTENT AREA */}
          <div className="flex-1 overflow-y-scroll pr-2 max-h-[320px] custom-scrollbar">
            {isComandaMode && comandas.length > 0 ? (
              /* === MODO COMANDA === */
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2 sticky top-0 bg-card py-2 z-10">
                  <Users className="w-4 h-4 text-primary" />
                  Comandas
                </h3>
                {comandas.map(comanda => renderComandaSection(comanda))}
              </div>
            ) : (
              /* === MODO MESA (padrão) === */
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground mb-3 flex items-center justify-between sticky top-0 bg-card py-2 z-10">
                  <span>Consumo</span>
                </h3>
                {groupedConsumption.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum item consumido</p>
                ) : (
                  <div className="space-y-3">
                    {groupedConsumption.map((item, idx) => {
                      const itemPedidoId = (item as any).pedidoId || (consumption.find(c => c.productName === item.productName) as any)?.pedidoId;
                      return renderItemRow(item, idx, true, itemPedidoId);
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Total Section */}
          <div className="border-t border-border pt-4 mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">R$ {subtotal.toFixed(2)}</span>
            </div>
            {couvertArtísticoTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  🎭 Couvert Artístico
                  {isComandaMode && comandas.filter(c => c.telefone !== 'mesa').length > 1 && (
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-foreground">
                      {comandas.filter(c => c.telefone !== 'mesa').length}x
                    </span>
                  )}
                </span>
                <span className="text-foreground">R$ {couvertArtísticoTotal.toFixed(2)}</span>
              </div>
            )}
            {settings.serviceFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de serviço ({settings.serviceFee}%)</span>
                <span className="text-foreground">R$ {serviceFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Add Item Section */}
          {isAddingItem ? (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {/* Comanda selector */}
              {isComandaMode && comandas.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Para qual comanda?</span>
                  <div className="flex flex-wrap gap-2">
                    {comandas.filter(c => c.telefone !== 'mesa').map(c => (
                      <button
                        key={c.telefone}
                        onClick={() => setSelectedComandaTelefone(c.telefone)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedComandaTelefone === c.telefone
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                            : 'bg-secondary/60 text-foreground hover:bg-secondary'
                        }`}
                      >
                        👤 {c.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground">Observação (opcional)</span>
                <Input
                  placeholder="Digite a observação e depois escolha o item (ex.: sem gelo)"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-lg"
                  autoFocus
                />
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddItem(product)}
                      disabled={isComandaMode && comandas.length > 0 && !selectedComandaTelefone && comandas.every(c => c.telefone !== 'mesa')}
                      className="w-full flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      <div className="text-left">
                        <span className="font-medium text-foreground block">{product.name}</span>
                        <span className="text-xs text-muted-foreground">{product.category}</span>
                      </div>
                      <span className="font-semibold text-foreground">R$ {product.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <Button variant="outline" onClick={() => { setIsAddingItem(false); setSelectedComandaTelefone(null); }} className="w-full rounded-lg">
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Button
                onClick={() => setIsAddingItem(true)}
                className="h-12 rounded-lg bg-primary text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-1" />
                Item
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestBill}
                disabled={currentTable.alert === 'bill' || groupedConsumption.length === 0}
                className="h-12 rounded-lg"
              >
                <Receipt className="w-4 h-4 mr-1" />
                Conta
              </Button>
              {currentTable.status === 'occupied' && groupedConsumption.length === 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    closeTable(currentTable.id);
                    onClose();
                  }}
                  className="h-12 rounded-lg"
                >
                  <Unlock className="w-4 h-4 mr-1" />
                  Liberar
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleCloseTable}
                  className="h-12 rounded-lg"
                >
                  <X className="w-4 h-4 mr-1" />
                  Fechar
                </Button>
              )}
            </div>
          )}
        </DialogContent>

        {/* Confirmação: conta paga */}
        <AlertDialog open={confirmPaidOpen} onOpenChange={setConfirmPaidOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isComandaMode && comandas.length > 0
                  ? `Fechar ${comandas.filter(c => c.telefone !== 'mesa').length} comanda(s)?`
                  : 'Conta foi paga?'
                }
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isComandaMode && comandas.length > 0
                  ? `Cada comanda será fechada individualmente e a conta será enviada por WhatsApp para cada cliente: ${comandas.filter(c => c.telefone !== 'mesa').map(c => c.nome).join(', ')}.`
                  : 'Se confirmar, a mesa será liberada e os pedidos dessa mesa serão removidos do sistema.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPaid}>
                {isComandaMode ? 'Sim, fechar comandas' : 'Sim, liberar mesa'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmação: fechar comanda individual */}
        <AlertDialog open={confirmCloseComandaOpen} onOpenChange={setConfirmCloseComandaOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fechar comanda de {closingComandaNome}?</AlertDialogTitle>
              <AlertDialogDescription>
                Os pedidos dessa pessoa serão finalizados. Se for a última comanda, a mesa será liberada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCloseComanda}>
                Fechar comanda
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Dividir item */}
        <AlertDialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Divide className="w-5 h-5 text-blue-500" />
                Dividir Item
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  {splitItemInfo && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="font-bold text-foreground">{splitItemInfo.productName}</p>
                      <p className="text-sm text-muted-foreground">Valor total: R$ {splitItemInfo.total.toFixed(2)}</p>
                    </div>
                  )}
                  <p className="text-sm">Selecione entre quais pessoas dividir:</p>
                  <div className="space-y-2">
                    {comandas.filter(c => c.telefone !== 'mesa').map(c => (
                      <button
                        key={c.telefone}
                        onClick={() => toggleSplitPhone(c.telefone)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          splitSelectedPhones.includes(c.telefone)
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-border bg-background hover:bg-secondary/50'
                        }`}
                      >
                        <span className="font-medium text-foreground">👤 {c.nome}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          splitSelectedPhones.includes(c.telefone)
                            ? 'bg-blue-500 text-white'
                            : 'bg-secondary text-muted-foreground'
                        }`}>
                          {splitSelectedPhones.includes(c.telefone) ? '✓' : '○'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {splitSelectedPhones.length >= 2 && (
                    <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                      <p className="text-sm text-foreground">
                        Dividindo por <strong>{splitSelectedPhones.length}</strong>:
                      </p>
                      <p className="text-lg font-bold text-blue-500">
                        R$ {splitPreview.toFixed(2)} por pessoa
                      </p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmSplit}
                disabled={splitSelectedPhones.length < 2}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Confirmar Divisão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Escolher Macarrão */}
        <AlertDialog open={pastaSelectionOpen} onOpenChange={setPastaSelectionOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                🍝 Selecione o Tipo de Macarrão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Escolha o tipo de macarrão para o molho <strong>{selectedPastaProduct?.name}</strong>:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-2 gap-2 my-4">
              {macarroes.filter(m => m.ativo).map((pasta) => (
                <button
                  type="button"
                  key={pasta.id}
                  onClick={() => {
                    if (selectedPastaProduct) {
                      executeAddItem(selectedPastaProduct, pasta.nome);
                      setPastaSelectionOpen(false);
                    }
                  }}
                  className="p-3 bg-secondary/50 rounded-xl hover:bg-primary hover:text-primary-foreground text-foreground text-sm font-semibold text-center transition-all"
                >
                  {pasta.nome}
                </button>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPastaSelectionOpen(false);
                setSelectedPastaProduct(null);
              }}>
                Cancelar
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Montar Pizza */}
        <AlertDialog open={pizzaAssemblyOpen} onOpenChange={setPizzaAssemblyOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                🍕 Assistente de Pizza
              </AlertDialogTitle>
              <AlertDialogDescription>
                Selecione o tipo de pizza e monte os sabores:
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 my-4">
              {/* Toggle Mode */}
              <div className="flex gap-2 bg-secondary/50 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPizzaMode('inteira');
                    setSabor2Id(null);
                  }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    pizzaMode === 'inteira'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Inteira (1 Sabor)
                </button>
                <button
                  type="button"
                  onClick={() => setPizzaMode('meia')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    pizzaMode === 'meia'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Meia a Meia (2 Sabores)
                </button>
              </div>

              {/* Sabores selection */}
              {pizzaMode === 'inteira' ? (
                <div className="space-y-2">
                  <Label>Selecione o Sabor</Label>
                  <select
                    className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={sabor1Id || ''}
                    onChange={(e) => setSabor1Id(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">-- Escolha um sabor --</option>
                    {activeSabores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nome} - R$ {parseFloat(s.preco).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Metade 1 (Sabor 1)</Label>
                    <select
                      className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      value={sabor1Id || ''}
                      onChange={(e) => setSabor1Id(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">-- Escolha o sabor --</option>
                      {activeSabores.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome} - R$ {parseFloat(s.preco).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Metade 2 (Sabor 2)</Label>
                    <select
                      className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      value={sabor2Id || ''}
                      onChange={(e) => setSabor2Id(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">-- Escolha o sabor --</option>
                      {activeSabores.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome} - R$ {parseFloat(s.preco).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Show Max Price preview */}
              {pizzaMode === 'meia' && sabor1Id && sabor2Id && (
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-center">
                  {(() => {
                    const s1 = activeSabores.find(s => s.id === sabor1Id);
                    const s2 = activeSabores.find(s => s.id === sabor2Id);
                    if (s1 && s2) {
                      const p1 = parseFloat(s1.preco);
                      const p2 = parseFloat(s2.preco);
                      const isSomaMetades = settings.pizzaBillingMode === 'soma_metades';
                      const price = isSomaMetades ? (p1 / 2) + (p2 / 2) : Math.max(p1, p2);
                      return (
                        <p className="text-sm font-semibold text-foreground">
                          Valor da Meia a Meia: <span className="text-primary font-bold">R$ {price.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground block font-normal">
                            {isSomaMetades 
                              ? `(Metade ${s1.nome} R$ ${(p1/2).toFixed(2)} + Metade ${s2.nome} R$ ${(p2/2).toFixed(2)})`
                              : `(Cobrado pelo sabor mais caro: ${p1 >= p2 ? s1.nome : s2.nome})`}
                          </span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPizzaAssemblyOpen(false);
                setSabor1Id(null);
                setSabor2Id(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pizzaMode === 'inteira' ? !sabor1Id : (!sabor1Id || !sabor2Id)}
                onClick={() => {
                  const s1 = activeSabores.find(s => s.id === sabor1Id);
                  const s2 = activeSabores.find(s => s.id === sabor2Id);
                  
                  if (pizzaMode === 'inteira' && s1) {
                    const virtualProduct = {
                      id: `pizza-flavor-${s1.id}`,
                      name: `Pizza ${s1.nome}`,
                      price: parseFloat(s1.preco),
                      category: 'Pizza',
                      station: s1.estacao || ('kitchen' as const),
                      isActive: true,
                      stock: 999
                    };
                    executeAddItem(virtualProduct);
                  } else if (pizzaMode === 'meia' && s1 && s2) {
                    const p1 = parseFloat(s1.preco);
                    const p2 = parseFloat(s2.preco);
                    const isSomaMetades = settings.pizzaBillingMode === 'soma_metades';
                    const price = isSomaMetades ? (p1 / 2) + (p2 / 2) : Math.max(p1, p2);
                    
                    const virtualProduct = {
                      id: `pizza-half-half-${s1.id}-${s2.id}`,
                      name: 'Pizza Meia a Meia',
                      price: price,
                      category: 'Pizza',
                      station: s1.estacao || ('kitchen' as const),
                      isActive: true,
                      stock: 999
                    };
                    
                    const originalDesc = itemDescription.trim();
                    const pizzaDesc = `Metade ${s1.nome} + Metade ${s2.nome}`;
                    const finalDesc = originalDesc ? `${pizzaDesc} - ${originalDesc}` : pizzaDesc;
                    
                    const item: OrderItem = {
                      productId: virtualProduct.id,
                      productName: virtualProduct.name,
                      quantity: 1,
                      price: virtualProduct.price,
                      description: finalDesc,
                    };
                    
                    addItemToTable(currentTable.id, item, isComandaMode ? selectedComandaTelefone || undefined : undefined);
                    setIsAddingItem(false);
                    setSearchQuery('');
                    setItemDescription('');
                    setSelectedComandaTelefone(null);
                    setSabor1Id(null);
                    setSabor2Id(null);
                    setPizzaAssemblyOpen(false);
                  }
                  
                  setPizzaAssemblyOpen(false);
                  setSabor1Id(null);
                  setSabor2Id(null);
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Simulator Modal */}
        <PrinterSimulator
          open={showSimulator}
          onClose={() => setShowSimulator(false)}
          data={simulatorData}
          restaurantName={settings.restaurantName}
        />
      </Dialog>
    </>
  );
};

export default TableDetailModal;
