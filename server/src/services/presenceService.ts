import { waha, evolution } from '../adapters/wahaAdapter';

/**
 * Envia "digitando..." e aguarda delay.
 * Equivale ao Digitando...1 + Wait2 do n8n.
 */
export async function sendTypingAndWait(
  restauranteId: string | null | undefined,
  phone: string,
  delayMs = 1000,
): Promise<void> {
  await evolution.sendPresence(restauranteId, phone, 'composing');
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
