import dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  WAHA_URL: z.string().optional(),
  WAHA_API_KEY: z.string().optional(),
  WAHA_SESSION: z.string().default('default'),
  EVOLUTION_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().default('PidiAI'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().min(10),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RESTAURANTE_ID: z.string().uuid().optional(),
  AGENT_ROLE: z.enum(['pedeai', 'delivery']).default('pedeai'),
  // Segurança
  CORS_ORIGIN: z.string().default('*'),
  WEBHOOK_SECRET: z.string().optional(),
}).transform((data) => {
  return {
    ...data,
    WAHA_URL: data.WAHA_URL || data.EVOLUTION_URL || 'http://localhost:3000',
    WAHA_API_KEY: data.WAHA_API_KEY || data.EVOLUTION_API_KEY || '',
    WAHA_SESSION: data.WAHA_SESSION || data.EVOLUTION_INSTANCE || 'default',
    EVOLUTION_URL: data.EVOLUTION_URL || data.WAHA_URL || 'http://localhost:3000',
    EVOLUTION_API_KEY: data.EVOLUTION_API_KEY || data.WAHA_API_KEY || '',
    EVOLUTION_INSTANCE: data.EVOLUTION_INSTANCE || data.WAHA_SESSION || 'default',
  };
});

export const config = schema.parse(process.env);

console.log(`[Config] ✅ Validação OK — porta ${config.PORT}, env ${config.NODE_ENV}, WAHA URL: ${config.WAHA_URL}`);
