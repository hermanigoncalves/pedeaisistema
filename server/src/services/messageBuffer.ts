import Redis from 'ioredis';
import { config } from '../config';

const DEBOUNCE_MS = 8000; // 8 segundos — mesmo valor do Wait1 no n8n

let redis: Redis;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // para de reconectar
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err) => console.error('[Redis] ❌ Erro:', err.message));
    redis.on('connect', () => console.log('[Redis] ✅ Conectado'));
  }
  return redis;
}

// Memory fallback em caso de falha do Redis
const memoryBuffers = new Map<string, string[]>();

export async function pushToBuffer(phone: string, text: string): Promise<void> {
  try {
    await getRedis().rpush(`buffer:${phone}`, text);
    console.log(`[Buffer] PUSH ${phone.slice(0, 6)}... → "${text.slice(0, 50)}..."`);
  } catch (err: any) {
    console.warn('[Buffer] ⚠️ Redis indisponível, usando fallback em memória local');
    const list = memoryBuffers.get(phone) || [];
    list.push(text);
    memoryBuffers.set(phone, list);
  }
}

export async function waitAndCollect(phone: string): Promise<string | null> {
  try {
    const r = getRedis();
    const key = `buffer:${phone}`;

    const before = await r.lrange(key, 0, -1);
    console.log(`[Buffer] BEFORE ${phone.slice(0, 6)}...: [${before.length} msgs]`);

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));

    const after = await r.lrange(key, 0, -1);
    console.log(`[Buffer] AFTER  ${phone.slice(0, 6)}...: [${after.length} msgs]`);

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      console.log(`[Buffer] ⏭️ Nova msg detectada, descartando esta execução`);
      return null;
    }

    const fullMessage = after.join('\n');
    await r.del(key);
    console.log(`[Buffer] ✅ Coletado: "${fullMessage.slice(0, 80)}..."`);
    return fullMessage;
  } catch (err: any) {
    console.warn('[Buffer] ⚠️ Coletando via fallback em memória local...');
    const msgs = memoryBuffers.get(phone) || [];
    memoryBuffers.delete(phone);
    return msgs.join('\n') || null;
  }
}

