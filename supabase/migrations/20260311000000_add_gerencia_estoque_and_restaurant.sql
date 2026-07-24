-- Add gerencia_estoque to Restaurantes table
ALTER TABLE "Restaurantes" ADD COLUMN IF NOT EXISTS "gerencia_estoque" BOOLEAN DEFAULT TRUE;

-- Insert Restaurante Liderança
INSERT INTO "Restaurantes" (nome, email, senha, quantidade_mesas, quantidade_max_mesas, gerencia_estoque)
VALUES ('Liderança', 'fernandolidercachorroquente@gmail.com', 'lideranca2026', '10', '10', FALSE)
ON CONFLICT (email) DO NOTHING;
