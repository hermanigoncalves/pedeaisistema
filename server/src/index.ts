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

async function main() {
  // CORS
  await app.register(cors, { origin: true });

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
}

main().catch((err) => {
  console.error('❌ Erro fatal ao iniciar:', err);
  process.exit(1);
});
