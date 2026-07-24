-- Migração: Configurações de SaaS Multi-tenant e Customização de IA
-- Objetivo: Adicionar campos de credenciais da Evolution Go e comportamento de IA para cada restaurante.

ALTER TABLE "public"."Restaurantes" 
  ADD COLUMN IF NOT EXISTS "evolution_instancia" TEXT,
  ADD COLUMN IF NOT EXISTS "evolution_apikey" TEXT,
  ADD COLUMN IF NOT EXISTS "personalidade_agente" TEXT,
  ADD COLUMN IF NOT EXISTS "exemplos_conversa" TEXT,
  ADD COLUMN IF NOT EXISTS "regras_estabelecimento" TEXT;
