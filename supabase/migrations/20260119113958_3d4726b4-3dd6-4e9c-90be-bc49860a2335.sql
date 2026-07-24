-- Drop existing RLS policies on Produtos
DROP POLICY IF EXISTS "Restaurants can create own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can delete own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can update own products" ON public."Produtos";
DROP POLICY IF EXISTS "Restaurants can view own products" ON public."Produtos";

-- Create new policies that check restaurante_id exists in Restaurantes table
-- SELECT: Allow viewing products with valid restaurant
CREATE POLICY "Allow view products with valid restaurant"
ON public."Produtos"
FOR SELECT
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- INSERT: Allow inserting products with valid restaurant
CREATE POLICY "Allow insert products with valid restaurant"
ON public."Produtos"
FOR INSERT
WITH CHECK (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- UPDATE: Allow updating products with valid restaurant
CREATE POLICY "Allow update products with valid restaurant"
ON public."Produtos"
FOR UPDATE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);

-- DELETE: Allow deleting products with valid restaurant
CREATE POLICY "Allow delete products with valid restaurant"
ON public."Produtos"
FOR DELETE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM "Restaurantes" 
    WHERE "Restaurantes".id = "Produtos".restaurante_id
  )
);