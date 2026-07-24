-- =================================================================
-- PEDEAI — MIGRATION: CONFIGURAÇÃO DE PRECIFICAÇÃO DE PIZZA MEIA-A-MEIA
-- =================================================================
-- Executar no SQL Editor do Dashboard do Supabase
-- =================================================================

ALTER TABLE "Restaurantes" ADD COLUMN IF NOT EXISTS "cobranca_meio_a_meio" TEXT DEFAULT 'mais_cara';
