-- ===========================================
-- SECURITY FIX: Migrate to proper authentication and RLS
-- ===========================================

-- Step 1: Create helper function to check restaurant ownership
-- Using SECURITY DEFINER to avoid recursive RLS issues
CREATE OR REPLACE FUNCTION public.is_restaurant_owner(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "Restaurantes"
    WHERE id = restaurant_uuid
      AND id = auth.uid()
  );
$$;

-- Step 2: Create helper function for products ownership check
CREATE OR REPLACE FUNCTION public.owns_product_restaurant(product_restaurante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_restaurante_id = auth.uid();
$$;

-- Step 3: Create helper function for orders ownership check  
CREATE OR REPLACE FUNCTION public.owns_order_restaurant(order_restaurante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT order_restaurante_id = auth.uid();
$$;

-- ===========================================
-- RLS POLICIES FOR RESTAURANTES
-- ===========================================

-- Allow restaurants to read their own data
CREATE POLICY "Restaurants can view own data"
ON "Restaurantes" FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow restaurants to update their own data
CREATE POLICY "Restaurants can update own data"
ON "Restaurantes" FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow new restaurant creation during signup (id matches auth.uid)
CREATE POLICY "Users can create their restaurant profile"
ON "Restaurantes" FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ===========================================
-- RLS POLICIES FOR PRODUTOS
-- ===========================================

-- Allow viewing own products
CREATE POLICY "Restaurants can view own products"
ON "Produtos" FOR SELECT
TO authenticated
USING (public.owns_product_restaurant(restaurante_id));

-- Allow creating products for own restaurant
CREATE POLICY "Restaurants can create own products"
ON "Produtos" FOR INSERT
TO authenticated
WITH CHECK (public.owns_product_restaurant(restaurante_id));

-- Allow updating own products
CREATE POLICY "Restaurants can update own products"
ON "Produtos" FOR UPDATE
TO authenticated
USING (public.owns_product_restaurant(restaurante_id))
WITH CHECK (public.owns_product_restaurant(restaurante_id));

-- Allow deleting own products
CREATE POLICY "Restaurants can delete own products"
ON "Produtos" FOR DELETE
TO authenticated
USING (public.owns_product_restaurant(restaurante_id));

-- ===========================================
-- RLS POLICIES FOR PEDIDOS
-- ===========================================

-- Allow viewing own orders
CREATE POLICY "Restaurants can view own orders"
ON "Pedidos" FOR SELECT
TO authenticated
USING (public.owns_order_restaurant(restaurante_id));

-- Allow creating orders for own restaurant
CREATE POLICY "Restaurants can create own orders"
ON "Pedidos" FOR INSERT
TO authenticated
WITH CHECK (public.owns_order_restaurant(restaurante_id));

-- Allow updating own orders
CREATE POLICY "Restaurants can update own orders"
ON "Pedidos" FOR UPDATE
TO authenticated
USING (public.owns_order_restaurant(restaurante_id))
WITH CHECK (public.owns_order_restaurant(restaurante_id));

-- Allow deleting own orders
CREATE POLICY "Restaurants can delete own orders"
ON "Pedidos" FOR DELETE
TO authenticated
USING (public.owns_order_restaurant(restaurante_id));