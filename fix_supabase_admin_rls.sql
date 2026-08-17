-- ==============================================================================
-- FIX SUPABASE PERMISSIONS (RLS COMPLETO) & CONFIGURAÇÕES GLOBAIS
-- Execute este script no SQL Editor do seu Dashboard Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. TABELA DE CONFIGURAÇÕES GLOBAIS
CREATE TABLE IF NOT EXISTS public."ConfiguracoesGlobais" (
    id INT PRIMARY KEY,
    prompt_geral TEXT,
    prompt_vendas TEXT,
    prompt_servico TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public."ConfiguracoesGlobais" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de configurações globais" ON public."ConfiguracoesGlobais";
CREATE POLICY "Leitura pública de configurações globais" ON public."ConfiguracoesGlobais"
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Edição pública de configurações globais" ON public."ConfiguracoesGlobais";
CREATE POLICY "Edição pública de configurações globais" ON public."ConfiguracoesGlobais"
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Garantir que a linha com id = 1 exista
INSERT INTO public."ConfiguracoesGlobais" (id, prompt_geral, prompt_vendas, prompt_servico)
VALUES (
    1,
    '# PEDEAI — GARÇOM DIGITAL\nVocê é o Garçom Digital do restaurante. Seja cordial, ágil e prestativo.',
    '# ESPECIALISTA EM VENDAS\nApresente os itens do cardápio com clareza e destaque os diferenciais da casa.',
    '# ESPECIALISTA EM SERVIÇOS\nAjude o cliente com o status dos pedidos e no fechamento da conta.'
)
ON CONFLICT (id) DO NOTHING;


-- 2. TABELA DE RESTAURANTES
ALTER TABLE public."Restaurantes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de Restaurantes" ON public."Restaurantes";
DROP POLICY IF EXISTS "Restaurants can view own data" ON public."Restaurantes";
DROP POLICY IF EXISTS "Allow anonymous login check" ON public."Restaurantes";
CREATE POLICY "Permitir leitura de Restaurantes" ON public."Restaurantes"
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir inserção e atualização de Restaurantes" ON public."Restaurantes";
DROP POLICY IF EXISTS "Restaurants can update own data" ON public."Restaurantes";
DROP POLICY IF EXISTS "Users can create their restaurant profile" ON public."Restaurantes";
CREATE POLICY "Permitir inserção e atualização de Restaurantes" ON public."Restaurantes"
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 3. TABELA DE USUÁRIOS (CLIENTES) - Remove bloqueios antigos e libera acesso
ALTER TABLE public."Usuários" ENABLE ROW LEVEL SECURITY;

-- Remover políticas restritivas antigas
DROP POLICY IF EXISTS "No select on Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "No insert on Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "No update on Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "No delete on Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "Allow all on Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "Permitir leitura de Usuarios" ON public."Usuários";
DROP POLICY IF EXISTS "Permitir gerenciamento de Usuarios" ON public."Usuários";

CREATE POLICY "Permitir leitura de Usuarios" ON public."Usuários"
    FOR SELECT TO public USING (true);

CREATE POLICY "Permitir gerenciamento de Usuarios" ON public."Usuários"
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 4. TABELA DE PEDIDOS
ALTER TABLE public."Pedidos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurants can view own orders" ON public."Pedidos";
DROP POLICY IF EXISTS "Allow view orders with valid restaurant" ON public."Pedidos";
DROP POLICY IF EXISTS "Allow all on Pedidos" ON public."Pedidos";
DROP POLICY IF EXISTS "Permitir leitura de Pedidos" ON public."Pedidos";
DROP POLICY IF EXISTS "Permitir gerenciamento de Pedidos" ON public."Pedidos";

CREATE POLICY "Permitir leitura de Pedidos" ON public."Pedidos"
    FOR SELECT TO public USING (true);

CREATE POLICY "Permitir gerenciamento de Pedidos" ON public."Pedidos"
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 5. TABELA DE PRODUTOS
ALTER TABLE public."Produtos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurants can view own products" ON public."Produtos";
DROP POLICY IF EXISTS "Allow view products with valid restaurant" ON public."Produtos";
DROP POLICY IF EXISTS "Allow all on Produtos" ON public."Produtos";
DROP POLICY IF EXISTS "Permitir leitura de Produtos" ON public."Produtos";
DROP POLICY IF EXISTS "Permitir gerenciamento de Produtos" ON public."Produtos";

CREATE POLICY "Permitir leitura de Produtos" ON public."Produtos"
    FOR SELECT TO public USING (true);

CREATE POLICY "Permitir gerenciamento de Produtos" ON public."Produtos"
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 6. TABELA DE MENSAGENS
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Mensagens') THEN
        ALTER TABLE public."Mensagens" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Restaurantes podem ver suas mensagens" ON public."Mensagens";
        DROP POLICY IF EXISTS "Bot ou Restaurante podem inserir mensagens" ON public."Mensagens";
        DROP POLICY IF EXISTS "Permitir tudo em Mensagens" ON public."Mensagens";
        CREATE POLICY "Permitir tudo em Mensagens" ON public."Mensagens" FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 7. TABELA DE ADMIN ACESSOS
CREATE TABLE IF NOT EXISTS public.admin_acessos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de admin_acessos" ON public.admin_acessos;
CREATE POLICY "Permitir leitura de admin_acessos" ON public.admin_acessos
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir gestão de admin_acessos" ON public.admin_acessos;
CREATE POLICY "Permitir gestão de admin_acessos" ON public.admin_acessos
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 8. TABELAS ADICIONAIS (Impressoras, Categorias, Estações, Sabores, Estoque)
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Impressoras') THEN
        ALTER TABLE public."Impressoras" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on Impressoras" ON public."Impressoras";
        CREATE POLICY "Allow all on Impressoras" ON public."Impressoras" FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categorias_restaurante') THEN
        ALTER TABLE public.categorias_restaurante ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on categorias_restaurante" ON public.categorias_restaurante;
        CREATE POLICY "Allow all on categorias_restaurante" ON public.categorias_restaurante FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'estacoes_restaurante') THEN
        ALTER TABLE public.estacoes_restaurante ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on estacoes_restaurante" ON public.estacoes_restaurante;
        CREATE POLICY "Allow all on estacoes_restaurante" ON public.estacoes_restaurante FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'SaboresPizza') THEN
        ALTER TABLE public."SaboresPizza" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on SaboresPizza" ON public."SaboresPizza";
        CREATE POLICY "Allow all on SaboresPizza" ON public."SaboresPizza" FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Macarroes') THEN
        ALTER TABLE public."Macarroes" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on Macarroes" ON public."Macarroes";
        CREATE POLICY "Allow all on Macarroes" ON public."Macarroes" FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'estoque_restaurantes') THEN
        ALTER TABLE public.estoque_restaurantes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all on estoque_restaurantes" ON public.estoque_restaurantes;
        CREATE POLICY "Allow all on estoque_restaurantes" ON public.estoque_restaurantes FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;
