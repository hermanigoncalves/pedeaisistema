import React, { useState, useEffect } from 'react';
import { offlineService } from '@/lib/offline-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const OfflineIndicator: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const updateStatus = () => {
            setIsOnline(navigator.onLine);
            setPendingCount(offlineService.getPendingCount());
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Atualizar a cada 5 segundos
        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
            clearInterval(interval);
        };
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await offlineService.syncPendingActions();
            setPendingCount(0);
            toast.success('Sincronização concluída!');
        } catch (error) {
            toast.error('Erro na sincronização');
        } finally {
            setIsSyncing(false);
        }
    };

    if (isOnline && pendingCount === 0) {
        return null; // Não mostrar nada quando online e sem pendências
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-3 shadow-lg">
                {isOnline ? (
                    <Wifi className="w-5 h-5 text-success" />
                ) : (
                    <WifiOff className="w-5 h-5 text-destructive" />
                )}

                <div className="flex flex-col">
                    <span className="text-sm font-medium">
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {pendingCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {pendingCount} ação{pendingCount > 1 ? 'ões' : ''} pendente{pendingCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {pendingCount > 0 && isOnline && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="ml-2"
                    >
                        {isSyncing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            'Sincronizar'
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default OfflineIndicator;
