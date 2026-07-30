-- Migration: Adicionar suporte a colunas WAHA na tabela Restaurantes
-- Permite configurar a Sessão e API Key do WAHA por restaurante.

ALTER TABLE "Restaurantes"
  ADD COLUMN IF NOT EXISTS "waha_session" TEXT,
  ADD COLUMN IF NOT EXISTS "waha_apikey" TEXT,
  ADD COLUMN IF NOT EXISTS "waha_session_delivery" TEXT,
  ADD COLUMN IF NOT EXISTS "waha_apikey_delivery" TEXT;

COMMENT ON COLUMN "Restaurantes"."waha_session" IS 'Nome da sessão configurada no WAHA (ex: default)';
COMMENT ON COLUMN "Restaurantes"."waha_apikey" IS 'Chave de API do WAHA para esta instância';
COMMENT ON COLUMN "Restaurantes"."waha_session_delivery" IS 'Nome da sessão WAHA exclusiva para Delivery';
COMMENT ON COLUMN "Restaurantes"."waha_apikey_delivery" IS 'Chave de API WAHA para a sessão Delivery';
