// ============================================================
// Tipos compartilhados — Backend PedeAi
// ============================================================

/** Payload recebido pelo webhook da Evolution Go */
export interface EvoWebhookPayload {
  event: string; // "messages.upsert"
  instance: string; // "PidiAI"
  data: {
    key: {
      remoteJid: string; // "5533999999999@s.whatsapp.net"
      fromMe: boolean;
      id: string; // message ID
    };
    pushName: string; // nome do remetente
    message: {
      conversation?: string; // texto simples
      extendedTextMessage?: { text: string };
      audioMessage?: { mimetype: string; url?: string };
      imageMessage?: { mimetype: string; caption?: string; url?: string };
    };
    messageType: string; // "conversation", "audioMessage", "imageMessage"
    messageTimestamp: number;
  };
}

/** Dados do usuário (tabela Usuários no Supabase) */
export interface UserData {
  id: number;
  telefone: string;
  id_restaurante: string;
  mesa_atual: string;
  Status: string;
  nome?: string;
  quantas_vezes_foi: number;
  chat_humano?: boolean;
}

/** Payload de entrada para o webhook leadpedeaichegou */
export interface FirstMessagePayload {
  nome: string;
  telefone: string;
  restauranteId: string;
  restauranteNome: string;
  mesaId: number;
  isFirstVisit: boolean;
  visits: number;
  timestamp?: string;
}

/** Payload de entrada para o webhook Envia-conta */
export interface CloseBillPayload {
  telefone: string;
  nome: string;
  numero_mesa: number;
  itens: string;
  subtotal: string;
  taxa: string;
  total: string;
  couvert?: string;
  skipWhatsApp?: boolean;
  restaurante_id?: string;
}

/** Tipo de mensagem detectado */
export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'unknown';

/** Dados processados de uma mensagem recebida */
export interface ProcessedMessage {
  phone: string;       // Telefone normalizado (5533984266981)
  senderName: string;  // Nome do remetente
  text: string;        // Texto ou transcrição
  messageId: string;   // ID da mensagem original
  messageType: MessageType;
  timestamp: number;
  rawMessage?: any;    // Mensagem original (para download de mídia)
}
