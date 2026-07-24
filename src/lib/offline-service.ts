/**
 * Serviço de modo offline e sincronização
 */

interface OfflineAction {
    id: string;
    type: 'create_order' | 'update_table' | 'update_product';
    data: any;
    timestamp: number;
}

class OfflineService {
    private readonly QUEUE_KEY = 'pedeai_offline_queue';
    private readonly CACHE_KEY = 'pedeai_cache';
    private isOnline: boolean = navigator.onLine;
    private syncInProgress: boolean = false;

    constructor() {
        this.setupOnlineListener();
    }

    /**
     * Configura listener para mudanças de status online/offline
     */
    private setupOnlineListener(): void {
        window.addEventListener('online', () => {
            console.log('Conexão restaurada');
            this.isOnline = true;
            this.syncPendingActions();
        });

        window.addEventListener('offline', () => {
            console.log('Conexão perdida');
            this.isOnline = false;
        });
    }

    /**
     * Verifica se está online
     */
    getOnlineStatus(): boolean {
        return this.isOnline;
    }

    /**
     * Adiciona ação à fila offline
     */
    queueAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): void {
        const queue = this.getQueue();
        const newAction: OfflineAction = {
            ...action,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
        };

        queue.push(newAction);
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    }

    /**
     * Obtém fila de ações pendentes
     */
    getQueue(): OfflineAction[] {
        try {
            const queueJson = localStorage.getItem(this.QUEUE_KEY);
            return queueJson ? JSON.parse(queueJson) : [];
        } catch (error) {
            console.error('Erro ao obter fila offline:', error);
            return [];
        }
    }

    /**
     * Obtém número de ações pendentes
     */
    getPendingCount(): number {
        return this.getQueue().length;
    }

    /**
     * Sincroniza ações pendentes quando voltar online
     */
    async syncPendingActions(): Promise<void> {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        this.syncInProgress = true;
        const queue = this.getQueue();

        if (queue.length === 0) {
            this.syncInProgress = false;
            return;
        }

        console.log(`Sincronizando ${queue.length} ações pendentes...`);

        try {
            // Processar ações em ordem
            for (const action of queue) {
                await this.processAction(action);
            }

            // Limpar fila após sincronização bem-sucedida
            localStorage.removeItem(this.QUEUE_KEY);
            console.log('Sincronização concluída com sucesso');
        } catch (error) {
            console.error('Erro na sincronização:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Processa uma ação específica
     */
    private async processAction(action: OfflineAction): Promise<void> {
        // Aqui você implementaria a lógica específica para cada tipo de ação
        // Por exemplo, enviar para o Supabase
        console.log('Processando ação:', action);

        // Simulação de processamento
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Salva dados no cache local
     */
    cacheData(key: string, data: any): void {
        try {
            const cache = this.getCache();
            cache[key] = {
                data,
                timestamp: Date.now(),
            };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.error('Erro ao salvar cache:', error);
        }
    }

    /**
     * Obtém dados do cache
     */
    getCachedData(key: string): any | null {
        try {
            const cache = this.getCache();
            return cache[key]?.data || null;
        } catch (error) {
            console.error('Erro ao obter cache:', error);
            return null;
        }
    }

    /**
     * Obtém todo o cache
     */
    private getCache(): Record<string, { data: any; timestamp: number }> {
        try {
            const cacheJson = localStorage.getItem(this.CACHE_KEY);
            return cacheJson ? JSON.parse(cacheJson) : {};
        } catch (error) {
            console.error('Erro ao obter cache:', error);
            return {};
        }
    }

    /**
     * Limpa cache antigo (mais de 7 dias)
     */
    clearOldCache(): void {
        try {
            const cache = this.getCache();
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;

            Object.keys(cache).forEach(key => {
                if (now - cache[key].timestamp > sevenDays) {
                    delete cache[key];
                }
            });

            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
        }
    }

    /**
     * Limpa todos os dados offline
     */
    clearAll(): void {
        localStorage.removeItem(this.QUEUE_KEY);
        localStorage.removeItem(this.CACHE_KEY);
    }
}

export const offlineService = new OfflineService();
