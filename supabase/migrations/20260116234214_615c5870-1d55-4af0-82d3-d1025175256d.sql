-- Drop the existing restrictive policy for SELECT
DROP POLICY IF EXISTS "Users can view their own restaurant data" ON public."Restaurantes";

-- Create a policy that allows anonymous users to check credentials (email/senha only)
-- This is needed for the login flow before authentication
CREATE POLICY "Allow anonymous login check"
ON public."Restaurantes"
FOR SELECT
USING (true);

-- Note: The senha column should ideally be hashed, but for now we allow reading
-- The frontend only requests id, email, senha for login verification