import dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  EVOLUTION_URL: z.string().min(5), // Aceita URLs internas Docker (http://polis_evogo:8080) e públicas
  EVOLUTION_API_KEY: z.string().min(10),
  EVOLUTION_INSTANCE: z.string().default('PidiAI'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().min(10),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RESTAURANTE_ID: z.string().uuid().optional(),
  AGENT_ROLE: z.enum(['pedeai', 'delivery']).default('pedeai'),
});

export const config = schema.parse(process.env);

console.log(`[Config] ✅ Validação OK — porta ${config.PORT}, env ${config.NODE_ENV}`);
