-- Migração: Adicionar coluna meia_pizza_habilitada na tabela Restaurantes
-- Objetivo: Permitir habilitar/desabilitar o recurso de Meia Pizza (meio a meia)
-- Execução: Execute este SQL no editor SQL do Supabase.

ALTER TABLE "public"."Restaurantes" ADD COLUMN IF NOT EXISTS "meia_pizza_habilitada" BOOLEAN DEFAULT false;
