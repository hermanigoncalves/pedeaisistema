-- Migration: Adicionar configurações de Couvert Artístico na tabela Restaurantes
-- Execute este script no SQL Editor do painel do Supabase.

ALTER TABLE "Restaurantes" 
ADD COLUMN IF NOT EXISTS "couvert_habilitado" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "couvert_valor" NUMERIC DEFAULT 0;

COMMENT ON COLUMN "Restaurantes"."couvert_habilitado" IS 'Indica se a cobrança de couvert artístico está ativa nas contas';
COMMENT ON COLUMN "Restaurantes"."couvert_valor" IS 'Valor fixo em reais (R$) cobrado por couvert artístico';
