-- ============================================================
-- 🚀 PEDEAI & POLIS PUB — SCRIPT COMPLETO E DEFINITIVO (1 ARQUIVO)
-- ============================================================
-- Este script faz TUDO em uma única execução:
-- 1. Apaga com segurança todas as tabelas antigas (DROP CASCADE)
-- 2. Cria as extensões e todas as tabelas estruturadas
-- 3. Habilita o Realtime do Supabase
-- 4. Cadastra o Admin padrão
-- 5. Cadastra o Restaurante POLIS PUB com ID oficial e sessões WAHA
-- 6. Cadastra as Estações (kitchen, bar) e Categorias
-- 7. Cadastra o Cardápio Completo da Polis Pub
-- 8. Cadastra os Prompts dos Especialistas IA (sem copos e sem valores)
-- ============================================================

-- ------------------------------------------------------------
-- 1. APAGAR TABELAS ANTIGAS (LIMPEZA TOTAL)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public."Pedidos" CASCADE;
DROP TABLE IF EXISTS public."Usuários" CASCADE;
DROP TABLE IF EXISTS public."mensagens" CASCADE;
DROP TABLE IF EXISTS public."Produtos" CASCADE;
DROP TABLE IF EXISTS public."estoque_restaurantes" CASCADE;
DROP TABLE IF EXISTS public."Categorias" CASCADE;
DROP TABLE IF EXISTS public."Estações" CASCADE;
DROP TABLE IF EXISTS public."Impressoras" CASCADE;
DROP TABLE IF EXISTS public."macarroes" CASCADE;
DROP TABLE IF EXISTS public."sabores_pizza" CASCADE;
DROP TABLE IF EXISTS public."ConfiguracoesGlobais" CASCADE;
DROP TABLE IF EXISTS public.admin_acessos CASCADE;
DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.delivery_orders CASCADE;
DROP TABLE IF EXISTS public.delivery_person_stores CASCADE;
DROP TABLE IF EXISTS public.delivery_persons CASCADE;
DROP TABLE IF EXISTS public."Restaurantes" CASCADE;

-- ------------------------------------------------------------
-- 2. EXTENSÕES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 3. CRIAÇÃO DE TODAS AS TABELAS
-- ------------------------------------------------------------

-- 3.1. Admin
CREATE TABLE public.admin_acessos (
    "id"          BIGSERIAL PRIMARY KEY,
    "created_at"  TIMESTAMPTZ DEFAULT now() NOT NULL,
    "email"       TEXT UNIQUE,
    "senha"       TEXT
);

-- 3.2. Restaurantes
CREATE TABLE public."Restaurantes" (
    "id"                             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "created_at"                     TIMESTAMPTZ DEFAULT now() NOT NULL,
    "nome"                           TEXT NOT NULL,
    "email"                          TEXT UNIQUE,
    "senha"                          TEXT,
    "telefone"                       TEXT,
    "telefone_dono"                  TEXT,
    "quantidade_mesas"               TEXT DEFAULT '20',
    "quantidade_max_mesas"           TEXT DEFAULT '20',
    "max_mesas"                      TEXT DEFAULT '20',
    "horario_abertura"               TEXT DEFAULT '18:00',
    "horario_fechamento"             TEXT DEFAULT '00:00',
    "horario_fecha_cozinha"          TEXT DEFAULT '23:30',
    "fechar_mesa_auto"               BOOLEAN DEFAULT TRUE,
    "alertas_piscantes"              BOOLEAN DEFAULT TRUE,
    "sons_habilitados"               BOOLEAN DEFAULT TRUE,
    "impressao_auto"                 BOOLEAN DEFAULT FALSE,
    "gerencia_estoque"               BOOLEAN DEFAULT FALSE,
    "alerta_estoque_baixo"           INTEGER DEFAULT 15,
    "alerta_estoque_critico"         INTEGER DEFAULT 5,
    "taxa_servico"                   NUMERIC DEFAULT 0,
    "modo_cobranca"                  TEXT DEFAULT 'comanda', -- 'mesa' ou 'comanda'
    "cobranca_meio_a_meio"           TEXT DEFAULT 'mais_cara',
    "meia_pizza_habilitada"          BOOLEAN DEFAULT FALSE,
    "couvert_habilitado"             BOOLEAN DEFAULT FALSE,
    "couvert_valor"                  NUMERIC DEFAULT 0,
    "delivery_habilitado"            BOOLEAN DEFAULT FALSE,
    "waha_session"                   TEXT,
    "waha_apikey"                    TEXT,
    "waha_session_delivery"          TEXT,
    "waha_apikey_delivery"           TEXT,
    "evolution_instancia"            TEXT,
    "evolution_apikey"               TEXT,
    "evolution_instancia_delivery"   TEXT,
    "evolution_apikey_delivery"      TEXT,
    "personalidade_agente"           TEXT,
    "exemplos_conversa"              TEXT,
    "regras_estabelecimento"         TEXT,
    "personalidade_agente_delivery"  TEXT,
    "regras_estabelecimento_delivery" TEXT,
    "exemplos_conversa_delivery"     TEXT
);

