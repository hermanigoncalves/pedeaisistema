# 📦 Inventário Geral de Arquivos do Sistema PedeAí

> Data de Mapeamento: 2026-08-14 | Protocolo: Google Mantis 10-Step & Hallmark 57-Gates

## 1. Frontend Core & Páginas (`src/pages/`, `src/layouts/`, `src/contexts/`)

| # | Arquivo | Módulo | Hallmark UI States | Status da Auditoria |
|---|---|---|:---:|:---:|
| 1 | `src/App.tsx` | Roteamento Global & Providers | N/A | ⏳ Mapeado |
| 2 | `src/contexts/AppContext.tsx` | Estado Global, Sessão & Sincronização | N/A | ✅ Auditado |
| 3 | `src/pages/Index.tsx` | Dashboard Principal / Visão Geral | ⬜ Pendente | ✅ Auditado |
| 4 | `src/pages/Login.tsx` | Autenticação de Estabelecimentos | ⬜ Pendente | ✅ Auditado |
| 5 | `src/pages/AdminDashboard.tsx` | Painel Multi-Tenant & Configurações Globais | ⬜ Pendente | ✅ Auditado |
| 6 | `src/pages/AdminAuth.tsx` | Guard de Rotas Administrativas | N/A | ✅ Auditado |
| 7 | `src/pages/OperationPage.tsx` | Painel Operacional de Salão & Comandas | ⬜ Pendente | ✅ Auditado |
| 8 | `src/pages/Checkin.tsx` | Tela de Check-in de Clientes / QR Code | ⬜ Pendente | ✅ Auditado |
| 9 | `src/pages/ConversasPage.tsx` | Central de Atendimento & Live Chat | ⬜ Pendente | ✅ Auditado |
| 10 | `src/pages/AnalyticsPage.tsx` | Métricas, Vendas & Desempenho | ⬜ Pendente | ✅ Auditado |
| 11 | `src/pages/NotFound.tsx` | Página 404 / Rota Não Encontrada | ⬜ Pendente | ✅ Auditado |

## 2. Frontend Componentes Principais (`src/components/`)

| # | Arquivo | Componente / Responsabilidade | Hallmark UI States | Status da Auditoria |
|---|---|---|:---:|:---:|
| 12 | `src/components/dashboard/SettingsModal.tsx` | Modal Central de Configurações do Restaurante | ⬜ Pendente | ✅ Auditado |
| 13 | `src/components/dashboard/PasswordModal.tsx` | Modal de Validação de Senha de Gerente | ⬜ Pendente | ✅ Auditado |
| 14 | `src/components/dashboard/ConversationsView.tsx` | Visualização de Mensagens WhatsApp / WAHA | ⬜ Pendente | ✅ Auditado |
| 15 | `src/components/dashboard/PrinterStatusModal.tsx` | Status e Monitoramento de Impressoras | ⬜ Pendente | ✅ Auditado |
| 16 | `src/components/kanban/OrderCard.tsx` | Card de Pedidos no Salão e Delivery | ⬜ Pendente | ✅ Auditado |
| 17 | `src/components/admin/SystemLogs.tsx` | Visualizador de Logs do Sistema no Admin | ⬜ Pendente | ✅ Auditado |

## 3. Hooks Personalizados (`src/hooks/`)

