-- ============================================================
-- Migration: Adicionar modo_cobranca na tabela Restaurantes
-- Data: 2026-07-08
-- Descrição: Permite configurar se o restaurante trabalha com
--            conta por mesa (padrão) ou comanda individual.
-- ============================================================

ALTER TABLE "Restaurantes"
ADD COLUMN IF NOT EXISTS "modo_cobranca" TEXT DEFAULT 'mesa';

COMMENT ON COLUMN "Restaurantes"."modo_cobranca" 
IS 'Modo de cobrança: "mesa" (conta única por mesa) ou "comanda" (conta individual por check-in)';
