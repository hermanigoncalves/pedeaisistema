-- Script to insert products for Restaurante Liderança
-- First, get the ID of the restaurant (assuming it was created with email 'fernandolidercachorroquente@gmail.com')

DO $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    SELECT id INTO v_restaurant_id FROM "Restaurantes" WHERE email = 'fernandolidercachorroquente@gmail.com';

    IF v_restaurant_id IS NOT NULL THEN
        -- LANCHE
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Misto Quente', 13.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Hamburguer', 15.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Burguer', 16.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Egg', 17.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Americano', 18.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Bacon', 20.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Egg Bacon', 22.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Tudo', 24.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Calabresa Tudo', 26.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Filé Tudo', 28.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'X-Bagunça', 30.00, 'Lanche', 'kitchen', true),
        (v_restaurant_id, 'Laricão', 55.00, 'Lanche', 'kitchen', true);

        -- HOT DOG
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Tradicional', 8.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Dogão', 9.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Tridogão', 10.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'X-Pança de Mamute', 18.00, 'Hot Dog', 'kitchen', true),
        (v_restaurant_id, 'Adicional (Queijo Cheddar ou Bacon)', 4.00, 'Hot Dog', 'kitchen', true);

        -- PORÇÕES
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Carne de Sol', 60.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Filé de Tilápia', 45.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Coxinha de Asa Empanada', 40.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Nuggets de Frango', 40.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Batata Express', 28.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Toresmo', 15.00, 'Porção', 'kitchen', true),
        (v_restaurant_id, 'Pastéis', 15.00, 'Porção', 'kitchen', true);

        -- COMBOS
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Super Combo Liderança', 60.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Combo Família', 70.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Porção de Calabresa', 40.00, 'Combo', 'kitchen', true),
        (v_restaurant_id, 'Combo Individual', 37.00, 'Combo', 'kitchen', true);

        -- BEBIDAS
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Água Mineral (500ml)', 4.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Água com Gás (500ml)', 5.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Coca Cola (Lata 350ml)', 6.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Guaraná Antártica (Lata 350ml)', 6.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante (500ml)', 7.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Suco Natural', 7.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante 1L (Guaraná ou Coca Cola)', 10.00, 'Bebida', 'bar', true),
        (v_restaurant_id, 'Refrigerante 2L (Coca Cola ou Fanta)', 15.00, 'Bebida', 'bar', true);

        -- DRINK'S
        INSERT INTO "Produtos" (restaurante_id, nome, preco, categoria, estacao, ativo) VALUES
        (v_restaurant_id, 'Canelinha (Dose)', 4.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Cachaça (Dose)', 4.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Conhaque Dreer (Dose)', 5.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Gelo Saborizado (Unidade)', 6.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Vodka Orloff (Dose)', 8.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Campari (Dose)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Vinho (Taça)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Gin (Dose)', 10.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Whisky (Dose)', 15.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Copão 500 ml (Vodka, Gelo, Energético)', 15.00, 'Drink', 'bar', true),
        (v_restaurant_id, 'Copão 500 ml (Gelo Saborizado)', 20.00, 'Drink', 'bar', true);

        RAISE NOTICE 'Produtos inseridos com sucesso para o restaurante Liderança.';
    ELSE
        RAISE EXCEPTION 'Restaurante Liderança não encontrado. Verifique se a migração anterior foi executada.';
    END IF;
END $$;
