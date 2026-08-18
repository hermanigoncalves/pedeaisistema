import OpenAI, { toFile } from 'openai';
import axios from 'axios';
import { config } from '../config';
import { evolution } from '../adapters/evolutionAdapter';
import { supabase } from '../adapters/supabaseAdapter';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

/**
 * Transcreve áudio usando OpenAI Whisper.
 * Suporta Buffer, URLs (http/https), Data URIs (data:audio/...) e Base64 cru.
 */
export async function transcribeAudio(input: Buffer | string): Promise<string> {
  try {
    let buffer: Buffer;

    if (!input) {
      console.warn('[Media] ⚠️ Entrada de áudio vazia para transcrição');
      return '[Áudio sem conteúdo]';
    }

    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return '[Áudio sem conteúdo]';
      }

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        console.log('[Media] 🌐 Baixando arquivo de áudio da URL com autenticação...');
        const response = await axios.get(trimmed, {
          responseType: 'arraybuffer',
          headers: { 'apikey': config.EVOLUTION_API_KEY },
          timeout: 15000,
        });
        buffer = Buffer.from(response.data);
      } else if (trimmed.startsWith('data:')) {
        const parts = trimmed.split(',');
        const base64Data = parts[1] || parts[0];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(trimmed, 'base64');
      }
    } else {
      return '[Áudio inválido]';
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
 */
export async function analyzeImage(input: Buffer | string): Promise<string> {
  try {
    let base64Image = '';

    if (Buffer.isBuffer(input)) {
      base64Image = `data:image/jpeg;base64,${input.toString('base64')}`;
    } else if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.startsWith('data:image')) {
        base64Image = trimmed;
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const res = await axios.get(trimmed, {
          responseType: 'arraybuffer',
          headers: { 'apikey': config.EVOLUTION_API_KEY },
          timeout: 15000,
        });
        const mime = res.headers['content-type'] || 'image/jpeg';
        base64Image = `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
      } else {
        base64Image = `data:image/jpeg;base64,${trimmed}`;
      }
    }

    if (!base64Image) {
      return '[Imagem sem conteúdo]';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Descreva resumidamente o conteúdo desta imagem enviada pelo cliente do restaurante (prato, comprovante, cardápio, etc).' },
            { type: 'image_url', image_url: { url: base64Image } },
          ],
        },
      ],
      max_tokens: 150,
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
 * Baixa mídia e processa (transcrição ou análise visual) via Evolution Go.
 */
export async function downloadAndProcess(
  restauranteId: string | null | undefined,
  rawMessage: any,
  type: 'audio' | 'image',
): Promise<string> {
  try {
    const buffer = await evolution.downloadMedia(restauranteId, rawMessage);
    if (!buffer || buffer.length === 0) {
      console.warn('[Media] ⚠️ Buffer de mídia vazio após download');
      return type === 'audio' ? '[Áudio sem conteúdo]' : '[Imagem sem conteúdo]';
    }

    return type === 'audio'
      ? await transcribeAudio(buffer)
      : await analyzeImage(buffer);
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

  const { data } = supabase.client.storage
    .from('media')
    .getPublicUrl(path);

  return data.publicUrl;
}
