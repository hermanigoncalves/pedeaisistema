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
    let query = this.client
      .from('Usuários')
      .select('*')
      .eq('telefone', phone);

    if (restauranteId) {
      query = query.eq('id_restaurante', restauranteId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) console.error('[Supabase] Erro getUserByPhone:', error.message);
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
    let user = await this.getUserByPhone(phone, restauranteId);
    if (!user) {
      // Busca o restaurante padrão se não informado
      let targetRestauranteId = restauranteId;
      if (!targetRestauranteId) {
        const { data: rest } = await this.client.from('restaurantes').select('id').limit(1).single();
        targetRestauranteId = rest?.id || '00000000-0000-0000-0000-000000000000';
      }

      user = await this.createUser({
        telefone: phone,
        id_restaurante: targetRestauranteId,
        mesa_atual: '0',
        Status: 'Ativo',
        quantas_vezes_foi: 1,
      });
    }
    return user;
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

  async getRestauranteByEvolutionInstance(instanceName: string) {
    if (!instanceName) return null;
    const { data, error } = await this.client
      .from('Restaurantes')
      .select('*')
      .or(`evolution_instancia.eq.${instanceName},evolution_instancia_delivery.eq.${instanceName},evolution_instancia.ilike.%${instanceName}%,evolution_instancia_delivery.ilike.%${instanceName}%`)
      .limit(1)
      .maybeSingle();

    if (error) console.error('[Supabase] Erro getRestauranteByEvolutionInstance:', error.message);
    return data;
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
}

export const supabase = new SupabaseAdapter();