-- 3.3. Estações de Preparo
CREATE TABLE public."Estações" (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now() NOT NULL,
    "restaurante_id"  UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "nome"            TEXT NOT NULL
);

-- 3.4. Categorias
CREATE TABLE public."Categorias" (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now() NOT NULL,
    "restaurante_id"  UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "nome"            TEXT NOT NULL
);

-- 3.5. Produtos (Cardápio)
CREATE TABLE public."Produtos" (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now() NOT NULL,
    "restaurante_id"  UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "nome"            TEXT NOT NULL,
    "preco"           TEXT NOT NULL,
    "categoria"       TEXT,
    "estacao"         TEXT DEFAULT 'kitchen',
    "descricao"       TEXT,
    "estoque"         INTEGER DEFAULT 999,
    "estoque_minimo"  INTEGER DEFAULT 5,
    "ativo"           BOOLEAN DEFAULT TRUE
);

-- 3.6. Usuários (Clientes / Check-ins nas Mesas)
CREATE TABLE public."Usuários" (
    "id"                 BIGSERIAL PRIMARY KEY,
    "created_at"         TIMESTAMPTZ DEFAULT now() NOT NULL,
    "id_restaurante"     TEXT,
    "nome"               TEXT NOT NULL,
    "telefone"           TEXT NOT NULL,
    "mesa_atual"         TEXT DEFAULT '0',
    "quantas_vezes_foi"  TEXT DEFAULT '1',
    "Status"             TEXT DEFAULT 'Ativo',
    "ultimo_checkin"     TIMESTAMPTZ DEFAULT now(),
    "chat_humano"        BOOLEAN DEFAULT FALSE
);

-- 3.7. Pedidos
CREATE TABLE public."Pedidos" (
    "id"                BIGSERIAL PRIMARY KEY,
    "created_at"        TIMESTAMPTZ DEFAULT now() NOT NULL,
    "restaurante_id"    UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "mesa"              TEXT NOT NULL,
    "itens"             TEXT NOT NULL,
    "quantidade"        TEXT DEFAULT '1',
    "Subtotal"          TEXT DEFAULT '0.00',
    "descricao"         TEXT,
    "status"            TEXT DEFAULT 'Pendente',
    "usuario_telefone"  TEXT
);

-- 3.8. Mensagens (Chat WhatsApp)
CREATE TABLE public."mensagens" (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now() NOT NULL,
    "restaurante_id"  UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "telefone"        TEXT NOT NULL,
    "nome_contato"    TEXT,
    "conteudo"        TEXT,
    "tipo"            TEXT DEFAULT 'text',
    "direcao"         TEXT NOT NULL,
    "message_id"      TEXT,
    "metadata"        JSONB
);

-- 3.9. Configurações Globais (Prompts IA)
CREATE TABLE public."ConfiguracoesGlobais" (
    "id"              INTEGER PRIMARY KEY DEFAULT 1,
    "created_at"      TIMESTAMPTZ DEFAULT now(),
    "updated_at"      TIMESTAMPTZ DEFAULT now(),
    "prompt_geral"    TEXT,
    "prompt_vendas"   TEXT,
    "prompt_servico"  TEXT,
    "prompt_cardapio" TEXT
);

