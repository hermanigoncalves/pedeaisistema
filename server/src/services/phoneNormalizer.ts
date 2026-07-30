/**
 * Normalização de telefone brasileiro com tratamento completo para:
 *   - Sufixos de dispositivos do WhatsApp (ex: :11@s.whatsapp.net -> remove :11)
 *   - LIDs do WhatsApp Multi-Device (@lid)
 *   - Inserção do 9º dígito após DDD se necessário
 *   - Formatação canônica BR de 13 dígitos (55 + DDD + 9 + 8 dígitos)
 */
export function normalizePhone(rawJid: string): string {
  if (!rawJid) return '';

  // 1. Remove qualquer sufixo de dispositivo (:11, :2, etc) ANTES de separar por @
  let cleanJid = rawJid.split(':')[0];

  // 2. Extrai apenas dígitos
  let n = cleanJid.split('@')[0].replace(/\D/g, '');

  // 3. Trata números com mais de 13 dígitos (ex: resíduos de dispositivos não cortados)
  if (n.startsWith('55') && n.length > 13) {
    n = n.slice(0, 13);
  }

  // Garante que começa com 55 se for um número padrão BR (10 ou 11 dígitos)
  if (!n.startsWith('55') && (n.length === 10 || n.length === 11)) {
    n = '55' + n;
  }

  // Insere 9 após DDI+DDD (posição 4) se o "resto" tiver 8 dígitos
  if (n.startsWith('55') && n.length === 12) {
    const resto = n.slice(4);
    if (resto.length === 8) {
      n = n.slice(0, 4) + '9' + resto;
    }
  }

  return n;
}

/**
 * Normalização canônica para agrupamento de chats (frontend style).
 * Remove o 55, remove o 9 extra → fica DDD + 8 dígitos.
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
