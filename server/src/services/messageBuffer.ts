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

/**
 * Adiciona mensagem ao buffer do telefone.
 * Equivalente ao "Text Memory" / "Redis8" / "Redis3" do n8n.
 */
export async function pushToBuffer(phone: string, text: string): Promise<void> {
  await getRedis().rpush(`buffer:${phone}`, text);
  console.log(`[Buffer] PUSH ${phone.slice(0, 6)}... → "${text.slice(0, 50)}..."`);
}

/**
 * Aguarda o debounce e coleta todas as mensagens acumuladas.
 * 
 * Lógica do n8n reproduzida fielmente:
 * 1. GET estado antes
 * 2. WAIT 8 segundos
 * 3. GET estado depois
 * 4. Se mudou → descarta (outra execução cuida)
 * 5. Se igual → junta tudo, deleta, retorna
 * 
 * Retorna null se outra mensagem chegou durante o wait.
 */
export async function waitAndCollect(phone: string): Promise<string | null> {
  const r = getRedis();
  const key = `buffer:${phone}`;

  // 1. Captura estado ANTES
  const before = await r.lrange(key, 0, -1);
  console.log(`[Buffer] BEFORE ${phone.slice(0, 6)}...: [${before.length} msgs]`);

  // 2. Espera debounce
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));

  // 3. Captura estado DEPOIS
  const after = await r.lrange(key, 0, -1);
  console.log(`[Buffer] AFTER  ${phone.slice(0, 6)}...: [${after.length} msgs]`);

  // 4. Se mudou, outra execução processará
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    console.log(`[Buffer] ⏭️ Nova msg detectada, descartando esta execução`);
    return null;
  }

  // 5. Junta tudo em texto único
  const fullMessage = after.join('\n');

  // 6. Limpa buffer
  await r.del(key);
  console.log(`[Buffer] ✅ Coletado: "${fullMessage.slice(0, 80)}..."`);

  return fullMessage;
}
