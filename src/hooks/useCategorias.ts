import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CategoriaRestaurante {
  id: number;
  restaurante_id: string;
  nome: string;
  created_at: string;
}

export const useCategorias = (restaurantId: string | null) => {
  const [categorias, setCategorias] = useState<CategoriaRestaurante[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategorias = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('Categorias' as any)
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('nome', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          console.warn('[useCategorias] Tabela Categorias não existe no banco de dados ainda.');
        } else {
          throw error;
        }
      } else {
        setCategorias((data || []) as any as CategoriaRestaurante[]);
      }
    } catch (err: any) {
      console.error('[useCategorias] Erro ao buscar categorias:', err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const addCategoria = useCallback(async (nome: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Categorias' as any)
        .insert({ restaurante_id: restaurantId, nome });

      if (error) throw error;
      toast.success('Categoria adicionada!');
      await fetchCategorias({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao adicionar categoria: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchCategorias]);

  const updateCategoria = useCallback(async (id: number, nome: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Categorias' as any)
        .update({ nome })
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Categoria atualizada!');
      await fetchCategorias({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar categoria: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchCategorias]);

  const deleteCategoria = useCallback(async (id: number): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Categorias' as any)
        .delete()
        .eq('id', id)
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Categoria removida!');
      await fetchCategorias({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover categoria: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchCategorias]);

  useEffect(() => {
    if (restaurantId) {
      fetchCategorias();
    }
  }, [restaurantId, fetchCategorias]);

  // Setup real-time subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('categorias-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Categorias',
          filter: `restaurante_id=eq.${restaurantId}`,
        },
        () => {
          fetchCategorias({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchCategorias]);

  return {
    categorias,
    loading,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    refetchCategorias: fetchCategorias
  };
};
