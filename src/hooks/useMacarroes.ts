import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Macarrao {
  id: number;
  restaurante_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export const useMacarroes = (restaurantId: string | null) => {
  const [macarroes, setMacarroes] = useState<Macarrao[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMacarroes = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('Macarroes' as any)
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('nome', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table') || error.code === 'PGRST204') {
          // Tabela opcional não criada no Supabase ainda
        } else {
          throw error;
        }
      } else {
        setMacarroes((data || []) as any as Macarrao[]);
      }
    } catch (err: any) {
      console.error('[useMacarroes] Erro ao buscar macarrões:', err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const addMacarrao = useCallback(async (nome: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Macarroes' as any)
        .insert({ restaurante_id: restaurantId, nome, ativo: true });

      if (error) throw error;
      toast.success('Tipo de macarrão adicionado!');
      await fetchMacarroes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao adicionar macarrão: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchMacarroes]);

  const updateMacarrao = useCallback(async (id: number, updates: Partial<{ nome: string; ativo: boolean }>): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Macarroes' as any)
        .update(updates)
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Macarrão atualizado!');
      await fetchMacarroes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchMacarroes]);

  const deleteMacarrao = useCallback(async (id: number): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Macarroes' as any)
        .delete()
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Macarrão removido!');
      await fetchMacarroes({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchMacarroes]);

  useEffect(() => {
    fetchMacarroes();
  }, [fetchMacarroes]);

  return {
    macarroes,
    loading,
    addMacarrao,
    updateMacarrao,
    deleteMacarrao,
    refetchMacarroes: fetchMacarroes
  };
};
