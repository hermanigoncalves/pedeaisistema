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


-- PARTE 2: MIGRATIONS, TRIGGERS, FUNÇÕES E RLS (IDEMPOTENTE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurantes_email ON public."Restaurantes"(email);

-- Migração: 20260116233034_510767bf-e9ae-4401-a1fc-467be0dd21c7.sql
-- ===========================================
-- SECURITY FIX: Migrate to proper authentication and RLS
-- ===========================================

-- Step 1: Create helper function to check restaurant ownership
-- Using SECURITY DEFINER to avoid recursive RLS issues
CREATE OR REPLACE FUNCTION public.is_restaurant_owner(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "Restaurantes"
    WHERE id = restaurant_uuid
      AND id = auth.uid()
  );
$$;

-- Step 2: Create helper function for products ownership check
CREATE OR REPLACE FUNCTION public.owns_product_restaurant(product_restaurante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_restaurante_id = auth.uid();
$$;

-- Step 3: Create helper function for orders ownership check  
CREATE OR REPLACE FUNCTION public.owns_order_restaurant(order_restaurante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT order_restaurante_id = auth.uid();
$$;

-- ===========================================
-- RLS POLICIES FOR RESTAURANTES
-- ===========================================

-- Allow restaurants to read their own data
DROP POLICY IF EXISTS "Restaurants can view own data" ON "Restaurantes";
CREATE POLICY "Restaurants can view own data" ON "Restaurantes" FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow restaurants to update their own data
DROP POLICY IF EXISTS "Restaurants can update own data" ON "Restaurantes";
CREATE POLICY "Restaurants can update own data" ON "Restaurantes" FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow new restaurant creation during signup (id matches auth.uid)
DROP POLICY IF EXISTS "Users can create their restaurant profile" ON "Restaurantes";
CREATE POLICY "Users can create their restaurant profile" ON "Restaurantes" FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ===========================================
-- RLS POLICIES FOR PRODUTOS
-- ===========================================

-- Allow viewing own products
DROP POLICY IF EXISTS "Restaurants can view own products" ON "Produtos";
CREATE POLICY "Restaurants can view own products" ON "Produtos" FOR SELECT
TO authenticated
USING (public.owns_product_restaurant(restaurante_id));

-- Allow creating products for own restaurant
DROP POLICY IF EXISTS "Restaurants can create own products" ON "Produtos";
CREATE POLICY "Restaurants can create own products" ON "Produtos" FOR INSERT
TO authenticated
WITH CHECK (public.owns_product_restaurant(restaurante_id));

-- Allow updating own products
DROP POLICY IF EXISTS "Restaurants can update own products" ON "Produtos";
CREATE POLICY "Restaurants can update own products" ON "Produtos" FOR UPDATE
TO authenticated
USING (public.owns_product_restaurant(restaurante_id))
WITH CHECK (public.owns_product_restaurant(restaurante_id));

-- Allow deleting own products
DROP POLICY IF EXISTS "Restaurants can delete own products" ON "Produtos";
CREATE POLICY "Restaurants can delete own products" ON "Produtos" FOR DELETE
TO authenticated
USING (public.owns_product_restaurant(restaurante_id));

-- ===========================================
-- RLS POLICIES FOR PEDIDOS
-- ===========================================

-- Allow viewing own orders
DROP POLICY IF EXISTS "Restaurants can view own orders" ON "Pedidos";
CREATE POLICY "Restaurants can view own orders" ON "Pedidos" FOR SELECT
TO authenticated
USING (public.owns_order_restaurant(restaurante_id));

-- Allow creating orders for own restaurant
DROP POLICY IF EXISTS "Restaurants can create own orders" ON "Pedidos";
CREATE POLICY "Restaurants can create own orders" ON "Pedidos" FOR INSERT
TO authenticated
WITH CHECK (public.owns_order_restaurant(restaurante_id));

-- Allow updating own orders
DROP POLICY IF EXISTS "Restaurants can update own orders" ON "Pedidos";
CREATE POLICY "Restaurants can update own orders" ON "Pedidos" FOR UPDATE
TO authenticated
USING (public.owns_order_restaurant(restaurante_id))
WITH CHECK (public.owns_order_restaurant(restaurante_id));

-- Allow deleting own orders
DROP POLICY IF EXISTS "Restaurants can delete own orders" ON "Pedidos";
CREATE POLICY "Restaurants can delete own orders" ON "Pedidos" FOR DELETE
TO authenticated
USING (public.owns_order_restaurant(restaurante_id));


-- Migração: 20260116234214_615c5870-1d55-4af0-82d3-d1025175256d.sql
-- Drop the existing restrictive policy for SELECT
DROP POLICY IF EXISTS "Users can view their own restaurant data" ON public."Restaurantes";

-- Create a policy that allows anonymous users to check credentials (email/senha only)
-- This is needed for the login flow before authentication
DROP POLICY IF EXISTS "Allow anonymous login check" ON public."Restaurantes";
CREATE POLICY "Allow anonymous login check" ON public."Restaurantes"
FOR SELECT
USING (true);

-- Note: The senha column should ideally be hashed, but for now we allow reading
-- The frontend only requests id, email, senha for login verification


-- Migração: 20260119111910_c4bc3f68-7103-4e0a-b686-107884f69660.sql
-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Restaurants can create own orders " ON public."Pedidos";

-- Create new INSERT policy that allows any authenticated insert with valid restaurante_id
DROP POLICY IF EXISTS "Allow insert orders with valid restaurant" ON public."Pedidos";
CREATE POLICY "Allow insert orders with valid restaurant" ON public."Pedidos" 
FOR INSERT 
WITH CHECK (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Also update SELECT, UPDATE, DELETE policies to work without auth.uid()
DROP POLICY IF EXISTS "Restaurants can view own orders " ON public."Pedidos";
DROP POLICY IF EXISTS "Restaurants can update own orders " ON public."Pedidos";
DROP POLICY IF EXISTS "Restaurants can delete own orders " ON public."Pedidos";

-- Allow selecting orders when restaurante_id matches a valid restaurant
DROP POLICY IF EXISTS "Allow view orders with valid restaurant" ON public."Pedidos";
CREATE POLICY "Allow view orders with valid restaurant" ON public."Pedidos"
FOR SELECT
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Allow updating orders when restaurante_id matches
DROP POLICY IF EXISTS "Allow update orders with valid restaurant" ON public."Pedidos";
CREATE POLICY "Allow update orders with valid restaurant" ON public."Pedidos"
FOR UPDATE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Allow deleting orders when restaurante_id matches
DROP POLICY IF EXISTS "Allow delete orders with valid restaurant" ON public."Pedidos";
CREATE POLICY "Allow delete orders with valid restaurant" ON public."Pedidos"
FOR DELETE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);


-- Migração: 20260119113958_3d4726b4-3dd6-4e9c-90be-bc49860a2335.sql
-- Drop existing RLS policies on Produtos
DROP POLICY IF EXISTS "Restaurants can create own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can delete own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can update own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can view own products" ON public."Produtos";

-- Create new policies that check restaurante_id exists in Restaurantes table
-- SELECT: Allow viewing products with valid restaurant
DROP POLICY IF EXISTS "Allow view products with valid restaurant" ON public."Produtos";
CREATE POLICY "Allow view products with valid restaurant" ON public."Produtos"
FOR SELECT
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- INSERT: Allow inserting products with valid restaurant
DROP POLICY IF EXISTS "Allow insert products with valid restaurant" ON public."Produtos";
CREATE POLICY "Allow insert products with valid restaurant" ON public."Produtos"
FOR INSERT
WITH CHECK (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- UPDATE: Allow updating products with valid restaurant
DROP POLICY IF EXISTS "Allow update products with valid restaurant" ON public."Produtos";
CREATE POLICY "Allow update products with valid restaurant" ON public."Produtos"
FOR UPDATE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- DELETE: Allow deleting products with valid restaurant
DROP POLICY IF EXISTS "Allow delete products with valid restaurant" ON public."Produtos";
CREATE POLICY "Allow delete products with valid restaurant" ON public."Produtos"
FOR DELETE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);


-- Migração: 20260122161815_55666c7c-dfdf-4fff-95a9-11ed32328010.sql
-- Add order description field (optional)
ALTER TABLE public."Pedidos"
ADD COLUMN IF NOT EXISTS descricao text;


-- Migração: 20260122162413_ec2d28b8-fcdd-46b9-9ab0-4f957033a5a9.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No select on Usuarios'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "No select on Usuarios" ON public."Usuários";
CREATE POLICY "No select on Usuarios" ON public."Usuários" FOR SELECT USING (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No insert on Usuarios'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "No insert on Usuarios" ON public."Usuários";
CREATE POLICY "No insert on Usuarios" ON public."Usuários" FOR INSERT WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No update on Usuarios'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "No update on Usuarios" ON public."Usuários";
CREATE POLICY "No update on Usuarios" ON public."Usuários" FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No delete on Usuarios'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "No delete on Usuarios" ON public."Usuários";
CREATE POLICY "No delete on Usuarios" ON public."Usuários" FOR DELETE USING (false)';
  END IF;
END
$$;


-- Migração: 20260129215500_baixa_estoque_trigger.sql
-- Função para processar a string de itens e diminuir o estoque
CREATE OR REPLACE FUNCTION public.baixar_estoque_pedido_v3()
RETURNS TRIGGER AS $$
DECLARE
    item_nome TEXT;
    item_lista TEXT[];
BEGIN
    -- Se não houver itens, não faz nada
    IF NEW.itens IS NULL OR NEW.itens = '' THEN
        RETURN NEW;
    END IF;

    -- Converte a string "Item 1, Item 2" em um array de strings
    -- Remove espaços em branco ao redor de cada item
    item_lista := string_to_array(NEW.itens, ',');

    FOREACH item_nome IN ARRAY item_lista LOOP
        -- Tenta atualizar o estoque do produto pelo nome dentro do mesmo restaurante
        -- O TRIM remove espaços que podem sobrar da separação por vírgula
        UPDATE public."Produtos"
        SET estoque = GREATEST(0, COALESCE(estoque, 0) - 1)
        WHERE TRIM(nome) = TRIM(item_nome)
          AND restaurante_id = NEW.restaurante_id;
          
        -- Opcional: Aqui poderíamos inserir na tabela de movimentações de estoque
        -- se ela existisse no banco como uma tabela real.
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que dispara APÓS a inserção de um pedido
DROP TRIGGER IF EXISTS trg_baixar_estoque_on_pedido ON public."Pedidos";
CREATE TRIGGER trg_baixar_estoque_on_pedido
AFTER INSERT ON public."Pedidos"
FOR EACH ROW
EXECUTE FUNCTION public.baixar_estoque_pedido_v3();


-- Migração: 20260129221500_create_mensagens.sql
-- Criação da tabela de Mensagens
CREATE TABLE IF NOT EXISTS public."Mensagens" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public."Usuários"(id) ON DELETE CASCADE,
    restaurante_id uuid REFERENCES public."Restaurantes"(id) ON DELETE CASCADE,
    conteudo text NOT NULL,
    remetente_tipo text CHECK (remetente_tipo IN ('cliente', 'bot', 'restaurante')) NOT NULL,
    lida boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Habilitar Realtime para esta tabela
DO $pub$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Mensagens";
EXCEPTION WHEN OTHERS THEN NULL;
END $pub$;

-- Segurança (RLS)
ALTER TABLE public."Mensagens" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurantes podem ver suas mensagens" ON public."Mensagens";
CREATE POLICY "Restaurantes podem ver suas mensagens" ON public."Mensagens" FOR SELECT
TO authenticated
USING (restaurante_id = auth.uid());

DROP POLICY IF EXISTS "Bot ou Restaurante podem inserir mensagens" ON public."Mensagens";
CREATE POLICY "Bot ou Restaurante podem inserir mensagens" ON public."Mensagens" FOR INSERT
TO authenticated
WITH CHECK (restaurante_id = auth.uid());

-- Exemplo de dados para teste (opcional):
-- INSERT INTO public."Mensagens" (cliente_id, restaurante_id, conteudo, remetente_tipo)
-- SELECT id, id_restaurante, 'Olá! Gostaria de fazer um pedido.', 'cliente'
-- FROM public."Usuários" LIMIT 1;


-- Migração: 20260203000000_add_impressao_auto.sql
-- Migration to add impressao_auto column to Restaurantes table
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;


-- Migração: 20260203000001_fix_all_restaurante_columns.sql
-- Comprehensive migration to ensure all required columns exist in Restaurantes table
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "horario_abertura" TEXT,
ADD COLUMN IF NOT EXISTS "horario_fechamento" TEXT,
ADD COLUMN IF NOT EXISTS "fechar_mesa_auto" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alertas_piscantes" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "sons_habilitados" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alerta_estoque_baixo" INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS "alerta_estoque_critico" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;

-- Force reload of Postgrest schema cache
NOTIFY pgrst, 'reload schema';


-- Migração: 20260203000002_definitive_column_fix.sql
-- Definitive fix for Restaurantes table schema cache and column names
-- Run this in the Supabase SQL Editor

-- 1. Ensure the column names match what the AppContext.tsx is sending
DO $$ 
BEGIN 
    -- Rename if the old name exists and new one doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Restaurantes' AND column_name='quantidade_max_mesas') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Restaurantes' AND column_name='quantidade_mesas') THEN
        ALTER TABLE public."Restaurantes" RENAME COLUMN "quantidade_max_mesas" TO "quantidade_mesas";
    END IF;
END $$;

-- 2. Add all missing columns for settings
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "horario_abertura" TEXT,
ADD COLUMN IF NOT EXISTS "horario_fechamento" TEXT,
ADD COLUMN IF NOT EXISTS "fechar_mesa_auto" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alertas_piscantes" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "sons_habilitados" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alerta_estoque_baixo" INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS "alerta_estoque_critico" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;

-- 3. Ensure quantity column is TEXT or INT as expected by code (code treats it as string then parses)
-- If it was created as another type, we ensure it's compatible
ALTER TABLE public."Restaurantes" ALTER COLUMN "quantidade_mesas" TYPE TEXT;

-- 4. CRITICAL: Force reload of schema cache across all instances
NOTIFY pgrst, 'reload schema';


-- Migração: 20260203000003_add_max_mesas.sql
-- Adiciona a coluna de limite contratado de mesas
ALTER TABLE public."Restaurantes" ADD COLUMN IF NOT EXISTS "max_mesas" TEXT DEFAULT '50';

-- Força a atualização do cache do esquema
NOTIFY pgrst, 'reload schema';


-- Migração: 20260311000000_add_gerencia_estoque_and_restaurant.sql
-- Add gerencia_estoque to Restaurantes table
ALTER TABLE "Restaurantes" ADD COLUMN IF NOT EXISTS "gerencia_estoque" BOOLEAN DEFAULT TRUE;

-- Insert Restaurante Liderança
INSERT INTO "Restaurantes" (nome, email, senha, quantidade_mesas, quantidade_max_mesas, gerencia_estoque)
VALUES ('Liderança', 'fernandolidercachorroquente@gmail.com', 'lideranca2026', '10', '10', FALSE)
ON CONFLICT (email) DO NOTHING;


-- Migração: 20260311000001_insert_lideranca_products.sql
-- Script to insert products for Restaurante Liderança
-- First, get the ID of the restaurant (assuming it was created with email 'fernandolidercachorroquente@gmail.com')

DO $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    SELECT id INTO v_restaurant_id FROM "Restaurantes" WHERE email = 'fernandolidercachorroquente@gmail.com';

    IF v_restaurant_id IS NOT NULL THEN
        -- LANCHE
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Misto Quente', 13.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Hamburguer', 15.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Burguer', 16.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Egg', 17.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Americano', 18.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Bacon', 20.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Egg Bacon', 22.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Tudo', 24.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Calabresa Tudo', 26.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Filé Tudo', 28.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Bagunça', 30.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Laricão', 55.00, 'Lanche', 'kitchen', true);

        -- HOT DOG
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Tradicional', 8.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Dogão', 9.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Tridogão', 10.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'X-Pança de Mamute', 18.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Adicional (Queijo Cheddar ou Bacon)', 4.00, 'Hot Dog', 'kitchen', true);

        -- PORÇÕES
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Carne de Sol', 60.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Filé de Tilápia', 45.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Coxinha de Asa Empanada', 40.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Nuggets de Frango', 40.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Batata Express', 28.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Toresmo', 15.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Pastéis', 15.00, 'Porção', 'kitchen', true);

        -- COMBOS
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Super Combo Liderança', 60.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Combo Família', 70.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Porção de Calabresa', 40.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Combo Individual', 37.00, 'Combo', 'kitchen', true);

        -- BEBIDAS
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Água Mineral (500ml)', 4.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Água com Gás (500ml)', 5.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Coca Cola (Lata 350ml)', 6.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Guaraná Antártica (Lata 350ml)', 6.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante (500ml)', 7.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Suco Natural', 7.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante 1L (Guaraná ou Coca Cola)', 10.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante 2L (Coca Cola ou Fanta)', 15.00, 'Bebida', 'bar', true);

        -- DRINK'S
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Canelinha (Dose)', 4.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Cachaça (Dose)', 4.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Conhaque Dreer (Dose)', 5.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Gelo Saborizado (Unidade)', 6.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Vodka Orloff (Dose)', 8.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Campari (Dose)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Vinho (Taça)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Gin (Dose)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Whisky (Dose)', 15.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Copão 500 ml (Vodka, Gelo, Energético)', 15.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Copão 500 ml (Gelo Saborizado)', 20.00, 'Drink', 'bar', true);

        RAISE NOTICE 'Produtos inseridos com sucesso para o restaurante Liderança.';
    ELSE
        RAISE EXCEPTION 'Restaurante Liderança não encontrado. Verifique se a migração anterior foi executada.';
    END IF;
