-- PARTE 1: EXTENSÕES E TABELAS BASE (RECRIAÇÃO LIMPA)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --- Tabela: Restaurantes ---
DROP TABLE IF EXISTS public."Restaurantes" CASCADE;
CREATE TABLE public."Restaurantes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMPTZ,
    "nome" TEXT,
    "email" TEXT,
    "senha" TEXT,
    "telefone" TEXT,
    "telefone_dono" TEXT,
    "quantidade_mesas" TEXT,
    "quantidade_max_mesas" TEXT,
    "max_mesas" TEXT,
    "horario_abertura" TEXT,
    "horario_fechamento" TEXT,
    "horario_fecha_cozinha" TEXT,
    "fechar_mesa_auto" BOOLEAN,
    "alertas_piscantes" BOOLEAN,
    "sons_habilitados" BOOLEAN,
    "impressao_auto" BOOLEAN,
    "gerencia_estoque" BOOLEAN,
    "alerta_estoque_baixo" INTEGER,
    "alerta_estoque_critico" INTEGER,
    "taxa_servico" INTEGER,
    "modo_cobranca" TEXT,
    "cobranca_meio_a_meio" TEXT,
    "meia_pizza_habilitada" BOOLEAN,
    "evolution_instancia" TEXT,
    "evolution_apikey" TEXT,
    "personalidade_agente" TEXT,
    "exemplos_conversa" TEXT,
    "regras_estabelecimento" TEXT,
    "couvert_habilitado" BOOLEAN,
    "couvert_valor" INTEGER,
    "delivery_habilitado" BOOLEAN,
    "evolution_instancia_delivery" TEXT,
    "evolution_apikey_delivery" TEXT,
    "personalidade_agente_delivery" TEXT,
    "regras_estabelecimento_delivery" TEXT,
    "exemplos_conversa_delivery" TEXT,
    "waha_session" TEXT,
    "waha_apikey" TEXT,
    "waha_session_delivery" TEXT,
    "waha_apikey_delivery" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurantes_email ON public."Restaurantes"(email);

-- --- Tabela: Produtos ---
DROP TABLE IF EXISTS public."Produtos" CASCADE;
CREATE TABLE public."Produtos" (
    "id" BIGSERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ,
    "restaurante_id" UUID,
    "nome" TEXT,
    "preco" TEXT,
    "categoria" TEXT,
    "estacao" TEXT,
    "descricao" TEXT,
    "estoque" INTEGER,
    "estoque_minimo" INTEGER,
    "ativo" BOOLEAN
);

-- --- Tabela: Usuários ---
DROP TABLE IF EXISTS public."Usuários" CASCADE;
CREATE TABLE public."Usuários" (
    "id" BIGSERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ,
    "id_restaurante" TEXT,
    "nome" TEXT,
    "telefone" TEXT,
    "mesa_atual" TEXT,
    "quantas_vezes_foi" TEXT,
    "Status" TEXT,
    "ultimo_checkin" TIMESTAMPTZ,
    "chat_humano" BOOLEAN
);

-- --- Tabela: admin_acessos ---
DROP TABLE IF EXISTS public."admin_acessos" CASCADE;
CREATE TABLE public."admin_acessos" (
    "id" BIGSERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ,
    "email" TEXT,
    "senha" TEXT
);

-- --- Tabela: estoque_restaurantes ---
DROP TABLE IF EXISTS public."estoque_restaurantes" CASCADE;
CREATE TABLE public."estoque_restaurantes" (
    "id" BIGSERIAL PRIMARY KEY,
    "produto_id" INTEGER,
    "restaurante_id" UUID,
    "quantidade_atual" TEXT,
    "created_at" TIMESTAMPTZ
);

-- --- Tabela: Pedidos ---
DROP TABLE IF EXISTS public."Pedidos" CASCADE;
CREATE TABLE public."Pedidos" (
    "id" BIGSERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ,
    "restaurante_id" UUID,
    "mesa" TEXT,
    "itens" TEXT,
    "quantidade" TEXT,
    "Subtotal" TEXT,
    "descricao" TEXT,
    "status" TEXT,
    "usuario_telefone" TEXT
);

-- --- Tabela: mensagens ---
DROP TABLE IF EXISTS public."mensagens" CASCADE;
CREATE TABLE public."mensagens" (
    "id" BIGSERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ,
    "restaurante_id" UUID,
    "telefone" TEXT,
    "nome_contato" TEXT,
    "conteudo" TEXT,
    "tipo" TEXT,
    "direcao" TEXT,
    "message_id" TEXT,
    "metadata" JSONB
);

-- --- Tabela: delivery_persons ---
DROP TABLE IF EXISTS public."delivery_persons" CASCADE;
CREATE TABLE public."delivery_persons" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --- Tabela: delivery_person_stores ---
DROP TABLE IF EXISTS public."delivery_person_stores" CASCADE;
CREATE TABLE public."delivery_person_stores" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --- Tabela: delivery_requests ---
DROP TABLE IF EXISTS public."delivery_requests" CASCADE;
CREATE TABLE public."delivery_requests" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --- Tabela: entregador_locations ---
DROP TABLE IF EXISTS public."entregador_locations" CASCADE;
CREATE TABLE public."entregador_locations" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now()
);