-- 3.10. Impressoras
CREATE TABLE public."Impressoras" (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now(),
    "restaurante_id"  UUID REFERENCES public."Restaurantes"("id") ON DELETE CASCADE,
    "nome"            TEXT NOT NULL,
    "tipo"            TEXT DEFAULT 'termica',
    "ip"              TEXT,
    "porta"           INTEGER DEFAULT 9100,
    "ativa"           BOOLEAN DEFAULT TRUE,
    "estacao"         TEXT
);

-- 3.11. Logs do Sistema
CREATE TABLE public.system_logs (
    "id"              BIGSERIAL PRIMARY KEY,
    "created_at"      TIMESTAMPTZ DEFAULT now(),
    "restaurante_id"  UUID,
    "modulo"          TEXT,
    "nivel"           TEXT,
    "mensagem"        TEXT,
    "detalhes"        JSONB
);

-- ------------------------------------------------------------
-- 4. HABILITAR REALTIME DO SUPABASE
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public."Pedidos";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Usuários";
ALTER PUBLICATION supabase_realtime ADD TABLE public."mensagens";

-- ------------------------------------------------------------
-- 5. SEED: ADMIN PADRÃO
-- ------------------------------------------------------------
INSERT INTO public.admin_acessos (email, senha)
VALUES ('admin@pedeai.com', 'admin123')
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------
-- 6. SEED: CADASTRO COMPLETO DA POLIS PUB
-- ------------------------------------------------------------

-- 6.1. Restaurante Polis Pub (ID Oficial)
INSERT INTO public."Restaurantes" (
    id,
    nome,
    email,
    senha,
    telefone,
    quantidade_mesas,
    modo_cobranca,
    waha_session,
    evolution_instancia
) VALUES (
    '875bcd11-b91d-4abc-aae8-ee587df23717',
    'Polis Pub',
    'polispub@gmail.com',
    '123456',
    '5533991423777',
    '20',
    'comanda',
    'PolisHub',
    'PolisHub'
);

-- 6.2. Estações de Trabalho da Polis Pub
INSERT INTO public."Estações" (restaurante_id, nome) VALUES
('875bcd11-b91d-4abc-aae8-ee587df23717', 'kitchen'),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'bar');

-- 6.3. Categorias da Polis Pub
INSERT INTO public."Categorias" (restaurante_id, nome) VALUES
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Salgados Quentes'),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Bebidas'),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Porções');

-- 6.4. Produtos Reais da Polis Pub
INSERT INTO public."Produtos" (restaurante_id, nome, preco, categoria, estacao, descricao, estoque, estoque_minimo, ativo) VALUES
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Porção de coxinha (7 und)', '0.00', 'Salgados Quentes', 'kitchen', '7 unidades de deliciosas coxinhas', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Porção de quibe (7 und)', '0.00', 'Salgados Quentes', 'kitchen', '7 unidades de quibe frito crocante', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Porção de bolinha de queijo (7 und)', '0.00', 'Salgados Quentes', 'kitchen', '7 unidades recheadas com queijo derretido', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Porção mista (7 und diversas)', '0.00', 'Salgados Quentes', 'kitchen', '7 unidades sortidas de salgados', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Chopp', '0.00', 'Bebidas', 'bar', 'Chopp gelado servido na hora', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Refrigerante', '0.00', 'Bebidas', 'bar', 'Refrigerante lata gelado', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Água com gás', '0.00', 'Bebidas', 'bar', 'Água mineral com gás 500ml', 1000, 10, true),
('875bcd11-b91d-4abc-aae8-ee587df23717', 'Água sem gás', '0.00', 'Bebidas', 'bar', 'Água mineral sem gás 500ml', 1000, 10, true);

