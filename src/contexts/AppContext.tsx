import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant, Restaurant } from '@/hooks/useRestaurant';
import { usePedidos, ParsedPedido } from '@/hooks/usePedidos';
import { useProdutos, ProdutoSupabase } from '@/hooks/useProdutos';
import { useUsuarios, UsuarioSupabase } from '@/hooks/useUsuarios';
import { useMensagens } from '@/hooks/useMensagens';
import { useMacarroes, Macarrao } from '@/hooks/useMacarroes';
import { useSaboresPizza, SaborPizza } from '@/hooks/useSaboresPizza';
import { useImpressoras, Printer } from '@/hooks/useImpressoras';
import { useCategorias, CategoriaRestaurante } from '@/hooks/useCategorias';
import { useEstacoes, EstacaoRestaurante } from '@/hooks/useEstacoes';
import { validateLoginInput } from '@/lib/auth-validation';
import { toast } from 'sonner';
import { printOrder } from '@/lib/print-utils';
import { printViaWebBluetooth, printToDevice } from '@/services/printerService';
import { isSystemMarkerItem } from '@/lib/utils';
import { apiFetch } from '@/lib/api-config';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  station: string;
  stock: number;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  minStock?: number;
  costPrice?: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  description?: string;
}

export interface Order {
  id: string;
  tableId: number;
  items: OrderItem[];
  station: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  printStatus?: 'printed' | 'error';
  createdAt: Date;
}

export interface Table {
  id: number;
  status: 'free' | 'occupied';
  alert?: 'waiter' | 'bill' | null;
  orders: Order[];
  consumption: OrderItem[];
  comandas: Comanda[];
}

export interface ComandaItem extends OrderItem {
  pedidoId: number;
  isDivided: boolean;
  divisionCount?: number;
  originalPrice?: number;
}

export interface Comanda {
  telefone: string;
  nome: string;
  items: ComandaItem[];
  subtotal: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visits: number;
  lastVisit: Date;
  totalSpent: number;
  tags: string[];
  notes?: string;
  birthday?: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  date: Date;
}

export type { Printer };

export interface Campaign {
  id: string;
  name: string;
  message: string;
  targetTags: string[];
  scheduledDate?: Date;
  status: 'draft' | 'scheduled' | 'sent';
  sentCount?: number;
}

interface UndoAction {
  type: 'deliver_order' | 'close_table' | 'resolve_alert';
  data: any;
  timestamp: number;
}

