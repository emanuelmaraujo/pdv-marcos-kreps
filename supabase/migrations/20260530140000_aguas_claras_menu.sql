-- Migration: Cardápio da filial Águas Claras
-- Date: 2026-05-30
-- Source: PDF entregue pelo Marcos (cardápio com 11 crepes — 6 salgados + 5 doces).
-- Numeração e preços mantidos exatamente como no PDF para facilitar conferência
-- balcão↔sistema (item 03, 04, 07, 08, 11, 12 salgados; 27, 29, 32, 33, 35 doces).
--
-- Idempotente:
--   * Aborta cedo se a filial não existir
--   * Pula seed se já houver produtos cadastrados na filial

DO $$
DECLARE
  v_branch_id   UUID;
  cat_salgado   UUID;
  cat_doce      UUID;

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
  -- Lookup tolerante a acento e variação ("Águas Claras" / "Aguas Claras")
  SELECT id INTO v_branch_id
  FROM branches
  WHERE name ILIKE '%águas%claras%' OR name ILIKE '%aguas%claras%' OR slug = 'aguas-claras'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    -- Filial é dado operacional (criada pela UI, não por seed/migration) —
    -- ambientes novos (reset local do zero, CI) legitimamente não a têm
    -- ainda. Pula em silêncio em vez de abortar a migration inteira.
    RAISE NOTICE 'Filial Águas Claras não encontrada — pulando seed.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM products WHERE branch_id = v_branch_id) THEN
    RAISE NOTICE 'Cardápio de Águas Claras já existe — pulando seed.';
    RETURN;
  END IF;

  -- Packing fee R$0,50 conforme PDF, apenas se a filial ainda estiver com 0.
  UPDATE branches SET packing_fee = 0.50
  WHERE id = v_branch_id AND COALESCE(packing_fee, 0) = 0;

  -- ── Categorias ─────────────────────────────────────────────────────────
  INSERT INTO categories (branch_id, name, sort_order) VALUES (v_branch_id, 'Crepes Salgados', 1) RETURNING id INTO cat_salgado;
  INSERT INTO categories (branch_id, name, sort_order) VALUES (v_branch_id, 'Crepes Doces',    2) RETURNING id INTO cat_doce;

  -- ── Ingredientes ───────────────────────────────────────────────────────
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

  -- ── Adicionais (preços alinhados com Candangolândia / Loja Principal) ──
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

  -- ── CREPES SALGADOS (numeração e preços do PDF) ────────────────────────
  -- 03 - Presunto | queijo | milho | catupiry | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '03 - Presunto', 30.00, 'KITCHEN', 3) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_presunto), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  -- 04 - Presunto Completo | + bacon + ovo | R$ 36
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '04 - Presunto Completo', 36.00, 'KITCHEN', 4) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_presunto), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  -- 07 - Calabresa | queijo | milho | catupiry | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '07 - Calabresa', 30.00, 'KITCHEN', 7) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_calabresa), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  -- 08 - Calabresa Completo | + bacon + ovo | R$ 36
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '08 - Calabresa Completo', 36.00, 'KITCHEN', 8) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_calabresa), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  -- 11 - Frango | queijo | milho | catupiry | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '11 - Frango', 30.00, 'KITCHEN', 11) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_frango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho), (curr_prod_id, ing_catupiry);

  -- 12 - Frango Completo | + bacon + ovo | R$ 36
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_salgado, '12 - Frango Completo', 36.00, 'KITCHEN', 12) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_frango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_milho),
    (curr_prod_id, ing_catupiry), (curr_prod_id, ing_bacon), (curr_prod_id, ing_ovo);

  -- ── CREPES DOCES (numeração e preços do PDF) ───────────────────────────
  -- 27 - Banana com Canela | banana | queijo | açúcar | canela | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '27 - Banana com Canela', 30.00, 'KITCHEN', 27) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_acucar), (curr_prod_id, ing_canela);

  -- 29 - Banana com Canela e Chocolate | + chocolate | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '29 - Banana com Canela e Chocolate', 30.00, 'KITCHEN', 29) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_acucar),
    (curr_prod_id, ing_canela), (curr_prod_id, ing_chocolate);

  -- 32 - Banana com Nutella | banana | queijo | nutella | R$ 36
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '32 - Banana com Nutella', 36.00, 'KITCHEN', 32) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_banana), (curr_prod_id, ing_queijo), (curr_prod_id, ing_nutella);

  -- 33 - Morango com Chocolate | morango | queijo | chocolate | R$ 30
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '33 - Morango com Chocolate', 30.00, 'KITCHEN', 33) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_morango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_chocolate);

  -- 35 - Morango com Nutella | morango | queijo | nutella | R$ 36
  INSERT INTO products (branch_id, category_id, name, price, sector, sort_order)
    VALUES (v_branch_id, cat_doce, '35 - Morango com Nutella', 36.00, 'KITCHEN', 35) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES
    (curr_prod_id, ing_morango), (curr_prod_id, ing_queijo), (curr_prod_id, ing_nutella);

  -- ── Vínculos adicional ↔ produto ───────────────────────────────────────
  -- Crepes salgados: adicionais salgados + Queijo
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.branch_id = v_branch_id AND a.branch_id = v_branch_id
    AND p.category_id = cat_salgado
    AND a.name IN ('Ovo', 'Queijo', 'Bacon', 'Calabresa', 'Frango', 'Presunto');

  -- Crepes doces: adicionais doces + Queijo
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.branch_id = v_branch_id AND a.branch_id = v_branch_id
    AND p.category_id = cat_doce
    AND a.name IN ('Banana', 'Morango', 'Queijo', 'Chocolate', 'Nutella');
END $$;
