-- ============================================================
-- PEDEAI — MIGRATION: ADICIONAR ESTOQUE NA TABELA SABORESPIZZA
-- ============================================================
-- Executar no SQL Editor do Dashboard do Supabase
-- ============================================================

ALTER TABLE "SaboresPizza" ADD COLUMN IF NOT EXISTS "estoque" INTEGER DEFAULT 0;
ALTER TABLE "SaboresPizza" ADD COLUMN IF NOT EXISTS "estoque_minimo" INTEGER DEFAULT 10;
