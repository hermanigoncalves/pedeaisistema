-- Migração: Adicionar coluna chat_humano na tabela Usuários
-- Objetivo: Permitir que o atendente assuma a conversa manualmente,
--           desativando as respostas automáticas da IA para aquele cliente.
-- Execução: Rode este SQL no console SQL do Supabase.

ALTER TABLE "public"."Usuários" ADD COLUMN IF NOT EXISTS "chat_humano" BOOLEAN DEFAULT false;
