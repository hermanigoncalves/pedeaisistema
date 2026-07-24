import { ParsedPedido } from '@/hooks/usePedidos';

const EASYPANEL_DELIVERY_AGENT_URL =
  import.meta.env.VITE_DELIVERY_AGENT_WEBHOOK_URL ||
  'https://n8n.atendeexspress.com.br/webhook/status';

export const deliveryAgentService = {
  /**
   * Sincroniza a mudança de status do pedido no Kanban com o Agente de Delivery rodando no EasyPanel.
   */
  async syncOrderStatus(pedido: ParsedPedido, newStatus: string) {
    console.log(
      `[DeliveryAgent] Sincronizando pedido #${pedido.id} -> status '${newStatus}' no EasyPanel`
    );

    try {
      const response = await fetch(EASYPANEL_DELIVERY_AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          mesa: pedido.mesa,
          status: newStatus,
          cliente_telefone: pedido.usuario_telefone || null,
          itens: pedido.itens,
          total: pedido.total,
          descricao: pedido.descricao || '',
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.warn(
          `[DeliveryAgent] Webhook EasyPanel respondeu com status ${response.status}`
        );
      }

      return true;
    } catch (error) {
      console.warn('[DeliveryAgent] Erro ao notificar Agente de Delivery no EasyPanel:', error);
      return false;
    }
  },
};
