# Guia de Especificação e Construção: Backend Standalone de Delivery (Sem App de Entregadores — Provedor WAHA)

Este documento contém a arquitetura simplificada, schemas de banco de dados, estrutura de arquivos, credenciais do Supabase, integração com **WAHA (WhatsApp HTTP API)**, contratos de API e variáveis de ambiente para um microserviço/backend **100% isolado de Delivery**.

---

## 1. Visão Geral da Arquitetura (Com WAHA)

Sem a necessidade de um aplicativo nativo/web para entregadores, o backend de Delivery utiliza o **WAHA (WhatsApp HTTP API)** para automação e mensagens:

- **Atendimento Autônomo por IA no WhatsApp (WAHA)**: Processa mensagens recebidas do WAHA (`/webhook/delivery`) e responde dúvidas sobre taxa de entrega, raio de atendimento, horário, cardápio e andamento do pedido.
- **Despacho Automático de Pedidos (Dispatch)**: Recebe a notificação do Kanban quando um pedido muda para "Em Entrega" e dispara a mensagem automática via WAHA (`POST /api/sendText`) para o cliente.
- **Sincronização de Status (Kanban ↔ Delivery)**: Mantém o histórico atualizado no Supabase.

```
+-------------------------------------------------------------------------+
|                    BACKEND STANDALONE DE DELIVERY                       |
|                       (Novo Repositório Git)                            |
+-------------------------------------------------------------------------+
          │                                           │
          ▼                                           ▼
┌──────────────────┐                         ┌──────────────────┐
│ WAHA             │                         │  Sistema Main    │
│ (WhatsApp API)   │                         │  PedeAí (Kanban) │
└─────────┬────────┘                         └────────┬─────────┘
          │                                           │
          │  Webhooks WAHA (Atendimento IA)           │
          └─────────────────────┬─────────────────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ Supabase DB         │
                     │ (Tabela Restaurantes│
                     │  & Pedidos/Delivery)│
                     └─────────────────────┘
```

---

## 2. Dados e Credenciais de Conexão com o Banco (Supabase)

- **URL do Supabase**: `https://gpsbydlnbkbofbhmhuvp.supabase.co`
- **Service Role Key (Uso exclusivo no Backend)**:
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM5Nzc3MCwiZXhwIjoyMDk4OTczNzcwfQ.11gOTNAy1fVuZ7LlRJgc8eGsK4IrAb_fjJ9mL6CiXqg`
- **Anon / Publishable Key (Uso público no Frontend se necessário)**:
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTc3NzAsImV4cCI6MjA5ODk3Mzc3MH0.13ezDWGrO6AKTib_-l7HjqamN_9oI7etpJaoNN4bB7k`

---

## 3. Variáveis de Ambiente (`.env`)

Copie este arquivo `.env` para a raiz do seu novo projeto backend:

```env
# Configurações do Servidor
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# Supabase (Banco de Dados Central)
SUPABASE_URL=https://gpsbydlnbkbofbhmhuvp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM5Nzc3MCwiZXhwIjoyMDk4OTczNzcwfQ.11gOTNAy1fVuZ7LlRJgc8eGsK4IrAb_fjJ9mL6CiXqg
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTc3NzAsImV4cCI6MjA5ODk3Mzc3MH0.13ezDWGrO6AKTib_-l7HjqamN_9oI7etpJaoNN4bB7k

# Provedor de WhatsApp (WAHA)
WHATSAPP_PROVIDER=waha
WAHA_URL=https://seu-waha.com
WAHA_API_KEY=sua_apikey_waha
WAHA_SESSION=default

# IA (Gemini)
GEMINI_API_KEY=sua_chave_gemini

# Segredo de comunicação interna com o Kanban principal
DELIVERY_SECRET_KEY=chave_secreta_webhook_kanban
```

---

## 4. Estrutura de Arquivos do Repositório (`tree`)

