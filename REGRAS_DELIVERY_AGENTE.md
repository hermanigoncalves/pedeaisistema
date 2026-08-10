# Documento de Especificação: Regras Adaptadas para o Agente e Backend de Delivery — Sistema PedeAí

---

## 1. Visão Geral

Este documento define detalhadamente a **transformação e adaptação das regras operacionais e de negócio** do Sistema PedeAí do modelo presencial (Salão: Mesa / Comanda) para o **Módulo de Delivery Standalone (Atendimento por WhatsApp via WAHA & IA Gemini)**.

---

## 2. Matriz de Transformação de Regras: Salão (Mesa/Comanda) vs. Delivery

| Recurso / Regra | Salão (Mesa / Comanda) | Delivery (WhatsApp / WAHA) |
| :--- | :--- | :--- |
| **Identificação do Cliente** | Número do WhatsApp + Número da Mesa ou Comanda | Número do WhatsApp + Endereço Completo de Entrega |
| **Modo de Cobrança (`billingMode`)** | `comanda` (individual) ou `mesa` (compartilhada) | **`delivery`** (pedido individual associado à entrega) |
| **Pergunta "Dividir a Conta?"** | Exibida no WhatsApp **apenas no modo mesa** | **Não aplicável**. O pedido de delivery é individual por cliente/endereço. |
| **Recurso "Dividir Item" (Split)** | Disponível em ambos os modos (mesa e comanda) | **Desativado / Não aplicável** para pedidos de delivery. |
| **Cálculo da Conta / Pedido** | Consumo acumulado na mesa/comanda ao longo da permanência | Total imediato do carrinho + Taxa de Entrega (calculada por km/bairro) |
| **Momento do Pagamento** | Ao fechar a mesa/comanda (Individual por WhatsApp) | No checkout do pedido (Pix, Cartão online, ou Pagamento na Entrega - Dinheiro/Maquininha) |
| **Despacho / Notificação** | Garçom/Cozinha notificados no Kanban de Salão | Notificação automática de "Saiu para Entrega" enviada via WAHA ao cliente |

---

## 3. Regras de Negócio e Comportamento do Agente de IA de Delivery (Gemini / WAHA)

O agente de IA que atende os clientes no WhatsApp do Delivery deve seguir estritamente os seguintes fluxos e travas de segurança:

### 3.1. Fluxo de Atendimento e Captura de Pedidos
1. **Saudação e Coleta de Intenção**:
   - Identificar se o cliente deseja fazer um novo pedido, consultar o cardápio, verificar taxa/raio de entrega ou saber o status de um pedido existente.
2. **Validação de Raio e Endereço de Entrega**:
   - **Regra Rígida**: O agente DEVE solicitar o CEP e/ou endereço completo do cliente antes de prosseguir com a montagem do pedido.
   - O endereço deve ser validado contra o raio de cobertura (km) cadastrado no restaurante. Caso esteja fora do raio, a IA deve informar educadamente que a região não é atendida.
3. **Cálculo da Taxa de Entrega**:
   - O agente adiciona o valor da taxa de entrega calculada ao subtotal dos itens.
4. **Resumo Obrigatório e Confirmação**:
   - Antes de efetivar o pedido no banco de dados (`pedidos` / `delivery_requests`), a IA deve obrigatoriamente apresentar ao cliente um resumo contendo:
     * Itens e adicionais selecionados.
     * Endereço de entrega confirmado.
     * Subtotal dos itens + Taxa de entrega = **Valor Total**.
     * Forma de pagamento selecionada (se dinheiro, perguntar necessidade de troco e valor do troco).
5. **Criação do Pedido**:
   - Aciona a ferramenta `criarPedidoTool` com status inicial `'pendente'`.

### 3.2. Notificação Automática de Despacho (Dispatch)
1. Quando o restaurante altera o status do pedido para **"Em Entrega"** no Kanban:
   - O backend de Delivery captura o webhook de atualização.
   - O agente dispara uma mensagem automática no WhatsApp do cliente via WAHA (`POST /api/sendText`):
     > *"Seu pedido #XXXXX saiu para entrega! 🛵 Em breve o entregador estará no seu endereço."*

---

## 4. Regras do Agente Desenvolvedor Backend (Engenharia & Arquitetura)

Para qualquer manutenção ou expansão do código do backend de Delivery:

### 4.1. Controle de Versão e Git
> [!IMPORTANT]
> **Push é SEMPRE manual.** O agente/desenvolvedor IA **NÃO** executa `git push`. São permitidos apenas os comandos `git add` e `git commit`. O push será executado manualmente pelo desenvolvedor responsável.

### 4.2. Segurança e Autenticação
- **Service Role Key**: O microserviço de Delivery conecta-se ao Supabase utilizando a `SUPABASE_SERVICE_ROLE_KEY` exclusiva para acesso administrativo seguro no servidor.
- **Comunicação Interna Segura**: Chamadas entre o Kanban principal e o backend de Delivery devem utilizar o cabeçalho de autenticação `x-delivery-secret` comparado com `DELIVERY_SECRET_KEY`.

### 4.3. Idempotência em Webhooks (WAHA)
- Mensagens recebidas do WAHA (`/webhook/delivery`) devem ser checadas por `message_id` para evitar reprocessamento ou duplicidade de respostas da IA e pedidos duplicados.

### 4.4. Padrões de Código e Tratamento de Erros
- **TypeScript & Fastify**: Código fortemente tipado com rotas declaradas em Fastify.
- **Validação de Schemas**: Uso de Zod para sanitização de todos os corpos de requisições e parâmetros de webhook.
- **Tratamento de Exceções**: Respostas de erro padronizadas (JSON com `error`, `message`, `statusCode`). Sem supressão silenciosa de exceções.

---

## 5. Resumo do Contrato de Operação do Delivery

```
           [ Cliente no WhatsApp ]
                     │
                     ▼
         ┌───────────────────────┐
         │     WAHA Webhook      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Agente IA (Gemini)   │ ──( Valida Raio / Endereço / Taxa )
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Cria Pedido no DB    │ ──( Status: Pendente )
         └───────────┬───────────┘
                     │
                     ▼
   [ Cozinha Prepara & Muda Status ]
                     │
                     ▼ (Status: Em Entrega)
         ┌───────────────────────┐
         │ Disparo Automático    │ ──> Mensagem via WAHA: "Saiu para Entrega! 🛵"
         └───────────────────────┘
```
