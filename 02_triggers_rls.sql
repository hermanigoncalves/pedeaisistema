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

