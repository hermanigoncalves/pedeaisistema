-- ============================================================
-- MIGRATION: Habilitar Módulo Delivery e Configurações Dedicadas do Agente Delivery
-- ============================================================

ALTER TABLE "Restaurantes" 
ADD COLUMN IF NOT EXISTS "delivery_habilitado" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "evolution_instancia_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "evolution_apikey_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "personalidade_agente_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "regras_estabelecimento_delivery" TEXT,
ADD COLUMN IF NOT EXISTS "exemplos_conversa_delivery" TEXT;
