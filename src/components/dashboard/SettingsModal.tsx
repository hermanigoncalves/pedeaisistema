import { useState, useEffect, useMemo } from 'react';
import {
  X, Settings2, Package, Warehouse, Users, CreditCard, Printer,
  Plus, Search, Edit2, Trash2, Save, MessageSquare, Send, Calendar,
  TrendingUp, TrendingDown, RotateCcw, AlertTriangle, Check, Clock,
  Phone, Mail, Tag, Gift, Volume2, VolumeX, Wifi, WifiOff, Loader2,
  Bell, AlertCircle, Store, Zap, Receipt, Download
} from 'lucide-react';
import { useApp, Product, Customer, Campaign } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  printToRawBT,
  printViaDeepLink,
  connectBluetoothPrinter,
  printViaWebBluetooth,
  printToDevice,
  getConnectedDeviceName,
  isPrinterConnected,
  getConnectedDeviceNameForPrinter
} from '@/services/printerService';

const PRODUCT_CATEGORIES = [
  'Bebida',
  'Comida',
  'Petisco',
  'Porção',
  'Sobremesa',
  'Lanche',
  'Hot Dog',
  'Combo',
  'Drink',
  'Massas',
  'Pizza',
  'Outros'
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings, updateSettings, // Mantidos
    updateAndSaveSetting, restaurant, // Adicionado
    products, addProduct, updateProduct, deleteProduct,
    customers, addCustomer, updateCustomer, deleteCustomer,
    stockMovements, addStockMovement,
    campaigns, addCampaign, updateCampaign, deleteCampaign,
    localAutoPrint, setLocalAutoPrint,
    macarroes, addMacarrao, updateMacarrao, deleteMacarrao,
    saboresPizza, addSaborPizza, updateSaborPizza, deleteSaborPizza,
    categorias, addCategoria, updateCategoria, deleteCategoria,
    estacoes, addEstacao, updateEstacao, deleteEstacao,
    savePrinters
  } = useApp();

  // Initialize local state with settings
  const [localSettings, setLocalSettings] = useState({
    restaurantName: settings.restaurantName,
    whatsappNumber: settings.whatsappNumber,
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
    totalTables: settings.totalTables,
    kitchenClosingTime: settings.kitchenClosingTime,
    serviceFee: settings.serviceFee,
    couvertValor: settings.couvertValor,
  });

  // Sync local state when settings change (only if not editing - simplified approach: sync only on mount or major updates, 
  // but to avoid overwriting while typing, we rely on local state for inputs)
  useEffect(() => {
    setLocalSettings(prev => ({
      ...prev,
      restaurantName: settings.restaurantName,
      whatsappNumber: settings.whatsappNumber,
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      totalTables: settings.totalTables,
      kitchenClosingTime: settings.kitchenClosingTime,
      serviceFee: settings.serviceFee,
      couvertValor: settings.couvertValor,
    }));
  }, [settings.restaurantName, settings.whatsappNumber, settings.openingTime, settings.closingTime, settings.totalTables, settings.kitchenClosingTime, settings.serviceFee, settings.couvertValor]);

  // Estados locais para chatbot de IA e Evolution Go
  const [evolutionInstancia, setEvolutionInstancia] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [personalidadeAgente, setPersonalidadeAgente] = useState('');
  const [exemplosConversa, setExemplosConversa] = useState('');
  const [regrasEstabelecimento, setRegrasEstabelecimento] = useState('');

  // Estados locais para Prompts Especialistas Globais
  const [globalPromptVendas, setGlobalPromptVendas] = useState('');
  const [globalPromptServico, setGlobalPromptServico] = useState('');
  const [globalPromptGeral, setGlobalPromptGeral] = useState('');

  // Sincroniza estados locais quando os dados do restaurante forem carregados do banco
  useEffect(() => {
    if (restaurant) {
      setEvolutionInstancia(restaurant.evolution_instancia || '');
      setEvolutionApiKey(restaurant.evolution_apikey || '');
      setPersonalidadeAgente(restaurant.personalidade_agente || '');
      setExemplosConversa(restaurant.exemplos_conversa || '');
      setRegrasEstabelecimento(restaurant.regras_estabelecimento || '');
    }
  }, [restaurant]);

  // Carrega os prompts especialistas globais ao abrir o modal
  useEffect(() => {
    const loadGlobalPrompts = async () => {
      try {
        const { data, error } = await supabase
          .from('ConfiguracoesGlobais')
          .select('prompt_geral, prompt_vendas, prompt_servico')
          .eq('id', 1)
          .single();
        if (data) {
          setGlobalPromptVendas(data.prompt_vendas || '');
          setGlobalPromptServico(data.prompt_servico || '');
          setGlobalPromptGeral(data.prompt_geral || '');
        }
      } catch (err) {
        console.error('Erro ao carregar prompts globais:', err);
      }
    };
    loadGlobalPrompts();
  }, [isOpen]);

  // Função para salvar alterações do prompt global no onBlur
  const saveGlobalPrompt = async (fields: { prompt_vendas?: string; prompt_servico?: string; prompt_geral?: string }) => {
    try {
      const { error } = await supabase
        .from('ConfiguracoesGlobais')
        .update(fields)
        .eq('id', 1);
      if (error) throw error;
      toast.success('Prompt do sistema atualizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar prompt global:', err);
      toast.error('Erro ao salvar prompt: ' + err.message);
    }
  };

  const [activeTab, setActiveTab] = useState('operation');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'bar' | 'kitchen'>('all');
  const [productSubTab, setProductSubTab] = useState<'all' | 'pastas' | 'pizzas'>('all');
  const [newPastaName, setNewPastaName] = useState('');
  const [editingPastaId, setEditingPastaId] = useState<number | null>(null);
  const [editingPastaName, setEditingPastaName] = useState('');
  
  // Pizza flavors states
  const [newPizzaName, setNewPizzaName] = useState('');
  const [newPizzaPrice, setNewPizzaPrice] = useState<number | ''>('');
  const [newPizzaDesc, setNewPizzaDesc] = useState('');
  const [newPizzaStock, setNewPizzaStock] = useState<number | ''>('');
  const [newPizzaMinStock, setNewPizzaMinStock] = useState<number | ''>('');
  const [editingPizzaSaborId, setEditingPizzaSaborId] = useState<number | null>(null);
  const [editingPizzaSaborName, setEditingPizzaSaborName] = useState('');
  const [editingPizzaSaborPrice, setEditingPizzaSaborPrice] = useState<number | ''>('');
  const [editingPizzaSaborDesc, setEditingPizzaSaborDesc] = useState('');
  const [editingPizzaSaborStock, setEditingPizzaSaborStock] = useState<number | ''>('');
  const [editingPizzaSaborMinStock, setEditingPizzaSaborMinStock] = useState<number | ''>('');
  const [newPizzaStation, setNewPizzaStation] = useState<string>('kitchen');
  const [editingPizzaSaborStation, setEditingPizzaSaborStation] = useState<string>('kitchen');
  const [showAddPrinterForm, setShowAddPrinterForm] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<'kitchen' | 'bar' | 'receipt' | 'all'>('kitchen');
  const [newPrinterEstacoes, setNewPrinterEstacoes] = useState<string[]>(['kitchen']);
  const [newPrinterConnection, setNewPrinterConnection] = useState<'bluetooth' | 'rawbt' | 'deeplink' | 'browser' | 'tcp' | 'usb'>('bluetooth');

  // Estados para Estações e Categorias dinâmicas
  const [newEstacaoNome, setNewEstacaoNome] = useState('');
  const [newCategoriaNome, setNewCategoriaNome] = useState('');
  const [editingEstacaoId, setEditingEstacaoId] = useState<number | null>(null);
  const [editingEstacaoNome, setEditingEstacaoNome] = useState('');
  const [editingCategoriaId, setEditingCategoriaId] = useState<number | null>(null);
  const [editingCategoriaNome, setEditingCategoriaNome] = useState('');

  const estacoesOptions = useMemo(() => {
    const list = estacoes.map(e => ({
      value: e.nome.trim().toLowerCase(),
      label: e.nome
    }));
    
    // Se por acaso não houver estações cadastradas, adiciona os padrões de segurança
    if (estacoes.length === 0) {
      list.push({ value: 'kitchen', label: '🍽️ Cozinha' });
      list.push({ value: 'bar', label: '🍺 Bar' });
    }
    
    // Adiciona o canal de Recibo/Conta que é fixo
    if (!list.some(e => e.value === 'receipt')) {
      list.push({ value: 'receipt', label: '🧾 Conta' });
    }
    return list;
  }, [estacoes]);

  const formatDestino = (type: string) => {
    if (!type) return 'Nenhum';
    const currentEst = type.split(',').map(s => s.trim().toLowerCase());
    if (currentEst.includes('all')) return '🧾 Imprimir Tudo';
    const labels = [];
    
    currentEst.forEach(val => {
      const found = estacoes.find(e => e.nome.trim().toLowerCase() === val);
      if (found) {
        labels.push(found.nome);
      } else if (val === 'receipt') {
        labels.push('🧾 Conta');
      } else if (val === 'kitchen') {
        labels.push('🍽️ Cozinha');
      } else if (val === 'bar') {
        labels.push('🍺 Bar');
      }
    });
    
    return labels.join(' + ') || 'Apenas a Conta';
  };
  const [newPrinterIp, setNewPrinterIp] = useState('192.168.1.169');
  const [newPrinterPort, setNewPrinterPort] = useState('9100');
  const [newPrinterUsbPath, setNewPrinterUsbPath] = useState('\\\\.\\COM3');
  const [newPrinterWidth, setNewPrinterWidth] = useState<'58mm' | '80mm'>('80mm');
  const [windowsPrinters, setWindowsPrinters] = useState<{Name: string; PortName: string; Type?: number}[]>([]);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [selectedWindowsPrinter, setSelectedWindowsPrinter] = useState('');

  // Efeito para carregar impressoras do Windows via Agente Local
  useEffect(() => {
    if (!isOpen) return;
    const fetchWindowsPrinters = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/printers');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setWindowsPrinters(data.printers || []);
            setIsAgentConnected(true);
          } else {
            setIsAgentConnected(false);
          }
        }
      } catch (e) {
        console.log('[SettingsModal] Agente local não detectado na porta 3001.');
        setIsAgentConnected(false);
      }
    };
    fetchWindowsPrinters();
  }, [isOpen]);

  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingProductData, setEditingProductData] = useState<Partial<Product> | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [showStockAdjust, setShowStockAdjust] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    category: '',
    station: 'bar',
    stock: 0,
    isActive: true,
    minStock: 10,
    costPrice: 0,
    description: '',
  });

  const handleAddEstacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEstacaoNome.trim()) return;
    const success = await addEstacao(newEstacaoNome.trim());
    if (success) setNewEstacaoNome('');
  };

  const handleAddCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoriaNome.trim()) return;
    const success = await addCategoria(newCategoriaNome.trim());
    if (success) setNewCategoriaNome('');
  };

  const handleUpdateEstacao = async (id: number) => {
    if (!editingEstacaoNome.trim()) return;
    const success = await updateEstacao(id, editingEstacaoNome.trim());
    if (success) {
      setEditingEstacaoId(null);
      setEditingEstacaoNome('');
    }
  };

  const handleUpdateCategoria = async (id: number) => {
    if (!editingCategoriaNome.trim()) return;
    const success = await updateCategoria(id, editingCategoriaNome.trim());
    if (success) {
      setEditingCategoriaId(null);
      setEditingCategoriaNome('');
    }
  };

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    email: '',
    visits: 0,
    totalSpent: 0,
    tags: [],
    notes: '',
  });

  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    message: '',
    targetTags: [],
    status: 'draft',
  });

  const [stockAdjustment, setStockAdjustment] = useState({
    type: 'in' as 'in' | 'out',
    quantity: 0,
    reason: '',
  });

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.name.trim()) {
      toast.error('Por favor, informe o nome do produto.');
      return;
    }
    if (newProduct.price === undefined || newProduct.price === null || isNaN(newProduct.price)) {
      toast.error('Por favor, informe um preço válido para o produto.');
      return;
    }

    const success = await addProduct({
      name: newProduct.name.trim(),
      price: Number(newProduct.price),
      category: newProduct.category || 'Geral',
      station: newProduct.station || 'bar',
      stock: Number(newProduct.stock || 0),
      isActive: newProduct.isActive ?? true,
      minStock: Number(newProduct.minStock || 10),
      costPrice: Number(newProduct.costPrice || 0),
      description: newProduct.description || '',
    });

    if (success) {
      setNewProduct({
        name: '',
        price: 0,
        category: '',
        station: 'bar',
        stock: 0,
        isActive: true,
        minStock: 10,
        costPrice: 0,
        description: '',
      });
      setShowAddProduct(false);
    }
  };

  const handleAddCustomer = async () => {
    if (newCustomer.name && newCustomer.phone) {
      try {
        await addCustomer({
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          visits: newCustomer.visits || 0,
          lastVisit: new Date(),
          totalSpent: newCustomer.totalSpent || 0,
          tags: newCustomer.tags || [],
          notes: newCustomer.notes,
          birthday: newCustomer.birthday,
        });

        setNewCustomer({
          name: '',
          phone: '',
          email: '',
          visits: 0,
          totalSpent: 0,
          tags: [],
          notes: '',
        });
        setShowAddCustomer(false);
      } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
      }
    }
  };

  const handleAddCampaign = () => {
    if (newCampaign.name && newCampaign.message) {
      addCampaign({
        name: newCampaign.name,
        message: newCampaign.message,
        targetTags: newCampaign.targetTags || [],
        status: newCampaign.status || 'draft',
        scheduledDate: newCampaign.scheduledDate,
      });
      setNewCampaign({
        name: '',
        message: '',
        targetTags: [],
        status: 'draft',
      });
      setShowAddCampaign(false);
    }
  };

  const handleStockAdjustment = (productId: string, productName: string) => {
    if (stockAdjustment.quantity > 0) {
      addStockMovement({
        productId,
        productName,
        type: stockAdjustment.type,
        quantity: stockAdjustment.quantity,
        reason: 'Ajuste manual',
      });
      setStockAdjustment({ type: 'in', quantity: 0, reason: '' });
      setShowStockAdjust(null);
    }
  };


  const handleRegisterBluetoothNew = async () => {
    const tempId = Date.now().toString();
    
    if (newPrinterConnection === 'bluetooth') {
      const res = await connectBluetoothPrinter(tempId);
      if (res.success) {
        const deviceName = res.deviceName || 'Impressora Bluetooth';
        const newPrinter = {
          id: tempId,
          name: newPrinterName.trim() || deviceName,
          type: (newPrinterEstacoes.join(',') || 'receipt') as any,
          connectionType: newPrinterConnection,
          isActive: true,
          ipAddress: deviceName,
          larguraBobina: newPrinterWidth
        };
        savePrinters([...settings.printers, newPrinter]);
        setNewPrinterName('');
        setNewPrinterEstacoes(['kitchen']);
        setNewPrinterWidth('80mm');
        setShowAddPrinterForm(false);
        toast.success(`Impressora "${newPrinter.name}" cadastrada com sucesso!`);
      } else {
        toast.error('Falha ao parear ou conectar impressora Bluetooth.');
      }
    } else if (newPrinterConnection === 'browser') {
      const printerLabel = newPrinterName.trim() || 'Impressora do PC';
      const newPrinter = {
        id: tempId,
        name: printerLabel,
        type: (newPrinterEstacoes.join(',') || 'receipt') as any,
        connectionType: newPrinterConnection as 'browser',
        isActive: true,
        ipAddress: 'sistema', // Indica que usa o diálogo nativo do sistema
        larguraBobina: newPrinterWidth
      };
      savePrinters([...settings.printers, newPrinter]);
      setNewPrinterName('');
      setNewPrinterEstacoes(['kitchen']);
      setNewPrinterWidth('80mm');
      setShowAddPrinterForm(false);
      toast.success(`Impressora "${newPrinter.name}" cadastrada! O diálogo do Windows abrirá ao imprimir.`);
    } else if (newPrinterConnection === 'tcp') {
      const printerLabel = newPrinterName.trim() || 'Impressora de Rede (TCP)';
      const newPrinter = {
        id: tempId,
        name: printerLabel,
        type: (newPrinterEstacoes.join(',') || 'receipt') as any,
        connectionType: newPrinterConnection as any,
        isActive: true,
        ipAddress: newPrinterIp.trim() || '192.168.1.169',
        port: parseInt(newPrinterPort, 10) || 9100,
        usbPath: '',
        larguraBobina: newPrinterWidth
      };
      savePrinters([...settings.printers, newPrinter]);
      setNewPrinterName('');
      setNewPrinterIp('192.168.1.169');
      setNewPrinterPort('9100');
      setNewPrinterEstacoes(['kitchen']);
      setNewPrinterWidth('80mm');
      setShowAddPrinterForm(false);
      toast.success(`Impressora de Rede "${newPrinter.name}" cadastrada!`);
    } else if (newPrinterConnection === 'usb') {
      const printerLabel = newPrinterName.trim() || 'Impressora USB/COM';
      const newPrinter = {
        id: tempId,
        name: printerLabel,
        type: (newPrinterEstacoes.join(',') || 'receipt') as any,
        connectionType: newPrinterConnection as any,
        isActive: true,
        ipAddress: 'usb',
        port: 9100,
        usbPath: newPrinterUsbPath.trim() || '\\\\.\\COM3',
        larguraBobina: newPrinterWidth
      };
      savePrinters([...settings.printers, newPrinter]);
      setNewPrinterName('');
      setNewPrinterUsbPath('\\\\.\\COM3');
      setNewPrinterEstacoes(['kitchen']);
      setNewPrinterWidth('80mm');
      setShowAddPrinterForm(false);
      toast.success(`Impressora USB/Serial "${newPrinter.name}" cadastrada!`);
    } else {
      const connName = newPrinterConnection === 'rawbt' ? 'RawBT App' : 'RawBT Link';
      const newPrinter = {
        id: tempId,
        name: newPrinterName.trim() || `Impressora ${connName}`,
        type: (newPrinterEstacoes.join(',') || 'receipt') as any,
        connectionType: newPrinterConnection,
        isActive: true,
        ipAddress: connName,
        larguraBobina: newPrinterWidth
      };
      savePrinters([...settings.printers, newPrinter]);
      setNewPrinterName('');
      setNewPrinterEstacoes(['kitchen']);
      setNewPrinterWidth('80mm');
      setShowAddPrinterForm(false);
      toast.success(`Impressora "${newPrinter.name}" cadastrada com sucesso!`);
    }
  };


  const handleReconnectPrinter = async (printerId: string) => {
    const res = await connectBluetoothPrinter(printerId);
    if (res.success) {
      toast.success('Impressora reconectada com sucesso!');
      // Força atualização de estado local e marca como ativa
      const updated = settings.printers.map(p =>
        p.id === printerId ? { ...p, isActive: true } : p
      );
      savePrinters(updated);
    } else {
      toast.error('Falha ao reconectar. Certifique-se de que a impressora está ligada.');
    }
  };

  const handleTestPrinter = async (printer: any) => {
    const mockOrder = {
      id: "TESTE-001",
      mesa: "00",
      created_at: new Date(),
      total: 50.00,
      itens: [
        { nome: `Teste - ${printer.name}`, quantidade: 1, preco: 50.00 }
      ],
      descricao: `Teste direcionado para a estação: ${printer.type === 'kitchen' ? 'COZINHA' : printer.type === 'bar' ? 'BAR' : 'RECIBO/TODOS'}`
    };
    const success = await printToDevice(mockOrder, settings.restaurantName, printer);
    if (success) {
      toast.success('Cupom de teste enviado com sucesso!');
    } else {
      toast.error('Erro ao enviar cupom. Tente reconectar a impressora.');
    }
  };

  const handleDeletePrinter = (printerId: string) => {
    const updated = settings.printers.filter(p => p.id !== printerId);
    savePrinters(updated);
    toast.success('Impressora excluída com sucesso.');
  };

  const handleUpdateProductClick = async (productId: string) => {
    if (editingProductData) {
      await updateProduct(productId, editingProductData);
      setEditingProduct(null);
      setEditingProductData(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase());
    const matchesFilter = productFilter === 'all' || p.station === productFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const lowStockProducts = products.filter(p => p.stock <= (p.minStock || settings.lowStockAlert));
  const criticalStockProducts = products.filter(p => p.stock <= settings.criticalStockAlert);

  const allTags = [...new Set(customers.flatMap(c => c.tags))];

  const hasPizzas = useMemo(() => {
    const hasPizzaCategory = products.some(p => p.category?.toLowerCase() === 'pizza');
    const hasPizzaFlavors = (saboresPizza && saboresPizza.length > 0) || false;
    return hasPizzaCategory || hasPizzaFlavors;
  }, [products, saboresPizza]);

  // handleSaveSettings removido (Auto-save ativo)

  // handleUpdateOperationSetting removido (Auto-save ativo)

  const handleLocalChange = (field: keyof typeof localSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleBlurSave = async (field: string, value: any) => {
    // Mapeamento de campos localSettings para colunas do banco
    const map: Record<string, string> = {
      restaurantName: 'nome',
      whatsappNumber: 'telefone',
      openingTime: 'horario_abertura',
      closingTime: 'horario_fechamento',
      kitchenClosingTime: 'horario_fecha_cozinha',
      totalTables: 'quantidade_mesas',
      serviceFee: 'taxa_servico',
      couvertValor: 'couvert_valor'
    };

    const dbField = map[field];
    if (dbField) {
      updateAndSaveSetting({ [dbField]: value.toString() });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] bg-card p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurações
            </DialogTitle>
            {/* Removido o botão Salvar Alterações para usar Auto-Save */}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className={`grid w-full ${settings.inventoryEnabled ? 'grid-cols-6' : 'grid-cols-5'} bg-secondary rounded-none border-b border-border px-6 flex-shrink-0`}>
            <TabsTrigger value="operation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Settings2 className="w-4 h-4 mr-2" />
              Operação
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Package className="w-4 h-4 mr-2" />
              Produtos
            </TabsTrigger>
            {settings.inventoryEnabled && (
              <TabsTrigger value="inventory" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <Warehouse className="w-4 h-4 mr-2" />
                Estoque
              </TabsTrigger>
            )}
            <TabsTrigger value="marketing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Users className="w-4 h-4 mr-2" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <CreditCard className="w-4 h-4 mr-2" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="downloads" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Downloads
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab A: Operação */}
            <TabsContent value="operation" className="mt-0 space-y-6 data-[state=active]:block">
              {/* Informações do Restaurante */}
              <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary" />
                    Informações do Restaurante
                  </h3>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Nome do Estabelecimento</Label>
                      <div className="relative group">
                        <Input
                          value={localSettings.restaurantName}
                          onChange={(e) => handleLocalChange('restaurantName', e.target.value)}
                          onBlur={(e) => handleBlurSave('restaurantName', e.target.value)}
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 transition-all pl-10"
                        />
                        <Settings2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">WhatsApp de Contato</Label>
                      <div className="relative group">
                        <Input
                          value={localSettings.whatsappNumber}
                          onChange={(e) => handleLocalChange('whatsappNumber', e.target.value)}
                          onBlur={(e) => handleBlurSave('whatsappNumber', e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 transition-all pl-10"
                        />
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Horário de Abertura</Label>
                      <div className="relative group">
                        <Input
                          type="time"
                          value={localSettings.openingTime}
                          onChange={(e) => handleLocalChange('openingTime', e.target.value)}
                          onBlur={(e) => handleBlurSave('openingTime', e.target.value)}
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 transition-all pl-10 pr-10"
                        />
                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Horário de Fechamento</Label>
                      <div className="relative group">
                        <Input
                          type="time"
                          value={localSettings.closingTime}
                          onChange={(e) => handleLocalChange('closingTime', e.target.value)}
                          onBlur={(e) => handleBlurSave('closingTime', e.target.value)}
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 transition-all pl-10 pr-10"
                        />
                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Taxa de Serviço */}
                    <div className="space-y-4 p-4 rounded-xl bg-secondary/10 border border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Taxa de Serviço</Label>
                          <span className="text-[10px] text-muted-foreground">Cobrar taxa de serviço de 10% nas contas</span>
                        </div>
                        <Switch
                          checked={settings.serviceFee > 0}
                          onCheckedChange={(checked) => {
                            const newFee = checked ? 10 : 0;
                            handleLocalChange('serviceFee', newFee);
                            updateAndSaveSetting({ taxa_servico: newFee });
                          }}
                        />
                      </div>
                      <div className="relative group">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          max="100"
                          value={localSettings.serviceFee}
                          disabled={settings.serviceFee === 0}
                          onChange={(e) => handleLocalChange('serviceFee', parseFloat(e.target.value) || 0)}
                          onBlur={(e) => handleBlurSave('serviceFee', parseFloat(e.target.value) || 0)}
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 disabled:opacity-50 disabled:bg-secondary/20 transition-all pl-10 pr-4"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground group-focus-within:text-primary transition-colors">%</span>
                      </div>
                    </div>

                    {/* Couvert Artístico */}
                    <div className="space-y-4 p-4 rounded-xl bg-secondary/10 border border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Couvert Artístico</Label>
                          <span className="text-[10px] text-muted-foreground">Cobrar couvert artístico por comanda/mesa</span>
                        </div>
                        <Switch
                          checked={settings.couvertHabilitado}
                          onCheckedChange={(checked) => {
                            updateAndSaveSetting({ couvert_habilitado: checked });
                          }}
                        />
                      </div>
                      <div className="relative group">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          value={localSettings.couvertValor}
                          disabled={!settings.couvertHabilitado}
                          onChange={(e) => handleLocalChange('couvertValor', parseFloat(e.target.value) || 0)}
                          onBlur={(e) => handleBlurSave('couvertValor', parseFloat(e.target.value) || 0)}
                          className="h-12 rounded-xl bg-background border-2 border-primary/5 group-focus-within:border-primary/30 disabled:opacity-50 disabled:bg-secondary/20 transition-all pl-10 pr-4"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground group-focus-within:text-primary transition-colors">R$</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mesas */}
              <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-primary" />
                    Configuração de Mesas
                  </h3>
                </div>

                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Número de Mesas Ativas</Label>
                        <p className="text-xs text-muted-foreground">Defina quantas mesas aparecerão no salão</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Input
                            type="number"
                            max={parseInt(restaurant?.quantidade_max_mesas || '50')}
                            value={localSettings.totalTables}
                            onChange={(e) => {
                              const val = e.target.value;
                              const value = val === '' ? 0 : parseInt(val);
                              handleLocalChange('totalTables', value);
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const max = parseInt(restaurant?.quantidade_max_mesas || '50');
                              const finalVal = Math.min(Math.max(0, val), max);
                              handleLocalChange('totalTables', finalVal);
                              updateAndSaveSetting({ quantidade_mesas: finalVal.toString() });
                            }}
                            className="w-40 h-14 rounded-2xl text-center font-black text-2xl bg-background border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                          />
                        </div>

                        <div className="flex flex-col justify-center">
                          <p className="text-sm font-medium text-foreground">
                            Até <span className="text-primary font-bold">{restaurant?.quantidade_max_mesas || '50'}</span> contratadas
                          </p>
                          <div className="w-32 h-2 bg-secondary rounded-full mt-2 overflow-hidden border border-border">
                            <div
                              className="h-full bg-primary transition-all duration-500 ease-out"
                              style={{
                                width: `${Math.min(100, (localSettings.totalTables / parseInt(restaurant?.quantidade_max_mesas || '50')) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fechamento da Cozinha</Label>
                        <p className="text-xs text-muted-foreground">Horário limite para pedidos na cozinha</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative group">
                          <Input
                            type="time"
                            value={localSettings.kitchenClosingTime || localSettings.closingTime}
                            onChange={(e) => handleLocalChange('kitchenClosingTime', e.target.value)}
                            onBlur={(e) => handleBlurSave('kitchenClosingTime', e.target.value)}
                            className="w-40 h-14 rounded-2xl text-center font-bold text-xl bg-background border-2 border-primary/10 focus:border-primary transition-all pr-4 pl-4"
                          />
                          <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors pointer-events-none" />
                        </div>
                        <div className="flex-1">
                          <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] leading-tight font-medium">Avisar clientes 30min antes</span>
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10 hover:bg-primary/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <Label className="text-foreground font-bold text-lg">Auto-Fechar Mesas</Label>
                          <p className="text-sm text-muted-foreground italic">
                            Libera a mesa instantaneamente após confirmação de pagamento
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.autoCloseTable}
                        onCheckedChange={(checked) => updateAndSaveSetting({ fechar_mesa_auto: checked })}
                        className="scale-125 data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modo de Cobrança */}
              <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-primary" />
                    Modo de Cobrança
                  </h3>
                </div>

                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Escolha como os pedidos são agrupados na conta.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateAndSaveSetting({ modo_cobranca: 'mesa' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        settings.billingMode === 'mesa'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/50 bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🍽️</span>
                        <span className="font-bold text-foreground">Mesa</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uma conta única por mesa, independente de quantas pessoas.
                      </p>
                    </button>

                    <button
                      onClick={() => updateAndSaveSetting({ modo_cobranca: 'comanda' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        settings.billingMode === 'comanda'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/50 bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">📋</span>
                        <span className="font-bold text-foreground">Comanda</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Conta individual por pessoa (cada check-in = 1 comanda).
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggle Permitir Meia Pizza (só aparece se houver pizzas no cardápio) */}
              {hasPizzas && (
                <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <span className="text-2xl">🍕</span>
                        </div>
                        <div>
                          <Label className="text-foreground font-bold text-lg">Permitir Meia Pizza</Label>
                          <p className="text-sm text-muted-foreground italic">
                            Habilita a venda e configuração de pizzas com dois sabores (Meia a Meia).
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.meiaPizzaHabilitada}
                        onCheckedChange={(checked) => updateAndSaveSetting({ meia_pizza_habilitada: checked })}
                        className="scale-125 data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cobrança Meio a Meia (só aparece se houver pizzas e estiver habilitado) */}
              {hasPizzas && settings.meiaPizzaHabilitada && (
                <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <span className="text-xl">🍕</span>
                      Cobrança Meio a Meia (2 Sabores)
                    </h3>
                  </div>

                  <div className="p-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione a regra de precificação para pizzas com dois sabores (Meia a Meia).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => updateAndSaveSetting({ cobranca_meio_a_meio: 'mais_cara' })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          settings.pizzaBillingMode === 'mais_cara'
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-border/50 bg-background hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">💰</span>
                          <span className="font-bold text-foreground">Sabor Mais Caro</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cobra o valor total do sabor com maior preço (padrão).
                        </p>
                      </button>

                      <button
                        onClick={() => updateAndSaveSetting({ cobranca_meio_a_meio: 'soma_metades' })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          settings.pizzaBillingMode === 'soma_metades'
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-border/50 bg-background hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">⚖️</span>
                          <span className="font-bold text-foreground">Média das Metades</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cobra a soma da metade do valor de cada um dos dois sabores.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Alertas e Sons */}
              <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    Alertas e Notificações
                  </h3>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between p-4 bg-background border border-primary/5 rounded-2xl hover:border-primary/20 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                          <AlertCircle className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                          <Label className="text-foreground font-bold text-base">Alertas Piscantes</Label>
                          <p className="text-xs text-muted-foreground">Animar mesas ao chamar garçom</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.flashingEnabled}
                        onCheckedChange={(checked) => updateAndSaveSetting({ alertas_piscantes: checked })}
                        className="data-[state=checked]:bg-orange-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background border border-primary/5 rounded-2xl hover:border-primary/20 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          {settings.soundEnabled ? (
                            <Volume2 className="w-6 h-6 text-primary" />
                          ) : (
                            <VolumeX className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <Label className="text-foreground font-bold text-base">Sons Ativos</Label>
                          <p className="text-xs text-muted-foreground">Notificações sonoras de pedidos</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.soundEnabled}
                        onCheckedChange={(checked) => updateAndSaveSetting({ sons_habilitados: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-background border border-primary/5 rounded-2xl hover:border-primary/20 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Warehouse className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <Label className="text-foreground font-bold text-base">Gerenciar Estoque</Label>
                          <p className="text-xs text-muted-foreground">Habilitar controle de estoque</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.inventoryEnabled}
                        onCheckedChange={(checked) => updateAndSaveSetting({ gerencia_estoque: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Impressoras
                  </h3>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full border border-border">
                      <Label htmlFor="auto-print" className="text-xs font-medium cursor-pointer">Impressão Automática</Label>
                      <Switch
                        id="auto-print"
                        checked={settings.autoPrintEnabled}
                        onCheckedChange={(checked) => {
                          updateAndSaveSetting({ impressao_auto: checked });
                        }}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowAddPrinterForm(!showAddPrinterForm)} 
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {showAddPrinterForm ? 'Cancelar' : 'Adicionar'}
                    </Button>
                  </div>
                </div>

                {/* Formulário para adicionar nova impressora */}
                {showAddPrinterForm && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Nova Impressora</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da Impressora</Label>
                        <Input
                          placeholder="Ex: Cozinha, Bar, Caixa..."
                          value={newPrinterName}
                          onChange={(e) => setNewPrinterName(e.target.value)}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Método de Conexão</Label>
                        <Select
                          value={newPrinterConnection}
                          onValueChange={(v) => setNewPrinterConnection(v as any)}
                        >
                          <SelectTrigger className="h-10 bg-background border border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bluetooth">📶 Bluetooth Nativo (Chrome)</SelectItem>
                            <SelectItem value="rawbt">📱 RawBT App (USB, IP, Bluetooth)</SelectItem>
                            <SelectItem value="deeplink">🔗 RawBT Deep Link (Dispositivos Antigos)</SelectItem>
                            <SelectItem value="browser">💻 Impressora do Sistema (PC/Windows)</SelectItem>
                            <SelectItem value="tcp">🔌 Rede Local (TCP/IP - Elgin, Bematech...)</SelectItem>
                            <SelectItem value="usb">🔌 USB ou Porta Serial COM (Agente Local)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Largura da Bobina</Label>
                        <Select
                          value={newPrinterWidth}
                          onValueChange={(v) => setNewPrinterWidth(v as any)}
                        >
                          <SelectTrigger className="h-10 bg-background border border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80mm">80mm (Largo/Padrão)</SelectItem>
                            <SelectItem value="58mm">58mm (Estreito)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Inputs extras para conexão de Rede (TCP) */}
                      {newPrinterConnection === 'tcp' && (
                        <div className="col-span-1 md:col-span-3 grid grid-cols-2 gap-3 bg-primary/5 border border-primary/10 rounded-lg p-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Endereço IP da Impressora</Label>
                            <Input
                              placeholder="Ex: 192.168.1.169"
                              value={newPrinterIp}
                              onChange={(e) => setNewPrinterIp(e.target.value)}
                              className="rounded-lg bg-background"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Porta TCP</Label>
                            <Input
                              placeholder="Ex: 9100"
                              value={newPrinterPort}
                              onChange={(e) => setNewPrinterPort(e.target.value)}
                              className="rounded-lg bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* Inputs extras para conexão USB/Serial */}
                      {newPrinterConnection === 'usb' && (
                        <div className="col-span-1 md:col-span-3 bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-3">
                          {isAgentConnected && windowsPrinters.length > 0 ? (
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Selecione a Impressora Instalada no Windows</Label>
                              <Select
                                value={selectedWindowsPrinter}
                                onValueChange={(v) => {
                                  setSelectedWindowsPrinter(v);
                                  setNewPrinterUsbPath(v);
                                  // Preenche automaticamente o apelido se estiver vazio
                                  if (!newPrinterName.trim()) {
                                    setNewPrinterName(v);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-10 bg-background border border-border">
                                  <SelectValue placeholder="Selecione uma impressora..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {windowsPrinters.map((p) => (
                                    <SelectItem key={p.Name} value={p.Name}>
                                      🖨️ {p.Name} ({p.PortName})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Caminho USB ou Porta COM (Windows)</Label>
                              <Input
                                placeholder="Ex: \\\\.\\COM3 ou \\\\.\\USB001"
                                value={newPrinterUsbPath}
                                onChange={(e) => setNewPrinterUsbPath(e.target.value)}
                                className="rounded-lg bg-background"
                              />
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {isAgentConnected ? (
                              "💡 O agente local de impressões está ativo e detectou suas impressoras instaladas."
                            ) : (
                              "💡 Exemplos: Para impressoras de cabo serial COM use \\\\.\\COM3. Para USB use \\\\.\\USB001 ou o nome da impressora compartilhada."
                            )}
                          </p>
                        </div>
                      )}

                      {/* Info sobre impressora do sistema */}
                      {newPrinterConnection === 'browser' && (
                        <div className="col-span-3 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Printer className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold">Como funciona a impressão pelo PC?</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Ao imprimir um pedido, o <strong>diálogo de impressão do Windows</strong> abrirá automaticamente.
                            Você escolhe a impressora desejada (HP, Epson, PDF, etc.) direto no diálogo — sem necessidade de configurar aqui.
                          </p>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            💡 Dê um apelido no campo "Nome" acima para identificar esta configuração no painel (ex: "Cozinha PC").
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Estações de Destino (Selecione uma ou mais)</Label>
                        <div className="flex flex-wrap gap-2">
                          {estacoesOptions.map((option) => {
                            const isSelected = newPrinterEstacoes.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setNewPrinterEstacoes(newPrinterEstacoes.filter(e => e !== option.value));
                                  } else {
                                    setNewPrinterEstacoes([...newPrinterEstacoes, option.value]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  isSelected 
                                    ? 'bg-green-600 text-white border-green-600 dark:bg-green-700' 
                                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleRegisterBluetoothNew}
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {newPrinterConnection === 'bluetooth' ? (
                          <>
                            <Wifi className="w-4 h-4" />
                            Parear e Conectar
                          </>
                        ) : newPrinterConnection === 'browser' ? (
                          <>
                            <Printer className="w-4 h-4" />
                            Salvar (Usará Diálogo do PC)
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Salvar e Cadastrar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Status de Conexão Local</h4>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="local-auto-print" className="text-[10px] font-bold uppercase tracking-wider text-green-700/70">Auto-Impressão Local</Label>
                      <Switch 
                        id="local-auto-print" 
                        checked={localAutoPrint} 
                        onCheckedChange={setLocalAutoPrint}
                        className="scale-75 data-[state=checked]:bg-green-600"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Certifique-se de manter o painel aberto neste computador/tablet com a <strong>Auto-Impressão Local</strong> ligada para que o sistema direcione as impressões automaticamente.
                  </p>
                </div>

                <div className="space-y-2">
                  {settings.printers.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-lg">
                      <Printer className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">Nenhuma impressora cadastrada.</p>
                      <p className="text-xs text-muted-foreground">Adicione uma impressora clicando no botão "Adicionar" acima.</p>
                    </div>
                  ) : (
                    settings.printers.map((printer) => {
                      const connType = printer.connectionType || 'bluetooth';
                      const isConnected = connType === 'bluetooth' ? isPrinterConnected(printer.id) : true;
                      
                      return (
                        <div key={printer.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-card rounded-xl border border-border gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3.5 h-3.5 rounded-full ${printer.isActive && isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground/30'}`} />
                            <div>
                              <p className="font-bold text-foreground flex items-center gap-2">
                                {printer.name}
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  ({printer.ipAddress || (printer as any).usbPath || 'Bluetooth'})
                                </span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isConnected ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {connType === 'bluetooth' 
                                    ? (isConnected ? 'Conectada' : 'Desconectada')
                                    : connType === 'browser'
                                    ? 'Pronta (PC/Sistema)'
                                    : connType === 'tcp'
                                    ? `Rede IP: ${printer.ipAddress}:${(printer as any).port || 9100}`
                                    : connType === 'usb'
                                    ? `USB/COM: ${(printer as any).usbPath || 'Local'}`
                                    : 'Pronta (RawBT)'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Canal: <strong>{
                                    connType === 'bluetooth' ? '📶 Bluetooth' 
                                    : connType === 'rawbt' ? '📱 RawBT App'
                                    : connType === 'deeplink' ? '🔗 Deep Link'
                                    : connType === 'tcp' ? '🔌 Rede TCP'
                                    : connType === 'usb' ? '🔌 USB/Serial'
                                    : '💻 PC/Sistema'
                                  }</strong>
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  Destino: {formatDestino(printer.type)}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  (printer.larguraBobina || '80mm') === '80mm' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                                }`}>
                                  Bobina: {printer.larguraBobina || '80mm'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Alterar Estação Inline com Múltiplas Seleções */}
                            <div className="flex items-center gap-1.5">
                              {estacoesOptions.map((option) => {
                                const currentEstacoes = printer.type ? printer.type.split(',').map(s => s.trim().toLowerCase()) : [];
                                const isSelected = currentEstacoes.includes(option.value) || currentEstacoes.includes('all');
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      let updatedEstacoes = [...currentEstacoes].filter(e => e !== 'all');
                                      if (isSelected) {
                                        updatedEstacoes = updatedEstacoes.filter(e => e !== option.value);
                                      } else {
                                        updatedEstacoes.push(option.value);
                                      }
                                      // Se tudo estiver desmarcado, coloca 'receipt' como padrão de segurança
                                      const newTypeVal = updatedEstacoes.length > 0 ? updatedEstacoes.join(',') : 'receipt';
                                      
                                      const updated = settings.printers.map(p =>
                                        p.id === printer.id ? { ...p, type: newTypeVal as any } : p
                                      );
                                      savePrinters(updated);
                                      toast.success(`Estações de "${printer.name}" atualizadas!`);
                                    }}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                      isSelected
                                        ? 'bg-green-600 text-white border-green-600 dark:bg-green-700'
                                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Alterar Largura da Bobina Inline */}
                            <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-lg border border-border">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = settings.printers.map(p =>
                                    p.id === printer.id ? { ...p, larguraBobina: '80mm' } : p
                                  );
                                  savePrinters(updated);
                                  toast.success(`Bobina de "${printer.name}" alterada para 80mm`);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  (printer.larguraBobina || '80mm') === '80mm'
                                    ? 'bg-background text-foreground shadow-sm border border-border/20'
                                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                                }`}
                              >
                                80mm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = settings.printers.map(p =>
                                    p.id === printer.id ? { ...p, larguraBobina: '58mm' } : p
                                  );
                                  savePrinters(updated);
                                  toast.success(`Bobina de "${printer.name}" alterada para 58mm`);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  printer.larguraBobina === '58mm'
                                    ? 'bg-background text-foreground shadow-sm border border-border/20'
                                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                                }`}
                              >
                                58mm
                              </button>
                            </div>

                            {connType === 'bluetooth' && !isConnected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReconnectPrinter(printer.id)}
                                className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
                              >
                                <Wifi className="w-3 h-3" />
                                Conectar
                              </Button>
                            )}

                            {isConnected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTestPrinter(printer)}
                                className="h-8 text-xs gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                Testar
                              </Button>
                            )}

                            <Switch
                              checked={printer.isActive}
                              onCheckedChange={(checked) => {
                                const updated = settings.printers.map(p =>
                                  p.id === printer.id ? { ...p, isActive: checked } : p
                                );
                                savePrinters(updated);
                              }}
                              className="scale-75"
                            />

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeletePrinter(printer.id)}
                              className="w-8 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </TabsContent>

            {/* Tab B: Produtos */}
            <TabsContent value="products" className="mt-0 space-y-4">
              {/* Sub-tabs para Produtos / Massas */}
              <div className="flex border-b border-border mb-2">
                <button
                  type="button"
                  onClick={() => setProductSubTab('all')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                    productSubTab === 'all'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cardápio Geral
                </button>
                <button
                  type="button"
                  onClick={() => setProductSubTab('pastas')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                    productSubTab === 'pastas'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Tipos de Macarrão
                </button>
                <button
                  type="button"
                  onClick={() => setProductSubTab('pizzas')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                    productSubTab === 'pizzas'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sabores de Pizza
                </button>
              </div>

              {productSubTab === 'all' ? (
                <>
                  {/* Toolbar */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10 rounded-lg"
                    />
                  </div>
                  <Select value={productFilter} onValueChange={(v) => setProductFilter(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="kitchen">Cozinha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => {
                  setShowAddProduct(true);
                  setEditingProduct(null);
                  setEditingProductData(null);
                }} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Produto
                </Button>
              </div>

              {/* Add Product Form */}
              {showAddProduct && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Novo Produto</h3>
                    <Button variant="ghost" size="icon" onClick={() => setShowAddProduct(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newProduct.price === 0 ? '' : newProduct.price}
                        placeholder="0.00"
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={newProduct.category}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.length > 0 ? (
                            categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                            ))
                          ) : (
                            PRODUCT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estação</Label>
                      <Select
                        value={newProduct.station}
                        onValueChange={(v) => setNewProduct({ ...newProduct, station: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma estação" />
                        </SelectTrigger>
                        <SelectContent>
                          {estacoes.length > 0 ? (
                            estacoes.map((est) => (
                              <SelectItem key={est.id} value={est.nome.toLowerCase()}>{est.nome}</SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="bar">🍺 Bar</SelectItem>
                              <SelectItem value="kitchen">🍽️ Cozinha</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {settings.inventoryEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label>Estoque Inicial</Label>
                          <Input
                            type="number"
                            value={newProduct.stock === 0 ? '' : newProduct.stock}
                            placeholder="0"
                            onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                            className="rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Estoque Mínimo</Label>
                          <Input
                            type="number"
                            value={newProduct.minStock === 0 ? '' : newProduct.minStock}
                            placeholder="0"
                            onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                            className="rounded-lg"
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2 col-span-3">
                      <Label>Descrição</Label>
                      <Input
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddProduct(false)}>Cancelar</Button>
                    <Button onClick={handleAddProduct} className="gap-2">
                      <Save className="w-4 h-4" />
                      Salvar Produto
                    </Button>
                  </div>
                </div>
              )}

              {/* Products List */}
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${product.isActive
                      ? 'bg-card border-border'
                      : 'bg-muted/50 border-muted opacity-60'
                      }`}
                  >
                    {editingProduct === product.id ? (
                      <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4 my-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground">Editar Produto: {product.name}</h3>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(null); setEditingProductData(null); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Nome *</Label>
                            <Input
                              value={editingProductData?.name ?? product.name}
                              onChange={(e) => setEditingProductData({ ...editingProductData, name: e.target.value })}
                              className="rounded-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Preço *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingProductData?.price ?? product.price}
                              onChange={(e) => setEditingProductData({ ...editingProductData, price: parseFloat(e.target.value) || 0 })}
                              className="rounded-lg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select
                              value={editingProductData?.category ?? product.category}
                              onValueChange={(v) => setEditingProductData({ ...editingProductData, category: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {categorias.length > 0 ? (
                                  categorias.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                                  ))
                                ) : (
                                  PRODUCT_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Estação</Label>
                            <Select
                              value={editingProductData?.station ?? product.station}
                              onValueChange={(v) => setEditingProductData({ ...editingProductData, station: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma estação" />
                              </SelectTrigger>
                              <SelectContent>
                                {estacoes.length > 0 ? (
                                  estacoes.map((est) => (
                                    <SelectItem key={est.id} value={est.nome.toLowerCase()}>{est.nome}</SelectItem>
                                  ))
                                ) : (
                                  <>
                                    <SelectItem value="bar">Bar</SelectItem>
                                    <SelectItem value="kitchen">Cozinha</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          {settings.inventoryEnabled && (
                            <>
                              <div className="space-y-2">
                                <Label>Estoque</Label>
                                <Input
                                  type="number"
                                  value={editingProductData?.stock ?? product.stock}
                                  onChange={(e) => setEditingProductData({ ...editingProductData, stock: parseInt(e.target.value) || 0 })}
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Estoque Mínimo</Label>
                                <Input
                                  type="number"
                                  value={editingProductData?.minStock ?? product.minStock}
                                  onChange={(e) => setEditingProductData({ ...editingProductData, minStock: parseInt(e.target.value) || 0 })}
                                  className="rounded-lg"
                                />
                              </div>
                            </>
                          )}
                          <div className="space-y-2 col-span-3">
                            <Label>Descrição</Label>
                            <Input
                              value={editingProductData?.description ?? product.description}
                              onChange={(e) => setEditingProductData({ ...editingProductData, description: e.target.value })}
                              className="rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => { setEditingProduct(null); setEditingProductData(null); }}>Cancelar</Button>
                          <Button onClick={() => handleUpdateProductClick(product.id)} className="gap-2">
                            <Check className="w-4 h-4" />
                            Confirmar Alterações
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{product.name}</span>
                              {!product.isActive && (
                                <Badge variant="secondary" className="text-xs">Inativo</Badge>
                              )}
                            </div>
                            {product.description && (
                              <p className="text-sm text-muted-foreground">{product.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                          </div>
                          <Badge variant="outline">{product.category}</Badge>
                          <Badge variant={product.station.toLowerCase() === 'bar' ? 'default' : 'secondary'}>
                            {product.station.toLowerCase() === 'bar' ? '🍺 Bar' : 
                             product.station.toLowerCase() === 'kitchen' ? '🍽️ Cozinha' : 
                             `📍 ${product.station}`}
                          </Badge>
                          {settings.inventoryEnabled && (
                            <div className={`text-center min-w-[60px] px-2 py-1 rounded-lg ${product.stock <= settings.criticalStockAlert
                              ? 'bg-destructive/20 text-destructive'
                              : product.stock <= (product.minStock || settings.lowStockAlert)
                                ? 'bg-warning/20 text-warning'
                                : 'bg-success/20 text-success'
                              }`}>
                              <p className="font-bold">{product.stock}</p>
                              <p className="text-xs">un.</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Switch
                            checked={product.isActive}
                            onCheckedChange={(checked) => updateProduct(product.id, { isActive: checked })}
                          />
                          <Button variant="ghost" size="icon" onClick={() => {
                            setShowAddProduct(false);
                            setEditingProduct(product.id);
                            setEditingProductData({ ...product });
                          }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteProduct(product.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : productSubTab === 'pastas' ? (
            <div className="space-y-4">
              {/* Form to add new noodle type */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Adicionar Tipo de Macarrão</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Espaguete, Penne, Fettuccine..."
                    value={newPastaName}
                    onChange={(e) => setNewPastaName(e.target.value)}
                    className="rounded-lg max-w-sm"
                  />
                  <Button
                    onClick={async () => {
                      if (newPastaName.trim()) {
                        const success = await addMacarrao(newPastaName.trim());
                        if (success) setNewPastaName('');
                      } else {
                        toast.error('Digite o nome do macarrão');
                      }
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* List of Noodles */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 bg-secondary/30 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">Tipos de Macarrão Cadastrados</h3>
                </div>
                {macarroes.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum tipo de macarrão cadastrado ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {macarroes.map((pasta) => (
                      <div key={pasta.id} className="p-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                        <div className="flex-1 mr-4">
                          {editingPastaId === pasta.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingPastaName}
                                onChange={(e) => setEditingPastaName(e.target.value)}
                                className="rounded-lg max-w-sm"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (editingPastaName.trim()) {
                                    const success = await updateMacarrao(pasta.id, { nome: editingPastaName.trim() });
                                    if (success) setEditingPastaId(null);
                                  }
                                }}
                              >
                                Salvar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingPastaId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <span className={`font-medium ${pasta.ativo ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                              {pasta.nome}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Ativo</span>
                            <Switch
                              checked={pasta.ativo}
                              onCheckedChange={(checked) => updateMacarrao(pasta.id, { ativo: checked })}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={editingPastaId === pasta.id}
                            onClick={() => {
                              setEditingPastaId(pasta.id);
                              setEditingPastaName(pasta.nome);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMacarrao(pasta.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Form to add new pizza flavor */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Adicionar Sabor de Pizza</h3>
                <div className={`grid grid-cols-1 md:grid-cols-${settings.inventoryEnabled ? '6' : '4'} gap-3`}>
                  <div className="space-y-1">
                    <Label className="text-xs">Sabor *</Label>
                    <Input
                      placeholder="Ex: Calabresa, Marguerita..."
                      value={newPizzaName}
                      onChange={(e) => setNewPizzaName(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newPizzaPrice}
                      onChange={(e) => setNewPizzaPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ingredientes / Descrição</Label>
                    <Input
                      placeholder="Ex: Molho de tomate, mussarela, calabresa..."
                      value={newPizzaDesc}
                      onChange={(e) => setNewPizzaDesc(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estação *</Label>
                    <Select
                      value={newPizzaStation}
                      onValueChange={(v) => setNewPizzaStation(v)}
                    >
                      <SelectTrigger className="h-10 bg-background border border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estacoes.length > 0 ? (
                          estacoes.map((est) => (
                            <SelectItem key={est.id} value={est.nome.toLowerCase()}>{est.nome}</SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="kitchen">🍽️ Cozinha</SelectItem>
                            <SelectItem value="bar">🍺 Bar</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {settings.inventoryEnabled && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Estoque Inicial</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={newPizzaStock}
                          onChange={(e) => setNewPizzaStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Estoque Mínimo</Label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={newPizzaMinStock}
                          onChange={(e) => setNewPizzaMinStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                          className="rounded-lg"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={async () => {
                      if (newPizzaName.trim() && newPizzaPrice !== '') {
                        const success = await addSaborPizza(
                          newPizzaName.trim(), 
                          newPizzaPrice, 
                          newPizzaDesc.trim(),
                          newPizzaStock !== '' ? newPizzaStock : undefined,
                          newPizzaMinStock !== '' ? newPizzaMinStock : undefined,
                          newPizzaStation
                        );
                        if (success) {
                          setNewPizzaName('');
                          setNewPizzaPrice('');
                          setNewPizzaDesc('');
                          setNewPizzaStock('');
                          setNewPizzaMinStock('');
                          setNewPizzaStation('kitchen');
                        }
                      } else {
                        toast.error('Preencha nome e preço');
                      }
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Sabor
                  </Button>
                </div>
              </div>

              {/* List of Pizza Flavors */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 bg-secondary/30 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">Sabores de Pizza Cadastrados</h3>
                </div>
                {saboresPizza.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum sabor de pizza cadastrado ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {saboresPizza.map((sabor) => (
                      <div key={sabor.id} className="p-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                        <div className="flex-1 mr-4">
                          {editingPizzaSaborId === sabor.id ? (
                            <div className="space-y-2 w-full max-w-xl">
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  value={editingPizzaSaborName}
                                  onChange={(e) => setEditingPizzaSaborName(e.target.value)}
                                  placeholder="Nome"
                                  className="rounded-lg"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPizzaSaborPrice}
                                  onChange={(e) => setEditingPizzaSaborPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  placeholder="Preço"
                                  className="rounded-lg"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  value={editingPizzaSaborDesc}
                                  onChange={(e) => setEditingPizzaSaborDesc(e.target.value)}
                                  placeholder="Descrição"
                                  className="rounded-lg"
                                />
                                <Select
                                  value={editingPizzaSaborStation}
                                  onValueChange={(v) => setEditingPizzaSaborStation(v)}
                                >
                                  <SelectTrigger className="h-10 bg-background border border-border">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {estacoes.length > 0 ? (
                                      estacoes.map((est) => (
                                        <SelectItem key={est.id} value={est.nome.toLowerCase()}>{est.nome}</SelectItem>
                                      ))
                                    ) : (
                                      <>
                                        <SelectItem value="kitchen">🍽️ Cozinha</SelectItem>
                                        <SelectItem value="bar">🍺 Bar</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              {settings.inventoryEnabled && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Estoque</Label>
                                    <Input
                                      type="number"
                                      value={editingPizzaSaborStock}
                                      onChange={(e) => setEditingPizzaSaborStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                                      placeholder="0"
                                      className="rounded-lg"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Estoque Mínimo</Label>
                                    <Input
                                      type="number"
                                      value={editingPizzaSaborMinStock}
                                      onChange={(e) => setEditingPizzaSaborMinStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                                      placeholder="10"
                                      className="rounded-lg"
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    if (editingPizzaSaborName.trim() && editingPizzaSaborPrice !== '') {
                                      const success = await updateSaborPizza(sabor.id, {
                                        nome: editingPizzaSaborName.trim(),
                                        preco: editingPizzaSaborPrice as number,
                                        descricao: editingPizzaSaborDesc.trim(),
                                        estoque: editingPizzaSaborStock !== '' ? editingPizzaSaborStock : 0,
                                        estoque_minimo: editingPizzaSaborMinStock !== '' ? editingPizzaSaborMinStock : 10,
                                        estacao: editingPizzaSaborStation
                                      });
                                      if (success) setEditingPizzaSaborId(null);
                                    }
                                  }}
                                >
                                  Salvar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingPizzaSaborId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${sabor.ativo ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                                  {sabor.nome}
                                </span>
                                <span className="text-sm font-semibold text-primary">R$ {parseFloat(sabor.preco).toFixed(2)}</span>
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full ml-2 font-medium">
                                  {sabor.estacao?.toLowerCase() === 'bar' ? '🍺 Bar' : 
                                   sabor.estacao?.toLowerCase() === 'kitchen' ? '🍽️ Cozinha' : 
                                   `📍 ${sabor.estacao}`}
                                </span>
                                {settings.inventoryEnabled && (
                                  <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
                                    Estoque: {sabor.estoque} / Mín: {sabor.estoque_minimo}
                                  </span>
                                )}
                              </div>
                              {sabor.descricao && (
                                <p className="text-xs text-muted-foreground mt-0.5">{sabor.descricao}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Ativo</span>
                            <Switch
                              checked={sabor.ativo}
                              onCheckedChange={(checked) => updateSaborPizza(sabor.id, { ativo: checked })}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={editingPizzaSaborId === sabor.id}
                            onClick={() => {
                              setEditingPizzaSaborId(sabor.id);
                              setEditingPizzaSaborName(sabor.nome);
                              setEditingPizzaSaborPrice(parseFloat(sabor.preco));
                              setEditingPizzaSaborDesc(sabor.descricao || '');
                              setEditingPizzaSaborStock(sabor.estoque ?? 0);
                              setEditingPizzaSaborMinStock(sabor.estoque_minimo ?? 10);
                              setEditingPizzaSaborStation(sabor.estacao || 'kitchen');
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteSaborPizza(sabor.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

            {/* Tab C: Estoque */}
            <TabsContent value="inventory" className="mt-0 space-y-6">
              {/* Alertas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Configurar Alertas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Alerta Estoque Baixo</Label>
                      <Input
                        type="number"
                        value={settings.lowStockAlert}
                        onChange={(e) => updateAndSaveSetting({ alerta_estoque_baixo: parseInt(e.target.value) || 15 })}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alerta Crítico</Label>
                      <Input
                        type="number"
                        value={settings.criticalStockAlert}
                        onChange={(e) => updateAndSaveSetting({ alerta_estoque_critico: parseInt(e.target.value) || 5 })}
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <h3 className="font-semibold text-destructive mb-2">Produtos em Alerta</h3>
                  <div className="space-y-1">
                    {criticalStockProducts.length > 0 ? (
                      criticalStockProducts.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className="text-foreground">{p.name}</span>
                          <span className="font-bold text-destructive">{p.stock} un.</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum produto em estado crítico</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Gestão de Estoque */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Gestão de Estoque</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${product.stock <= settings.criticalStockAlert
                        ? 'border-destructive bg-destructive/10'
                        : product.stock <= (product.minStock || settings.lowStockAlert)
                          ? 'border-warning bg-warning/10'
                          : 'border-success bg-success/10'
                        }`}
                      onClick={() => setShowStockAdjust(showStockAdjust === product.id ? null : product.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-foreground">{product.name}</h4>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                        </div>
                        <Badge variant={product.station.toLowerCase() === 'bar' ? 'default' : 'secondary'} className="text-xs">
                          {product.station.toLowerCase() === 'bar' ? '🍺' : 
                           product.station.toLowerCase() === 'kitchen' ? '🍽️' : 
                           '📍'}
                        </Badge>
                      </div>
                      <p className="text-3xl font-bold mt-2">
                        {product.stock}
                        <span className="text-sm font-normal text-muted-foreground ml-1">un.</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.stock <= settings.criticalStockAlert
                          ? '🔴 Estoque crítico!'
                          : product.stock <= (product.minStock || settings.lowStockAlert)
                            ? '🟡 Estoque baixo'
                            : '🟢 OK'}
                      </p>

                      {showStockAdjust === product.id && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Button
                              variant={stockAdjustment.type === 'in' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setStockAdjustment({ ...stockAdjustment, type: 'in' })}
                              className="flex-1 gap-1"
                            >
                              <TrendingUp className="w-4 h-4" />
                              Entrada
                            </Button>
                            <Button
                              variant={stockAdjustment.type === 'out' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setStockAdjustment({ ...stockAdjustment, type: 'out' })}
                              className="flex-1 gap-1"
                            >
                              <TrendingDown className="w-4 h-4" />
                              Saída
                            </Button>
                          </div>
                          <Input
                            type="number"
                            placeholder="Quantidade"
                            value={stockAdjustment.quantity || ''}
                            onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: parseInt(e.target.value) || 0 })}
                            className="rounded-lg"
                          />
                          <Button
                            onClick={() => handleStockAdjustment(product.id, product.name)}
                            className="w-full"
                            disabled={!stockAdjustment.quantity}
                          >
                            Confirmar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Histórico de Movimentações */}
              <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Histórico de Movimentações
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stockMovements.slice(0, 10).map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${movement.type === 'in' ? 'bg-success/20' : 'bg-destructive/20'
                          }`}>
                          {movement.type === 'in' ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{movement.productName}</p>
                          <p className="text-sm text-muted-foreground">{movement.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${movement.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                          {movement.type === 'in' ? '+' : '-'}{movement.quantity} un.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.date.toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab D: Marketing */}
            <TabsContent value="marketing" className="mt-0 space-y-6">
              {/* CRM */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Clientes ({customers.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10 w-64 rounded-lg"
                      />
                    </div>
                    <Button onClick={() => setShowAddCustomer(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Novo Cliente
                    </Button>
                  </div>
                </div>

                {/* Add Customer Form */}
                {showAddCustomer && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Novo Cliente</h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowAddCustomer(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          value={newCustomer.name}
                          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone *</Label>
                        <Input
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Aniversário</Label>
                        <Input
                          type="date"
                          onChange={(e) => setNewCustomer({ ...newCustomer, birthday: new Date(e.target.value) })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Observações</Label>
                        <Input
                          value={newCustomer.notes}
                          onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddCustomer(false)}>Cancelar</Button>
                      <Button onClick={handleAddCustomer} className="gap-2">
                        <Save className="w-4 h-4" />
                        Salvar Cliente
                      </Button>
                    </div>
                  </div>
                )}

                {/* Customers List */}
                <div className="border rounded-xl bg-card/30 overflow-hidden">
                  <ScrollArea className="max-h-[400px] w-full">
                    <div className="p-4 space-y-2">

                      {filteredCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-lg font-bold text-primary">{customer.name.charAt(0)}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-foreground">{customer.name}</h4>
                                {customer.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </span>
                                {customer.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {customer.email}
                                  </span>
                                )}
                                {customer.birthday && (
                                  <span className="flex items-center gap-1">
                                    <Gift className="w-3 h-3" />
                                    {customer.birthday.toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              {customer.notes && (
                                <p className="text-sm text-muted-foreground mt-1 italic">"{customer.notes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-sm text-foreground">{customer.lastVisit.toLocaleDateString('pt-BR')}</p>
                              <p className="text-xs text-muted-foreground">última visita</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon">
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteCustomer(customer.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>


              {/* Campanhas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Campanhas
                  </h3>
                  <Button onClick={() => setShowAddCampaign(true)} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nova Campanha
                  </Button>
                </div>

                {/* Add Campaign Form */}
                {showAddCampaign && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Nova Campanha</h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowAddCampaign(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Campanha *</Label>
                        <Input
                          value={newCampaign.name}
                          onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de Envio</Label>
                        <Input
                          type="datetime-local"
                          onChange={(e) => setNewCampaign({ ...newCampaign, scheduledDate: new Date(e.target.value), status: 'scheduled' })}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Mensagem *</Label>
                        <Textarea
                          value={newCampaign.message}
                          onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                          className="rounded-lg"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Tags de Destino</Label>
                        <div className="flex flex-wrap gap-2">
                          {allTags.map(tag => (
                            <Badge
                              key={tag}
                              variant={newCampaign.targetTags?.includes(tag) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                const current = newCampaign.targetTags || [];
                                setNewCampaign({
                                  ...newCampaign,
                                  targetTags: current.includes(tag)
                                    ? current.filter(t => t !== tag)
                                    : [...current, tag]
                                });
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddCampaign(false)}>Cancelar</Button>
                      <Button onClick={handleAddCampaign} className="gap-2">
                        <Save className="w-4 h-4" />
                        Salvar Campanha
                      </Button>
                    </div>
                  </div>
                )}

                {/* Campaigns List */}
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{campaign.name}</h4>
                          <Badge variant={
                            campaign.status === 'sent' ? 'default' :
                              campaign.status === 'scheduled' ? 'secondary' : 'outline'
                          }>
                            {campaign.status === 'sent' ? 'Enviada' :
                              campaign.status === 'scheduled' ? 'Agendada' : 'Rascunho'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{campaign.message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            {campaign.targetTags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                          {campaign.scheduledDate && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {campaign.scheduledDate.toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {campaign.status === 'sent' && campaign.sentCount && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-success">{campaign.sentCount}</p>
                            <p className="text-xs text-muted-foreground">enviados</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {campaign.status === 'draft' && (
                            <Button variant="outline" size="sm" className="gap-1">
                              <Send className="w-4 h-4" />
                              Enviar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => deleteCampaign(campaign.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab E: Pagamentos */}
            <TabsContent value="payments" className="mt-0 h-full flex items-center justify-center">
              <div className="bg-secondary/30 rounded-xl p-12 text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Módulo de Pagamentos em Breve
                </h3>
                <p className="text-muted-foreground">
                  Estamos trabalhando para trazer integração completa com métodos de pagamento.
                </p>
              </div>
            </TabsContent>

            {/* Tab F: Downloads */}
            <TabsContent value="downloads" className="mt-0 space-y-6 data-[state=active]:block">
              <div className="bg-secondary/20 rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-primary/10 to-transparent px-6 py-4 border-b border-primary/5">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    Downloads e Recursos Locais
                  </h3>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card do Executável do Agente */}
                    <div className="bg-background border border-border rounded-xl p-5 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm">
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Printer className="w-5 h-5 text-primary" />
                        </div>
                        <h4 className="font-bold text-base text-foreground">Agente de Impressão Local (Windows)</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Aplicativo oficial do PedeAí para Windows. Permite a impressão automática de novos pedidos e fechamentos de conta diretamente em impressoras USB ou seriais sem diálogos do sistema.
                        </p>
                      </div>
                      <div className="mt-5">
                        <a href="/pedeai-printer.exe" download="pedeai-printer.exe">
                          <Button className="w-full gap-2 rounded-lg">
                            <Download className="w-4 h-4" />
                            Baixar Executável (.exe)
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* Card da Pasta Completa/Configuração */}
                    <div className="bg-background border border-border rounded-xl p-5 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm">
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Settings2 className="w-5 h-5 text-primary" />
                        </div>
                        <h4 className="font-bold text-base text-foreground">Instruções e Exemplo de Configuração</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Visualizar ou baixar o arquivo de exemplo de configuração contendo os parâmetros de conexão com o banco de dados e as portas USB/TCP-IP das suas impressoras.
                        </p>
                      </div>
                      <div className="mt-5">
                        <a href="/printer-config-example.txt" target="_blank">
                          <Button variant="outline" className="w-full gap-2 rounded-lg">
                            Visualizar Exemplo (.env)
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Instruções Rápidas de Configuração */}
                  <div className="bg-secondary/10 border border-border rounded-xl p-5 space-y-4">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      Guia de Instalação Rápida
                    </h4>
                    <div className="text-xs text-muted-foreground space-y-3 leading-relaxed">
                      <p>
                        <strong>1. Execução do Agente:</strong> Faça o download do arquivo <code>pedeai-printer.exe</code> no computador que está conectado fisicamente às impressoras do estabelecimento.
                      </p>
                      <p>
                        <strong>2. Configuração das Variáveis:</strong> Crie um arquivo chamado <code>.env</code> na mesma pasta do executável utilizando os parâmetros do arquivo de exemplo de configuração acima. Preencha com a URL do Supabase, a chave de acesso do seu restaurante e as portas das impressoras.
                      </p>
                      <p>
                        <strong>3. Descobrir portas USB no Windows:</strong> Abra o PowerShell no Windows e execute o comando abaixo para listar o nome exato da porta da sua impressora física (ex: <code>\\.\USB001</code>):
                        <pre className="mt-1.5 p-2.5 bg-background rounded border border-border font-mono text-[10px] text-foreground select-all">
                          Get-WmiObject Win32_Printer | Select Name, PortName
                        </pre>
                      </p>
                      <p>
                        <strong>4. Inicialização Automática:</strong> Para fazer o agente iniciar junto com o Windows, crie um atalho do programa ou do script de inicialização e coloque-o na pasta de Inicialização do Windows (Startup):
                        <code className="block mt-1 p-1 bg-background rounded border border-border font-mono text-[9px] text-foreground">
                          C:\Users\SEU_USUARIO\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
                        </code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Módulo de IA & WhatsApp removido das configurações visuais */}
            {/* Aba de Estações e Categorias movida para o painel /admin */}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
