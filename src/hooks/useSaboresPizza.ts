import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SaborPizza {
  id: number;
  restaurante_id: string;
  nome: string;
  preco: string;
  ativo: boolean;
  descricao: string | null;
  estoque: number;
  estoque_minimo: number;
  estacao: 'bar' | 'kitchen';
  created_at: string;
}

export const useSaboresPizza = (restaurantId: string | null) => {
  const [saboresPizza, setSaboresPizza] = useState<SaborPizza[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSabores = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('SaboresPizza' as any)
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
        setSaboresPizza((data || []) as any as SaborPizza[]);
      }
    } catch (err: any) {
      console.error('[useSaboresPizza] Erro ao buscar sabores de pizza:', err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const addSaborPizza = useCallback(async (
    nome: string, 
    preco: number, 
    descricao?: string,
    estoque?: number,
    estoque_minimo?: number,
    estacao?: 'bar' | 'kitchen'
  ): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('SaboresPizza' as any)
        .insert({
          restaurante_id: restaurantId,
          nome,
          preco: preco.toString(),
          ativo: true,
          descricao: descricao || null,
          estoque: estoque ?? 0,
          estoque_minimo: estoque_minimo ?? 10,
          estacao: estacao ?? 'kitchen'
        });

      if (error) throw error;
      toast.success('Sabor de pizza adicionado!');
      await fetchSabores({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao adicionar sabor de pizza: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchSabores]);

  const updateSaborPizza = useCallback(async (
    id: number, 
    updates: Partial<{ 
      nome: string; 
      preco: number; 
      ativo: boolean; 
      descricao: string;
      estoque: number;
      estoque_minimo: number;
      estacao: 'bar' | 'kitchen';
    }>
  ): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const updateData: any = { ...updates };
      if (updates.preco !== undefined) {
        updateData.preco = updates.preco.toString();
      }

      const { error } = await supabase
        .from('SaboresPizza' as any)
        .update(updateData)
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Sabor de pizza atualizado!');
      await fetchSabores({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar sabor de pizza: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchSabores]);

  const deleteSaborPizza = useCallback(async (id: number): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('SaboresPizza' as any)
        .delete()
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Sabor de pizza removido!');
      await fetchSabores({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover sabor de pizza: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchSabores]);

  useEffect(() => {
    fetchSabores();
  }, [fetchSabores]);

  return {
    saboresPizza,
    loading,
    addSaborPizza,
    updateSaborPizza,
    deleteSaborPizza,
    refetchSaboresPizza: fetchSabores
  };
};