| # | Arquivo | Responsabilidade | Status da Auditoria |
|---|---|---|:---:|
| 18 | `src/hooks/usePedidos.ts` | Realtime de Pedidos & Ações de Cozinha/Salão | ✅ Auditado |
| 19 | `src/hooks/useMensagens.ts` | Realtime de Mensagens WhatsApp / WAHA | ✅ Auditado |
| 20 | `src/hooks/useProdutos.ts` | CRUD e Sincronização de Produtos & Estoque | ✅ Auditado |
| 21 | `src/hooks/useCategorias.ts` | Gestão de Categorias do Cardápio | ✅ Auditado |
| 22 | `src/hooks/useEstacoes.ts` | Estações de Preparo (Cozinha, Bar, Forno) | ✅ Auditado |
| 23 | `src/hooks/useImpressoras.ts` | Gerenciamento de Impressoras Térmicas | ✅ Auditado |
| 24 | `src/hooks/useSaboresPizza.ts` | Sabores, Tamanhos & Meio-a-Meio | ✅ Auditado |
| 25 | `src/hooks/useMacarroes.ts` | Personalizações de Massas / Macarrão | ✅ Auditado |
| 26 | `src/hooks/useRestaurant.ts` | Dados, Horários e Configurações do Estabelecimento | ✅ Auditado |
| 27 | `src/hooks/useUsuarios.ts` | Gestão de Comandas / Usuários da Mesa | ✅ Auditado |
| 28 | `src/hooks/useSystemLogs.ts` | Coleta e Exibição de Logs de Auditoria | ✅ Auditado |

## 4. Integrações & Serviços Frontend (`src/services/`, `src/integrations/`)

| # | Arquivo | Responsabilidade | Status da Auditoria |
|---|---|---|:---:|
| 29 | `src/integrations/supabase/client.ts` | Cliente Supabase Central & Fallbacks | ✅ Auditado |
| 30 | `src/integrations/supabase/types.ts` | Tipagem TypeScript do Banco Supabase | ✅ Auditado |
| 31 | `src/services/printerService.ts` | Driver de Impressão Térmica ESC/POS, RawBT & TCP | ✅ Auditado |
| 32 | `src/services/deliveryAgentService.ts` | Integração com Agente de Delivery & Easypanel | ✅ Auditado |
| 33 | `src/services/deliveryAdminService.ts` | Disparo e Controle de Pedidos de Delivery | ✅ Auditado |
| 34 | `src/services/logger-service.ts` | Serviço de Logging Estruturado | ✅ Auditado |

## 5. Backend Fastify (`server/src/`)

| # | Arquivo | Responsabilidade | Status da Auditoria |
|---|---|---|:---:|
| 35 | `server/src/index.ts` | Servidor Fastify, Plugins, Middlewares e Rotas | ✅ Auditado |
| 36 | `server/src/config.ts` | Configurações de Ambiente do Backend | ✅ Auditado |
| 37 | `server/src/controllers/authController.ts` | Autenticação, Bcrypt, Login Admin e Restaurante | ✅ Auditado |
| 38 | `server/src/controllers/webhookController.ts` | Webhooks do WhatsApp (WAHA / Evolution) | ✅ Auditado |
| 39 | `server/src/controllers/chatController.ts` | Controle de Pausa de Bot e Envio Manual de Chat | ✅ Auditado |
| 40 | `server/src/controllers/closeBillController.ts` | Fechamento de Conta (Mesa & Comanda) | ✅ Auditado |
| 41 | `server/src/controllers/stockAlertController.ts` | Alertas de Estoque Crítico via WhatsApp | ✅ Auditado |
| 42 | `server/src/controllers/firstMessageController.ts` | Mensagem de Boas-Vindas no Check-in | ✅ Auditado |
| 43 | `server/src/controllers/systemController.ts` | Download do Agente de Impressão Windows | ✅ Auditado |
| 44 | `server/src/agents/pedeaiAgent.ts` | Agente IA de Atendimento OpenAI / Tools | ✅ Auditado |
| 45 | `server/src/services/cloudPrintService.ts` | Fila de Impressão em Nuvem e Despacho | ✅ Auditado |
| 46 | `server/src/services/mediaService.ts` | Download e Tratamento de Mídias/Áudios | ✅ Auditado |
| 47 | `server/src/services/messageBuffer.ts` | Agrupador / Debounce de Mensagens do Cliente | ✅ Auditado |
| 48 | `server/src/services/phoneNormalizer.ts` | Normalização de Telefones DDI/DDD Brasil | ✅ Auditado |

## 6. Agente de Impressão Windows (`print-agent/`)

| # | Arquivo | Responsabilidade | Status da Auditoria |
|---|---|---|:---:|
| 49 | `print-agent/index.js` | Driver Local Windows, Polling Supabase, ESC/POS | ✅ Auditado |
