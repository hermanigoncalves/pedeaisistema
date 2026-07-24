-- ============================================================
-- PEDEAI — MIGRATION: ADICIONAR ESTACAO NA TABELA SABORESPIZZA
-- ============================================================
-- Executar no SQL Editor do Dashboard do Supabase
-- ============================================================

ALTER TABLE "SaboresPizza" ADD COLUMN IF NOT EXISTS "estacao" TEXT DEFAULT 'kitchen';
