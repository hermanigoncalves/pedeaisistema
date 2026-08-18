-- ========================================================
-- MIGRATION: EVOLUTION GO v3 - SUPABASE RESTAURANTES
-- ========================================================

-- 1. Garante que as colunas da Evolution Go existam
ALTER TABLE public."Restaurantes"
  ADD COLUMN IF NOT EXISTS evolution_instancia text,
  ADD COLUMN IF NOT EXISTS evolution_apikey text,
  ADD COLUMN IF NOT EXISTS evolution_instancia_delivery text,
  ADD COLUMN IF NOT EXISTS evolution_apikey_delivery text;

-- 2. Migração segura e dinâmica dos dados legados (trata waha_apikey e waha_api_key)
DO $$
DECLARE
  has_session boolean;
  has_apikey boolean;
  has_api_key boolean;
  has_session_del boolean;
  has_apikey_del boolean;
  has_api_key_del boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_session') INTO has_session;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_apikey') INTO has_apikey;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_api_key') INTO has_api_key;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_session_delivery') INTO has_session_del;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_apikey_delivery') INTO has_apikey_del;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'Restaurantes' AND column_name = 'waha_api_key_delivery') INTO has_api_key_del;

  -- Copia waha_session
  IF has_session THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_instancia = COALESCE(evolution_instancia, waha_session)';
  END IF;

  -- Copia waha_apikey ou waha_api_key
  IF has_apikey THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_apikey = COALESCE(evolution_apikey, waha_apikey)';
  ELSIF has_api_key THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_apikey = COALESCE(evolution_apikey, waha_api_key)';
  END IF;

  -- Copia waha_session_delivery
  IF has_session_del THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_instancia_delivery = COALESCE(evolution_instancia_delivery, waha_session_delivery)';
  END IF;

  -- Copia waha_apikey_delivery ou waha_api_key_delivery
  IF has_apikey_del THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_apikey_delivery = COALESCE(evolution_apikey_delivery, waha_apikey_delivery)';
  ELSIF has_api_key_del THEN
    EXECUTE 'UPDATE public."Restaurantes" SET evolution_apikey_delivery = COALESCE(evolution_apikey_delivery, waha_api_key_delivery)';
  END IF;

  -- Remove as colunas antigas
  IF has_session THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_session'; END IF;
  IF has_apikey THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_apikey'; END IF;
  IF has_api_key THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_api_key'; END IF;
  IF has_session_del THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_session_delivery'; END IF;
  IF has_apikey_del THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_apikey_delivery'; END IF;
  IF has_api_key_del THEN EXECUTE 'ALTER TABLE public."Restaurantes" DROP COLUMN IF EXISTS waha_api_key_delivery'; END IF;
END $$;
