import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

// Controllers
import { registerWebhookRoutes } from './controllers/webhookController';
import { registerFirstMessageRoutes } from './controllers/firstMessageController';
import { registerCloseBillRoutes } from './controllers/closeBillController';
import { startStockAlertCron } from './controllers/stockAlertController';
import { registerSystemRoutes } from './controllers/systemController';
import { registerChatRoutes } from './controllers/chatController';

const app = Fastify({ logger: true });

// Rotas públicas que NÃO passam pela validação de secret
const PUBLIC_PATHS = new Set([
  '/health',
  '/webhook/pedeai',
  '/webhook/delivery',
  '/webhook',
]);

async function main() {
  // CORS — usa CORS_ORIGIN do env; '*' em dev, domínio real em produção
  const corsOrigin = config.CORS_ORIGIN === '*'
    ? true
    : config.CORS_ORIGIN.split(',').map(o => o.trim());

  await app.register(cors, { origin: corsOrigin, credentials: true });

  // Middleware de segurança: valida X-Webhook-Secret nos endpoints privados
  app.addHook('preHandler', async (request, reply) => {
    const secret = config.WEBHOOK_SECRET;
    if (!secret) return; // Secret não configurado — sem validação (modo dev)

    const path = request.url.split('?')[0];
    if (PUBLIC_PATHS.has(path)) return; // Endpoint público, não valida

    const provided = request.headers['x-webhook-secret'];
    if (provided !== secret) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'pedeai-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Registra rotas
  registerWebhookRoutes(app);
  registerFirstMessageRoutes(app);
  registerCloseBillRoutes(app);
  registerSystemRoutes(app);
  registerChatRoutes(app);

  // Inicia cron de estoque
  startStockAlertCron();

  // Start
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`🚀 Sistema PedeAí (Salão & Delivery PRO) Backend rodando na porta ${config.PORT}`);
  if (config.WEBHOOK_SECRET) {
    console.log('[Security] ✅ WEBHOOK_SECRET ativo — endpoints privados protegidos');
  } else {
    console.warn('[Security] ⚠️ WEBHOOK_SECRET não configurado — endpoints privados sem autenticação');
  }
  if (config.CORS_ORIGIN !== '*') {
    console.log(`[Security] ✅ CORS restrito para: ${config.CORS_ORIGIN}`);
  } else {
    console.warn('[Security] ⚠️ CORS_ORIGIN=* (aberto) — defina CORS_ORIGIN em produção');
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal ao iniciar:', err);
  process.exit(1);
});
