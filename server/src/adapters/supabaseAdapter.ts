import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Adapter para Supabase — CRUD genérico.
 * Usa service_role key para bypass de RLS.
 */
class SupabaseAdapter {
  public client: SupabaseClient;

  constructor() {
    this.client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  }

  // ============================================================
  // Usuários
  // ============================================================

  async getUserByPhone(phone: string, restauranteId?: string | null) {
    if (!phone) return null;

    const numOnly = phone.replace(/\D/g, '');
    if (!numOnly) return null;

    const candidateNumbers = new Set<string>();
    candidateNumbers.add(numOnly);

    // Tratar formatos do Brasil
    let ddd = '';
    let localNum = '';

    if (numOnly.startsWith('55') && numOnly.length >= 10) {
      ddd = numOnly.substring(2, 4);
      localNum = numOnly.substring(4);
    } else if (numOnly.length >= 10 && !numOnly.startsWith('55')) {
      ddd = numOnly.substring(0, 2);
      localNum = numOnly.substring(2);
    }

    if (ddd && localNum) {
      // 1. Variação com e sem 55
      candidateNumbers.add(`55${ddd}${localNum}`);
      candidateNumbers.add(`${ddd}${localNum}`);

      // 2. Se começa com 9 repetido (ex: 998231142 digitado no check-in)
      if (localNum.startsWith('99') && localNum.length === 9) {
        const fixedLocal = localNum.substring(1); // 98231142
        candidateNumbers.add(`55${ddd}${fixedLocal}`);
        candidateNumbers.add(`${ddd}${fixedLocal}`);
      }

      // 3. Variação 9 dígitos vs 8 dígitos
      if (localNum.length === 9 && localNum.startsWith('9')) {
        const withoutNine = localNum.substring(1);
        candidateNumbers.add(`55${ddd}${withoutNine}`);
        candidateNumbers.add(`${ddd}${withoutNine}`);
      } else if (localNum.length === 8) {
        const withNine = '9' + localNum;
        candidateNumbers.add(`55${ddd}${withNine}`);
        candidateNumbers.add(`${ddd}${withNine}`);
      }
    }

    // 4. Últimos 8 dígitos para fallback
    const last8 = numOnly.slice(-8);

    const orClauses = Array.from(candidateNumbers)
      .map(num => `telefone.eq.${num}`)
      .join(',');

    let query = this.client
      .from('Usuários')
      .select('*')
      .or(orClauses);

    if (restauranteId) {
      query = query.eq('id_restaurante', restauranteId);
    }

    let { data, error } = await query
      .order('ultimo_checkin', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) console.error('[Supabase] Erro getUserByPhone:', error.message);

    // Fallback: se não encontrou e temos os últimos 8 dígitos + restauranteId
    if ((!data || data.length === 0) && restauranteId && last8.length === 8) {
      const fallbackQuery = await this.client
        .from('Usuários')
        .select('*')
        .eq('id_restaurante', restauranteId)
        .ilike('telefone', `%${last8}`)
        .order('ultimo_checkin', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (fallbackQuery.data && fallbackQuery.data.length > 0) {
        data = fallbackQuery.data;
      }
    }

    return data && data.length > 0 ? data[0] : null;
  }

  async createUser(data: {
    telefone: string;
    id_restaurante: string;
    mesa_atual: string;
    Status?: string;
    quantas_vezes_foi?: number;
  }) {
    const { data: user, error } = await this.client
      .from('Usuários')
      .insert({
        ...data,
        Status: data.Status || 'Ativo',
        quantas_vezes_foi: data.quantas_vezes_foi || 0,
      })
      .select()
      .single();

    if (error) console.error('[Supabase] Erro createUser:', error.message);
    return user;
  }

  async getOrCreateUser(phone: string, name?: string, restauranteId?: string) {
    // Apenas consulta o usuário existente (não cria registro fantasma na mesa 0)
    return this.getUserByPhone(phone, restauranteId);
  }

  // ============================================================
  // Restaurantes
  // ============================================================

  async getRestauranteByName(nome: string) {
    const { data, error } = await this.client
      .from('Restaurantes')
      .select('*')
      .eq('nome', nome)
      .maybeSingle();

    if (error) console.error('[Supabase] Erro getRestauranteByName:', error.message);
    return data;
  }

  async getAllRestaurantes() {
    const { data, error } = await this.client
      .from('Restaurantes')
      .select('*');

    if (error) console.error('[Supabase] Erro getAllRestaurantes:', error.message);
    return data || [];
  }

  async getRestauranteById(id: string) {
    const { data, error } = await this.client
      .from('Restaurantes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) console.error('[Supabase] Erro getRestauranteById:', error.message);
    return data;
  }

  async getRestauranteByEvolutionInstance(instanceName: string, isDelivery: boolean = false) {
    if (!instanceName) return null;

    let query = this.client.from('Restaurantes').select('*');

    if (isDelivery) {
      query = query.or(`evolution_instancia_delivery.eq.${instanceName},evolution_instancia_delivery.ilike.%${instanceName}%`);
    } else {
      query = query.or(`evolution_instancia.eq.${instanceName},evolution_instancia_delivery.eq.${instanceName},evolution_instancia.ilike.%${instanceName}%,evolution_instancia_delivery.ilike.%${instanceName}%`);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) console.error('[Supabase] Erro getRestauranteByEvolutionInstance:', error.message);
    return data;
  }

  // Alias para compatibilidade
  async getRestauranteByWahaSession(sessionName: string, isDelivery: boolean = false) {
    return this.getRestauranteByEvolutionInstance(sessionName, isDelivery);
  }


  // ============================================================
  // Produtos
  // ============================================================

  async getProductsByRestaurante(restauranteId: string) {
    const { data, error } = await this.client
      .from('Produtos')
      .select('*')
      .eq('restaurante_id', restauranteId);

    if (error) console.error('[Supabase] Erro getProductsByRestaurante:', error.message);
    return data || [];
  }

  // ============================================================
  // Pedidos
  // ============================================================

  async createPedido(pedido: {
    mesa: string;
    status: string;
    itens: string;
    Subtotal: string;
    restaurante_id: string;
    quantidade: string;
    descricao: string;
    usuario_telefone: string;
  }) {
    const { data, error } = await this.client
      .from('Pedidos')
      .insert(pedido)
      .select()
      .single();

    if (error) console.error('[Supabase] Erro createPedido:', error.message);
    return data;
  }

  async getPedidosByMesa(mesa: number, restauranteId: string, status?: string, usuarioTelefone?: string) {
    let query = this.client
      .from('Pedidos')
      .select('*')
      .eq('mesa', mesa)
      .eq('restaurante_id', restauranteId);

    if (status) query = query.eq('status', status);
    if (usuarioTelefone) query = query.eq('usuario_telefone', usuarioTelefone);

    const { data, error } = await query;
    if (error) console.error('[Supabase] Erro getPedidosByMesa:', error.message);
    return data || [];
  }

  async getPedidosByMesaExcluindo(mesa: number, restauranteId: string, excludeStatus: string, usuarioTelefone?: string) {
    let query = this.client
      .from('Pedidos')
      .select('*')
      .eq('mesa', mesa)
      .eq('restaurante_id', restauranteId)
      .neq('status', excludeStatus);

    if (usuarioTelefone) query = query.eq('usuario_telefone', usuarioTelefone);

    const { data, error } = await query;
    if (error) console.error('[Supabase] Erro getPedidosByMesaExcluindo:', error.message);
    return data || [];
  }

  async updatePedidosStatus(
    mesa: string,
    restauranteId: string,
    newStatus: string,
    excludeStatus?: string,
    usuarioTelefone?: string,
  ) {
    let query = this.client
      .from('Pedidos')
      .update({ status: newStatus })
      .eq('mesa', mesa)
      .eq('restaurante_id', restauranteId)
      .neq('status', 'dividido');

    if (excludeStatus) query = query.neq('status', excludeStatus);
    if (usuarioTelefone) query = query.eq('usuario_telefone', usuarioTelefone);

    const { data, error } = await query.select();
    if (error) console.error('[Supabase] Erro updatePedidosStatus:', error.message);
    return data || [];
  }

  // ============================================================
  // Mensagens
  // ============================================================

  async saveMensagem(msg: {
    restaurante_id: string;
    telefone: string;
    nome_contato?: string;
    conteudo: string;
    tipo?: string;
    direcao: 'recebida' | 'enviada';
    message_id?: string;
    metadata?: Record<string, any>;
  }) {
    // Se tem message_id, verifica duplicata
    if (msg.message_id) {
      const { data: existing } = await this.client
        .from('mensagens')
        .select('id')
        .eq('message_id', msg.message_id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Supabase] Mensagem já existe: ${msg.message_id}`);
        return existing[0];
      }
    }

    const { data, error } = await this.client
      .from('mensagens')
      .insert({
        restaurante_id: msg.restaurante_id,
        telefone: msg.telefone,
        nome_contato: msg.nome_contato || null,
        conteudo: msg.conteudo,
        tipo: msg.tipo || 'text',
        direcao: msg.direcao,
        message_id: msg.message_id || null,
        metadata: msg.metadata || null,
      })
      .select()
      .single();

    if (error) console.error('[Supabase] Erro saveMensagem:', error.message);
    return data;
  }

  async getRecentMensagens(telefone: string, restaurante_id?: string, limit = 20) {
    let query = this.client
      .from('mensagens')
      .select('conteudo, direcao, created_at')
      .eq('telefone', telefone);

    if (restaurante_id) {
      query = query.eq('restaurante_id', restaurante_id);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Supabase] Erro ao buscar histórico de mensagens:', error.message);
      return [];
    }

    return (data || []).reverse();
  }
}

export const supabase = new SupabaseAdapter();

