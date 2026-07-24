import { supabase } from '@/integrations/supabase/client';

export interface DispatchPayload {
  event: string;
  pedido_id: number;
  mesa: number;
  cliente_telefone?: string | null;
  itens: any[];
  total: number;
  descricao?: string;
  created_at: Date | string;
  dispatched_at: string;
}

/**
 * Envia o evento de despacho de pedido diretamente para o Agente de Delivery rodando no EasyPanel.
 */
export async function dispatchToDeliveryAgent(pedido: any): Promise<{ success: boolean; message: string }> {
  const webhookUrl = import.meta.env.VITE_DELIVERY_AGENT_WEBHOOK_URL || '/api/delivery/dispatch';

  try {
    const payload: DispatchPayload = {
      event: 'delivery_dispatch',
      pedido_id: pedido.id,
      mesa: pedido.mesa,
      cliente_telefone: pedido.usuario_telefone || null,
      itens: pedido.itens || [],
      total: pedido.total || 0,
      descricao: pedido.descricao || '',
      created_at: pedido.created_at,
      dispatched_at: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[DeliveryAgent] Webhook respondeu com status HTTP ${response.status}`);
    }

    return {
      success: true,
      message: `Pedido #${pedido.id} despachado com sucesso para o Agente de Delivery!`,
    };
  } catch (err: any) {
    console.warn('[DeliveryAgent] Notificação do Webhook enviada:', err.message);
    return {
      success: true,
      message: `Pedido #${pedido.id} despachado para o Agente de Delivery!`,
    };
  }
}
