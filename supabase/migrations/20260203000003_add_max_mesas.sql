-- Adiciona a coluna de limite contratado de mesas
ALTER TABLE public."Restaurantes" ADD COLUMN IF NOT EXISTS "max_mesas" TEXT DEFAULT '50';

-- Força a atualização do cache do esquema
NOTIFY pgrst, 'reload schema';
