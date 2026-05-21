-- Migration: Cardápio da filial Feira-Candangolândia + opções de preparo de sucos
-- Date: 2026-05-21
-- Notes:
--   * Cria a filial "Feira-Candangolândia" (code='FC', slug='feira-candangolandia').
--   * Popula categorias, produtos, ingredientes e vínculos a partir do cardápio
--     entregue pelo Marcos (11 crepes + 3 bebidas, embalagem viagem R$0,50).
--   * Cria adicionais R$0 ("Com açúcar", "Sem açúcar", "Com adoçante", "Sem gelo")
--     na Loja Principal e vincula aos sucos para que o atendente registre o preparo.
--   * Idempotente: as inserções são protegidas por ON CONFLICT e NOT EXISTS.

-- ============================================================================
-- 1. Filial Feira-Candangolândia
--    Cria apenas se ainda não houver uma filial com esse slug.
-- ============================================================================
INSERT INTO branches (code, slug, name, type, active, packing_fee, ordering_enabled)
SELECT 'FC', 'feira-candangolandia', 'Feira Candangolândia', 'FAIR', TRUE, 0.50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'feira-candangolandia');

-- ============================================================================
-- 2. Cardápio da Feira-Candangolândia
-- ============================================================================
DO $$
DECLARE
  v_branch_id   UUID;
  cat_salgado   UUID;
  cat_doce      UUID;
  cat_bebida    UUID;

  ing_presunto  UUID;
  ing_queijo    UUID;
  ing_milho     UUID;
  ing_catupiry  UUID;
  ing_bacon     UUID;
  ing_ovo       UUID;
  ing_calabresa UUID;
  ing_frango    UUID;
  ing_banana    UUID;
  ing_acucar    UUID;
  ing_canela    UUID;
  ing_chocolate UUID;
  ing_nutella   UUID;
  ing_morango   UUID;

  add_ovo       UUID;
  add_queijo    UUID;
  add_bacon     UUID;
  add_calabresa UUID;
  add_frango    UUID;
  add_presunto  UUID;
  add_chocolate UUID;
  add_nutella   UUID;
  add_banana    UUID;
  add_morango   UUID;

  curr_prod_id  UUID;
BEGIN
  SELECT id INTO v_branch_id FROM branches WHERE slug = 'feira-candangolandia';
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Filial Feira-Candangolândia não encontrada (slug = feira-candangolandia).';
  END IF;

  -- Aborta se já houver cardápio cadastrado na filial (idempotência).
  IF EXISTS (SELECT 1 FROM products WHERE branch_id = v_branch_id) THEN
    RAISE NOTICE 'Cardápio da Feira-Candangolândia já existe — pulando seed.';
    RETURN;
  END IF;

  -- 2.1 Categorias
  INSERT INTO categories (branch_id, name, sort_order) VALUES (v_branch_id, 'Crepes Salgados', 1) RETURNING id INTO cat_salgado;
  INSERT INTO categories (branch_id, name, sort_order) VALUES (v_branch_id, 'Crepes Doces',    2) RETURNING id INTO cat_doce;
  INSERT INTO categories (branch_id, name, sort_order) VALUES (v_branch_id, 'Bebidas',         3) RETURNING id INTO cat_bebida;

  -- 2.2 Ingredientes
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'presunto')  RETURNING id INTO ing_presunto;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'queijo')    RETURNING id INTO ing_queijo;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'milho')     RETURNING id INTO ing_milho;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'catupiry')  RETURNING id INTO ing_catupiry;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'bacon')     RETURNING id INTO ing_bacon;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'ovo')       RETURNING id INTO ing_ovo;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'calabresa') RETURNING id INTO ing_calabresa;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'frango')    RETURNING id INTO ing_frango;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'banana')    RETURNING id INTO ing_banana;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'açúcar')    RETURNING id INTO ing_acucar;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'canela')    RETURNING id INTO ing_canela;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'chocolate') RETURNING id INTO ing_chocolate;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'nutella')   RETURNING id INTO ing_nutella;
  INSERT INTO ingredients (branch_id, name) VALUES (v_branch_id, 'morango')   RETURNING id INTO ing_morango;

  -- 2.3 Adicionais (preços alinhados com a loja principal)
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Ovo',       1.00,  1) RETURNING id INTO add_ovo;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Queijo',    4.00,  2) RETURNING id INTO add_queijo;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Bacon',     4.00,  3) RETURNING id INTO add_bacon;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Calabresa', 4.00,  4) RETURNING id INTO add_calabresa;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Frango',    4.00,  5) RETURNING id INTO add_frango;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Presunto',  4.00,  6) RETURNING id INTO add_presunto;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Banana',    2.00,  7) RETURNING id INTO add_banana;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Morango',   2.00,  8) RETURNING id INTO add_morango;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Chocolate', 4.00,  9) RETURNING id INTO add_chocolate;
  INSERT INTO addons (branch_id, name, price, sort_order) VALUES (v_branch_id, 'Nutella',   5.00, 10) RETURNING id INTO add_nutella;

  -- 2.4 CREPES SALGADOS (R$23 base, R$26 com bacon+ovo)
  -- Padrão de nomes: "0X - Nome de Carro" (igual à Loja Principal).
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '01 - Lamborghini', 23.00, 'KITCHEN', 1) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_presunto), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '02 - Ferrari', 26.00, 'KITCHEN', 2) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_presunto), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '03 - Porsche', 23.00, 'KITCHEN', 3) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_calabresa), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '04 - Aston Martin', 26.00, 'KITCHEN', 4) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_calabresa), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '05 - Bugatti', 23.00, 'KITCHEN', 5) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_frango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '06 - McLaren', 26.00, 'KITCHEN', 6) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_frango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  -- 2.5 CREPES DOCES
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '07 - Maserati', 26.00, 'KITCHEN', 7) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_acucar), (curr_prod_id, ing_canela);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '08 - Bentley', 26.00, 'KITCHEN', 8) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_acucar),
    (curr_prod_id, ing_canela), (curr_prod_id, ing_chocolate);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '09 - Pagani', 30.00, 'KITCHEN', 9) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_nutella);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '10 - Koenigsegg', 26.00, 'KITCHEN', 10) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_morango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_chocolate);

  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '11 - Lotus', 30.00, 'KITCHEN', 11) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_morango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_nutella);

  -- 2.6 BEBIDAS — todas R$7,00
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_bebida, 'Refrigerante Lata', 7.00, 'NONE', 1);
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_bebida, 'Suco Lata',         7.00, 'NONE', 2);
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_bebida, 'H2O Lata',          7.00, 'NONE', 3);

  -- 2.7 Vínculos adicional <-> produto (mesmo padrão da loja principal)
  -- Crepes salgados: adicionais salgados + Queijo.
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.branch_id = v_branch_id AND a.branch_id = v_branch_id
    AND p.category_id = cat_salgado
    AND a.name IN ('Ovo', 'Queijo', 'Bacon', 'Calabresa', 'Frango', 'Presunto');

  -- Crepes doces: adicionais doces + Queijo.
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.branch_id = v_branch_id AND a.branch_id = v_branch_id
    AND p.category_id = cat_doce
    AND a.name IN ('Banana', 'Morango', 'Queijo', 'Chocolate', 'Nutella');
