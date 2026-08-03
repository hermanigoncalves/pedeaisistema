-- ====================================================================
-- Migração: Garantir a existência e permissões do Bucket 'media' no Supabase Storage
-- ====================================================================

-- 1. Criar o bucket 'media' se não existir e garantir que seja público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 52428800, ARRAY['audio/ogg', 'audio/webm', 'audio/mpeg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Garantir políticas RLS de Leitura e Escrita Públicas na tabela storage.objects para o bucket 'media'
DROP POLICY IF EXISTS "Media Bucket Public Read" ON storage.objects;
CREATE POLICY "Media Bucket Public Read" ON storage.objects
FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Media Bucket Public Insert" ON storage.objects;
CREATE POLICY "Media Bucket Public Insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Media Bucket Public Update" ON storage.objects;
CREATE POLICY "Media Bucket Public Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Media Bucket Public Delete" ON storage.objects;
CREATE POLICY "Media Bucket Public Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'media');
