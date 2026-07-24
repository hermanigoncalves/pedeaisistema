-- Script to add 10,000 units of stock to all products of Restaurante Liderança
DO $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    SELECT id INTO v_restaurant_id FROM "Restaurantes" WHERE email = 'fernandolidercachorroquente@gmail.com';

    IF v_restaurant_id IS NOT NULL THEN
        UPDATE "Produtos" 
        SET estoque = 10000 
        WHERE restaurante_id = v_restaurant_id;
        
        RAISE NOTICE 'Estoque de 10.000 unidades adicionado a todos os produtos do restaurante Liderança.';
    ELSE
        RAISE EXCEPTION 'Restaurante Liderança não encontrado. Verifique se o restaurante foi criado.';
    END IF;
END $$;
