-- Comprehensive migration to ensure all required columns exist in Restaurantes table
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "horario_abertura" TEXT,
ADD COLUMN IF NOT EXISTS "horario_fechamento" TEXT,
ADD COLUMN IF NOT EXISTS "fechar_mesa_auto" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alertas_piscantes" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "sons_habilitados" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alerta_estoque_baixo" INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS "alerta_estoque_critico" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;

-- Force reload of Postgrest schema cache
NOTIFY pgrst, 'reload schema';