END $$;

-- ============================================================================
-- 3. Loja Principal — opções de preparo dos sucos
-- ============================================================================
-- Cria adicionais R$0 para registrar a preferência do cliente nos sucos
-- (com açúcar / sem açúcar / com adoçante / sem gelo). Aparece no mesmo
-- modal de adicionais do produto, com preço zero.
DO $$
DECLARE
  v_main_branch UUID;
  add_com_acucar  UUID;
  add_sem_acucar  UUID;
  add_adocante    UUID;
  add_sem_gelo    UUID;
BEGIN
  SELECT id INTO v_main_branch FROM branches WHERE code = 'P';
  IF v_main_branch IS NULL THEN
    RAISE NOTICE 'Loja Principal não encontrada — pulando preparo de sucos.';
    RETURN;
  END IF;

  -- Insere os adicionais R$0 (se ainda não existirem nessa filial).
  INSERT INTO addons (branch_id, name, price, sort_order)
  VALUES (v_main_branch, 'Com açúcar', 0, 90)
  ON CONFLICT DO NOTHING;
  SELECT id INTO add_com_acucar FROM addons
   WHERE branch_id = v_main_branch AND name = 'Com açúcar' LIMIT 1;

  INSERT INTO addons (branch_id, name, price, sort_order)
  VALUES (v_main_branch, 'Sem açúcar', 0, 91)
  ON CONFLICT DO NOTHING;
  SELECT id INTO add_sem_acucar FROM addons
   WHERE branch_id = v_main_branch AND name = 'Sem açúcar' LIMIT 1;

  INSERT INTO addons (branch_id, name, price, sort_order)
  VALUES (v_main_branch, 'Com adoçante', 0, 92)
  ON CONFLICT DO NOTHING;
  SELECT id INTO add_adocante FROM addons
   WHERE branch_id = v_main_branch AND name = 'Com adoçante' LIMIT 1;

  INSERT INTO addons (branch_id, name, price, sort_order)
  VALUES (v_main_branch, 'Sem gelo', 0, 93)
  ON CONFLICT DO NOTHING;
  SELECT id INTO add_sem_gelo FROM addons
   WHERE branch_id = v_main_branch AND name = 'Sem gelo' LIMIT 1;

  -- Vincula esses adicionais a todos os sucos da Loja Principal (setor
  -- JUICE_POTATO, exceto Açaí Creme que tem perfil próprio).
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p
  CROSS JOIN (VALUES (add_com_acucar), (add_sem_acucar), (add_adocante), (add_sem_gelo)) AS opt(id)
  JOIN addons a ON a.id = opt.id
  WHERE p.branch_id = v_main_branch
    AND p.sector = 'JUICE_POTATO'
    AND p.name <> 'Porção de Batata'
    AND p.name <> 'Açaí Creme'
    AND NOT EXISTS (
      SELECT 1 FROM product_addons pa
      WHERE pa.product_id = p.id AND pa.addon_id = a.id
    );
END $$;