interface AppSettings {
  totalTables: number;
  flashingEnabled: boolean;
  restaurantName: string;
  openingTime: string;
  closingTime: string;
  kitchenClosingTime?: string;
  autoCloseTable: boolean;
  soundEnabled: boolean;
  lowStockAlert: number;
  criticalStockAlert: number;
  acceptPix: boolean;
  acceptCard: boolean;
  acceptCash: boolean;
  serviceFee: number;
  whatsappNumber: string;
  printers: Printer[];
  autoPrintEnabled: boolean;
  inventoryEnabled: boolean;
  billingMode: 'mesa' | 'comanda';
  pizzaBillingMode: 'mais_cara' | 'soma_metades';
  meiaPizzaHabilitada: boolean;
  couvertHabilitado: boolean;
  couvertValor: number;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AppContextType {
  isAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  restaurantId: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  adminLogin: (email: string, password: string) => Promise<AuthResult>;
  adminLogout: () => void;
  tables: Table[];
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  saveSettingsToSupabase: () => Promise<boolean>;
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<boolean>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<void>;
  updateAndSaveSetting: (updates: Partial<Restaurant>) => Promise<boolean>;
  orders: Order[];
  addOrder: (tableId: number, items: OrderItem[], station: string) => Promise<void>;
  deliverOrder: (orderId: string) => void;
  reprintOrder: (orderId: string) => void;
  updateTableAlert: (tableId: number, alert: 'waiter' | 'bill' | null) => void;
  closeTable: (tableId: number, skipWebhook?: boolean) => Promise<void>;
  addItemToTable: (tableId: number, item: OrderItem, usuarioTelefone?: string) => Promise<void>;
  customers: Customer[];
  restaurant: any; // Exposed to allow access to max_mesas and other DB raw data
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  stockMovements: StockMovement[];
  addStockMovement: (movement: Omit<StockMovement, 'id' | 'date'>) => void;
  campaigns: Campaign[];
  addCampaign: (campaign: Omit<Campaign, 'id'>) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  undoAction: UndoAction | null;
  performUndo: () => void;
  clearUndo: () => void;
  filter: string;
  setFilter: (filter: string) => void;
  loadingData: boolean;
  pedidos: ParsedPedido[];
  updatePedidoStatus: (pedidoId: number, status: string) => Promise<{ error: string | null }>;
  deletePedido: (pedidoId: number) => Promise<{ error: string | null }>;
  // Metrics
  getMetrics: (startDate?: Date, endDate?: Date) => {
    totalSales: number;
    pendingOrders: number;
    topProducts: any[];
    totalOrders: number;
  };
  loadingPedidos: boolean;
  requestBill: (tableId: number, manual?: boolean) => Promise<void>;
  localAutoPrint: boolean;
  setLocalAutoPrint: (value: boolean) => void;
  mensagens: any;
  usuarios: UsuarioSupabase[];
  refetchUsuarios: () => void;
  closeComanda: (tableId: number, telefone: string) => Promise<void>;
  splitItem: (pedidoId: number, phones: string[]) => Promise<void>;
  unsplitItem: (pedidoId: number) => Promise<void>;
  macarroes: Macarrao[];
  addMacarrao: (nome: string) => Promise<boolean>;
  updateMacarrao: (id: number, updates: Partial<{ nome: string; ativo: boolean }>) => Promise<boolean>;
  deleteMacarrao: (id: number) => Promise<boolean>;
  refetchMacarroes: () => Promise<void>;
  saboresPizza: SaborPizza[];
  addSaborPizza: (nome: string, preco: number, descricao?: string, estoque?: number, estoque_minimo?: number, estacao?: string) => Promise<boolean>;
  updateSaborPizza: (id: number, updates: Partial<{ nome: string; preco: number; ativo: boolean; descricao: string; estoque: number; estoque_minimo: number; estacao: string }>) => Promise<boolean>;
  deleteSaborPizza: (id: number) => Promise<boolean>;
  refetchSaboresPizza: () => Promise<void>;
  categorias: CategoriaRestaurante[];
  addCategoria: (nome: string) => Promise<boolean>;
  updateCategoria: (id: number, nome: string) => Promise<boolean>;
  deleteCategoria: (id: number) => Promise<boolean>;
  refetchCategorias: () => Promise<void>;
  estacoes: EstacaoRestaurante[];
  addEstacao: (nome: string) => Promise<boolean>;
  updateEstacao: (id: number, nome: string) => Promise<boolean>;
  deleteEstacao: (id: number) => Promise<boolean>;
  refetchEstacoes: () => Promise<void>;
  savePrinters: (printers: Printer[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getInitialPrinters = (): Printer[] => {
  try {
    const saved = localStorage.getItem('pedeai_printers');
    if (saved) {
      return JSON.parse(saved).map((p: any) => ({ ...p, isActive: p.isActive !== false }));
    }
  } catch (e) {
    console.error('Erro ao inicializar impressoras do LocalStorage:', e);
  }
  return [];
};
const initialPrinters = getInitialPrinters();

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [restaurantId, setRestaurantId] = useState<string | null>(() => {
    // Check localStorage for existing session
    return localStorage.getItem('pedeai_restaurant_id');
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('pedeai_admin_auth') === 'true';
  });
  const [loadingData, setLoadingData] = useState(true);

  const isAuthenticated = !!restaurantId;

  const [settings, setSettings] = useState<AppSettings>({
    totalTables: 12,
    flashingEnabled: true,
    restaurantName: 'Meu Restaurante',
    openingTime: '11:00',
    closingTime: '23:00',
    autoCloseTable: true,
    soundEnabled: true,
    lowStockAlert: 15,
    criticalStockAlert: 5,
    acceptPix: true,
    acceptCard: true,
    acceptCash: true,
    serviceFee: 10,
    whatsappNumber: '',
    printers: initialPrinters,
    autoPrintEnabled: false,
    inventoryEnabled: true,
    billingMode: 'mesa',
    pizzaBillingMode: 'mais_cara',
    meiaPizzaHabilitada: false,
    couvertHabilitado: false,
    couvertValor: 0,
  });

  // Empty initial states - no mock data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const isSavingRef = React.useRef(false); // Proteção contra polling
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const [localAutoPrint, setLocalAutoPrintState] = useState<boolean>(() => {
    const saved = localStorage.getItem('pedeai_local_autoprint');
    // Se for nulo (não configurado no localStorage), o padrão será true
    return saved === null ? true : saved === 'true';
  });

  const setLocalAutoPrint = (value: boolean) => {
    setLocalAutoPrintState(value);
    localStorage.setItem('pedeai_local_autoprint', value.toString());
  };

  // Use Supabase hooks
  const { restaurant, updateRestaurant, refetch: refetchRestaurant } = useRestaurant(restaurantId);
  const {
    pedidos,
    getMetrics,
    loading: loadingPedidos,
    updatePedidoStatus,
    deletePedido,
    updateTablePedidosStatus,
    refetch: refetchPedidos
  } = usePedidos(restaurantId);
  const {
    produtos: produtosDb,
    addProduto,
    updateProduto,
    deleteProduto,
    refetch: refetchProdutos
  } = useProdutos(restaurantId);

  const {
    macarroes,
    addMacarrao,
    updateMacarrao,
    deleteMacarrao,
    refetchMacarroes
  } = useMacarroes(restaurantId);

  const {
    saboresPizza,
    addSaborPizza,
    updateSaborPizza,
    deleteSaborPizza,
    refetchSaboresPizza
  } = useSaboresPizza(restaurantId);

  const {
    categorias,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    refetchCategorias
  } = useCategorias(restaurantId);

  const {
    estacoes,
    addEstacao,
    updateEstacao,
    deleteEstacao,
    refetchEstacoes
  } = useEstacoes(restaurantId);

  const {
    dbPrinters,
    addImpressora,
    updateImpressora,
    deleteImpressora
  } = useImpressoras(restaurantId);
  const {
    usuarios,
    addUsuario,
    updateUsuario,
    deleteUsuario,
    refetch: refetchUsuarios
  } = useUsuarios(restaurantId);

  const allowedContacts = useMemo(() => customers.map(c => ({ phone: c.phone, name: c.name })), [customers]);
  const mensagensData = useMensagens(restaurantId, allowedContacts);
  console.log('[AppContext] authorized contacts phones:', allowedContacts.slice(0, 2).map(c => c.phone));

  // Check for existing session on mount
  useEffect(() => {
    const storedId = localStorage.getItem('pedeai_restaurant_id');
    if (storedId) {
      setRestaurantId(storedId);
    }
    const adminAuth = localStorage.getItem('pedeai_admin_auth');
    if (adminAuth === 'true') {
      setIsAdminAuthenticated(true);
    }
    setLoadingData(false);
  }, []);

  // Poll for updates every 2 seconds
  useEffect(() => {
    if (!restaurantId) return;

    const interval = setInterval(() => {
      refetchPedidos({ silent: true });
      refetchProdutos({ silent: true });
      refetchUsuarios({ silent: true });

      // Só busca restaurante se não estiver salvando no momento
      if (!isSavingRef.current) {
        refetchRestaurant({ silent: true });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [restaurantId, refetchPedidos, refetchProdutos, refetchRestaurant]);

  // Sync restaurant data with settings
  useEffect(() => {
    if (restaurant) {
      setSettings(prev => ({
        ...prev,
        restaurantName: restaurant.nome || 'Meu Restaurante',
        totalTables: parseInt(restaurant.quantidade_mesas || '12', 10),
        kitchenClosingTime: restaurant.horario_fecha_cozinha || undefined,
        whatsappNumber: restaurant.telefone || '',
        openingTime: restaurant.horario_abertura || '11:00',
        closingTime: restaurant.horario_fechamento || '23:00',
        autoCloseTable: restaurant.fechar_mesa_auto ?? true,
        flashingEnabled: restaurant.alertas_piscantes ?? true,
        soundEnabled: restaurant.sons_habilitados ?? true,
        lowStockAlert: restaurant.alerta_estoque_baixo ?? 15,
        criticalStockAlert: restaurant.alerta_estoque_critico ?? 5,
        autoPrintEnabled: restaurant.impressao_auto ?? false,
        serviceFee: restaurant.taxa_servico ?? 0,
        inventoryEnabled: restaurant.gerencia_estoque ?? true,
        billingMode: (restaurant.modo_cobranca as 'mesa' | 'comanda') || 'mesa',
        pizzaBillingMode: (restaurant.cobranca_meio_a_meio as 'mais_cara' | 'soma_metades') || 'mais_cara',
        meiaPizzaHabilitada: restaurant.meia_pizza_habilitada ?? false,
        couvertHabilitado: restaurant.couvert_habilitado ?? false,
        couvertValor: restaurant.couvert_valor ?? 0,
      }));
    }
  }, [restaurant]);

  // Convert active pedidos to orders format for compatibility
  useEffect(() => {
    // CRITICAL: Only consider pedidos that are NOT 'fechado' (closed) AND created within the last 24 hours
    // This prevents old zombie orders from previous months piling up if they were never properly closed.
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activePedidos = pedidos.filter(p => {
      if (p.status === 'fechado' || p.status === 'dividido') return false;
      return new Date(p.created_at) >= cutoffTime;
    });

    console.log('[Table Sync] Total pedidos:', pedidos.length, 'Active (non-fechado, <24h):', activePedidos.length);

    const convertedOrders: Order[] = activePedidos.map(p => ({
      id: p.id.toString(),
      tableId: parseInt(String(p.mesa), 10),
      items: p.itens.map((item, idx) => ({
        productId: `db-${p.id}-${idx}`,
        productName: item.nome,
        quantity: item.quantidade,
        price: item.preco,
        description: p.descricao,
      })),
      station: 'kitchen' as const,
      status: p.status === 'pendente' ? 'pending' as const :
        p.status === 'preparando' ? 'preparing' as const :
          p.status === 'pronto' ? 'ready' as const : 'delivered' as const,
      printStatus: 'printed' as const,
      createdAt: p.created_at,
    }));
    setOrders(convertedOrders);

    // Keep tables in sync with orders coming from the DB (e.g. WhatsApp bot)
    // Rule: table becomes occupied if there is at least one active (non-closed) pedido
    //        OR if there is a user checked-in at that table (Usuários with mesa_atual).
    const mesasComPedidos = new Set(activePedidos.map(p => parseInt(String(p.mesa), 10)));
    const mesasComContaPedida = new Set(activePedidos.filter(p => p.status === 'pagamento_pendente').map(p => parseInt(String(p.mesa), 10)));

    // Check-in: Usuários com mesa_atual ativa (com auto-heal de check-ins órfãos)
    const mesasComCheckin = new Set<number>();
    const checkinNomes = new Map<number, string>();
    for (const u of usuarios) {
      const mesaNum = parseInt(String(u.mesa_atual || '0'), 10);
      if (mesaNum > 0) {
        // Auto-heal: verificar se o check-in tem atividade recente
        const temPedidoAtivo = mesasComPedidos.has(mesaNum);
        // Usar ultimo_checkin (data do último check-in) com fallback para created_at
        const checkinTimestamp = new Date(u.ultimo_checkin || u.created_at);
        const checkinRecente = (Date.now() - checkinTimestamp.getTime()) < 4 * 60 * 60 * 1000; // 4h

        if (temPedidoAtivo || checkinRecente) {
          mesasComCheckin.add(mesaNum);
          checkinNomes.set(mesaNum, u.nome || 'Cliente');
        } else {
          console.warn(`[Table Sync] ⚠️ Check-in órfão ignorado: ${u.nome} na mesa ${mesaNum} (sem atividade, check-in > 4h)`);
        }
      }
    }

    console.log('[Table Sync] Mesas com pedidos ativos:', Array.from(mesasComPedidos));
    console.log('[Table Sync] Mesas com check-in:', Array.from(mesasComCheckin));
    console.log('[Table Sync] Mesas com conta pedida:', Array.from(mesasComContaPedida));

    // Also sync table consumption from DB active pedidos (source of truth).
    const consumoPorMesa = new Map<number, OrderItem[]>();
    // Comandas: agrupar por mesa + usuario_telefone
    const comandasPorMesa = new Map<number, Map<string, { nome: string; items: ComandaItem[] }>>();

    for (const pedido of activePedidos) {
      const tableId = parseInt(String(pedido.mesa), 10);
      // Ignorar pedidos com status 'dividido' (original que foi clonado)
      if (pedido.status === 'dividido') continue;

      const items = pedido.itens.map((it, idx) => ({
        productId: `db-${pedido.id}-${idx}`,
        productName: it.nome,
        quantity: it.quantidade,
        price: it.preco,
        description: pedido.descricao,
      }));
      consumoPorMesa.set(tableId, [...(consumoPorMesa.get(tableId) ?? []), ...items]);

      // Build comandas map
      const telefone = pedido.usuario_telefone || 'mesa';
      if (!comandasPorMesa.has(tableId)) comandasPorMesa.set(tableId, new Map());
      const mesaMap = comandasPorMesa.get(tableId)!;
      if (!mesaMap.has(telefone)) {
        const usuario = usuarios.find(u => u.telefone === telefone);
        mesaMap.set(telefone, { nome: usuario?.nome || 'Mesa', items: [] });
      }
      const comanda = mesaMap.get(telefone)!;
      const isDivided = pedido.descricao?.includes('÷') || false;
      pedido.itens.forEach((it, idx) => {
        if (!isSystemMarkerItem(it.nome)) {
          comanda.items.push({
            productId: `db-${pedido.id}-${idx}`,
            productName: it.nome,
            quantity: it.quantidade,
            price: it.preco,
            description: pedido.descricao,
            pedidoId: pedido.id,
            isDivided,
            divisionCount: isDivided ? parseInt(pedido.descricao?.match(/÷(\d+)/)?.[1] || '1') : undefined,
            originalPrice: isDivided ? it.preco * (parseInt(pedido.descricao?.match(/÷(\d+)/)?.[1] || '1')) : undefined,
          });
        }
      });
    }

    // Garantir que usuários com check-in tenham comanda (mesmo sem pedidos)
    // Isso faz a comanda aparecer no modal assim que o cliente faz check-in
    if (settings.billingMode === 'comanda') {
      for (const u of usuarios) {
        const mesaNum = parseInt(String(u.mesa_atual || '0'), 10);
        if (mesaNum > 0 && mesasComCheckin.has(mesaNum)) {
          const telefone = u.telefone || 'mesa';
          if (!comandasPorMesa.has(mesaNum)) comandasPorMesa.set(mesaNum, new Map());
          const mesaMap = comandasPorMesa.get(mesaNum)!;
          if (!mesaMap.has(telefone)) {
            mesaMap.set(telefone, { nome: u.nome || 'Cliente', items: [] });
          }
        }
      }
    }

    setTables(prev =>
      prev.map(t => {
        const consumo = consumoPorMesa.get(t.id) ?? [];
        // Mark as occupied if there are ACTIVE pedidos OR an active check-in
        const shouldBeOccupied = mesasComPedidos.has(t.id) || mesasComCheckin.has(t.id);
        const hasBillRequested = mesasComContaPedida.has(t.id);

        // Check for waiter call in active pedidos (using status 'garcom_pendente')
        const hasWaiterCall = activePedidos.some(p =>
          p.mesa === t.id &&
          (p.status === 'garcom_pendente')
        );

        const newStatus = shouldBeOccupied ? 'occupied' : 'free';
        const newAlert = hasBillRequested ? 'bill' : (hasWaiterCall ? 'waiter' : null);

        // Log changes for debugging
        if (t.status !== newStatus || t.alert !== newAlert) {
          console.log(`[Table Sync] Mesa ${t.id}: status ${t.status} -> ${newStatus}, alert ${t.alert} -> ${newAlert}`);
        }

        return {
          ...t,
          status: newStatus,
          alert: newAlert,
          consumption: consumo,
          comandas: settings.billingMode === 'comanda'
            ? Array.from((comandasPorMesa.get(t.id) || new Map()).entries()).map(
                ([tel, data]) => ({
                  telefone: tel,
                  nome: data.nome,
                  items: data.items,
                  subtotal: data.items.reduce((s, i) => s + i.price * i.quantity, 0),
                })
              )
            : [],
        };
      })
    );
  }, [pedidos, usuarios, settings.billingMode]);

  // --- LOGICA DE IMPRESSÃO AUTOMÁTICA ---
  const printedOrdersRef = React.useRef<Set<number>>(new Set());
  const initialSyncDone = React.useRef(false);

  // Carrega histórico de IDs já impressos do localStorage para evitar reimpressões ao atualizar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pedeai_printed_order_ids');
      if (saved) {
        const ids: number[] = JSON.parse(saved);
        ids.forEach(id => printedOrdersRef.current.add(id));
      }
    } catch (e) {}
  }, []);

  const markOrderAsPrinted = useCallback((orderId: number) => {
    printedOrdersRef.current.add(orderId);
    try {
      const ids = Array.from(printedOrdersRef.current).slice(-300); // mantém últimos 300 IDs
      localStorage.setItem('pedeai_printed_order_ids', JSON.stringify(ids));
    } catch (e) {}
  }, []);

  // Sincroniza o Ref inicial para evitar imprimir pedidos antigos ao carregar ou ligar o interruptor
  // No entanto, permite que pedidos criados nos últimos 5 minutos sejam impressos mesmo após recarregamentos ou refreshes rápidos.
  useEffect(() => {
    if (!initialSyncDone.current && pedidos.length > 0) {
      const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
      
      pedidos.forEach(p => {
        const isPendingOrPreparing = p.status?.toLowerCase() === 'pendente' || p.status?.toLowerCase() === 'preparando';
        if (isPendingOrPreparing) {
          const dataPedido = new Date(p.created_at);
          // Se o pedido foi criado há mais de 5 minutos, marca como já impresso para não imprimir em lote
          if (dataPedido < cincoMinutosAtras) {
            markOrderAsPrinted(p.id);
          } else {
            console.log(`[AutoPrint] Pedido recente #${p.id} detectado na carga inicial (${dataPedido.toLocaleTimeString()}). Será impresso automaticamente.`);
          }
        }
      });
      initialSyncDone.current = true;
      console.log(`[AutoPrint] Ref inicial sincronizado. Ignorados ${printedOrdersRef.current.size} pedidos antigos.`);
    }
  }, [pedidos, markOrderAsPrinted]);

  useEffect(() => {
    if (!settings.autoPrintEnabled || !localAutoPrint) return;

    // Filtra pedidos pendentes que ainda não foram impressos nesta sessão
    const newPendingOrders = pedidos.filter(p => {
      const isPending = p.status?.toLowerCase() === 'pendente';
      const notPrintedYet = !printedOrdersRef.current.has(p.id);

      // Filtra pedidos que são apenas marcadores de abertura de mesa
      const isNotOnlySystemMarker = !p.itens.every(item =>
        isSystemMarkerItem(item.nome)
      );

      return isPending && notPrintedYet && isNotOnlySystemMarker;
    });

    if (newPendingOrders.length > 0) {
      console.log(`[AutoPrint] Detectados ${newPendingOrders.length} novos pedidos.`);

      newPendingOrders.forEach(async (pedido) => {
        // Marca IMEDIATAMENTE e de forma PERMANENTE para evitar qualquer loop de disparo
        markOrderAsPrinted(pedido.id);

        // No modo comanda, buscar nome do cliente pelo telefone
        let printData: any = pedido;
        if (settings.billingMode === 'comanda' && pedido.usuario_telefone) {
          const usuario = usuarios.find(u => u.telefone === pedido.usuario_telefone);
          printData = { ...pedido, clienteNome: usuario?.nome || undefined };
        }

        console.log(`[AutoPrint] Imprimindo pedido #${pedido.id}...`);
        
        const activePrinters = settings.printers.filter(p => p.isActive);
        
        if (activePrinters.length === 0) {
          // Fallback: Nenhuma impressora cadastrada, envia cupom completo para o dispositivo bluetooth ativo padrão
          const success = await printViaWebBluetooth(printData, settings.restaurantName);
          if (success) {
            toast.success(`Pedido #${pedido.id} impresso automaticamente!`);
          } else {
            console.warn(`[AutoPrint] Falha ao imprimir cupom único do pedido #${pedido.id}.`);
          }
        } else {
          for (const printer of activePrinters) {
            let itemsToPrint = printData.itens;
            
            if (printer.type && printer.type !== 'all') {
              const printerEstacoes = Array.from(new Set(printer.type.split(',').map(s => s.trim().toLowerCase())));
              itemsToPrint = printData.itens.filter(item => {
                const itemEst = item.estacao ? item.estacao.trim().toLowerCase() : 'kitchen';
                return printerEstacoes.some(pEst => {
                  if (pEst === 'all') return true;
                  if (pEst === itemEst) return true;
                  if ((pEst === 'kitchen' || pEst === 'cozinha') && (itemEst === 'kitchen' || itemEst === 'cozinha')) return true;
                  if (pEst === 'bar' && itemEst === 'bar') return true;
                  if ((pEst === 'receipt' || pEst === 'conta' || pEst === 'recibo') && (itemEst === 'receipt' || itemEst === 'conta' || itemEst === 'recibo')) return true;
                  return false;
                });
              });
            }

            if (itemsToPrint.length > 0) {
              const segmentedData = {
                ...printData,
                itens: itemsToPrint,
                descricao: pedido.descricao || ''
              };
              
              const success = await printToDevice(segmentedData, settings.restaurantName, printer);
              if (!success) {
                toast.error(`Falha ao imprimir na impressora "${printer.name}"`);
              } else {
                toast.success(`Pedido #${pedido.id} enviado para "${printer.name}"`);
              }
            }
          }
        }
      });
    }
  }, [pedidos, settings.autoPrintEnabled, settings.restaurantName, settings.billingMode, settings.printers, localAutoPrint, usuarios, markOrderAsPrinted]);

  // --------------------------------------
  // --------------------------------------

  const generateTables = useCallback((count: number): Table[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      status: 'free' as const,
      alert: null,
      orders: [],
      consumption: [],
      comandas: [],
    }));
  }, []);

  const [tables, setTables] = useState<Table[]>(() => generateTables(settings.totalTables));

  const pedidosRef = React.useRef(pedidos);
  const tablesRef = React.useRef(tables);
  const settingsRef = React.useRef(settings);
  const usuariosRef = React.useRef(usuarios);

  useEffect(() => { pedidosRef.current = pedidos; }, [pedidos]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { usuariosRef.current = usuarios; }, [usuarios]);

  // --- LOGICA DE IMPRESSÃO AUTOMÁTICA DA CONTA (Mesa com status 'bill' ou 'pagamento_pendente') ---
  const printedBillsRef = React.useRef<Set<number>>(new Set());
  // Ref para rastrear se a mesa já estava com conta pedida na carga inicial (para não imprimir contas antigas no F5)
  const initialBillSyncDone = React.useRef(false);

  useEffect(() => {
    if (!initialBillSyncDone.current && tables.length > 0) {
      tables.forEach(t => {
        if (t.alert === 'bill' || t.orders.some(o => o.status === 'pending_payment' as any)) { // 'pending_payment' mapped from 'pagamento_pendente' logic? 
          // Na verdade, verifiquemos com base no alert e se tem consumo
          if (t.alert === 'bill') {
            printedBillsRef.current.add(t.id);
          }
        }
      });
      initialBillSyncDone.current = true;
    }
  }, [tables]);

  useEffect(() => {
    if (!settings.autoPrintEnabled || !localAutoPrint) return;

    tables.forEach(async (table) => {
      // Verifica se a mesa está pedindo conta
      const isBillRequested = table.alert === 'bill';

      // Verifica se já foi impresso nesta sessão
      const alreadyPrinted = printedBillsRef.current.has(table.id);

      if (isBillRequested && !alreadyPrinted && table.consumption.length > 0) {
        console.log(`[AutoPrint] Detectada solicitação de conta na Mesa ${table.id}`);

        // Marca como impresso IMEDIATAMENTE para evitar disparar múltiplos timeouts paralelos nos próximos renders
        printedBillsRef.current.add(table.id);

        // Agendar impressão para dar tempo ao Realtime de receber todas as atualizações em lote do Supabase
        setTimeout(async () => {
          // Acessa as referências atualizadas para evitar dados stale das closures do render original
          const currentTables = tablesRef.current;
          const currentPedidos = pedidosRef.current;
          const currentSettings = settingsRef.current;

          // Busca a mesa correspondente mais atualizada
          const freshTable = currentTables.find(t => t.id === table.id);
          if (!freshTable || freshTable.alert !== 'bill') {
            console.log(`[AutoPrint] Cancelando impressão para Mesa ${table.id}: status alterado.`);
            return;
          }

          console.log(`[AutoPrint] Executando impressão de conta com debounce para Mesa ${table.id}...`);

          // Buscar pedidos com pagamento_pendente desta mesa para obter divisões e saber quem pediu conta
          const pedidosPagamento = currentPedidos.filter(
            p => Number(p.mesa) === freshTable.id && p.status === 'pagamento_pendente'
          );

          let divisoes: number | undefined = undefined;
          const pedidoMarcador = pedidosPagamento.find(p => p.descricao?.includes('Dividido por'));
          if (pedidoMarcador) {
            const match = pedidoMarcador.descricao?.match(/Dividido por (\d+)/);
            if (match) {
              divisoes = parseInt(match[1], 10);
            }
          }

          // No modo comanda, filtrar apenas itens do usuario que pediu conta (pagamento_pendente)
          let consumptionToPrint: typeof freshTable.consumption;
          let billClienteNome: string | undefined;

          if (currentSettings.billingMode === 'comanda') {
            const telefonesComConta = [...new Set(pedidosPagamento.map(p => p.usuario_telefone).filter(Boolean))];

            if (pedidosPagamento.length > 0) {
              // Construir consumptionToPrint direto dos pedidos com pagamento_pendente
              consumptionToPrint = [];
              for (const p of pedidosPagamento) {
                for (const it of p.itens) {
                  if (isSystemMarkerItem(it.nome) || it.nome.toLowerCase().includes('fechamento de conta')) continue;
                  consumptionToPrint.push({
                    productId: `bill-${p.id}`,
                    productName: it.nome,
                    quantity: it.quantidade,
                    price: it.preco,
                    description: p.descricao,
                  });
                }
              }
              // Nome: apenas quem pediu conta
              const nomes = telefonesComConta.map(tel => {
                const comanda = freshTable.comandas?.find(c => c.telefone === tel);
                return comanda?.nome || 'Cliente';
              });
              billClienteNome = nomes.join(', ');
            } else {
              // Fallback: todos os itens
              consumptionToPrint = freshTable.consumption.filter(item => !isSystemMarkerItem(item.productName) && !item.productName.toLowerCase().includes('fechamento de conta'));
              billClienteNome = freshTable.comandas?.map(c => c.nome).filter(n => n !== 'Mesa').join(', ') || freshTable.customerName;
            }
          } else {
            consumptionToPrint = freshTable.consumption.filter(item => !isSystemMarkerItem(item.productName) && !item.productName.toLowerCase().includes('fechamento de conta'));
            billClienteNome = freshTable.customerName || undefined;
          }

          if (consumptionToPrint.length === 0) {
            console.log(`[AutoPrint] Nenhum item para imprimir na Mesa ${table.id}`);
            return;
          }

          const groupedConsumption = consumptionToPrint.reduce((acc, item) => {
            const existing = acc.find(i => i.productName === item.productName && i.price === item.price);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              acc.push({ ...item });
            }
            return acc;
          }, [] as typeof freshTable.consumption);

          const subtotal = consumptionToPrint.reduce((acc, item) => acc + (item.price * item.quantity), 0);
          const serviceFeePercentage = currentSettings.serviceFee || 0;
          const serviceFeeValue = (subtotal * serviceFeePercentage) / 100;

          // Calcular quantidade de comandas ativas (check-ins recentes ou com pedidos na mesa)
          const activeCheckins = usuarios.filter(u => {
            const mesaNum = parseInt(String(u.mesa_atual || '0'), 10);
            if (mesaNum !== freshTable.id) return false;
            
            const temPedidoAtivo = currentPedidos.some(p => Number(p.mesa) === freshTable.id && p.status !== 'fechado' && p.status !== 'dividido');
            const checkinTimestamp = new Date(u.ultimo_checkin || u.created_at);
            const checkinRecente = (Date.now() - checkinTimestamp.getTime()) < 4 * 60 * 60 * 1000;
            return temPedidoAtivo || checkinRecente;
          });

          const couvertValue = currentSettings.couvertHabilitado
            ? (currentSettings.billingMode === 'comanda'
              ? Math.max(1, activeCheckins.length) * currentSettings.couvertValor
              : currentSettings.couvertValor)
            : 0;
          const totalWithFee = subtotal + serviceFeeValue + couvertValue;

          const billData: any = {
            id: `AutoF${freshTable.id}-${Date.now()}`,
            mesa: freshTable.id,
            created_at: new Date(),
            itens: groupedConsumption.map(i => ({
              nome: i.productName,
              quantidade: i.quantity,
              preco: i.price,
              descricao: i.description
            })),
            total: totalWithFee,
            subtotal: subtotal,
            serviceFee: serviceFeeValue,
            serviceFeePercentage: serviceFeePercentage,
            totalWithFee: totalWithFee,
            couvert: couvertValue,
            descricao: 'Fechamento de Conta',
            clienteNome: billClienteNome,
            divisoes: divisoes,
          };

          toast.info(`Imprimindo conta da mesa ${freshTable.id} automaticamente...`, { icon: '🖨️' });

          const receiptPrinters = currentSettings.printers.filter(p => {
            if (!p.isActive) return false;
            if (!p.type || p.type === 'all') return true;
            const types = p.type.split(',').map(t => t.trim().toLowerCase());
            return types.includes('receipt') || types.includes('conta') || types.includes('recibo');
          });

          if (receiptPrinters.length === 0) {
            const success = await printViaWebBluetooth(billData, currentSettings.restaurantName);
            if (!success) {
              console.warn(`[AutoPrint] Falha ao imprimir conta da Mesa ${freshTable.id} via Bluetooth padrão.`);
            }
          } else {
            for (const printer of receiptPrinters) {
              const success = await printToDevice(billData, currentSettings.restaurantName, printer);
              if (!success) {
                console.warn(`[AutoPrint] Falha ao imprimir conta da Mesa ${freshTable.id} na impressora "${printer.name}".`);
              }
            }
          }
        }, 1500); // 1.5 segundos de debounce
      } else if (!isBillRequested && alreadyPrinted) {
        // Se a mesa não está mais pedindo conta (ex: pagou/fechou), removemos do set para permitir nova impressão futura se reabrirem
        printedBillsRef.current.delete(table.id);
      }
    });

  }, [tables, settings.autoPrintEnabled, settings.restaurantName, settings.serviceFee, settings.billingMode, settings.printers, localAutoPrint, pedidos, usuarios]);

