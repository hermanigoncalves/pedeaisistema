-- ============================================================
-- PEDEAI — MIGRATION: HABILITAR REALTIME PARA A TABELA MENSAGENS
-- ============================================================
-- Executar no SQL Editor do Dashboard do Supabase
-- ============================================================

-- 1. Alterar a identidade de réplica para FULL para garantir que o realtime envie todos os dados
ALTER TABLE "mensagens" REPLICA IDENTITY FULL;

-- 2. Habilitar Publicações em Tempo Real (Realtime) para a tabela de mensagens
-- Se a publicação já existir, adicionamos a tabela nela.
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE "mensagens";
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN 
        NULL; -- Ignorar erro se a tabela já estiver na publicação
END $$;
