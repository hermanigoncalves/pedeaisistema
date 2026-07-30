import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Restaurant {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  quantidade_mesas: string | null;
  horario_fecha_cozinha: string | null;
  horario_abertura: string | null;
  horario_fechamento: string | null;
  fechar_mesa_auto: boolean | null;
  alertas_piscantes: boolean | null;
  sons_habilitados: boolean | null;
  alerta_estoque_baixo: number | null;
  alerta_estoque_critico: number | null;
  impressao_auto: boolean | null;
  max_mesas: string | null;
  taxa_servico: number | null;
  gerencia_estoque: boolean | null;
  modo_cobranca: string | null;
  cobranca_meio_a_meio: string | null;
  meia_pizza_habilitada: boolean | null;
  couvert_habilitado: boolean | null;
  couvert_valor: number | null;
  evolution_instancia: string | null;
  evolution_apikey: string | null;
  waha_session?: string | null;
  waha_apikey?: string | null;
  personalidade_agente: string | null;
  exemplos_conversa: string | null;
  regras_estabelecimento: string | null;
  delivery_habilitado?: boolean | null;
  evolution_instancia_delivery?: string | null;
  evolution_apikey_delivery?: string | null;
  waha_session_delivery?: string | null;
  waha_apikey_delivery?: string | null;
  personalidade_agente_delivery?: string | null;
  regras_estabelecimento_delivery?: string | null;
  exemplos_conversa_delivery?: string | null;
  created_at: string;
}

export const useRestaurant = (restaurantId: string | null) => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurant = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      if (!options.silent) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('Restaurantes')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error) throw error;
      setRestaurant(data as any as Restaurant);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar restaurante');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const updateRestaurant = useCallback(async (updates: Partial<Restaurant>) => {
    if (!restaurantId) return { error: 'No restaurant ID' };

    try {
      const { error } = await supabase
        .from('Restaurantes')
        .update(updates)
        .eq('id', restaurantId);

      if (error) throw error;

      // Update local state
      setRestaurant(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (err) {
      console.error('Error updating restaurant:', err);
      return { error: err instanceof Error ? err.message : 'Erro ao atualizar restaurante' };
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  return {
    restaurant,
    loading,
    error,
    updateRestaurant,
    refetch: fetchRestaurant,
  };
};
