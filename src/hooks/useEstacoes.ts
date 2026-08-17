import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EstacaoRestaurante {
  id: number;
  restaurante_id: string;
  nome: string;
  created_at: string;
}

export const useEstacoes = (restaurantId: string | null) => {
  const [estacoes, setEstacoes] = useState<EstacaoRestaurante[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEstacoes = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('Estações' as any)
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('nome', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          console.warn('[useEstacoes] Tabela Estações não existe no banco de dados ainda.');
        } else {
          throw error;
        }
      } else {
        setEstacoes((data || []) as any as EstacaoRestaurante[]);
      }
    } catch (err: any) {
      console.error('[useEstacoes] Erro ao buscar estações:', err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const addEstacao = useCallback(async (nome: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Estações' as any)
        .insert({ restaurante_id: restaurantId, nome });

      if (error) throw error;
      toast.success('Estação adicionada!');
      await fetchEstacoes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao adicionar estação: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchEstacoes]);

  const updateEstacao = useCallback(async (id: number, nome: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Estações' as any)
        .update({ nome })
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Estação atualizada!');
      await fetchEstacoes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar estação: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchEstacoes]);

  const deleteEstacao = useCallback(async (id: number): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Estações' as any)
        .delete()
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Estação removida!');
      await fetchEstacoes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover estação: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchEstacoes]);

  useEffect(() => {
    if (restaurantId) {
      fetchEstacoes();
    }
  }, [restaurantId, fetchEstacoes]);

  // Setup real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('estacoes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Estações',
          filter: `restaurante_id=eq.${restaurantId}`,
        },
        () => {
          fetchEstacoes({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchEstacoes]);

  return {
    estacoes,
    loading,
    addEstacao,
    updateEstacao,
    deleteEstacao,
    refetchEstacoes: fetchEstacoes
  };
};
