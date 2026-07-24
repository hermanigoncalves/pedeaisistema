-- ============================================================
-- Migration: Adicionar ultimo_checkin na tabela Usuários
-- Data: 2026-07-08
-- Descrição: Armazena o timestamp do último check-in do cliente,
--            usado para determinar se a mesa está ocupada.
--            Corrige o bug onde clientes recorrentes (created_at antigo)
--            tinham seu check-in ignorado como "órfão".
-- ============================================================

ALTER TABLE "Usuários"
ADD COLUMN IF NOT EXISTS "ultimo_checkin" TIMESTAMPTZ;

COMMENT ON COLUMN "Usuários"."ultimo_checkin"
IS 'Timestamp do último check-in do cliente. Usado pelo dashboard para determinar mesas ocupadas.';

-- Backfill: para registros existentes com mesa_atual preenchida, setar ultimo_checkin = now()
UPDATE "Usuários"
SET "ultimo_checkin" = NOW()
WHERE "mesa_atual" IS NOT NULL AND "mesa_atual" != '0' AND "mesa_atual" != '';
