-- Este script adiciona a coluna `taxa_servico` na tabela `Restaurantes`.
-- Ele deve ser executado no SQL Editor do Supabase (Dashboard)
-- para permitir que as configurações de taxa de serviço sejam salvas.

ALTER TABLE "Restaurantes" 
ADD COLUMN IF NOT EXISTS "taxa_servico" NUMERIC DEFAULT 0;

-- Observação: Adicionamos o "IF NOT EXISTS" para que, caso a 
-- coluna já tenha sido criada, o comando não retorne erro.
