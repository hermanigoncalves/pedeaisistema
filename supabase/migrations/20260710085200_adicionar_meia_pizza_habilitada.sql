-- Migração: Adicionar coluna meia_pizza_habilitada na tabela Restaurantes
-- Objetivo: Permitir habilitar/desabilitar o recurso de Meia Pizza (meio a meia)

ALTER TABLE "public"."Restaurantes" ADD COLUMN IF NOT EXISTS "meia_pizza_habilitada" BOOLEAN DEFAULT false;
