-- SCRIPT AUTOMÁTICO PARA SINCRONIZAR TODAS AS SEQUENCES DO SCHEMA PUBLIC NO SUPABASE
-- Este script localiza dinamicamente todas as sequences e atualiza para o MAX(id) real de cada tabela existente.

DO $$
DECLARE
    rec RECORD;
    max_val BIGINT;
    sql_text TEXT;
BEGIN
    FOR rec IN
        SELECT 
            s.relname AS seq_name,
            t.relname AS table_name,
            a.attname AS column_name
        FROM pg_class s
        JOIN pg_namespace ns ON ns.oid = s.relnamespace
        JOIN pg_depend d ON d.objid = s.oid
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_attribute a ON (a.attrelid = d.refobjid AND a.attnum = d.refobjsubid)
        WHERE s.relkind = 'S' 
          AND ns.nspname = 'public'
    LOOP
        -- Obter o maior valor atual da coluna
        sql_text := format('SELECT COALESCE(MAX(%I), 1) FROM public.%I', rec.column_name, rec.table_name);
        EXECUTE sql_text INTO max_val;
        
        -- Atualizar a sequence para o maior valor
        PERFORM setval(format('public.%I', rec.seq_name)::regclass, max_val);
        RAISE NOTICE 'Sequence % (Tabela %.%) atualizada para %', rec.seq_name, rec.table_name, rec.column_name, max_val;
    END LOOP;
END $$;
