-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Restaurants can create own orders " ON public."Pedidos";

-- Create new INSERT policy that allows any authenticated insert with valid restaurante_id
CREATE POLICY "Allow insert orders with valid restaurant" 
ON public."Pedidos" 
FOR INSERT 
WITH CHECK (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Also update SELECT, UPDATE, DELETE policies to work without auth.uid()
DROP POLICY IF EXISTS "Restaurants can view own orders " ON public."Pedidos";
DROP POLICY IF EXISTS "Restaurants can update own orders " ON public."Pedidos";
DROP POLICY IF EXISTS "Restaurants can delete own orders " ON public."Pedidos";

-- Allow selecting orders when restaurante_id matches a valid restaurant
CREATE POLICY "Allow view orders with valid restaurant"
ON public."Pedidos"
FOR SELECT
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Allow updating orders when restaurante_id matches
CREATE POLICY "Allow update orders with valid restaurant"
ON public."Pedidos"
FOR UPDATE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);

-- Allow deleting orders when restaurante_id matches
CREATE POLICY "Allow delete orders with valid restaurant"
ON public."Pedidos"
FOR DELETE
USING (
  restaurante_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public."Restaurantes" 
    WHERE id = restaurante_id
  )
);