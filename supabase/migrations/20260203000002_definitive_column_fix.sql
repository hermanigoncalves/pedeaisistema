-- Definitive fix for Restaurantes table schema cache and column names
-- Run this in the Supabase SQL Editor

-- 1. Ensure the column names match what the AppContext.tsx is sending
DO $$ 
BEGIN 
    -- Rename if the old name exists and new one doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Restaurantes' AND column_name='quantidade_max_mesas') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Restaurantes' AND column_name='quantidade_mesas') THEN
        ALTER TABLE public."Restaurantes" RENAME COLUMN "quantidade_max_mesas" TO "quantidade_mesas";
    END IF;
END $$;

-- 2. Add all missing columns for settings
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "horario_abertura" TEXT,
ADD COLUMN IF NOT EXISTS "horario_fechamento" TEXT,
ADD COLUMN IF NOT EXISTS "fechar_mesa_auto" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alertas_piscantes" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "sons_habilitados" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "alerta_estoque_baixo" INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS "alerta_estoque_critico" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;

-- 3. Ensure quantity column is TEXT or INT as expected by code (code treats it as string then parses)
-- If it was created as another type, we ensure it's compatible
ALTER TABLE public."Restaurantes" ALTER COLUMN "quantidade_mesas" TYPE TEXT;

-- 4. CRITICAL: Force reload of schema cache across all instances
NOTIFY pgrst, 'reload schema';
