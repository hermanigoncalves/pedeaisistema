import OpenAI, { toFile } from 'openai';
import axios from 'axios';
import { config } from '../config';
import { evolution } from '../adapters/evolutionAdapter';
import { supabase } from '../adapters/supabaseAdapter';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

/**
 * Transcreve áudio usando OpenAI Whisper.
 * Suporta URLs (http/https), Data URIs (data:audio/...) e Base64 cru.
 */
export async function transcribeAudio(input: string): Promise<string> {
  try {
    let buffer: Buffer;

    if (!input || !input.trim()) {
      console.warn('[Media] ⚠️ Entradas de áudio vazia para transcrição');
      return '[Áudio sem conteúdo]';
    }

    const trimmed = input.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      console.log('[Media] 🌐 Baixando arquivo de áudio da URL...');
      const response = await axios.get(trimmed, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } else if (trimmed.startsWith('data:')) {
      const parts = trimmed.split(',');
      const base64Data = parts[1] || parts[0];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(trimmed, 'base64');
    }

    if (!buffer || buffer.length === 0) {
      console.warn('[Media] ⚠️ Buffer de áudio vazio');
      return '[Áudio sem conteúdo]';
    }

    const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' });

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
    });

    console.log(`[Media] 🎤 Transcrição concluída: "${response.text.slice(0, 80)}..."`);
    return response.text;
  } catch (err: any) {
    console.error('[Media] ❌ Erro transcrição:', err.message);
    return '[Áudio não pôde ser transcrito]';
  }
}

/**
 * Analisa imagem usando OpenAI Vision (GPT-4o-mini).
 * Equivalente ao fluxo: baixa_imagem → Convert to File → OpenAI1 (analyze image)
 */
export async function analyzeImage(base64Data: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Descreva essa imagem' },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Data}` },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const description = response.choices[0]?.message?.content || '[Imagem não identificada]';
    console.log(`[Media] 📷 Descrição: "${description.slice(0, 80)}..."`);
    return description;
  } catch (err: any) {
    console.error('[Media] ❌ Erro análise imagem:', err.message);
    return '[Imagem não pôde ser analisada]';
  }
}

/**
 * Baixa mídia e processa (transcrição ou análise visual).
 * Usa Evolution Go /message/downloadimage.
 */
export async function downloadAndProcess(
  restauranteId: string | null | undefined,
  rawMessage: any,
  type: 'audio' | 'image',
): Promise<string> {
  try {
    const mediaData = await evolution.downloadMedia(restauranteId, rawMessage);
    const base64 = mediaData.base64Data || mediaData.base64 || '';

    if (!base64) {
      console.warn('[Media] ⚠️ Base64 vazio após download');
      return type === 'audio' ? '[Áudio sem conteúdo]' : '[Imagem sem conteúdo]';
    }

    return type === 'audio'
      ? await transcribeAudio(base64)
      : await analyzeImage(base64);
  } catch (err: any) {
    console.error(`[Media] ❌ Erro download ${type}:`, err.message);
    return `[${type === 'audio' ? 'Áudio' : 'Imagem'} indisponível]`;
  }
}

/**
 * Faz upload de um buffer de mídia para o Supabase Storage no bucket "media".
 */
export async function uploadMediaBuffer(buffer: Buffer, mimeType: string, extension: string): Promise<string> {
  const path = `chats/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
  
  const { error } = await supabase.client.storage
    .from('media')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    console.error('[Storage] Erro ao fazer upload de mídia recebida:', error.message);
    throw error;
  }

  const { data } = supabase.client.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Baixa a mídia recebida e faz upload no Supabase Storage.
 * Retorna a URL pública da mídia.
 */
export async function saveIncomingMedia(
  restauranteId: string | null | undefined,
  message: any,
  type: 'audio' | 'image' | 'video' | 'document',
): Promise<string> {
  try {
    let base64 = message.base64 || '';
    if (!base64) {
      const mediaData = await evolution.downloadMedia(restauranteId, message);
      base64 = mediaData.base64Data || mediaData.base64 || '';
    }

    if (!base64) {
      console.warn('[Media] ⚠️ Não foi possível obter base64 da mídia recebida');
      return '';
    }

    const buffer = Buffer.from(base64, 'base64');
    let mimeType = 'application/octet-stream';
    let extension = 'bin';

    if (type === 'audio') {
      mimeType = 'audio/ogg';
      extension = 'ogg';
    } else if (type === 'image') {
      mimeType = 'image/jpeg';
      extension = 'jpg';
    } else if (type === 'video') {
      mimeType = 'video/mp4';
      extension = 'mp4';
    } else if (type === 'document') {
      mimeType = message.documentMessage?.mimetype || 'application/pdf';
      extension = mimeType.split('/').pop() || 'pdf';
    }

    return await uploadMediaBuffer(buffer, mimeType, extension);
  } catch (err: any) {
    console.error('[Media] ❌ Erro ao salvar mídia recebida no Supabase:', err.message);
    return '';
  }
}
