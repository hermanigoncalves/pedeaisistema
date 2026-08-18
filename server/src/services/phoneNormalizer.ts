/**
 * Normalização de telefone brasileiro para WhatsApp JID.
 * Preserva os dígitos exatos do número de WhatsApp recebido do WAHA/WhatsApp Web,
 * evitando a inserção especulativa do '9' que altera o JID real da conta (ex: 553387140460).
 */
export function normalizePhone(rawJid: string): string {
  if (!rawJid) return '';

  // 1. Remove qualquer sufixo de dispositivo (:11, :2, etc) ANTES de separar por @
  const cleanJid = rawJid.split(':')[0];

  // 2. Extrai apenas os dígitos
  let n = cleanJid.split('@')[0].replace(/\D/g, '');

  // 3. Trata números com mais de 13 dígitos (ex: resíduos de dispositivos não cortados)
  if (n.startsWith('55') && n.length > 13) {
    n = n.slice(0, 13);
  }

  // Garante que começa com 55 se for um número padrão BR (10 ou 11 dígitos)
  if (!n.startsWith('55') && (n.length === 10 || n.length === 11)) {
    n = '55' + n;
  }

  return n;
}

/**
 * Normalização canônica para agrupamento de chats (frontend style).
 * Remove o 55, remove o 9 extra se houver 11 dígitos → fica DDD + 8 dígitos.
 */
export function getCanonicalPhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.split(':')[0].split('@')[0].replace(/\D/g, '');

  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.substring(2);
  }

  if (clean.length === 11) {
    clean = clean.substring(0, 2) + clean.substring(3);
  }

  return clean;
}

export const canonicalPhone = getCanonicalPhone;
