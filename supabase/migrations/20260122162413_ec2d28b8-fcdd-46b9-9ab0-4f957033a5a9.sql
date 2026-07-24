DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No select on Usuarios'
  ) THEN
    EXECUTE 'CREATE POLICY "No select on Usuarios" ON public."Usuários" FOR SELECT USING (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No insert on Usuarios'
  ) THEN
    EXECUTE 'CREATE POLICY "No insert on Usuarios" ON public."Usuários" FOR INSERT WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No update on Usuarios'
  ) THEN
    EXECUTE 'CREATE POLICY "No update on Usuarios" ON public."Usuários" FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Usuários' AND policyname = 'No delete on Usuarios'
  ) THEN
    EXECUTE 'CREATE POLICY "No delete on Usuarios" ON public."Usuários" FOR DELETE USING (false)';
  END IF;
END
$$;