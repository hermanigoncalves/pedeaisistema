import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SystemLog, LogLevel, LogCategory } from '@/services/logger-service';

interface UseSystemLogsOptions {
    level?: LogLevel;
    category?: LogCategory;
    restaurantId?: string;
    limit?: number;
    realtime?: boolean;
}

export function useSystemLogs(options: UseSystemLogsOptions = {}) {
    const { level, category, restaurantId, limit = 500, realtime = true } = options;
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch logs
    const fetchLogs = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('system_logs' as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (level) {
                query = query.eq('level', level);
            }

            if (category) {
                query = query.eq('category', category);
            }

            if (restaurantId) {
                query = query.eq('restaurant_id', restaurantId);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                setError(fetchError.message);
                console.error('Error fetching logs:', fetchError);
            } else {
                setLogs((data as unknown as SystemLog[]) || []);
                setError(null);
            }
        } catch (err) {
            setError('Failed to fetch logs');
            console.error('Fetch logs error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [level, category, restaurantId, limit]);

    // Realtime subscription
    useEffect(() => {
        if (!realtime) return;

        const channel = supabase
            .channel('system_logs_changes')
            .on(
                'postgres_changes' as any,
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'system_logs',
                },
                (payload: any) => {
                    const newLog = payload.new as SystemLog;

                    // Apply filters
                    if (level && newLog.level !== level) return;
                    if (category && newLog.category !== category) return;
                    if (restaurantId && newLog.restaurant_id !== restaurantId) return;

                    setLogs((prev) => [newLog, ...prev].slice(0, limit));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [realtime, level, category, restaurantId, limit]);

    const stats = useMemo(() => {
        return {
            total: logs.length,
            errors: logs.filter(l => l.level === 'error').length,
            warnings: logs.filter(l => l.level === 'warning').length,
            info: logs.filter(l => l.level === 'info').length,
            success: logs.filter(l => l.level === 'success').length,
        };
    }, [logs]);

    return {
        logs,
        loading,
        error,
        stats,
        refetch: fetchLogs,
    };
}