  // Update tables when settings change
  useEffect(() => {
    setTables(currentTables => {
      if (settings.totalTables > currentTables.length) {
        return [
          ...currentTables,
          ...Array.from({ length: settings.totalTables - currentTables.length }, (_, i) => ({
            id: currentTables.length + i + 1,
            status: 'free' as const,
            alert: null,
            orders: [],
            consumption: [],
          })),
        ];
      }
      return currentTables.slice(0, settings.totalTables);
    });
  }, [settings.totalTables]);

  // Login via servidor Backend Fastify ou fallback direto via Supabase Client (Vercel Standalone)
  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    // Validate input
    const validation = validateLoginInput(email, password);
    if (!validation.isValid) {
      const errorMessage = validation.errors.email || validation.errors.password || 'Dados inválidos';
      return { success: false, error: errorMessage };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.restauranteId) {
            localStorage.setItem('pedeai_restaurant_id', data.restauranteId);
            setRestaurantId(data.restauranteId);
            return { success: true };
          }
          return { success: false, error: data.error || 'Email ou senha inválidos' };
        }
      } catch (err) {
        console.warn('[Auth] Backend indisponível, usando fallback Supabase direto...');
      }
    }

    // Fallback direto via Supabase (para Vercel / ambiente estático)
    try {
      const { data, error } = await supabase
        .from('Restaurantes')
        .select('id, email, senha')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      if (data.senha !== password) {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      localStorage.setItem('pedeai_restaurant_id', data.id);
      setRestaurantId(data.id);
      return { success: true };
    } catch (err) {
      console.error('[Auth] Erro ao autenticar no Supabase:', err);
      return { success: false, error: 'Erro de conexão com o banco de dados. Tente novamente.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pedeai_restaurant_id');
    setRestaurantId(null);
  }, []);

  const adminLogin = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const trimmedEmail = email.trim().toLowerCase();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            localStorage.setItem('pedeai_admin_auth', 'true');
            setIsAdminAuthenticated(true);
            return { success: true };
          }
          return { success: false, error: data.error || 'Credenciais de administrador inválidas' };
        }
      } catch (err) {
        console.warn('[Auth] Backend indisponível para admin-login, usando fallback Supabase direto...');
      }
    }

    // Fallback direto via Supabase (para Vercel / ambiente estático)
    try {
      const { data, error } = await supabase
        .from('admin_acessos')
        .select('*')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Credenciais de administrador inválidas' };
      }

      if (data.senha !== password) {
        return { success: false, error: 'Credenciais de administrador inválidas' };
      }

      localStorage.setItem('pedeai_admin_auth', 'true');
      setIsAdminAuthenticated(true);
      return { success: true };
    } catch (err) {
      console.error('Admin login error:', err);
      return { success: false, error: 'Erro ao realizar login de administrador' };
    }
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem('pedeai_admin_auth');
    setIsAdminAuthenticated(false);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const savePrinters = useCallback(async (updatedPrinters: Printer[]) => {
    // 1. Identificar as locais (bluetooth, browser) e salvar no localStorage
    const local = updatedPrinters.filter(p => p.connectionType === 'bluetooth' || p.connectionType === 'browser');
    try {
      localStorage.setItem('pedeai_printers', JSON.stringify(local));
    } catch (e) {
      console.error('Erro ao salvar impressoras locais no LocalStorage:', e);
    }

    // 2. Identificar as do banco (tcp, usb)
    const incomingDb = updatedPrinters.filter(p => p.connectionType === 'tcp' || p.connectionType === 'usb');

    // 3. Processar exclusões (impressoras que estão em dbPrinters mas sumiram na nova lista)
    const currentDbMap = new Map(dbPrinters.map(p => [p.id, p]));
    const incomingDbIds = new Set(incomingDb.map(p => p.id));
    for (const cur of dbPrinters) {
      if (!incomingDbIds.has(cur.id)) {
        await deleteImpressora(cur.id);
      }
    }

    // 4. Processar inserções e atualizações
    for (const printer of incomingDb) {
      const isNew = isNaN(Number(printer.id)) || !currentDbMap.has(printer.id);
      if (isNew) {
        await addImpressora({
          name: printer.name,
          type: printer.type,
          connectionType: printer.connectionType,
          ipAddress: printer.ipAddress,
          port: printer.port,
          usbPath: printer.usbPath
        });
      } else {
        const existing = currentDbMap.get(printer.id)!;
        const hasChanges = 
          existing.name !== printer.name ||
          existing.type !== printer.type ||
          existing.connectionType !== printer.connectionType ||
          existing.ipAddress !== printer.ipAddress ||
          existing.port !== printer.port ||
          existing.usbPath !== printer.usbPath ||
          existing.isActive !== printer.isActive ||
          existing.larguraBobina !== printer.larguraBobina;

        if (hasChanges) {
          await updateImpressora(printer.id, {
            name: printer.name,
            type: printer.type,
            connectionType: printer.connectionType,
            ipAddress: printer.ipAddress,
            port: printer.port,
            usbPath: printer.usbPath,
            isActive: printer.isActive,
            larguraBobina: printer.larguraBobina
          });
        }
      }
    }

    // 5. Atualizar o estado local imediatamente
    setSettings(prev => ({
      ...prev,
      printers: [...local, ...incomingDb]
    }));
  }, [dbPrinters, addImpressora, updateImpressora, deleteImpressora]);

  // Combina as impressoras locais com as do banco sempre que as do banco atualizarem
  useEffect(() => {
    const local = getInitialPrinters();
    setSettings(prev => ({
      ...prev,
      printers: [...local, ...dbPrinters]
    }));
  }, [dbPrinters]);

  const saveSettingsToSupabase = useCallback(async () => {
    // Mantido por compatibilidade, mas moveremos para updateAndSaveSetting
    return true;
  }, [restaurantId, settings]);

  const updateAndSaveSetting = useCallback(async (updates: Partial<Restaurant>) => {
    if (!restaurantId) return false;

    // 1. Bloqueia o polling
    isSavingRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    try {
      // 2. Atualiza localmente IMEDIATAMENTE (Otimista)
      setSettings(prev => ({
        ...prev,
        restaurantName: updates.nome !== undefined ? (updates.nome || '') : prev.restaurantName,
        totalTables: updates.quantidade_mesas !== undefined ? parseInt(updates.quantidade_mesas || '0') : prev.totalTables,
        kitchenClosingTime: updates.horario_fecha_cozinha !== undefined ? (updates.horario_fecha_cozinha || undefined) : prev.kitchenClosingTime,
        whatsappNumber: updates.telefone !== undefined ? (updates.telefone || '') : prev.whatsappNumber,
        openingTime: updates.horario_abertura !== undefined ? (updates.horario_abertura || '11:00') : prev.openingTime,
        closingTime: updates.horario_fechamento !== undefined ? (updates.horario_fechamento || '23:00') : prev.closingTime,
        autoCloseTable: updates.fechar_mesa_auto !== undefined ? !!updates.fechar_mesa_auto : prev.autoCloseTable,
        flashingEnabled: updates.alertas_piscantes !== undefined ? !!updates.alertas_piscantes : prev.flashingEnabled,
        soundEnabled: updates.sons_habilitados !== undefined ? !!updates.sons_habilitados : prev.soundEnabled,
        lowStockAlert: updates.alerta_estoque_baixo !== undefined ? (updates.alerta_estoque_baixo ?? 15) : prev.lowStockAlert,
        criticalStockAlert: updates.alerta_estoque_critico !== undefined ? (updates.alerta_estoque_critico ?? 5) : prev.criticalStockAlert,
        autoPrintEnabled: updates.impressao_auto !== undefined ? !!updates.impressao_auto : prev.autoPrintEnabled,
        serviceFee: updates.taxa_servico !== undefined ? (updates.taxa_servico ?? 0) : prev.serviceFee,
        inventoryEnabled: updates.gerencia_estoque !== undefined ? !!updates.gerencia_estoque : prev.inventoryEnabled,
        billingMode: updates.modo_cobranca !== undefined ? (updates.modo_cobranca as 'mesa' | 'comanda') || 'mesa' : prev.billingMode,
        pizzaBillingMode: updates.cobranca_meio_a_meio !== undefined ? (updates.cobranca_meio_a_meio as 'mais_cara' | 'soma_metades') || 'mais_cara' : prev.pizzaBillingMode,
        meiaPizzaHabilitada: updates.meia_pizza_habilitada !== undefined ? !!updates.meia_pizza_habilitada : prev.meiaPizzaHabilitada,
        couvertHabilitado: updates.couvert_habilitado !== undefined ? !!updates.couvert_habilitado : prev.couvertHabilitado,
        couvertValor: updates.couvert_valor !== undefined ? (updates.couvert_valor ?? 0) : prev.couvertValor,
      }));

      // 3. Atualiza o banco
      const { error } = await supabase
        .from('Restaurantes')
        .update(updates)
        .eq('id', restaurantId);

      if (error) {
        console.error('Auto-save error:', error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return false;
      }

      // 4. Atualiza o cache do hook useRestaurant
      await updateRestaurant(updates);

      return true;
    } catch (err) {
      console.error('Failed auto-save:', err);
      return false;
    } finally {
      // 5. Libera o polling após um breve delay para garantir propagação
      saveTimeoutRef.current = setTimeout(() => {
        isSavingRef.current = false;
      }, 3000);
    }
  }, [restaurantId, updateRestaurant]);


  // Helper to normalize station names (kitchen -> cozinha)
  const normalizeStation = (st: string | null | undefined): string => {
    const normalized = (st || '').trim().toLowerCase();
    if (normalized === 'kitchen' || normalized === 'cozinha') return 'cozinha';
    if (normalized === 'bar') return 'bar';
    return normalized || 'bar';
  };

  // Sync products from Supabase
  useEffect(() => {
    const convertedProducts: Product[] = produtosDb.map(p => ({
      id: p.id.toString(),
      name: p.nome || '',
      price: parseFloat(p.preco || '0') || 0,
      category: p.categoria || 'Geral',
      station: normalizeStation(p.estacao),
      stock: p.estoque || 0,
      isActive: p.ativo ?? true,
      minStock: p.estoque_minimo || 10,
      description: p.descricao || '',
    }));
    setProducts(convertedProducts);
  }, [produtosDb]);

  useEffect(() => {
    const convertedCustomers: Customer[] = usuarios.map(u => ({
      id: u.id.toString(),
      name: u.nome || '',
      phone: (u.telefone || '').replace(/\D/g, ''),
      email: '', // Not in Usuários table
      visits: parseInt(u.quantas_vezes_foi || '0', 10),
      lastVisit: new Date(u.created_at),
      totalSpent: 0, // Not in Usuários table
      tags: [], // Not in Usuários table
      notes: '', // Not in Usuários table
    }));
    setCustomers(convertedCustomers);
  }, [usuarios]);


  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    const success = await addProduto({
      nome: product.name,
      preco: product.price,
      categoria: product.category,
      estacao: product.station,
      estoque: product.stock,
      estoque_minimo: product.minStock,
      descricao: product.description,
      ativo: product.isActive,
    });
    if (success) {
      toast.success('Produto adicionado com sucesso!');
      return true;
    } else {
      // O hook useProdutos já exibe o toast com a mensagem exata do erro
      return false;
    }
  }, [addProduto]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.nome = updates.name;
    if (updates.price !== undefined) updateData.preco = updates.price;
    if (updates.category !== undefined) updateData.categoria = updates.category;
    if (updates.station !== undefined) updateData.estacao = updates.station;
    if (updates.stock !== undefined) updateData.estoque = updates.stock;
    if (updates.minStock !== undefined) updateData.estoque_minimo = updates.minStock;
    if (updates.description !== undefined) updateData.descricao = updates.descricao;
    if (updates.isActive !== undefined) updateData.ativo = updates.isActive;

    const success = await updateProduto(parseInt(id, 10), updateData);
    if (success) {
      toast.success('Produto atualizado com sucesso!');
      return true;
    } else {
      // O hook useProdutos já exibe o toast com a mensagem exata do erro
      return false;
    }
  }, [updateProduto]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const success = await deleteProduto(parseInt(id));
      if (success) {
        toast.success('Produto removido!');
      } else {
        toast.error('Não foi possível excluir o produto. Verifique sua conexão.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao excluir produto.');
    }
  }, [deleteProduto]);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id'>) => {
    const success = await addUsuario({
      nome: customer.name,
      telefone: customer.phone,
    });
    if (success) {
      toast.success('Cliente adicionado com sucesso!');
    }
  }, [addUsuario]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.nome = updates.name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;

    const success = await updateUsuario(parseInt(id, 10), updateData);
    if (success) {
      toast.success('Cliente atualizado!');
    }
  }, [updateUsuario]);

  const deleteCustomer = useCallback(async (id: string) => {
    const success = await deleteUsuario(parseInt(id, 10));
    if (success) {
      toast.success('Cliente removido!');
    }
  }, [deleteUsuario]);

  const addStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'date'>, skipDbUpdate = false) => {
    const product = products.find(p => p.id === movement.productId);
    if (!product) {
      toast.error('Produto não encontrado');
      return;
    }

    const stockChange = movement.type === 'in' ? movement.quantity : -movement.quantity;
    const newStock = Math.max(0, (product.stock || 0) + stockChange);

    try {
      let success = true;
      if (!skipDbUpdate) {
        success = await updateProduct(movement.productId, { stock: newStock });
      }

      if (success) {
        const newMovement: StockMovement = {
          ...movement,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          date: new Date(),
        };
        setStockMovements(prev => [newMovement, ...prev]);
        if (!skipDbUpdate) {
          toast.success(`Estoque atualizado: ${movement.type === 'in' ? '+' : '-'}${movement.quantity}`);
        }
      }
    } catch (error) {
      toast.error('Erro ao atualizar estoque no banco de dados');
    }
  }, [products, updateProduct]);

  const addCampaign = useCallback((campaign: Omit<Campaign, 'id'>) => {
    const newCampaign = { ...campaign, id: Date.now().toString() };
    setCampaigns(prev => [...prev, newCampaign]);
  }, []);

  const updateCampaign = useCallback((id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }, []);

  const addOrder = useCallback(async (tableId: number, items: OrderItem[], station: string, customerName?: string, customerPhone?: string, usuarioTelefone?: string) => {
    if (!restaurantId) {
      console.error('No restaurant ID available');
      return;
    }

    // 1. Validate Stock
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        if ((product.stock || 0) < item.quantity) {
          toast.error(`Estoque insuficiente para ${product.name}. Restam apenas ${product.stock}.`);
          return;
        }
      }
    }

    try {
      // Consolidate optional description (DB has a single `descricao` field)
      const itemsDesc = items
        .map(i => i.description?.toString().trim())
        .filter(Boolean)
        .join(' | ');

      // Prepend Customer Info if available (Persistência de Cliente)
      let finalDesc = itemsDesc;
      if (customerName || customerPhone) {
        const clientInfo = `[Cliente: ${customerName || '?'} - ${customerPhone || '?'}]`;
        finalDesc = finalDesc ? `${clientInfo} ${finalDesc}` : clientInfo;
      }

      const descricao = finalDesc.slice(0, 500);

      // NEW: Serialize items as JSON to preserve per-item prices.
      // Format: [{nome, quantidade, preco}, ...]
      // This replaces the old comma-separated string that lost individual prices.
      const itensJson = JSON.stringify(
        items.map(item => ({
          nome: item.productName,
          quantidade: item.quantity,
          preco: item.price
        }))
      );

      // Calculate subtotal
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Get total quantity
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      // Format subtotal as R$ X,XX
      const formattedSubtotal = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;

      // Insert into Supabase
      const { data, error } = await supabase
        .from('Pedidos')
        .insert({
          mesa: tableId.toString(),
          itens: itensJson,
          quantidade: totalQuantity.toString(),
          Subtotal: formattedSubtotal,
          status: 'pendente',
          restaurante_id: restaurantId,
          descricao: descricao || null,
          ...(usuarioTelefone ? { usuario_telefone: usuarioTelefone } : {}),
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting order:', error);
        throw error;
      }

      // Update table status locally after successful insert
      setTables(prev => prev.map(t =>
        t.id === tableId
          ? { ...t, status: 'occupied', consumption: [...t.consumption, ...items] }
          : t
      ));

      console.log('Order created successfully:', data);
    } catch (err) {
      console.error('Failed to create order:', err);
    }
  }, [restaurantId, products, updateProduct, addStockMovement]);

  const requestBill = useCallback(async (tableId: number, manual: boolean = false) => {
    if (!restaurantId) return;

    const currentSettings = settingsRef.current;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    try {
      // CRITICAL RACE CONDITION FIX:
      // If manual, mark as printed IMMEDIATELY before any setTables/await
      // This prevents the AutoPrint useEffect (triggered by setTables below) from starting a second print.
      if (manual) {
        console.log(`[ManualPrint] Marking Mesa ${tableId} as printed BEFORE Supabase update.`);
        printedBillsRef.current.add(tableId);
      }

      // Optimistic update
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, alert: 'bill' } : t));

      // Update all orders for this table to 'pagamento_pendente'
      const { error } = await supabase
        .from('Pedidos')
        .update({ status: 'pagamento_pendente' })
        .eq('restaurante_id', restaurantId)
        .eq('mesa', tableId.toString())
        .neq('status', 'fechado')
        .neq('status', 'dividido'); // Don't reopen closed or divided orders

      if (error) throw error;

      // --- AUTO/MANUAL PRINT BILL LOGIC ---
      if (table.consumption && table.consumption.length > 0) {

        // Optimistic local update to synchronize React state immediately
        setPedidos(prev =>
          prev.map(p => Number(p.mesa) === tableId && p.status !== 'fechado' && p.status !== 'dividido'
            ? { ...p, status: 'pagamento_pendente' }
            : p
          )
        );

        // Project the updated status locally because setPedidos is asynchronous 
        // and 'pedidos' variable won't have the new values in this execution block
        const projetadosPedidos = pedidos.map(p => {
          if (Number(p.mesa) === tableId && p.status !== 'fechado' && p.status !== 'dividido') {
            return { ...p, status: 'pagamento_pendente' };
          }
          return p;
        });

        // Buscar pedidos com status pagamento_pendente a partir da lista projetada
        const pedidosPagamento = projetadosPedidos.filter(
          p => Number(p.mesa) === tableId && p.status === 'pagamento_pendente'
        );

        let divisoes: number | undefined = undefined;
        const pedidoMarcador = pedidosPagamento.find(p => p.descricao?.includes('Dividido por'));
        if (pedidoMarcador) {
          const match = pedidoMarcador.descricao?.match(/Dividido por (\d+)/);
          if (match) {
            divisoes = parseInt(match[1], 10);
          }
        }

        // No modo comanda: construir itens a partir dos pedidos com pagamento_pendente
        let consumptionToPrint: typeof table.consumption;
        if (currentSettings.billingMode === 'comanda') {
          if (pedidosPagamento.length > 0) {
            consumptionToPrint = [];
            for (const p of pedidosPagamento) {
              for (const it of p.itens) {
                if (isSystemMarkerItem(it.nome) || it.nome.toLowerCase().includes('fechamento de conta')) continue;
                consumptionToPrint.push({
                  productId: `bill-${p.id}`,
                  productName: it.nome,
                  quantity: it.quantidade,
                  price: it.preco,
                  description: p.descricao,
                });
              }
            }
          } else {
            consumptionToPrint = table.consumption.filter(item => !isSystemMarkerItem(item.productName) && !item.productName.toLowerCase().includes('fechamento de conta'));
          }
        } else {
          // Modo mesa: todos os itens
          consumptionToPrint = table.consumption.filter(item => !isSystemMarkerItem(item.productName) && !item.productName.toLowerCase().includes('fechamento de conta'));
        }

        if (consumptionToPrint.length === 0) {
          console.log('[RequestBill] Skipping print: only system items found.');
          toast.info(`Solicitação enviada (Mesa ${tableId}: apenas itens de sistema).`);
        } else if (manual) {
          // MANUAL PRINT TRIGGERED BY UI CLICK
          console.log(`[ManualPrint] Executing manual print for Mesa ${tableId}`);
          
          // Agrupar itens iguais (Agrupamos por nome e preço para garantir consistência entre múltiplos pedidos)
          const groupedConsumption = consumptionToPrint.reduce((acc, item) => {
            const existing = acc.find(i => i.productName === item.productName && i.price === item.price);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              acc.push({ ...item });
            }
            return acc;
          }, [] as typeof consumptionToPrint);

          const subtotal = consumptionToPrint.reduce((acc, item) => acc + (item.price * item.quantity), 0);
          const serviceFeePercentage = currentSettings.serviceFee || 0;
          const serviceFeeValue = (subtotal * serviceFeePercentage) / 100;

          // Calcular quantidade de comandas ativas (check-ins recentes ou com pedidos na mesa)
          const activeCheckins = usuarios.filter(u => {
            const mesaNum = parseInt(String(u.mesa_atual || '0'), 10);
            if (mesaNum !== tableId) return false;
            
            const temPedidoAtivo = pedidos.some(p => Number(p.mesa) === tableId && p.status !== 'fechado' && p.status !== 'dividido');
            const checkinTimestamp = new Date(u.ultimo_checkin || u.created_at);
            const checkinRecente = (Date.now() - checkinTimestamp.getTime()) < 4 * 60 * 60 * 1000;
            return temPedidoAtivo || checkinRecente;
          });

          const couvertValue = currentSettings.couvertHabilitado
            ? (currentSettings.billingMode === 'comanda'
              ? Math.max(1, activeCheckins.length) * currentSettings.couvertValor
              : currentSettings.couvertValor)
            : 0;
          const totalWithFee = subtotal + serviceFeeValue + couvertValue;

          // No modo comanda, identificar quem pediu a conta
          let manualClienteNome: string | undefined;
          if (currentSettings.billingMode === 'comanda') {
            const telefonesComConta = [...new Set(pedidosPagamento.map(p => p.usuario_telefone).filter(Boolean))];
            if (telefonesComConta.length > 0) {
              manualClienteNome = telefonesComConta.map(tel => {
                const comanda = table.comandas?.find(c => c.telefone === tel);
                return comanda?.nome || 'Cliente';
              }).join(', ');
            } else {
              manualClienteNome = table.comandas?.map(c => c.nome).filter(n => n !== 'Mesa').join(', ') || table.customerName;
            }
          } else {
            manualClienteNome = table.customerName || undefined;
          }

          const billData = {
            id: `F${tableId}-${Date.now()}`,
            mesa: tableId,
            created_at: new Date(),
            itens: groupedConsumption.map(i => ({
              nome: i.productName,
              quantity: i.quantity,
              quantidade: i.quantity,
              preco: i.price,
              descricao: i.description
            })),
            total: totalWithFee,
            subtotal: subtotal,
            serviceFee: serviceFeeValue,
            serviceFeePercentage: serviceFeePercentage,
            totalWithFee: totalWithFee,
            couvert: couvertValue,
            descricao: 'Fechamento de Conta',
            clienteNome: manualClienteNome,
            divisoes: divisoes,
          };

          toast.info(`Imprimindo conta da mesa ${tableId}...`, { icon: '🖨️' });
          const receiptPrinters = currentSettings.printers.filter(p => {
            if (!p.isActive) return false;
            if (!p.type || p.type === 'all') return true;
            const types = p.type.split(',').map(t => t.trim().toLowerCase());
            return types.includes('receipt') || types.includes('conta') || types.includes('recibo');
          });

          if (receiptPrinters.length === 0) {
            printViaWebBluetooth(billData, currentSettings.restaurantName);
          } else {
            receiptPrinters.forEach(printer => {
              printToDevice(billData, currentSettings.restaurantName, printer);
            });
          }
        } else {
          toast.info(`Conta solicitada para a mesa ${tableId}. A impressora irá imprimir automaticamente.`, {
            icon: '🧾',
          });
        }
      } else {
        toast.info(`Solicitação enviada (Mesa ${tableId} sem consumo registrado).`);
      }
      // -----------------------------

      // Silent refetch to sync
      refetchPedidos({ silent: true });
    } catch (err) {
      console.error('Error requesting bill:', err);
      toast.error('Erro ao solicitar conta');
    }
  }, [restaurantId, tables, refetchPedidos, pedidos, usuarios]);

  const deliverOrder = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setUndoAction({ type: 'deliver_order', data: order, timestamp: Date.now() });
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  }, [orders]);

  const reprintOrder = useCallback(async (orderId: string) => {
    const pedido = pedidos.find(p => p.id === parseInt(orderId));
    if (pedido) {
      // No modo comanda, enriquecer com nome do cliente
      let printData: any = pedido;
      if (settings.billingMode === 'comanda' && pedido.usuario_telefone) {
        const usuario = usuarios.find(u => u.telefone === pedido.usuario_telefone);
        printData = { ...pedido, clienteNome: usuario?.nome || undefined };
      }

      const activePrinters = settings.printers.filter(p => p.isActive);
      if (activePrinters.length === 0) {
        const success = await printViaWebBluetooth(printData, settings.restaurantName);
        if (success) {
          toast.success('Re-imprimindo pedido...');
        } else {
          toast.error('Falha ao imprimir. A impressora está conectada?');
        }
      } else {
        let hasSuccess = false;
        for (const printer of activePrinters) {
          let itemsToPrint = printData.itens;
          if (printer.type && printer.type !== 'all') {
            const printerEstacoes = Array.from(new Set(printer.type.split(',').map(s => s.trim().toLowerCase())));
            itemsToPrint = printData.itens.filter(item => {
              const itemEst = item.estacao ? item.estacao.trim().toLowerCase() : 'kitchen';
              return printerEstacoes.some(pEst => {
                if (pEst === 'all') return true;
                if (pEst === itemEst) return true;
                if ((pEst === 'kitchen' || pEst === 'cozinha') && (itemEst === 'kitchen' || itemEst === 'cozinha')) return true;
                if (pEst === 'bar' && itemEst === 'bar') return true;
                if ((pEst === 'receipt' || pEst === 'conta' || pEst === 'recibo') && (itemEst === 'receipt' || itemEst === 'conta' || itemEst === 'recibo')) return true;
                return false;
              });
            });
          }

          if (itemsToPrint.length > 0) {
            const segmentedData = {
              ...printData,
              itens: itemsToPrint,
              descricao: pedido.descricao || ''
            };
            const success = await printToDevice(segmentedData, settings.restaurantName, printer);
            if (success) hasSuccess = true;
          }
        }
        if (hasSuccess) {
          toast.success('Re-imprimindo pedido...');
        } else {
          toast.error('Falha ao imprimir. Verifique as conexões das impressoras.');
        }
      }
    } else {
      toast.error('Pedido não encontrado para re-impressão');
    }
  }, [pedidos, settings.restaurantName, settings.billingMode, usuarios]);

  const closeTable = useCallback(async (tableId: number, skipWebhook: boolean = false) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      console.log(`[Close Table] Iniciando fechamento da mesa ${tableId} (skipWebhook=${skipWebhook})`);
      setUndoAction({ type: 'close_table', data: table, timestamp: Date.now() });

      const currentSettings = settingsRef.current;
      const shouldSkipWebhook = skipWebhook;

      let customerName = 'Mesa';
      let customerPhone = 'Não informado';

      if (restaurantId) {
        const { data: usersData } = await supabase
          .from('Usuários')
          .select('nome, telefone')
          .eq('id_restaurante', restaurantId)
          .eq('mesa_atual', tableId.toString());

        if (usersData && usersData.length > 0) {
          customerName = usersData[0].nome || 'Cliente';
          customerPhone = usersData[0].telefone || 'Não informado';
        }
      }

      const tablePedidos = pedidos.filter(
        p => Number(p.mesa) === tableId && p.status !== 'fechado' && p.status !== 'dividido'
      );

      const itensFromPedidos = tablePedidos.flatMap(p =>
        p.itens
          .filter(it => !isSystemMarkerItem(it.nome))
          .map(it => ({
            productName: it.nome,
            price: it.preco || it.price || 0,
            quantity: it.quantidade || it.quantity || 1,
            description: '',
          }))
      );

      const consumptionToPrint = itensFromPedidos.length > 0
        ? itensFromPedidos
        : (table.consumption || []).filter(item => !isSystemMarkerItem(item.productName));

      const subtotal = consumptionToPrint.reduce((acc, item) => acc + ((item.price || item.preco || 0) * (item.quantity || item.quantidade || 1)), 0);
      const serviceFeePercentage = currentSettings.serviceFee || 0;
      const serviceFeeValue = (subtotal * serviceFeePercentage) / 100;
      const couvertValue = currentSettings.couvertHabilitado ? (currentSettings.couvertValor || 0) : 0;
      const total = subtotal + serviceFeeValue + couvertValue;
      const itensConsumidos = consumptionToPrint.map(i => `${i.quantity || i.quantidade || 1}x ${i.productName}`).join(', ');

      const webhookPayload = {
        restaurante_id: restaurantId,
        telefone: customerPhone,
        nome: customerName,
        numero_mesa: tableId,
        itens: itensConsumidos || 'Nenhum item',
        subtotal: subtotal.toFixed(2),
        taxa: serviceFeeValue.toFixed(2),
        couvert: couvertValue.toFixed(2),
        total: total.toFixed(2),
        skipWhatsApp: shouldSkipWebhook,
        tipo: 'mesa' as const
      };

      console.log('[Webhook Close Table] Enviando payload:', webhookPayload);
      if (!shouldSkipWebhook) {
        toast.info(`Enviando conta da mesa ${tableId} para o WhatsApp...`, { icon: '📲' });
      } else {
        toast.info(`Limpando mesa ${tableId} no painel...`);
      }

      try {
        // Garantia de persistência direta no Supabase para liberação imediata (Mesa = '0', Status = 'Inativo', Pedidos = 'fechado')
        if (restaurantId) {
          const tableStr = tableId.toString();
          await supabase
            .from('Pedidos')
            .update({ status: 'fechado' })
            .eq('restaurante_id', restaurantId)
            .eq('mesa', tableStr)
            .neq('status', 'fechado')
            .neq('status', 'dividido');

          await supabase
            .from('Usuários')
            .update({ mesa_atual: '0', Status: 'Inativo' })
            .eq('id_restaurante', restaurantId)
            .eq('mesa_atual', tableStr);
        }

        const res = await apiFetch('/webhook/Envia-conta', {
          method: 'POST',
          body: JSON.stringify(webhookPayload)
        }).catch(err => {
          console.warn('[Close Table] Webhook falhou, mas dados locais já foram atualizados:', err);
          return { ok: false, status: 500 } as Response;
        });

        if (res.ok) {
          if (!shouldSkipWebhook) {
            toast.success('Mesa fechada e conta enviada via WhatsApp!');
          } else {
            toast.success('Mesa liberada com sucesso!');
          }
        } else {
          console.warn('Webhook do backend retornou status não-OK:', res.status);
          toast.success('Mesa liberada com sucesso no sistema!');
        }

        // Imprimir conta na impressora configurada
        const billData: any = {
          id: `F${tableId}-${Date.now()}`,
          mesa: tableId,
          created_at: new Date(),
          itens: consumptionToPrint.map(i => ({
            nome: i.productName,
            quantidade: i.quantity || i.quantidade || 1,
            preco: i.price || i.preco || 0,
            descricao: i.description,
          })),
          total: total,
          subtotal: subtotal,
          serviceFee: serviceFeeValue,
          serviceFeePercentage: serviceFeePercentage,
          totalWithFee: total,
          couvert: couvertValue,
          descricao: 'Fechamento de Conta',
          clienteNome: customerName,
        };

        const receiptPrinters = currentSettings.printers.filter(p => {
          if (!p.isActive) return false;
          if (!p.type || p.type === 'all') return true;
          const types = p.type.split(',').map((t: string) => t.trim().toLowerCase());
          return types.includes('receipt') || types.includes('conta') || types.includes('recibo');
        });

        toast.info(`Imprimindo conta da mesa ${tableId}...`, { icon: '🖨️' });
        if (receiptPrinters.length === 0) {
          printViaWebBluetooth(billData, currentSettings.restaurantName);
        } else {
          for (const printer of receiptPrinters) {
            printToDevice(billData, currentSettings.restaurantName, printer);
          }
        }

        await refetchPedidos({ silent: true });
        await refetchUsuarios({ silent: true });
        
        setTables(prev => prev.map(t =>
          t.id === tableId
            ? { ...t, status: 'free', alert: null, orders: [], consumption: [], comandas: [] }
            : t
        ));
        setOrders(prev => prev.filter(o => o.tableId !== tableId));
        printedBillsRef.current.delete(tableId);

      } catch (err) {
        console.error('Erro ao chamar webhook de fechamento de mesa:', err);
        toast.error('Falha de conexão com o servidor de fechamento.');
      }
    }
  }, [tables, pedidos, restaurantId, refetchPedidos, refetchUsuarios]);

  // --- CLOSE COMANDA (individual, modo comanda) ---
  const closeComanda = useCallback(async (tableId: number, telefone: string) => {
    if (!restaurantId) return;
    console.log(`[Close Comanda] Fechando comanda de ${telefone} na mesa ${tableId}`);

    const currentSettings = settingsRef.current;

    try {
      const { data: userData } = await supabase
        .from('Usuários')
        .select('nome, telefone')
        .eq('id_restaurante', restaurantId)
        .eq('telefone', telefone)
        .limit(1);

      const customerName = userData?.[0]?.nome || 'Cliente';
      const customerPhone = userData?.[0]?.telefone || telefone;

      const comandaPedidos = pedidos.filter(
        p => Number(p.mesa) === tableId &&
             p.usuario_telefone === telefone &&
             p.status !== 'fechado' &&
             p.status !== 'dividido'
      );

      const itensConsumidos = comandaPedidos
        .flatMap(p => p.itens.filter(it => !isSystemMarkerItem(it.nome)))
        .map(it => `${it.quantidade || it.quantity || 1}x ${it.nome}`)
        .join(', ');

      const subtotal = comandaPedidos
        .flatMap(p => p.itens.filter(it => !isSystemMarkerItem(it.nome)))
        .reduce((acc, it) => acc + ((it.preco || it.price || 0) * (it.quantidade || it.quantity || 1)), 0);

      const serviceFeePercentage = currentSettings.serviceFee || 0;
      const serviceFeeValue = (subtotal * serviceFeePercentage) / 100;
      const couvertValue = currentSettings.couvertHabilitado ? (currentSettings.couvertValor || 0) : 0;
      const total = subtotal + serviceFeeValue + couvertValue;

      const webhookPayload = {
        restaurante_id: restaurantId,
        telefone: customerPhone,
        nome: customerName,
        numero_mesa: tableId,
        itens: itensConsumidos || 'Nenhum item',
        subtotal: subtotal.toFixed(2),
        taxa: serviceFeeValue.toFixed(2),
        couvert: couvertValue.toFixed(2),
        total: total.toFixed(2),
        tipo: 'comanda' as const
      };

      console.log('[Close Comanda] Enviando conta individual:', webhookPayload);
      toast.info(`Enviando conta de ${customerName} para o WhatsApp...`, { icon: '📲' });

      // Garantia de persistência direta no Supabase para liberação imediata (Mesa = '0', Status = 'Inativo', Pedidos = 'fechado')
      const tableStr = tableId.toString();
      await supabase
        .from('Pedidos')
        .update({ status: 'fechado' })
        .eq('restaurante_id', restaurantId)
        .eq('mesa', tableStr)
        .eq('usuario_telefone', telefone)
        .neq('status', 'fechado')
        .neq('status', 'dividido');

      const numOnly = telefone.replace(/\D/g, '');
      let altNum = numOnly;
      if (numOnly.startsWith('55')) {
        if (numOnly.length === 13 && numOnly.charAt(4) === '9') {
          altNum = '55' + numOnly.substring(2, 4) + numOnly.substring(5);
        } else if (numOnly.length === 12) {
          altNum = '55' + numOnly.substring(2, 4) + '9' + numOnly.substring(4);
        }
      }

      await supabase
        .from('Usuários')
        .update({ mesa_atual: '0', Status: 'Inativo' })
        .eq('id_restaurante', restaurantId)
        .or(`telefone.eq.${numOnly},telefone.eq.${altNum},telefone.eq.${telefone}`);

      const res = await apiFetch('/webhook/Envia-conta', {
        method: 'POST',
        body: JSON.stringify(webhookPayload)
      }).catch(err => {
        console.warn('[Close Comanda] Webhook falhou, mas dados locais já foram atualizados:', err);
        return { ok: false, status: 500 } as Response;
      });

      if (res.ok) {
        toast.success(`Comanda de ${customerName} fechada e enviada via WhatsApp!`);
      } else {
        toast.success(`Comanda de ${customerName} fechada com sucesso!`);
      }

      // Imprimir conta individual da comanda na impressora configurada
      const comandaItens = comandaPedidos.flatMap(p =>
        p.itens.filter(it => !isSystemMarkerItem(it.nome))
      );
      const comandaBillData: any = {
        id: `C${tableId}-${Date.now()}`,
        mesa: tableId,
        created_at: new Date(),
        itens: comandaItens.map(it => ({
          nome: it.nome,
          quantidade: it.quantidade || it.quantity || 1,
          preco: it.preco || it.price || 0,
        })),
        total: total,
        subtotal: subtotal,
        serviceFee: serviceFeeValue,
        serviceFeePercentage: serviceFeePercentage,
        totalWithFee: total,
        couvert: couvertValue,
        descricao: 'Fechamento de Comanda',
        clienteNome: customerName,
      };

      const receiptPrinters = currentSettings.printers.filter((p: any) => {
        if (!p.isActive) return false;
        if (!p.type || p.type === 'all') return true;
        const types = p.type.split(',').map((t: string) => t.trim().toLowerCase());
        return types.includes('receipt') || types.includes('conta') || types.includes('recibo');
      });

      toast.info(`Imprimindo conta de ${customerName}...`, { icon: '🖨️' });
      if (receiptPrinters.length === 0) {
        printViaWebBluetooth(comandaBillData, currentSettings.restaurantName);
      } else {
        for (const printer of receiptPrinters) {
          printToDevice(comandaBillData, currentSettings.restaurantName, printer);
        }
      }

      await refetchPedidos({ silent: true });
      await refetchUsuarios({ silent: true });

      // Verificar se ainda há outros usuários com check-in nessa mesa.
      // Se não houver, liberar a mesa imediatamente no frontend (sem esperar
      // o próximo ciclo de sync — evita mesa vermelha após fechar comanda).
      const { data: remainingUsers } = await supabase
        .from('Usuários')
        .select('id')
        .eq('id_restaurante', restaurantId)
        .eq('mesa_atual', tableId.toString())
        .neq('telefone', telefone);

      const hasOtherUsers = (remainingUsers?.length ?? 0) > 0;
      if (!hasOtherUsers) {
        // Não há mais ninguém na mesa — liberar visualmente
        setTables(prev => prev.map(t =>
          t.id === tableId
            ? { ...t, status: 'free', alert: null, consumption: [], comandas: [] }
            : t
        ));
        console.log(`[Close Comanda] 🟢 Mesa ${tableId} liberada (última comanda fechada)`);
      }

    } catch (err) {
      console.error('[Close Comanda] Erro ao fechar comanda:', err);
      toast.error('Erro ao fechar comanda');
    }
  }, [restaurantId, refetchPedidos, refetchUsuarios, pedidos]);

  // --- SPLIT ITEM (dividir item entre comandas) ---
  const splitItem = useCallback(async (pedidoId: number, phones: string[]) => {
    if (!restaurantId || phones.length < 2) return;

    const original = pedidos.find(p => p.id === pedidoId);
    if (!original) {
      toast.error('Pedido não encontrado');
      return;
    }

    console.log(`[Split Item] Dividindo pedido #${pedidoId} entre ${phones.length} pessoas`);

    try {
      const precoOriginal = original.total;
      const precoDiv = precoOriginal / phones.length;

      // 1. Marcar original como 'dividido'
      await supabase
        .from('Pedidos')
        .update({ status: 'dividido' })
        .eq('id', pedidoId);

      // 2. Criar clones para cada participante
      for (const phone of phones) {
        await supabase.from('Pedidos').insert({
          mesa: original.mesa.toString(),
          itens: original.productName,
          quantidade: original.quantity.toString(),
          Subtotal: precoDiv.toFixed(2),
          descricao: `${original.descricao || ''} (÷${phones.length})`.trim(),
          status: 'entregue',
          restaurante_id: restaurantId,
          usuario_telefone: phone,
        });
      }

      toast.success(`Item dividido entre ${phones.length} pessoas!`);
      await refetchPedidos({ silent: true });
    } catch (err) {
      console.error('[Split Item] Erro:', err);
      toast.error('Erro ao dividir item');
    }
  }, [restaurantId, pedidos, refetchPedidos]);

  // --- UNSPLIT ITEM (desfazer divisão) ---
  const unsplitItem = useCallback(async (pedidoId: number) => {
    if (!restaurantId) return;

    console.log(`[Unsplit Item] Desfazendo divisão do pedido #${pedidoId}`);

    try {
      // 1. Reativar o pedido original
      await supabase
        .from('Pedidos')
        .update({ status: 'entregue' })
        .eq('id', pedidoId)
        .eq('status', 'dividido');

      // 2. Deletar clones (descricao contém ÷ e foram criados depois)
      const original = pedidos.find(p => p.id === pedidoId);
      if (original) {
        // Find and delete clones by matching item name + mesa + divisão marker
        const clones = pedidos.filter(p =>
          p.mesa === original.mesa &&
          p.productName === original.productName &&
          p.descricao?.includes('÷') &&
          p.id !== pedidoId
        );
        for (const clone of clones) {
          await supabase.from('Pedidos').delete().eq('id', clone.id);
        }
      }

      toast.success('Divisão desfeita!');
      await refetchPedidos({ silent: true });
    } catch (err) {
      console.error('[Unsplit Item] Erro:', err);
      toast.error('Erro ao desfazer divisão');
    }
  }, [restaurantId, pedidos, refetchPedidos]);

  const updateTableAlert = useCallback(async (tableId: number, alert: 'waiter' | 'bill' | null) => {
    const table = tables.find(t => t.id === tableId);

    if (table && table.alert && alert === null) {
      setUndoAction({ type: 'resolve_alert', data: { tableId, previousAlert: table.alert }, timestamp: Date.now() });

      if (restaurantId) {
        if (table.alert === 'waiter') {
          console.log(`[Resolve Alert] Resolvendo chamado de garçom da mesa ${tableId}`);
          const { error } = await supabase
            .from('Pedidos')
            .update({ status: 'fechado' })
            .eq('restaurante_id', restaurantId)
            .eq('mesa', tableId.toString())
            .eq('status', 'garcom_pendente');

          if (error) {
            console.error('Error resolving waiter call:', error);
            toast.error('Erro ao atualizar status do pedido no banco.');
          } else {
            toast.success('Chamado de garçom resolvido!');
            refetchPedidos({ silent: true });
          }
        } else if (table.alert === 'bill') {
          console.log(`[Resolve Alert] Resolvendo pedido de conta da mesa ${tableId}`);
          
          if (settings.billingMode === 'comanda' && table.comandas && table.comandas.length > 0) {
            // Modo comanda: fechar apenas as comandas que pediram a conta (pagamento_pendente)
            const pedidosPagamento = pedidos.filter(
              p => Number(p.mesa) === tableId && p.status === 'pagamento_pendente'
            );
            
            // Coletar telefones únicos que pediram conta
            const telefonesComConta = [...new Set(pedidosPagamento.map(p => p.usuario_telefone).filter(Boolean))];
            
            if (telefonesComConta.length > 0) {
              console.log(`[Resolve Alert] Modo comanda: fechando ${telefonesComConta.length} comanda(s) com pagamento_pendente`);
              for (const tel of telefonesComConta) {
                await closeComanda(tableId, tel);
              }
            } else {
              // Fallback: se não encontrou telefones específicos, fecha a mesa toda
              await closeTable(tableId);
            }
          } else {
            // Modo mesa: fechar mesa inteira
            await closeTable(tableId);
          }
          return;
        }
      }
    }

    setTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, alert } : t
    ));

    // If alert is removed manually (not bill closing), we might want to allow re-printing
    if (alert === null) {
      printedBillsRef.current.delete(tableId);
    }
  }, [tables, restaurantId, refetchPedidos, closeTable, closeComanda, settings.billingMode, pedidos]);

  const addItemToTable = useCallback(async (tableId: number, item: OrderItem, usuarioTelefone?: string) => {
    const product = products.find(p => p.id === item.productId);
    if (product) {
      await addOrder(tableId, [item], product.station, undefined, undefined, usuarioTelefone);
    } else {
      await addOrder(tableId, [item], 'kitchen', undefined, undefined, usuarioTelefone);
    }
  }, [products, addOrder]);

  const performUndo = useCallback(() => {
    if (!undoAction) return;

    switch (undoAction.type) {
      case 'deliver_order':
        setOrders(prev => [...prev, undoAction.data]);
        break;
      case 'close_table':
        setTables(prev => prev.map(t =>
          t.id === undoAction.data.id ? undoAction.data : t
        ));
        break;
      case 'resolve_alert':
        setTables(prev => prev.map(t =>
          t.id === undoAction.data.tableId ? { ...t, alert: undoAction.data.previousAlert } : t
        ));
        break;
    }
    setUndoAction(null);
  }, [undoAction]);

  const clearUndo = useCallback(() => {
    setUndoAction(null);
  }, []);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    isAdminAuthenticated,
    restaurantId,
    login,
    logout,
    adminLogin,
    adminLogout,
    tables,
    settings,
    updateSettings,
    saveSettingsToSupabase,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    addOrder,
    deliverOrder,
    reprintOrder,
    updateTableAlert,
    closeTable,
    addItemToTable,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    stockMovements,
    addStockMovement,
    campaigns,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    restaurant,
    undoAction,
    performUndo,
    clearUndo,
    filter,
    setFilter,
    loadingData,
    pedidos,
    updatePedidoStatus,
    deletePedido,
    getMetrics,
    loadingPedidos,
    requestBill,
    mensagens: mensagensData,
    usuarios,
    updateAndSaveSetting,
    refetchUsuarios,
    localAutoPrint,
    setLocalAutoPrint,
    closeComanda,
    splitItem,
    unsplitItem,
    macarroes,
    addMacarrao,
    updateMacarrao,
    deleteMacarrao,
    refetchMacarroes,
    saboresPizza,
    addSaborPizza,
    updateSaborPizza,
    deleteSaborPizza,
    refetchSaboresPizza,
    categorias,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    refetchCategorias,
    estacoes,
    addEstacao,
    updateEstacao,
    deleteEstacao,
    refetchEstacoes,
    savePrinters,
  }), [
    isAuthenticated,
    isAdminAuthenticated,
    restaurantId,
    login,
    logout,
    adminLogin,
    adminLogout,
    tables,
    settings,
    updateSettings,
    saveSettingsToSupabase,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    addOrder,
    deliverOrder,
    reprintOrder,
    updateTableAlert,
    closeTable,
    addItemToTable,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    stockMovements,
    addStockMovement,
    campaigns,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    restaurant,
    undoAction,
    performUndo,
    clearUndo,
    filter,
    setFilter,
    loadingData,
    pedidos,
    updatePedidoStatus,
    deletePedido,
    getMetrics,
    loadingPedidos,
    requestBill,
    mensagensData,
    usuarios,
    updateAndSaveSetting,
    refetchUsuarios,
    localAutoPrint,
    setLocalAutoPrint,
    closeComanda,
    splitItem,
    unsplitItem,
    macarroes,
    addMacarrao,
    updateMacarrao,
    deleteMacarrao,
    refetchMacarroes,
    saboresPizza,
    addSaborPizza,
    updateSaborPizza,
    deleteSaborPizza,
    refetchSaboresPizza,
    categorias,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    refetchCategorias,
    estacoes,
    addEstacao,
    updateEstacao,
    deleteEstacao,
    refetchEstacoes,
    savePrinters,
  ]);

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
