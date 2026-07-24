/**
 * Serviço de notificações push
 */

export interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    silent?: boolean;
}

class NotificationService {
    private permission: NotificationPermission = 'default';

    constructor() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
        }
    }

    /**
     * Solicita permissão para notificações
     */
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('Este navegador não suporta notificações');
            return false;
        }

        if (this.permission === 'granted') {
            return true;
        }

        const permission = await Notification.requestPermission();
        this.permission = permission;
        return permission === 'granted';
    }

    /**
     * Verifica se notificações estão habilitadas
     */
    isEnabled(): boolean {
        return this.permission === 'granted';
    }

    /**
     * Envia uma notificação
     */
    async send(options: NotificationOptions): Promise<void> {
        if (!this.isEnabled()) {
            console.warn('Notificações não estão habilitadas');
            return;
        }

        try {
            const notification = new Notification(options.title, {
                body: options.body,
                icon: options.icon || '/logo.png',
                badge: options.badge || '/logo.png',
                tag: options.tag,
                requireInteraction: options.requireInteraction || false,
                silent: options.silent || false,
            });

            // Auto-fechar após 5 segundos se não for requireInteraction
            if (!options.requireInteraction) {
                setTimeout(() => notification.close(), 5000);
            }

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.error('Erro ao enviar notificação:', error);
        }
    }

    /**
     * Notificação de novo pedido
     */
    async notifyNewOrder(tableId: number): Promise<void> {
        await this.send({
            title: '🔔 Novo Pedido',
            body: `Novo pedido na Mesa ${tableId}`,
            tag: `order-${tableId}`,
            requireInteraction: true,
        });
    }

    /**
     * Notificação de garçom chamado
     */
    async notifyWaiterCall(tableId: number): Promise<void> {
        await this.send({
            title: '👋 Garçom Chamado',
            body: `Mesa ${tableId} está chamando o garçom`,
            tag: `waiter-${tableId}`,
            requireInteraction: true,
        });
    }

    /**
     * Notificação de conta solicitada
     */
    async notifyBillRequest(tableId: number): Promise<void> {
        await this.send({
            title: '💳 Conta Solicitada',
            body: `Mesa ${tableId} solicitou a conta`,
            tag: `bill-${tableId}`,
            requireInteraction: true,
        });
    }

    /**
     * Notificação de estoque baixo
     */
    async notifyLowStock(productName: string, quantity: number): Promise<void> {
        await this.send({
            title: '⚠️ Estoque Baixo',
            body: `${productName} com estoque baixo (${quantity} unidades)`,
            tag: `stock-${productName}`,
        });
    }
}

export const notificationService = new NotificationService();
