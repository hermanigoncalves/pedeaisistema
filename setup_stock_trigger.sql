
-- Função para processar a string de itens e diminuir o estoque
CREATE OR REPLACE FUNCTION public.baixar_estoque_pedido_v3()
RETURNS TRIGGER AS $$
DECLARE
    item_nome TEXT;
    item_lista TEXT[];
BEGIN
    -- Se não houver itens, não faz nada
    IF NEW.itens IS NULL OR NEW.itens = '' THEN
        RETURN NEW;
    END IF;

    -- Converte a string "Item 1, Item 2" em um array de strings
    -- Remove espaços em branco ao redor de cada item e separa por vírgula
    item_lista := string_to_array(NEW.itens, ',');

    FOREACH item_nome IN ARRAY item_lista LOOP
        -- Tenta atualizar o estoque do produto pelo nome dentro do mesmo restaurante
        -- O TRIM remove espaços que podem sobrar da separação por vírgula
        UPDATE public."Produtos"
        SET estoque = GREATEST(0, COALESCE(estoque, 0) - 1)
        WHERE TRIM(nome) = TRIM(item_nome)
          AND restaurante_id = NEW.restaurante_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que dispara APÓS a inserção de um pedido
DROP TRIGGER IF EXISTS trg_baixar_estoque_on_pedido ON public."Pedidos";

CREATE TRIGGER trg_baixar_estoque_on_pedido
AFTER INSERT ON public."Pedidos"
FOR EACH ROW
EXECUTE FUNCTION public.baixar_estoque_pedido_v3();