-- ------------------------------------------------------------
-- 7. SEED: PROMPTS DOS AGENTES IA (SEM COPOS E SEM VALORES)
-- ------------------------------------------------------------
INSERT INTO public."ConfiguracoesGlobais" (
    id,
    prompt_geral,
    prompt_vendas,
    prompt_servico,
    prompt_cardapio
) VALUES (
    1,
    '# PEDEAI — ATENDIMENTO GERAL E INFORMAÇÕES (POLIS PUB)
Você é o PedeAI, garçom virtual via WhatsApp da Polis Pub. Seja natural, amigável e eficiente.
Fale sempre em português brasileiro, sem termos técnicos.

## 👋 SAUDAÇÃO FIXA — POLIS PUB:
Olá! 👋 Seja muito bem-vindo à Polis Pub — Experiência PedeAI! 🤖💚

Você está experimentando uma nova forma de fazer pedidos, em uma parceria oficial com a ABRASEL.

Aqui você não precisa procurar botões ou seguir opções prontas: é só falar comigo normalmente, por texto ou áudio. 😊

Por exemplo, você pode dizer:
"Quero duas porções de coxinha e um chopp, por favor."

Eu vou entender seu pedido, tirar suas dúvidas e ajudar você durante toda a experiência. 🍽️

E quando estiver satisfeito e quiser encerrar, é só pedir "quero a conta" que vamos dar sequência ao fechamento da sua mesa.

Pode começar! O que você gostaria de pedir? 🚀',

    '# PEDEAI — ESPECIALISTA EM PEDIDOS (POLIS PUB)
Você é o PedeAI, especialista em registrar pedidos de comida e bebida da Polis Pub.

## 🥤 REGRA DE BEBIDAS (PROIBIDO PERGUNTAR COPOS):
- NUNCA pergunte a quantidade de copos para nenhuma bebida (seja litrão, garrafa, jarra, dose ou lata).
- Registre o pedido de bebidas imediatamente sem fazer perguntas sobre copos.

## ✅ CONFIRMAÇÃO ÚNICA DE PEDIDO (SEM INFORMAR VALORES):
- Você está SUMARIAMENTE PROIBIDO de informar valores, preços individuais ou valor total ao cliente durante o pedido e na confirmação (a menos que o cliente pergunte expressamente quanto custa).
- Após todos os itens resolvidos, exiba o resumo apenas com as quantidades e nomes dos itens e faça UMA ÚNICA pergunta simples:
  "Posso confirmar o seu pedido de [Qtd]x [Nome do Item]? 😊"
- Só execute Criar_pedido após a resposta afirmativa do cliente ("sim", "confirmo", "pode pedir", "pode", "isso").

## 🚫 REGRA ANTI-LOOP E PEDIDOS REPETIDOS:
- Proibido repetir perguntas de confirmação.
- O cliente tem total liberdade para pedir mais itens repetidos durante a sessão.',

    '# PEDEAI — ESPECIALISTA EM CONTAS E SERVIÇOS (POLIS PUB)
Você é o PedeAI, especialista em fechamento de contas e serviços da mesa da Polis Pub. Seu foco exclusivo é ajudar o cliente a ver seus pedidos, pedir a conta e chamar o garçom.

## 🙋 REGRAS PARA CHAMAR GARÇOM:
- Se o cliente pedir "garçom" ou "ajuda", execute OBRIGATORIAMENTE a tool Chama_garcom antes de responder qualquer texto.
- Confirmação: "🙋 Com certeza! Já chamei o garçom e ele está vindo à sua mesa agora mesmo. 👍"

## 💰 REGRAS PARA CONTA E FECHAMENTO:
1. Execute Get_Pedidos e Conta_Solicitada para obter os dados reais e registrar a conta.
2. Responda com a mensagem:
"🎉 Experiência PedeAI concluída!

Sua conta já foi paga e encerrada. ✅

Agradecemos muito por participar dessa experiência e conhecer uma nova forma de fazer pedidos pelo WhatsApp. 💚

PedeAI e ABRASEL agradecem a sua presença!

Esperamos que tenha gostado da experiência. Até a próxima! 🚀"',

    '# CARDÁPIO-AI — ESPECIALISTA EM RESOLUÇÃO DE ITENS DE CARDÁPIO (POLIS PUB)
Você é o Cardápio-AI, especialista em consultar e resolver itens do cardápio da Polis Pub. Seu foco exclusivo é identificar, validar e detalhar produtos.
A Polis Pub não trabalha com pizzas nem com pratos de massa. Foco em petiscos, porções, chopp, drinks e bebidas.'
);
