-- ============================================================
-- MIGRATION: Módulo de Entregas & Dispatch Delivery
-- ============================================================

-- 1. TABELA: delivery_persons (Entregadores)
CREATE TABLE IF NOT EXISTS public.delivery_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  telefone VARCHAR(20) NOT NULL,
  
  -- Veículo
  veiculo_tipo TEXT NOT NULL CHECK (veiculo_tipo IN ('moto', 'bicicleta', 'carro')),
  veiculo_placa VARCHAR(10),
  
  -- Documentos (URLs no Supabase Storage)
  documento_frente_url TEXT,
  documento_verso_url TEXT,
  selfie_documento_url TEXT,
  
  -- Preferências
  app_navegacao TEXT DEFAULT 'google_maps' CHECK (app_navegacao IN ('google_maps', 'waze')),
  
  -- Status de Cadastro
  status_cadastro TEXT DEFAULT 'pendente_aprovacao' 
    CHECK (status_cadastro IN ('pendente_aprovacao', 'aprovado', 'rejeitado', 'suspenso')),
  motivo_rejeicao TEXT,
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  
  -- Status Operacional
  status_operacional TEXT DEFAULT 'offline' 
    CHECK (status_operacional IN ('offline', 'disponivel', 'em_entrega')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_delivery_persons_user_id ON public.delivery_persons(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_persons_status_cadastro ON public.delivery_persons(status_cadastro);
CREATE INDEX IF NOT EXISTS idx_delivery_persons_status_operacional ON public.delivery_persons(status_operacional);

-- 2. TABELA: delivery_person_stores (Vínculo Entregador ↔ Loja)
CREATE TABLE IF NOT EXISTS public.delivery_person_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id UUID NOT NULL REFERENCES public.delivery_persons(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
  vinculado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(delivery_person_id, store_id)
);

-- 3. TABELA: delivery_requests (Chamadas de Entrega / Dispatch)
CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  
  status TEXT DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'aceito', 'expirado', 'cancelado')),
  
  codigo_retirada VARCHAR(6),
  retirada_validada BOOLEAN DEFAULT false,
  retirada_tentativas INTEGER DEFAULT 0,
  retirado_em TIMESTAMPTZ,
  
  accepted_by UUID REFERENCES public.delivery_persons(id),
  accepted_at TIMESTAMPTZ,
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA: entregador_locations (Rastreamento GPS em Tempo Real)
CREATE TABLE IF NOT EXISTS public.entregador_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id UUID NOT NULL REFERENCES public.delivery_persons(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Função de código de retirada seguro (6 dígitos alfanuméricos)
CREATE OR REPLACE FUNCTION generate_pickup_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
