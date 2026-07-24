-- Criação da tabela de Mensagens
CREATE TABLE IF NOT EXISTS public."Mensagens" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public."Usuários"(id) ON DELETE CASCADE,
    restaurante_id uuid REFERENCES public."Restaurantes"(id) ON DELETE CASCADE,
    conteudo text NOT NULL,
    remetente_tipo text CHECK (remetente_tipo IN ('cliente', 'bot', 'restaurante')) NOT NULL,
    lida boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Habilitar Realtime para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public."Mensagens";

-- Segurança (RLS)
ALTER TABLE public."Mensagens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurantes podem ver suas mensagens"
ON public."Mensagens" FOR SELECT
TO authenticated
USING (restaurante_id = auth.uid());

CREATE POLICY "Bot ou Restaurante podem inserir mensagens"
ON public."Mensagens" FOR INSERT
TO authenticated
WITH CHECK (restaurante_id = auth.uid());

-- Exemplo de dados para teste (opcional):
-- INSERT INTO public."Mensagens" (cliente_id, restaurante_id, conteudo, remetente_tipo)
-- SELECT id, id_restaurante, 'Olá! Gostaria de fazer um pedido.', 'cliente'
-- FROM public."Usuários" LIMIT 1;