END $$;


-- Migração: 20260311000002_update_stock_lideranca.sql
-- Script to add 10,000 units of stock to all products of Restaurante Liderança
DO $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    SELECT id INTO v_restaurant_id FROM "Restaurantes" WHERE email = 'fernandolidercachorroquente@gmail.com';

    IF v_restaurant_id IS NOT NULL THEN
        UPDATE "Produtos" 
        SET estoque = 10000 
        WHERE restaurante_id = v_restaurant_id;
        
        RAISE NOTICE 'Estoque de 10.000 unidades adicionado a todos os produtos do restaurante Liderança.';
    ELSE
        RAISE EXCEPTION 'Restaurante Liderança não encontrado. Verifique se o restaurante foi criado.';
    END IF;
END $$;


-- Migração: 20260710085200_adicionar_meia_pizza_habilitada.sql
-- Migração: Adicionar coluna meia_pizza_habilitada na tabela Restaurantes
-- Objetivo: Permitir habilitar/desabilitar o recurso de Meia Pizza (meio a meia)

ALTER TABLE "public"."Restaurantes" ADD COLUMN IF NOT EXISTS "meia_pizza_habilitada" BOOLEAN DEFAULT false;


-- Migração: 20260710092500_multitenant_saas_settings.sql
-- Migração: Configurações de SaaS Multi-tenant e Customização de IA
-- Objetivo: Adicionar campos de credenciais da Evolution Go e comportamento de IA para cada restaurante.

