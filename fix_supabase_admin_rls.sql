-- ==============================================================================
-- FIX SUPABASE PERMISSIONS (RLS) & CONFIGURAÇÕES GLOBAIS
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


-- 2. TABELA DE RESTAURANTES (Permissões de Leitura, Criação e Atualização)
ALTER TABLE public."Restaurantes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de Restaurantes" ON public."Restaurantes";
CREATE POLICY "Permitir leitura de Restaurantes" ON public."Restaurantes"
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir inserção e atualização de Restaurantes" ON public."Restaurantes";
CREATE POLICY "Permitir inserção e atualização de Restaurantes" ON public."Restaurantes"
    FOR ALL TO public USING (true) WITH CHECK (true);


-- 3. TABELA DE ADMIN ACESSOS
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
