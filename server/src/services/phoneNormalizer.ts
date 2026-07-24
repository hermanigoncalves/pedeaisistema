/**
 * Normalização de telefone brasileiro.
 * Reproduz exatamente a lógica do n8n "Tratar Dados1":
 *   - Remove @s.whatsapp.net
 *   - Adiciona +55 se não tiver
 *   - Insere 9 após DDD se necessário
 */
export function normalizePhone(rawJid: string): string {
  let n = rawJid.split('@')[0].replace(/\D/g, '');

  // Garante que começa com 55
  if (!n.startsWith('55')) {
    n = '55' + n;
  }

  // Insere 9 após DDI+DDD (posição 4) se o "resto" tem apenas 8 dígitos
  const resto = n.slice(4);
  if (resto.length === 8) {
    n = n.slice(0, 4) + '9' + resto;
  }

  return n;
}

/**
 * Normalização canônica para agrupamento de chats (frontend style).
 * Remove o 55, remove o 9 extra → fica DDD + 8 dígitos.
 */
export function getCanonicalPhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.split('@')[0].replace(/\D/g, '');

  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.substring(2);
  }

  if (clean.length === 11) {
    clean = clean.substring(0, 2) + clean.substring(3);
  }

  return clean;
}
