import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UsuarioSupabase {
    id: number;
    id_restaurante: string | null;
    nome: string | null;
    telefone: string | null;
    mesa_atual: string | null;
    quantas_vezes_foi: string | null;
    ultimo_checkin: string | null;
    created_at: string;
    chat_humano?: boolean;
}

export interface UsuarioInput {
    nome: string;
    telefone: string;
    mesa_atual?: string;
    quantas_vezes_foi?: string;
}

export const useUsuarios = (restaurantId: string | null) => {
    const [usuarios, setUsuarios] = useState<UsuarioSupabase[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchUsuarios = useCallback(async (options: { silent?: boolean } = {}) => {
        if (!restaurantId) return;

        if (!options.silent) {
            setLoading(true);
        }
        try {
            const { data, error } = await supabase
                .from('Usuários')
                .select('*')
                .eq('id_restaurante', restaurantId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching users:', error);
                return;
            }

            setUsuarios((data || []) as UsuarioSupabase[]);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    const addUsuario = useCallback(async (usuario: UsuarioInput): Promise<boolean> => {
        if (!restaurantId) return false;

        try {
            const { error } = await supabase
                .from('Usuários')
                .insert({
                    id_restaurante: restaurantId,
                    nome: usuario.nome,
                    telefone: usuario.telefone,
                    mesa_atual: usuario.mesa_atual || null,
                    quantas_vezes_foi: usuario.quantas_vezes_foi || '1',
                });

            if (error) {
                console.error('Supabase Error adding user:', error);
                toast.error(`Erro ao adicionar usuário: ${error.message}`);
                return false;
            }

            await fetchUsuarios();
            return true;
        } catch (err) {
            console.error('Failed to add user:', err);
            return false;
        }
    }, [restaurantId, fetchUsuarios]);

    const updateUsuario = useCallback(async (id: number, updates: Partial<UsuarioInput>): Promise<boolean> => {
        if (!restaurantId) return false;

        try {
            const updateData: any = {};
            if (updates.nome !== undefined) updateData.nome = updates.nome;
            if (updates.telefone !== undefined) updateData.telefone = updates.telefone;
            if (updates.mesa_atual !== undefined) updateData.mesa_atual = updates.mesa_atual;
            if (updates.quantas_vezes_foi !== undefined) updateData.quantas_vezes_foi = updates.quantas_vezes_foi;

            const { error } = await supabase
                .from('Usuários')
                .update(updateData)
                .eq('id', id)
                .eq('id_restaurante', restaurantId);

            if (error) {
                console.error('Supabase Error updating user:', error);
                toast.error(`Erro ao atualizar usuário: ${error.message}`);
                return false;
            }

            await fetchUsuarios();
            return true;
        } catch (err) {
            console.error('Failed to update user:', err);
            return false;
        }
    }, [restaurantId, fetchUsuarios]);

    const deleteUsuario = useCallback(async (id: number): Promise<boolean> => {
        if (!restaurantId) return false;

        try {
            const { error } = await supabase
                .from('Usuários')
                .delete()
                .eq('id', id)
                .eq('id_restaurante', restaurantId);

            if (error) {
                console.error('Supabase Error deleting user:', error);
                toast.error(`Erro ao remover usuário: ${error.message}`);
                return false;
            }

            await fetchUsuarios();
            return true;
        } catch (err) {
            console.error('Failed to delete user:', err);
            return false;
        }
    }, [restaurantId, fetchUsuarios]);

    useEffect(() => {
        if (restaurantId) {
            fetchUsuarios();
        }
    }, [restaurantId, fetchUsuarios]);

    useEffect(() => {
        if (!restaurantId) return;

        const channel = supabase
            .channel('usuarios-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Usuários',
                    filter: `id_restaurante=eq.${restaurantId}`,
                },
                () => {
                    fetchUsuarios({ silent: true });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [restaurantId, fetchUsuarios]);

    return {
        usuarios,
        loading,
        addUsuario,
        updateUsuario,
        deleteUsuario,
        refetch: fetchUsuarios,
    };
};