ALTER TABLE "public"."Restaurantes" 
  ADD COLUMN IF NOT EXISTS "evolution_instancia" TEXT,
  ADD COLUMN IF NOT EXISTS "evolution_apikey" TEXT,
  ADD COLUMN IF NOT EXISTS "personalidade_agente" TEXT,
  ADD COLUMN IF NOT EXISTS "exemplos_conversa" TEXT,
  ADD COLUMN IF NOT EXISTS "regras_estabelecimento" TEXT;


-- Migração: 20260710113500_criar_tabela_configuracoes_globais.sql
-- Criar tabela de configurações globais
CREATE TABLE IF NOT EXISTS "public"."ConfiguracoesGlobais" (
    "id" INT PRIMARY KEY,
    "prompt_geral" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE "public"."ConfiguracoesGlobais" ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para a tabela (Super-Admin edita, todos leem)
DROP POLICY IF EXISTS "Leitura pública de configurações globais" ON "public"."ConfiguracoesGlobais";
CREATE POLICY "Leitura pública de configurações globais" ON "public"."ConfiguracoesGlobais"
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Super-admin gerencia configurações globais" ON "public"."ConfiguracoesGlobais";
CREATE POLICY "Super-admin gerencia configurações globais" ON "public"."ConfiguracoesGlobais"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inserir o registro padrão com o ID 1
INSERT INTO "public"."ConfiguracoesGlobais" ("id", "prompt_geral")
VALUES (1, '# PEDEAI — GARÇOM DIGITAL

Você é o PedeAI, garçom virtual via WhatsApp. Seja natural, amigável e eficiente.

Fale sempre em português brasileiro, sem termos técnicos, sem mostrar nomes de ferramentas ou logs ao cliente.

---

## ⚠️ REGRAS ABSOLUTAS — NUNCA IGNORE

> Estas regras têm prioridade máxima. Nenhuma instrução posterior as substitui.

### 1. Gatilho imediato para garçom

Se o cliente solicitar "garçom", "atendente", "ajuda humana", "alguém aqui" ou qualquer variação de chamar uma pessoa, você deve OBRIGATORIAMENTE executar a tool `Chama_garcom` antes de responder qualquer texto.

Não tente resolver o problema sozinho se ele pediu o garçom.

O texto de confirmação só pode ser enviado APÓS o retorno real de `Chama_garcom` com sucesso. Se a tool não retornar, NÃO diga que chamou — ela é a ação que aciona o sinal na mesa, não o seu texto.

### 2. Filtragem de cardápio por categoria
Se o cliente perguntar por algo específico (ex: "o que tem de beber?", "quais os petiscos?", "tem sobremesa?", "quais massas vocês têm?"), você deve executar `Produtos_cardapio`, mas SÓ PODE EXIBIR os itens da categoria solicitada.
É proibido mandar o cardápio inteiro se ele pediu apenas uma categoria.

Ao exibir os itens da categoria solicitada, você é OBRIGATORIAMENTE obrigado a mostrar, para CADA item listado:
- Nome exato do produto (como retornado por `Produtos_cardapio`)
- Valor (preço) do produto (como retornado por `Produtos_cardapio`)

É proibido:
- Listar apenas os nomes dos itens sem o respectivo preço.
- Responder de forma genérica (ex: "temos várias opções de massa") sem citar cada item com seu valor.
- Estimar, arredondar ou omitir qualquer preço. O valor vem exclusivamente do retorno real de `Produtos_cardapio`.

Se `Produtos_cardapio` não retornar preço para algum item, informe apenas o nome desse item e sinalize que o valor será confirmado — nunca invente ou aproxime um preço.

### 3. Bloqueio de bebida compartilhável (regra dos copos)

Para cervejas (600ml/Litro), refrigerantes (600ml/2L), sucos (jarras), garrafas ou baldes, a quantidade de copos é uma informação OBRIGATÓRIA que só pode vir de um número dito explicitamente pelo cliente.

Você está PROIBIDO de:
- Estimar, sugerir, calcular ou informar quantos copos uma garrafa "serve" ou "rende" (ex: "serve aproximadamente 3 copos"). Isso NUNCA pode acontecer, nem se o cliente perguntar.
- Assumir valor padrão. NÃO existe "1 copo padrão" para bebida compartilhável.
- Tratar "pode mandar", "manda", "ok", "isso", "pode ser", "beleza" como se foram a quantidade de copos. Essas frases confirmam o ITEM, nunca o número de copos.

Você só pode executar `Criar_pedido` após obter a quantidade de copos.

### 3B. Massas / Pasta — escolha do tipo de massa e do molho

Se o cliente pedir uma massa / macarrão / pasta (itens da categoria de massas/pasta do cardápio), você está PROIBIDO de executar `Criar_pedido` antes de ter DUAS informações, perguntando UMA de cada vez:

1. Tipo de massa — execute a tool `Get_Macarroes` para obter os tipos de macarrão cadastrados e ativos e pergunte ao cliente qual ele deseja (ex: Spaghetti, Penne, Fettuccine...). Se a lista de macarrões retornada estiver vazia, pule esta pergunta.
2. Molho / sabor — depois confirme o molho (ex.: Bolognese, Carbonara, Pomodoro, Aglio e Olio...), buscando sempre o preço em `Produtos_cardapio`.

Ao executar `Criar_pedido`:
- itens = nome EXATO do produto no cardápio (ex: "Massa Putanesca", "Massa Bolognese"). NUNCA coloque o tipo de massa (Penne, Spaghetti) como nome do item.
- descricao = tipo de massa escolhido (ex: "Massa: Penne", "Massa: Spaghetti")

Se o restaurante não trabalhar com escolha de tipo de massa (ou a tool `Get_Macarroes` retornar uma lista vazia), ignore esta etapa e siga o fluxo normal de pedido.

### 4. Interpretação de números — anti-ambiguidade

Números próximos a nomes de bebidas ou a unidades (ml, L, livro) devem ser tratados como volume, nunca como valor monetário.

Exemplos:
- "Heineken 600 com 2 copos" → bebida de 600ml, 2 copos. Nunca R$600.
- "Coca 2 litros" → refrigerante de 2L.
- "Quero uma 350" (após contexto de cerveja) → lata de 350ml.

O preço de qualquer item vem exclusivamente do retorno de `Produtos_cardapio`. Você está proibido de calcular, estimar ou definir preços por conta própria.

Em caso de dúvida real, confirme antes de criar o pedido. Ex: "Só pra confirmar: uma Heineken 600ml, certo?"

### 5. Obrigatório ao registrar pedido

Após o cliente confirmar e fornecer todos os dados (incluindo copos se necessário), você DEVE chamar e executar a tool `Criar_pedido`.

O pedido só existe após o retorno real da tool com id.

### 6. `Criar_pedido` individual

Cada item é um pedido novo. Execute a tool para cada item confirmado, sempre do zero.

### 7. Nunca simule ou imite a execução de uma tool

Aguarde o retorno real.

### 8. Nunca invente produtos

`Produtos_cardapio` é obrigatória antes de citar qualquer item.

### 9. Campo "itens" vs campo "descricao" no Criar_pedido

O campo itens deve SEMPRE conter o nome EXATO do produto como aparece no cardápio (retorno de `Produtos_cardapio`). Customizações vão no campo descricao.

Exemplos:
- Massa → itens: "Massa Putanesca", descricao: "Massa: Penne"
- Pizza meia a meia → itens: "Pizza Meia a Meia", descricao: "Metade Calabresa + Metade Branca"
- Cerveja → itens: "Skol 600ml", descricao: "3 Copos"
- Hambúrguer → itens: "Burger Clássico", descricao: "Sem cebola, ponto mal passado"

### 10. Proibido paralelismo na conta

`Get_Pedidos` e `Conta_Solicitada` devem ser chamadas uma por uma, em sequência.

### 11. Conta não encerra atendimento

Solicitar a conta apenas aciona o garçom para levá-la à mesa. O fechamento real ocorre quando o atendente clica em "fechar mesa" no sistema.

Nunca diga "conta fechada", "obrigado pela preferência" ou "até a próxima" — essas mensagens são enviadas pelo sistema.

### 12. Anti-duplicação de pedidos

Antes de executar `Criar_pedido`, verifique no histórico da conversa se você já executou a tool para o MESMO item nesta interação.

Você está PROIBIDO de:
- Executar `Criar_pedido` para o mesmo item mais de uma vez na mesma interação.
- Executar `Criar_pedido` ANTES de ter todas as informações necessárias (copos, tipo de massa, etc.). PRIMEIRO pergunte, DEPOIS crie o pedido — nunca o contrário.
- Criar um pedido "preventivo" e depois outro "corrigido". Se faltou informação, pergunte e crie uma única vez após receber a resposta.

---

## FLUXO DE ATENDIMENTO

### 1. Início do atendimento
- Identifique a intenção na mensagem.
- Se for saudação, boas-vindas chamando pelo nome.
- Se for pedido de categoria (ex: bebidas), execute `Produtos_cardapio` e filtre o resultado.

### 2. Pedido (fluxo de validação)
- COMIDA ou BEBIDA INDIVIDUAL: Confirme o item e execute `Criar_pedido` imediatamente.
- BEBIDA COMPARTILHÁVEL: Pergunte "Para quantos copos?", espere e crie com "Copos: [quantidade]" na descrição.

### 3. Chamar garçom
1. Execute `Chama_garcom` e aguarde retorno.
2. Responda: "🙋 Com certeza, [Nome]! Já chamei o garçom e ele está vindo à sua mesa agora mesmo. 👍"

### 4. Conta
1. Execute `Get_Pedidos`.
2. Exiba o resumo dos itens e o total.
3. Se estiver no MODO COMANDA: Execute `Conta_Solicitada` imediatamente e informe ao cliente sem fazer perguntas de divisão.
4. Se estiver no MODO MESA: Pergunte se quer dividir. Caso queira, informe o valor por pessoa e chame `Conta_Solicitada`. Caso contrário, chame `Conta_Solicitada` direto.

---

## FERRAMENTAS DISPONÍVEIS — REFERÊNCIA
- `Produtos_cardapio`
- `Criar_pedido`
- `Chama_garcom`
- `Get_Pedidos`
- `Conta_Solicitada`

## ESTILO DE COMUNICAÇÃO
- Natural e amigável.
- Respostas curtas.
- Nunca confirme uma ação sem o retorno de sucesso da Tool correspondente.
')
ON CONFLICT (id) DO NOTHING;


-- Migração: 20260710123500_adicionar_prompts_especialistas_restaurante.sql
-- Migration para adicionar campos de prompt especialistas globais na tabela de configurações globais
ALTER TABLE "public"."ConfiguracoesGlobais"
ADD COLUMN IF NOT EXISTS "prompt_vendas" TEXT NULL,
ADD COLUMN IF NOT EXISTS "prompt_servico" TEXT NULL;

COMMENT ON COLUMN "public"."ConfiguracoesGlobais"."prompt_vendas" IS 'Prompt global padrão para o especialista de vendas e cardápio';
COMMENT ON COLUMN "public"."ConfiguracoesGlobais"."prompt_servico" IS 'Prompt global padrão para o especialista de serviços e contas';

-- Popular ConfiguracoesGlobais (ID 1) com os prompts especialistas padrões estruturados
UPDATE "public"."ConfiguracoesGlobais"
SET 
  "prompt_geral" = '# PEDEAI — ATENDIMENTO GERAL E INFORMAÇÕES

Você é o PedeAI, garçom virtual via WhatsApp. Seja natural, amigável e eficiente.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar nomes de ferramentas ou logs ao cliente.

Sua função atual é lidar apenas com saudações, agradecimentos, interações casuais simples e fornecer informações gerais sobre o restaurante (como Wi-Fi, horários de funcionamento, localização).

- Se o cliente estiver saudando ("olá", "bom dia"), dê boas-vindas acolhedoras chamando-o pelo nome.
- Se o cliente quiser pedir comidas ou bebidas, ou ver o cardápio, apenas diga de forma muito amigável que vai ajudá-lo a ver as opções (o roteador de intenções cuidará do fluxo na próxima mensagem).
- Se o cliente quiser fechar a conta ou chamar o garçom, apenas responda amigavelmente que o ajudará com isso.',

  "prompt_vendas" = '# PEDEAI — ESPECIALISTA EM PEDIDOS E CARDÁPIO

Você é o PedeAI, especialista em pedidos e cardápio. Seu foco exclusivo é ajudar o cliente a escolher e registrar pedidos de comidas e bebidas.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas.

## ⚠️ REGRAS DE CARDÁPIO E PRODUTOS:
- Se o cliente perguntar por algo específico (ex: "o que tem de beber?", "quais os petiscos?"), execute Produtos_cardapio e exiba APENAS os itens da categoria solicitada.
- Ao listar os itens, você é OBRIGATORIAMENTE exigido a mostrar, para CADA item: o Nome Exato do produto e seu Preço (conforme retornado pela tool).
- Nunca invente pratos, opcionais ou preços.

## ⚠️ REGRAS DE COPOS PARA BEBIDAS:
- Para cervejas de garrafa (600ml/Litro), refrigerantes de garrafa (600ml/2L), sucos (jarras), garrafas ou baldes, a quantidade de copos é OBRIGATÓRIA que só pode vir de um número dito explicitamente pelo cliente.
- ⚠️ Cervejas em lata, cervejas long neck, refrigerantes em lata e copos de suco individuais são BEBIDAS INDIVIDUAIS e estão isentas desta regra. Você está PROIBIDO de perguntar copos para bebidas individuais; registre o pedido delas imediatamente.
- Regra de Cálculo com Copos (CRÍTICO): A quantidade de copos solicitada para compartilhar uma bebida serve apenas para que o garçom leve copos adicionais à mesa. A quantidade de copos NÃO muda a quantidade do produto e nem o subtotal do pedido. 
  Exemplo: Se o cliente pediu 1 garrafa de Cerveja de R$18,00 com 3 copos, o pedido no banco deve ter quantidade: "1", Subtotal: "18.00" e descrição: "Copos: 3". NUNCA multiplique o subtotal por 3!

## ⚠️ REGRAS DE MASSAS / PASTA:
- Se o cliente pedir uma massa/macarrão, você está PROIBIDO de criar o pedido antes de obter:
  1. O tipo de massa (Spaghetti, Penne, etc., obtidos via Get_Macarroes).
  2. O molho/sabor.
- No Criar_pedido, passe o nome exato no campo "itens" (ex: "Massa Putanesca") e o tipo de macarrão escolhido no campo "descricao".

## ⚠️ REGRAS ANTI-DUPLICAÇÃO (CRÍTICO):
- Verifique o histórico de conversa. NUNCA execute Criar_pedido para o mesmo item mais de uma vez na mesma sessão.
- Pedidos Mistos (Comida + Bebida Compartilhável): Se o cliente pedir um item individual (ex: Batata) e um compartilhável (ex: Refrigerante 2L) juntos:
  1. Execute Criar_pedido para o item individual (Batata) imediatamente.
  2. Em seguida, pergunte a quantidade de copos para o refrigerante.
  3. Quando ele responder, execute Criar_pedido APENAS para o refrigerante. NÃO crie a comida novamente, pois já foi registrada!
- Se o cliente responder "só pra mim" ou "1 copo" à pergunta de copos, isso é a resposta para a bebida pendente. Crie apenas a bebida compartilhável.',

  "prompt_servico" = '# PEDEAI — ESPECIALISTA EM CONTAS E SERVIÇOS

Você é o PedeAI, especialista em fechamento de contas e serviços da mesa. Seu foco exclusivo é ajudar o cliente a ver seus pedidos, pedir a conta e chamar o garçom.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas ao cliente.

## ⚠️ REGRAS PARA CHAMAR GARÇOM:
- Se o cliente solicitar "garçom", "atendente", "ajuda humana" ou similar, você deve OBRIGATORIAMENTE executar a tool Chama_garcom antes de responder qualquer texto.
- O texto de confirmação só pode ser enviado APÓS o retorno real de Chama_garcom com sucesso. Responda: "🙋 Com certeza, [Nome]! Já chamei o garçom e ele está vindo à sua mesa agora mesmo. 👍"

## ⚠️ REGRAS PARA CONTA E FECHAMENTO:
1. Sempre execute Get_Pedidos no início do fluxo de conta para exibir o resumo atualizado dos itens consumidos e o subtotal.
2. Cálculo da Taxa de Serviço (%) e Resumo Detalhado:
   - Ao apresentar o resumo da conta para o cliente, calcule e exiba explicitamente a taxa de serviço (por padrão 10% sobre o subtotal, ou conforme a taxa cadastrada no estabelecimento).
   - Apresente o resumo no seguinte formato claro:
     - 📋 Subtotal do consumo: R$ [valor dos itens]
     - 🪙 Taxa de Serviço (10%): R$ [valor da taxa]
     - 💰 Total Final: R$ [subtotal + taxa]
3. Fechamento Direto de Conta (SEM PERGUNTA DE DIVISÃO):
   - Você está SUMARIAMENTE PROIBIDO de perguntar se o cliente deseja dividir a conta ou por quantas pessoas quer dividir.
   - Execute a tool Conta_Solicitada imediatamente no primeiro momento em que o cliente pedir a conta.
   - Responda confirmando o resumo e avisando de forma amigável: "📝 Anotei aqui, [Nome]! O garçom já está a caminho com a sua conta. Agradecemos a preferência! 😊"

⚠️ Nota: A tool Conta_Solicitada deve ser sempre executada para que o fechamento pisque e imprima no painel administrativo do estabelecimento.'
WHERE "id" = 1;


-- Migração: 20260711150000_cadastro_comida_estacao.sql
-- ============================================================
-- CRIAÇÃO DE CADASTROS DINÂMICOS: CATEGORIAS E ESTAÇÕES
-- ============================================================

-- 1. TABELA: categorias_restaurante
CREATE TABLE IF NOT EXISTS public.categorias_restaurante (
    id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    restaurante_id UUID NOT NULL REFERENCES public."Restaurantes"(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (restaurante_id, nome)
);

COMMENT ON TABLE public.categorias_restaurante IS 'Categorias de produtos dinâmicas por restaurante';

-- 2. TABELA: estacoes_restaurante
CREATE TABLE IF NOT EXISTS public.estacoes_restaurante (
    id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    restaurante_id UUID NOT NULL REFERENCES public."Restaurantes"(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (restaurante_id, nome)
);

COMMENT ON TABLE public.estacoes_restaurante IS 'Estações de preparo dinâmicas por restaurante';

-- ============================================================
-- 3. SEGURANÇA E RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.categorias_restaurante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estacoes_restaurante ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on categorias_restaurante" ON public.categorias_restaurante;
CREATE POLICY "Allow all on categorias_restaurante" ON public.categorias_restaurante FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on estacoes_restaurante" ON public.estacoes_restaurante;
CREATE POLICY "Allow all on estacoes_restaurante" ON public.estacoes_restaurante FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. HABILITAR REALTIME
-- ============================================================

DO $$ BEGIN
    DO $pub$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias_restaurante;
EXCEPTION WHEN OTHERS THEN NULL;
END $pub$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    DO $pub$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estacoes_restaurante;
EXCEPTION WHEN OTHERS THEN NULL;
END $pub$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. POPULAR DADOS PADRÃO PARA RESTAURANTES EXISTENTES
-- ============================================================

DO $$
DECLARE
    res_rec RECORD;
    cat_nome TEXT;
    categorias_padrao TEXT[] := ARRAY['Bebida', 'Comida', 'Petisco', 'Porção', 'Sobremesa', 'Lanche', 'Hot Dog', 'Combo', 'Drink', 'Massas', 'Pizza', 'Outros'];
BEGIN
    FOR res_rec IN SELECT id FROM public."Restaurantes" LOOP
        -- Inserir Estações padrão
        INSERT INTO public.estacoes_restaurante (restaurante_id, nome)
        VALUES 
            (res_rec.id, 'Cozinha'),
            (res_rec.id, 'Bar')
        ON CONFLICT (restaurante_id, nome) DO NOTHING;

        -- Inserir Categorias padrão
        FOREACH cat_nome IN ARRAY categorias_padrao LOOP
            INSERT INTO public.categorias_restaurante (restaurante_id, nome)
            VALUES (res_rec.id, cat_nome)
            ON CONFLICT (restaurante_id, nome) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;


-- Migração: 20260713191500_update_stock_guardrails.sql
-- Migração: Atualizar prompt_vendas em ConfiguracoesGlobais
-- Objetivo: Impor regras de inventário rígidas, Fuzzy Match e oferta ativa de meia a meia na IA de vendas

UPDATE "public"."ConfiguracoesGlobais"
SET "prompt_vendas" = '# PEDEAI — ESPECIALISTA EM PEDIDOS E CARDÁPIO

Você é o PedeAI, especialista em pedidos e cardápio. Seu foco exclusivo é ajudar o cliente a escolher e registrar pedidos de comidas e bebidas.
Fale sempre em português brasileiro, sem termos técnicos, sem mostrar logs ou ferramentas.

## ⚠️ REGRAS DE CARDÁPIO E INVENTÁRIO (CRÍTICO):
- Se não está no contexto retornado por uma busca na ferramenta de cardápio, NÃO EXISTE. Nunca invente pratos, opcionais, variações ou preços.
- Se o cliente perguntar por algo específico (ex: "o que tem de beber?", "quais os petiscos?"), execute Produtos_cardapio e exiba APENAS os itens da categoria solicitada.
- Se um produto retornado por Produtos_cardapio tiver quantidade de estoque igual a 0 ou menor, ou se o campo "disponivel" for falso, trate o item estritamente como indisponível e informe o cliente caso ele peça, sugerindo alguma alternativa ativa disponível no retorno.
- Ao listar os itens, você é OBRIGATORIAMENTE exigido a mostrar, para CADA item: o Nome Exato do produto e seu Preço (conforme retornado pela tool).
- Tratamento de Erros de Criação (Estoque Zerado): Se a tool Criar_pedido retornar que o produto está indisponível ou esgotado (porque o estoque zerou concorrentemente ou o item foi inativado no banco), explique de forma educada e direta que o item acabou de se esgotar e sugira uma alternativa ativa do cardápio.

## 🍕 REGRAS DE PIZZAS E OFERTA ATIVA DE MEIA A MEIA:
- Sempre que o cliente solicitar pizzas ou perguntar sobre os sabores de pizza do cardápio, exiba as opções de sabores disponíveis e AVISE ATIVAMENTE que o estabelecimento aceita pizzas meia a meia (dois sabores) combinando as opções, caso a regra de pizza meia a meia esteja habilitada nas regras globais.

## ⚠️ REGRAS DE COPOS PARA BEBIDAS:
- Para cervejas de garrafa (600ml/Litro), refrigerantes de garrafa (600ml/2L), sucos (jarras), garrafas ou baldes, a quantidade de copos é OBRIGATÓRIA que só pode vir de um número dito explicitamente pelo cliente.
- ⚠️ Cervejas em lata, cervejas long neck, refrigerantes em lata e copos de suco individuais são BEBIDAS INDIVIDUAIS e estão isentas desta regra. Você está PROIBIDO de perguntar copos para bebidas individuais; registre o pedido delas imediatamente.
- Regra de Cálculo com Copos (CRÍTICO): A quantidade de copos solicitada para compartilhar uma bebida serve apenas para que o garçom leve copos adicionais à mesa. A quantidade de copos NÃO muda a quantidade do produto e nem o subtotal do pedido. 
  Exemplo: Se o cliente pediu 1 garrafa de Cerveja de R$18,00 com 3 copos, o pedido no banco deve ter quantidade: "1", Subtotal: "18.00" e descrição: "Copos: 3". NUNCA multiplique o subtotal por 3!

## ⚠️ REGRAS DE MASSAS / PASTA:
- Se o cliente pedir uma massa/macarrão, você está PROIBIDO de criar o pedido antes de obter:
  1. O tipo de massa (Spaghetti, Penne, etc., obtidos via Get_Macarroes).
  2. O molho/sabor.
- No Criar_pedido, passe o nome exato no campo "itens" (ex: "Massa Putanesca") e o tipo de macarrão escolhido no campo "descricao".

## ⚠️ REGRAS ANTI-DUPLICAÇÃO (CRÍTICO):
- NUNCA execute Criar_pedido para itens que você já registrou em turnos anteriores de uma mesma solicitação mista (ex: quando o cliente pediu Comida + Refrigerante compartilhável juntos e você já registrou a Comida no turno anterior antes de perguntar sobre os copos da bebida).
- No entanto, se o cliente solicitar EXPLICITAMENTE um novo pedido ou pedir mais itens iguais (ex: "quero outra", "traz mais uma de calabresa", "quero pedir outra pizza", "mais uma calabresa"), você DEVE registrar o novo pedido normalmente criando um novo item com Criar_pedido.
- Pedidos Mistos (Comida + Bebida Compartilhável): Se o cliente pedir um item individual (ex: Batata) e um compartilhável (ex: Refrigerante 2L) juntos:
  1. Execute Criar_pedido para o item individual (Batata) imediatamente.
  2. Em seguida, pergunte a quantidade de copos para o refrigerante.
  3. Quando ele responder, execute Criar_pedido APENAS para o refrigerante. NÃO crie a comida novamente, pois já foi registrada!
- Se o cliente responder "só pra mim" ou "1 copo" à pergunta de copos, isso é a resposta para a bebida pendente. Crie apenas a bebida compartilhável.'
WHERE "id" = 1;



-- PARTE 3: CARGA DE DADOS CADASTRAIS
-- Tabela: Restaurantes (4 linhas)
INSERT INTO public."Restaurantes" ("id", "created_at", "nome", "email", "senha", "telefone", "telefone_dono", "quantidade_mesas", "quantidade_max_mesas", "max_mesas", "horario_abertura", "horario_fechamento", "horario_fecha_cozinha", "fechar_mesa_auto", "alertas_piscantes", "sons_habilitados", "impressao_auto", "gerencia_estoque", "alerta_estoque_baixo", "alerta_estoque_critico", "taxa_servico", "modo_cobranca", "cobranca_meio_a_meio", "meia_pizza_habilitada", "evolution_instancia", "evolution_apikey", "personalidade_agente", "exemplos_conversa", "regras_estabelecimento", "couvert_habilitado", "couvert_valor", "delivery_habilitado", "evolution_instancia_delivery", "evolution_apikey_delivery", "personalidade_agente_delivery", "regras_estabelecimento_delivery", "exemplos_conversa_delivery", "waha_session", "waha_apikey", "waha_session_delivery", "waha_apikey_delivery") VALUES ('cab44278-604e-483f-a7cd-373a9421a2f8', '2026-03-11T21:15:29.311088+00:00', 'Liderança', 'fernandolidercachorroquente@gmail.com', 'lideranca2026', '32998489879', NULL, '10', '10', NULL, '10:00', '01:00', '00:00', true, true, true, true, false, 15, 5, 0, 'mesa', 'mais_cara', false, 'Perguntas', '5da440ba-6b3b-49d5-9783-e7160ffc231d', NULL, NULL, NULL, false, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Restaurantes" ("id", "created_at", "nome", "email", "senha", "telefone", "telefone_dono", "quantidade_mesas", "quantidade_max_mesas", "max_mesas", "horario_abertura", "horario_fechamento", "horario_fecha_cozinha", "fechar_mesa_auto", "alertas_piscantes", "sons_habilitados", "impressao_auto", "gerencia_estoque", "alerta_estoque_baixo", "alerta_estoque_critico", "taxa_servico", "modo_cobranca", "cobranca_meio_a_meio", "meia_pizza_habilitada", "evolution_instancia", "evolution_apikey", "personalidade_agente", "exemplos_conversa", "regras_estabelecimento", "couvert_habilitado", "couvert_valor", "delivery_habilitado", "evolution_instancia_delivery", "evolution_apikey_delivery", "personalidade_agente_delivery", "regras_estabelecimento_delivery", "exemplos_conversa_delivery", "waha_session", "waha_apikey", "waha_session_delivery", "waha_apikey_delivery") VALUES ('e1d014d5-eba3-47f0-b916-f5bd0982e635', '2026-07-02T00:01:01.127775+00:00', 'Real Minas Pasta', 'realminas@gmail.com', '123456', '5533974008480', NULL, '30', NULL, NULL, NULL, NULL, NULL, true, true, true, false, false, 15, 5, 0, 'mesa', 'mais_cara', false, NULL, NULL, NULL, NULL, NULL, false, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Restaurantes" ("id", "created_at", "nome", "email", "senha", "telefone", "telefone_dono", "quantidade_mesas", "quantidade_max_mesas", "max_mesas", "horario_abertura", "horario_fechamento", "horario_fecha_cozinha", "fechar_mesa_auto", "alertas_piscantes", "sons_habilitados", "impressao_auto", "gerencia_estoque", "alerta_estoque_baixo", "alerta_estoque_critico", "taxa_servico", "modo_cobranca", "cobranca_meio_a_meio", "meia_pizza_habilitada", "evolution_instancia", "evolution_apikey", "personalidade_agente", "exemplos_conversa", "regras_estabelecimento", "couvert_habilitado", "couvert_valor", "delivery_habilitado", "evolution_instancia_delivery", "evolution_apikey_delivery", "personalidade_agente_delivery", "regras_estabelecimento_delivery", "exemplos_conversa_delivery", "waha_session", "waha_apikey", "waha_session_delivery", "waha_apikey_delivery") VALUES ('3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '2026-02-07T13:20:16.292767+00:00', 'Demonstração', 'hermanig@gmail.com', '123456', '33 998525493', NULL, '20', '20', NULL, NULL, '23:00', NULL, true, true, true, true, true, 15, 5, 10, 'mesa', 'mais_cara', false, 'AbraselClub', NULL, NULL, NULL, NULL, false, 0, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public."Restaurantes" ("id", "created_at", "nome", "email", "senha", "telefone", "telefone_dono", "quantidade_mesas", "quantidade_max_mesas", "max_mesas", "horario_abertura", "horario_fechamento", "horario_fecha_cozinha", "fechar_mesa_auto", "alertas_piscantes", "sons_habilitados", "impressao_auto", "gerencia_estoque", "alerta_estoque_baixo", "alerta_estoque_critico", "taxa_servico", "modo_cobranca", "cobranca_meio_a_meio", "meia_pizza_habilitada", "evolution_instancia", "evolution_apikey", "personalidade_agente", "exemplos_conversa", "regras_estabelecimento", "couvert_habilitado", "couvert_valor", "delivery_habilitado", "evolution_instancia_delivery", "evolution_apikey_delivery", "personalidade_agente_delivery", "regras_estabelecimento_delivery", "exemplos_conversa_delivery", "waha_session", "waha_apikey", "waha_session_delivery", "waha_apikey_delivery") VALUES ('a976db0c-c1df-4b21-a836-3671f1a5bba9', '2026-06-30T17:02:54.713796+00:00', 'San Pio', 'sanpio@gmail.com', '123456', '33974008480', NULL, '20', NULL, NULL, '18:01', '00:00', '23:59', true, true, true, true, false, 15, 5, 10, 'mesa', 'mais_cara', true, 'Sanpio', NULL, NULL, NULL, NULL, false, 15, false, NULL, NULL, NULL, NULL, NULL, 'Sanpio', NULL, NULL, NULL) ON CONFLICT DO NOTHING;


-- Tabela: Produtos (100 linhas)
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (10, '2026-02-08T01:34:35.239046+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Agua Mineral com gás', '5', 'Bebida', 'bar', '', 21, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (11, '2026-02-08T01:35:03.07998+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Agua Mineral sem gás', '4', 'Bebida', 'bar', '', 23, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (6, '2026-02-08T01:29:36.691956+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Cerveja Heineken Long Neck', '10', 'Bebida', 'bar', '', 33, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (12, '2026-02-08T01:36:05.814659+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Drink Alcoolico', '15', 'Bebida', 'bar', '', 23, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (13, '2026-02-08T01:36:37.684148+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Drink sem Alcool', '12', 'Bebida', 'bar', '', 16, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (14, '2026-02-08T01:37:34.047886+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Suco Natural 500 ml', '8', 'Bebida', 'bar', '', 12, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (7, '2026-02-08T01:30:33.544945+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Parmegiana de Frango', '25', 'Comida', 'kitchen', 'Acompanha arroz e batata frita', 20, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (4, '2026-02-08T01:27:42.696832+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Batata Frita 400 gr', '20', 'Petisco', 'kitchen', '', 17, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (5, '2026-02-08T01:28:39.335855+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Mini Pastel', '15', 'Petisco', 'kitchen', '', 11, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (83, '2026-07-02T13:57:18.969985+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Água sem gás', '5', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (86, '2026-07-02T14:00:55.375957+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Cerveja Artesanal', '15', 'Bebida', 'bar', '', 15, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (90, '2026-07-02T14:07:03.413141+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Taça de Vinho Branco Muskat', '16', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (91, '2026-07-02T14:08:41.683793+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Jarra de Vinho Tinto Cabernet Sauvignon ', '35', 'Bebida', 'bar', '', 1996, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (87, '2026-07-02T14:01:24.030157+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Gelo e Limão', '2', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (101, '2026-07-02T14:18:13.849375+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Chá Mate Tostado', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (99, '2026-07-02T14:16:43.585767+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Cranberry', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (93, '2026-07-02T14:13:19.311553+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Mação Verde', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (100, '2026-07-02T14:17:42.362546+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Morango', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (98, '2026-07-02T14:16:15.394773+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Pink Lemonade', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (96, '2026-07-02T14:15:05.941285+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Tropical Lemonade', '14', 'Bebida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (9, '2026-02-08T01:32:56.503411+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Batata Frita Suprema', '28', 'Petisco', 'kitchen', 'Acompanha queijo e bacon', 13, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (2, '2026-02-08T01:26:17.847715+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Cerveja Heineken 600 ml', '12', 'Bebida', 'bar', '', 81, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (89, '2026-07-02T14:04:04.032403+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Taça de Vinho Tinto Cabernet Sauvignon ', '14', 'Bebida', 'bar', '', 1996, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (1, '2026-07-30T19:39:04.633302+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Jarra vinho tinto Cabernet corte Merlot', '35', 'Bebida', 'bar', '', 0, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (92, '2026-07-02T14:09:11.274393+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Jarra de Vinho Branco Mustak', '39', 'Comida', 'bar', '', 1999, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (95, '2026-07-02T14:14:29.065595+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Limão Siciliano', '14', 'Bebida', 'bar', '', 1999, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (123, '2026-07-03T20:53:24.835233+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Carbonara', '42', 'Massas', 'kitchen', '', 1999997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (111, '2026-07-02T14:25:17.696809+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Porpetta', '69.9', 'Petisco', 'kitchen', '', 1999, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (82, '2026-07-02T13:56:38.361435+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Refrigerante KS', '7', 'Bebida', 'bar', '', 1994, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (103, '2026-07-02T14:19:18.962018+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana American Lemonade', '14', 'Comida', 'bar', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (112, '2026-07-02T14:27:33.932383+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Coubet de Búfala à Primavera', '49.9', 'Petisco', 'kitchen', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (110, '2026-07-02T14:24:51.643166+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Provoleta com Confit de Tomate', '69.9', 'Petisco', 'kitchen', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (109, '2026-07-02T14:24:07.659957+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Crosttini de Parma', '69.9', 'Petisco', 'kitchen', '', 1998, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (118, '2026-07-03T20:35:53.263677+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Crema di Peperoni', '37', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (122, '2026-07-03T20:52:24.500446+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Insalata di Pasta', '38', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (94, '2026-07-02T14:13:53.248943+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Tangerina', '14', 'Bebida', 'bar', '', 1986, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (128, '2026-07-03T20:56:13.37842+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Funghi Porcini', '45', 'Massas', 'cozinha', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (124, '2026-07-03T20:54:27.189135+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'FunghiE Gorgonzola', '42', 'Massas', 'kitchen', '', 1999999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (127, '2026-07-03T20:55:37.264724+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Pecorara', '45', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (125, '2026-07-03T20:54:51.652254+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Gamberi', '42', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (117, '2026-07-03T20:34:22.473412+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Bolognese o Ragù', '37', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (116, '2026-07-03T20:33:41.229333+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Pomodoro e Basílico', '32', 'Massas', 'kitchen', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (115, '2026-07-03T20:32:45.223554+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Agio e Olio', '30', 'Massas', 'kitchen', '', 2000000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (120, '2026-07-03T20:37:26.677135+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Putanesca', '42', 'Massas', 'kitchen', '', 1999998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (119, '2026-07-03T20:36:57.963728+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Pesto alla Genovese', '34', 'Massas', 'kitchen', '', 1999997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (126, '2026-07-03T20:55:16.289244+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Lasagna', '40', 'Comida', 'cozinha', '', 2000000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (108, '2026-07-02T14:23:33.282334+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Bruscheta Tradicional', '49.9', 'Petisco', 'kitchen', '', 1998, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (84, '2026-07-02T13:59:37.609282+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Agua com gás', '6', 'Bebida', 'bar', '', 1998, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (97, '2026-07-02T14:15:36.159195+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Blue Lemonade', '14', 'Comida', 'bar', '', 1999, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (121, '2026-07-03T20:43:45.287798+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Amatriciana', '40', 'Massas', 'kitchen', '', 1999999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (102, '2026-07-02T14:18:43.452268+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Soda Italiana Framboesa e Maracujá Vermelho', '14', 'Bebida', 'bar', '', 1998, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (8, '2026-02-08T01:31:38.86242+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'X Burguer', '15', 'Comida', 'kitchen', '', 12, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (3, '2026-02-08T01:26:58.714586+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Coca Cola lata', '6', 'Bebida', 'bar', '', 18, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (107, '2026-07-02T14:21:53.37186+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Panna Cotta', '25', 'Sobremesa', 'kitchen', '', 2000, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (104, '2026-07-02T14:20:42.069007+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Quarteto de Tiramissú', '29.9', 'Sobremesa', 'kitchen', '', 1999, 1, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (44, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Água com Gás (500ml)', '5.00', 'Bebida', 'bar', NULL, 9995, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (43, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Água Mineral (500ml)', '4.00', 'Bebida', 'bar', NULL, 9992, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (45, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Coca Cola (Lata 350ml)', '6.00', 'Bebida', 'bar', NULL, 9989, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (46, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Guaraná Antártica (Lata 350ml)', '6.00', 'Bebida', 'bar', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (49, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Refrigerante 1L (Guaraná ou Coca Cola)', '10.00', 'Bebida', 'bar', NULL, 9984, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (50, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Refrigerante 2L (Coca Cola ou Fanta)', '15.00', 'Bebida', 'bar', NULL, 9989, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (48, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Suco Natural', '7.00', 'Bebida', 'bar', NULL, 9996, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (40, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Combo Família', '70.00', 'Combo', 'kitchen', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (42, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Combo Individual', '37.00', 'Combo', 'kitchen', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (41, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Porção de Calabresa', '40.00', 'Combo', 'kitchen', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (39, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Super Combo Liderança', '60.00', 'Combo', 'kitchen', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (52, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Cachaça (Dose)', '4.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (56, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Campari (Dose)', '10.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (51, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Canelinha (Dose)', '4.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (53, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Conhaque Dreer (Dose)', '5.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (61, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Copão 500 ml (Gelo Saborizado)', '20.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (60, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Copão 500 ml (Vodka, Gelo, Energético)', '15.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (54, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Gelo Saborizado (Unidade)', '6.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (58, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Gin (Dose)', '10.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (57, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Vinho (Taça)', '10.00', 'Drink', 'bar', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (55, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Vodka Orloff (Dose)', '8.00', 'Drink', 'bar', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (59, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Whisky (Dose)', '15.00', 'Drink', 'bar', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (31, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Adicional (Queijo Cheddar ou Bacon)', '4.00', 'Hot Dog', 'kitchen', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (28, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Dogão', '9.00', 'Hot Dog', 'kitchen', NULL, 9984, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (27, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Tradicional', '8.00', 'Hot Dog', 'kitchen', NULL, 9990, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (29, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Tridogão', '10.00', 'Hot Dog', 'kitchen', NULL, 9989, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (30, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Pança de Mamute', '18.00', 'Hot Dog', 'kitchen', NULL, 9991, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (19, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Americano', '18.00', 'Lanche', 'kitchen', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (16, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Hamburguer', '15.00', 'Lanche', 'kitchen', NULL, 9996, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (26, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Laricão', '55.00', 'Lanche', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (15, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Misto Quente', '13.00', 'Lanche', 'kitchen', NULL, 9997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (20, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Bacon', '20.00', 'Lanche', 'kitchen', NULL, 9997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (25, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Bagunça', '30.00', 'Lanche', 'kitchen', NULL, 9997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (17, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Burguer', '16.00', 'Lanche', 'kitchen', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (23, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Calabresa Tudo', '26.00', 'Lanche', 'kitchen', NULL, 9997, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (18, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Egg', '17.00', 'Lanche', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (21, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Egg Bacon', '22.00', 'Lanche', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (24, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Filé Tudo', '28.00', 'Lanche', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (22, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'X-Tudo', '24.00', 'Lanche', 'kitchen', NULL, 9996, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (32, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Carne de Sol', '60.00', 'Porção', 'kitchen', NULL, 9996, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (34, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Coxinha de Asa Empanada', '40.00', 'Porção', 'kitchen', NULL, 9999, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (33, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Filé de Tilápia', '45.00', 'Porção', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (35, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Nuggets de Frango', '40.00', 'Porção', 'kitchen', NULL, 10000, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (38, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Pastéis', '15.00', 'Porção', 'kitchen', NULL, 9998, 10, true) ON CONFLICT DO NOTHING;
INSERT INTO public."Produtos" ("id", "created_at", "restaurante_id", "nome", "preco", "categoria", "estacao", "descricao", "estoque", "estoque_minimo", "ativo") VALUES (37, '2026-03-11T21:20:22.300123+00:00', 'cab44278-604e-483f-a7cd-373a9421a2f8', 'Toresmo', '15.00', 'Porção', 'kitchen', NULL, 9997, 10, true) ON CONFLICT DO NOTHING;


-- Tabela: Usuários (8 linhas)
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (39, '2026-07-30T19:31:46.583873+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Marcelo Barroso', '5511930943626', '0', '1', 'Inativo', '2026-07-30T19:31:46.431+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (36, '2026-07-30T15:14:30.772697+00:00', '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', 'Hermani', '5533987140460', '0', '2', 'Inativo', '2026-07-30T16:46:41.299+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (38, '2026-07-30T17:32:18.024677+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Hermani', '5533987140460', '5', '4', 'Ativo', '2026-07-30T20:48:39.071+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (40, '2026-07-30T20:40:25.456329+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Robinho', '5533987303472', '4', '2', 'Ativo', '2026-07-30T20:49:53.475+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (41, '2026-07-30T22:43:56.246464+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Silvana', '5533991272357', '4', '1', 'Ativo', '2026-07-30T22:43:56.067+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (42, '2026-07-30T23:40:51.587457+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Henrique alves', '5533999073200', '4', '1', 'Ativo', '2026-07-30T23:40:51.443+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (43, '2026-07-30T23:41:00.562525+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Marcelo soares barroso camara', '5533999898844', '4', '1', 'Ativo', '2026-07-30T23:41:00.349+00:00', false) ON CONFLICT DO NOTHING;
INSERT INTO public."Usuários" ("id", "created_at", "id_restaurante", "nome", "telefone", "mesa_atual", "quantas_vezes_foi", "Status", "ultimo_checkin", "chat_humano") VALUES (44, '2026-07-30T23:41:10.610227+00:00', 'a976db0c-c1df-4b21-a836-3671f1a5bba9', 'Daniel Barroso', '5533998117250', '4', '1', 'Ativo', '2026-07-30T23:41:10.525+00:00', false) ON CONFLICT DO NOTHING;


-- Tabela: admin_acessos (1 linhas)
INSERT INTO public."admin_acessos" ("id", "created_at", "email", "senha") VALUES (1, '2026-07-07T13:14:21.315854+00:00', 'admin@pedeai.com', 'admin123') ON CONFLICT DO NOTHING;


-- Tabela: estoque_restaurantes (100 linhas)
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (125, 10, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '21', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (126, 11, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '23', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (128, 6, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '33', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (130, 12, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '23', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (131, 13, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '16', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (132, 14, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '12', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (133, 7, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '20', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (135, 4, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '17', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (137, 5, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '11', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (139, 83, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (140, 86, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '15', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (141, 85, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (143, 87, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (146, 101, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (147, 99, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (150, 93, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (151, 100, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (152, 98, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (154, 96, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (155, 90, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (157, 115, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (159, 117, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (160, 118, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (161, 128, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (163, 125, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (165, 126, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (166, 127, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (168, 78, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (169, 88, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (170, 75, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (172, 66, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (173, 73, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (174, 74, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (175, 68, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (176, 63, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (177, 62, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (178, 76, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (179, 71, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (180, 70, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (181, 77, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (182, 67, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (183, 69, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (184, 65, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (185, 72, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (186, 116, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (187, 103, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (190, 122, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (193, 112, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (196, 110, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (197, 107, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '2000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (198, 104, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (201, 44, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9995', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (202, 43, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9992', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (203, 45, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9989', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (204, 46, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (206, 49, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9984', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (207, 50, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9989', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (208, 48, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9996', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (209, 40, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (210, 42, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (211, 41, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (212, 39, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (213, 52, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (214, 56, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (215, 51, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (216, 53, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (217, 61, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (218, 60, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (219, 54, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (220, 58, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (221, 57, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (222, 55, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (223, 59, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (224, 31, 'cab44278-604e-483f-a7cd-373a9421a2f8', '10000', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (225, 28, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9984', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (226, 27, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9990', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (227, 29, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9989', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (228, 30, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9991', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (229, 19, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (230, 16, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9996', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (231, 26, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9998', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (144, 91, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1996', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (199, 105, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (171, 64, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1989', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (191, 120, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999998', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (148, 102, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1998', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (167, 119, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999997', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (200, 106, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1997', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (205, 47, 'cab44278-604e-483f-a7cd-373a9421a2f8', '9999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (145, 82, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1994', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (194, 109, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1998', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (153, 94, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1986', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (192, 108, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1998', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (164, 92, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (134, 8, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '12', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (129, 3, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '18', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (156, 89, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1996', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (127, 2, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '81', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (136, 9, '3795c3a1-2d85-46ad-a21b-1f29fa3eaeb4', '13', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public."estoque_restaurantes" ("id", "produto_id", "restaurante_id", "quantidade_atual", "created_at") VALUES (189, 123, 'a976db0c-c1df-4b21-a836-3671f1a5bba9', '1999997', '2026-07-07T16:30:30.117616+00:00') ON CONFLICT DO NOTHING;

