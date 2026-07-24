-- Add order description field (optional)
ALTER TABLE public."Pedidos"
ADD COLUMN IF NOT EXISTS descricao text;