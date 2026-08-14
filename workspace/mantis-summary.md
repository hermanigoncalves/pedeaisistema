# 🗺️ Mantis Summary — Mapeamento do Sistema PedeAí

> Data: 2026-08-14 | Protocolo: Google Mantis 10-Step Architecture

## 1. Visão Geral da Arquitetura

O **Sistema PedeAí** é uma plataforma full-stack multi-tenant de atendimento automatizado via WhatsApp, gerenciamento de salão/mesas/comandas, cardápio digital, controle de produção na cozinha (KDS/Kanban) e impressão térmica distribuída para restaurantes.

```
                  ┌───────────────────────────────┐
                  │    WhatsApp (WAHA / Evolution)│
                  └───────────────┬───────────────┘
                                  │ Webhook
                                  ▼
┌──────────────────┐    ┌──────────────────┐    ┌───────────────────────────┐
│ Frontend React   │◄───┤  Supabase DB     ├───►│ Servidor Backend (Fastify)│
│ (Vite / Vercel)  │    │  (PostgreSQL +   │    │ (OpenAI Agent, Webhooks,  │
└──────────────────┘    │   Realtime Sync) │    │  Controle de Contas)      │
                        └─────────┬────────┘    └───────────────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ Agente Impressão │
                        │ (Windows / TCP)  │
                        └──────────────────┘
```

## 2. Sumário por Módulo & Diretório

### A. Frontend (`src/`)
- **`src/pages/`**: Telas principais da aplicação:
  - `Index.tsx`: Visão geral e estatísticas rápidas do estabelecimento.
  - `OperationPage.tsx`: Kanban operacional de pedidos, comanda individual, mesa, divisões e status de preparo.
  - `Checkin.tsx`: Fluxo público de entrada do cliente na mesa via QR Code / WhatsApp.
  - `ConversasPage.tsx`: Central de atendimento ao vivo com toggle de pausa do bot IA.
  - `AdminDashboard.tsx`: Painel mestre multi-tenant para gerenciamento de restaurantes, planos, módulos e logs globais.
  - `Login.tsx` / `AdminAuth.tsx`: Autenticação e proteção de rotas com fallback resiliente.
- **`src/contexts/AppContext.tsx`**: Contexto central do React que orquestra pedidos, mesas, configurações, comandas, autenticação e sincronização Realtime com o Supabase.
- **`src/hooks/`**: Hooks especializados por domínio (`usePedidos`, `useMensagens`, `useProdutos`, `useEstacoes`, `useImpressoras`, `useSaboresPizza`, `useMacarroes`, `useRestaurant`).
- **`src/services/`**: Serviços de hardware e drivers (`printerService.ts`, `deliveryAgentService.ts`, `logger-service.ts`).

### B. Backend (`server/`)
- **`server/src/index.ts`**: Servidor HTTP Fastify com CORS, rate limiting e rotas modulares.
- **`server/src/controllers/`**:
  - `authController.ts`: Login seguro com Bcrypt e migração transparente de senhas.
  - `webhookController.ts`: Recepção de eventos do WAHA/Evolution WhatsApp, identificação de cliente/mesa e despacho para o agente de IA.
  - `closeBillController.ts`: Fechamento de contas (modo mesa e modo comanda individual), cálculo de taxas e envio de recibo.
  - `stockAlertController.ts` & `firstMessageController.ts`: Notificações proativas e boas-vindas.
  - `systemController.ts`: Geração e download do executável/config do agente de impressão.
- **`server/src/agents/pedeaiAgent.ts`**: Orquestrador OpenAI Function Calling com ferramentas para consulta de cardápio, criação de pedidos, meia pizza, personalização de massas e fechamento.

### C. Agente de Impressão Local (`print-agent/`)
- **`print-agent/index.js`**: Serviço Windows de segundo plano que escuta eventos do Supabase via polling/realtime e dispara comandos ESC/POS para impressoras térmicas conectadas via TCP (Rede Ethernet) ou USB/Serial.

### D. Banco de Dados & Infraestrutura (`supabase/`, `*.sql`)
- PostgreSQL no Supabase com tabelas relacionais (`Restaurantes`, `Mesas`, `Comandas`, `Pedidos`, `ItensPedido`, `Produtos`, `Categorias`, `Estacoes`, `Impressoras`, `Mensagens`, `admin_acessos`).
- Modo de operação configurável por restaurante (`modo_cobranca: 'mesa' | 'comanda'`).
- Suporte a meia-pizza (`cobranca_meio_a_meio: 'mais_cara' | 'media'`), taxa de serviço e couvert artístico.

---