```text
pedeai-delivery-backend/
├── .env
├── .gitignore
├── README.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── schema.sql                     <-- Migration básica do Supabase
└── src/
    ├── index.ts                   <-- Servidor Fastify principal
    ├── config.ts                  <-- Validação de ENVs com Zod
    ├── adapters/
    │   ├── wahaAdapter.ts         <-- Integração WAHA API (sendText, sendMedia, etc.)
    │   └── supabaseAdapter.ts     <-- Cliente Supabase
    ├── agents/
    │   └── deliveryAgent.ts       <-- IA dedicada a Delivery
    ├── controllers/
    │   ├── webhookController.ts   <-- Webhook do WAHA (mensagens recebidas)
    │   └── dispatchController.ts  <-- Endpoint de Despacho de Pedidos do Kanban
    └── types/
        └── delivery.ts            <-- Interfaces de Payload
```

---

## 5. Código do Adapter WAHA (`src/adapters/wahaAdapter.ts`)

```typescript
import axios from 'axios';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

const wahaClient = axios.create({
  baseURL: WAHA_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': WAHA_API_KEY,
  },
  timeout: 15000,
});

/**
 * Formata número de telefone para formato WAHA (ex: 5511999998888@c.us)
 */
export function toWahaChatId(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.includes('@')) return clean;
  return `${clean}@c.us`;
}

/**
 * Envia mensagem de texto simples via WAHA API
 */
export async function sendWahaText(
  phone: string,
  text: string,
  sessionName?: string
): Promise<boolean> {
  try {
    const session = sessionName || WAHA_SESSION;
    const chatId = toWahaChatId(phone);

    await wahaClient.post('/api/sendText', {
      session,
      chatId,
      text,
    });

    console.log(`[WAHA] Mensagem enviada com sucesso para ${chatId}`);
    return true;
  } catch (error: any) {
    console.error(`[WAHA] Erro ao enviar mensagem para ${phone}:`, error?.response?.data || error.message);
    return false;
  }
}
```

---

## 6. Adapter do Supabase (`src/adapters/supabaseAdapter.ts`)

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpsbydlnbkbofbhmhuvp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwc2J5ZGxuYmtib2ZiaG1odXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM5Nzc3MCwiZXhwIjoyMDk4OTczNzcwfQ.11gOTNAy1fVuZ7LlRJgc8eGsK4IrAb_fjJ9mL6CiXqg';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
```

---

## 7. Webhook do WAHA e Despacho de Pedidos (`src/index.ts`)

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { sendWahaText } from './adapters/wahaAdapter';

dotenv.config();

const app = Fastify({ logger: true });
app.register(cors);

// Healthcheck
app.get('/health', async () => ({ status: 'ok', service: 'pedeai-delivery-backend-waha' }));

// 1. Webhook Recebido do WAHA (Mensagens de Clientes)
app.post('/webhook/delivery', async (request, reply) => {
  const body = request.body as any;

  // Filtra apenas mensagens de texto de terceiros (não enviadas por mim)
  if (body.event === 'message' && !body.payload?.fromMe) {
    const fromPhone = body.payload?.from || body.payload?.chatId;
    const incomingText = body.payload?.body || '';
    const session = body.session || process.env.WAHA_SESSION;

    console.log(`[WAHA Webhook] Mensagem de ${fromPhone}: "${incomingText}"`);

    // Aqui entra a chamada da IA (Gemini/OpenAI) para gerar a resposta
    // const responseIA = await generateDeliveryResponse(incomingText);
    // await sendWahaText(fromPhone, responseIA, session);
  }

  return reply.send({ success: true });
});

// 2. Endpoint de Despacho acionado pelo Kanban do PedeAí
app.post('/api/delivery/dispatch', async (request, reply) => {
  const payload = request.body as any;

  if (payload.cliente_telefone) {
    const mensagem = `🛵 *Seu pedido #${payload.pedido_id} saiu para entrega!*\n\nObrigado por comprar conosco. Em breve estará em seu endereço!`;
    
    await sendWahaText(payload.cliente_telefone, mensagem);
  }

  return reply.send({ success: true, message: 'Despacho processado e cliente notificado via WAHA.' });
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Delivery Backend (WAHA) rodando na porta ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

---

## 8. Script de Banco de Dados (`schema.sql`)

```sql
-- ============================================================
-- MIGRATION: Habilitar Módulo Delivery e Configurações WAHA
-- ============================================================

ALTER TABLE "Restaurantes" 
ADD COLUMN IF NOT EXISTS "delivery_habilitado" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "waha_session_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "waha_apikey_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "personalidade_agente_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "regras_estabelecimento_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "exemplos_conversa_delivery" TEXT;
```
