-- Migration to add impressao_auto column to Restaurantes table
ALTER TABLE public."Restaurantes" 
ADD COLUMN IF NOT EXISTS "impressao_auto" BOOLEAN DEFAULT false;
