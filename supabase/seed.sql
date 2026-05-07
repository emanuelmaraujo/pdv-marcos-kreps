-- Seed inicial do PDV Marcos Krep's (Cardápio Real Completo)
-- Este script limpa e repopula o cardápio com os dados reais enviados pelo Marcos.

-- Inserir Configurações Globais (Settings)
INSERT INTO settings (key, value) VALUES
  ('packaging_fee', '1.00'),
  ('apply_packaging_fee_for_takeaway', 'true'),
  ('print_customer_copy', 'true'),
  ('print_kitchen_copy', 'true'),
  ('print_juice_potato_copy', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DO $$
DECLARE
  -- Categorias
  cat_krep_salgado_id UUID;
  cat_krep_doce_id UUID;
  cat_batata_id UUID;
  cat_bebidas_id UUID;
  cat_cremes_acai_id UUID;
  cat_adicionais_id UUID;

  -- Ingredientes Base (para remoção)
  ing_presunto_id UUID;
  ing_queijo_id UUID;
  ing_milho_id UUID;
  ing_catupiry_id UUID;
  ing_bacon_id UUID;
  ing_ovo_id UUID;
  ing_calabresa_id UUID;
  ing_frango_id UUID;
  ing_atum_id UUID;
  ing_palmito_id UUID;
  ing_cheddar_id UUID;
  ing_rucula_id UUID;
  ing_tomate_seco_id UUID;
  ing_carne_sol_id UUID;
  ing_cebola_id UUID;
  ing_azeitona_id UUID;
  ing_tomate_id UUID;
  ing_batata_palha_id UUID;
  ing_banana_id UUID;
  ing_acucar_id UUID;
  ing_canela_id UUID;
  ing_mel_id UUID;
  ing_chocolate_id UUID;
  ing_doce_leite_id UUID;
  ing_nutella_id UUID;
  ing_sorvete_id UUID;
  ing_morango_id UUID;
  ing_goiabada_id UUID;
  ing_peito_peru_id UUID;

  -- Addons (Adicionais pagos)
  add_ovo_id UUID;
  add_batata_palha_id UUID;
  add_tomate_id UUID;
  add_cebola_id UUID;
  add_tomate_seco_id UUID;
  add_azeitona_id UUID;
  add_palmito_id UUID;
  add_cheddar_id UUID;
  add_morango_id UUID;
  add_banana_id UUID;
  add_leite_condensado_id UUID;
  add_frango_id UUID;
  add_peito_peru_id UUID;
  add_calabresa_id UUID;
  add_queijo_id UUID;
  add_bacon_id UUID;
  add_presunto_id UUID;
  add_chocolate_id UUID;
  add_doce_leite_id UUID;
  add_sorvete_id UUID;
  add_nutella_id UUID;
  add_carne_sol_id UUID;
  add_atum_id UUID;

  -- Produtos
  curr_prod_id UUID;
BEGIN
  -- 1. LIMPEZA TOTAL (Cascading deletes)
  DELETE FROM product_addons;
  DELETE FROM product_ingredients;
  DELETE FROM products;
  DELETE FROM categories;
  DELETE FROM ingredients;
  DELETE FROM addons;

  -- 2. CATEGORIAS
  INSERT INTO categories (name, sort_order) VALUES ('Kreps Salgados', 1) RETURNING id INTO cat_krep_salgado_id;
  INSERT INTO categories (name, sort_order) VALUES ('Kreps Doces', 2) RETURNING id INTO cat_krep_doce_id;
  INSERT INTO categories (name, sort_order) VALUES ('Batata', 3) RETURNING id INTO cat_batata_id;
  INSERT INTO categories (name, sort_order) VALUES ('Bebidas / Combustíveis', 4) RETURNING id INTO cat_bebidas_id;
  INSERT INTO categories (name, sort_order) VALUES ('Cremes / Açaí', 5) RETURNING id INTO cat_cremes_acai_id;
  INSERT INTO categories (name, sort_order) VALUES ('Adicionais', 6) RETURNING id INTO cat_adicionais_id;

  -- 3. INGREDIENTES (Para remoção em Kreps)
  INSERT INTO ingredients (name) VALUES ('presunto') RETURNING id INTO ing_presunto_id;
  INSERT INTO ingredients (name) VALUES ('queijo') RETURNING id INTO ing_queijo_id;
  INSERT INTO ingredients (name) VALUES ('milho') RETURNING id INTO ing_milho_id;
  INSERT INTO ingredients (name) VALUES ('catupiry') RETURNING id INTO ing_catupiry_id;
  INSERT INTO ingredients (name) VALUES ('bacon') RETURNING id INTO ing_bacon_id;
  INSERT INTO ingredients (name) VALUES ('ovo') RETURNING id INTO ing_ovo_id;
  INSERT INTO ingredients (name) VALUES ('calabresa') RETURNING id INTO ing_calabresa_id;
  INSERT INTO ingredients (name) VALUES ('frango') RETURNING id INTO ing_frango_id;
  INSERT INTO ingredients (name) VALUES ('atum') RETURNING id INTO ing_atum_id;
  INSERT INTO ingredients (name) VALUES ('palmito') RETURNING id INTO ing_palmito_id;
  INSERT INTO ingredients (name) VALUES ('cheddar cremoso') RETURNING id INTO ing_cheddar_id;
  INSERT INTO ingredients (name) VALUES ('rúcula') RETURNING id INTO ing_rucula_id;
  INSERT INTO ingredients (name) VALUES ('tomate seco') RETURNING id INTO ing_tomate_seco_id;
  INSERT INTO ingredients (name) VALUES ('carne de sol') RETURNING id INTO ing_carne_sol_id;
  INSERT INTO ingredients (name) VALUES ('cebola') RETURNING id INTO ing_cebola_id;
  INSERT INTO ingredients (name) VALUES ('azeitona') RETURNING id INTO ing_azeitona_id;
  INSERT INTO ingredients (name) VALUES ('tomate') RETURNING id INTO ing_tomate_id;
  INSERT INTO ingredients (name) VALUES ('batata palha') RETURNING id INTO ing_batata_palha_id;
  INSERT INTO ingredients (name) VALUES ('banana') RETURNING id INTO ing_banana_id;
  INSERT INTO ingredients (name) VALUES ('açúcar') RETURNING id INTO ing_acucar_id;
  INSERT INTO ingredients (name) VALUES ('canela') RETURNING id INTO ing_canela_id;
  INSERT INTO ingredients (name) VALUES ('mel') RETURNING id INTO ing_mel_id;
  INSERT INTO ingredients (name) VALUES ('chocolate') RETURNING id INTO ing_chocolate_id;
  INSERT INTO ingredients (name) VALUES ('doce de leite') RETURNING id INTO ing_doce_leite_id;
  INSERT INTO ingredients (name) VALUES ('nutella') RETURNING id INTO ing_nutella_id;
  INSERT INTO ingredients (name) VALUES ('sorvete') RETURNING id INTO ing_sorvete_id;
  INSERT INTO ingredients (name) VALUES ('morango') RETURNING id INTO ing_morango_id;
  INSERT INTO ingredients (name) VALUES ('goiabada') RETURNING id INTO ing_goiabada_id;
  INSERT INTO ingredients (name) VALUES ('peito de peru') RETURNING id INTO ing_peito_peru_id;

  -- 4. ADICIONAIS (Pagos)
  -- R$ 1,00
  INSERT INTO addons (name, price, sort_order) VALUES ('Ovo', 1.00, 1) RETURNING id INTO add_ovo_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Batata Palha', 1.00, 2) RETURNING id INTO add_batata_palha_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Tomate', 1.00, 3) RETURNING id INTO add_tomate_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Cebola', 1.00, 4) RETURNING id INTO add_cebola_id;
  -- R$ 2,00
  INSERT INTO addons (name, price, sort_order) VALUES ('Tomate Seco', 2.00, 5) RETURNING id INTO add_tomate_seco_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Azeitona', 2.00, 6) RETURNING id INTO add_azeitona_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Palmito', 2.00, 7) RETURNING id INTO add_palmito_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Cheddar Cremoso', 2.00, 8) RETURNING id INTO add_cheddar_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Morango', 2.00, 9) RETURNING id INTO add_morango_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Banana', 2.00, 10) RETURNING id INTO add_banana_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Leite Condensado', 2.00, 11) RETURNING id INTO add_leite_condensado_id;
  -- R$ 4,00
  INSERT INTO addons (name, price, sort_order) VALUES ('Frango', 4.00, 12) RETURNING id INTO add_frango_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Peito de Peru', 4.00, 13) RETURNING id INTO add_peito_peru_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Calabresa', 4.00, 14) RETURNING id INTO add_calabresa_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Queijo', 4.00, 15) RETURNING id INTO add_queijo_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Bacon', 4.00, 16) RETURNING id INTO add_bacon_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Presunto', 4.00, 17) RETURNING id INTO add_presunto_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Chocolate', 4.00, 18) RETURNING id INTO add_chocolate_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Doce de Leite', 4.00, 19) RETURNING id INTO add_doce_leite_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Sorvete', 4.00, 20) RETURNING id INTO add_sorvete_id;
  -- R$ 5,00
  INSERT INTO addons (name, price, sort_order) VALUES ('Nutella', 5.00, 21) RETURNING id INTO add_nutella_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Carne de Sol', 5.00, 22) RETURNING id INTO add_carne_sol_id;
  INSERT INTO addons (name, price, sort_order) VALUES ('Atum', 5.00, 23) RETURNING id INTO add_atum_id;

  -- 5. PRODUTOS: KREPS SALGADOS
  -- Presunto
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '01 - Fiat 147', 20.00, 'KITCHEN', 1) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_presunto_id), (curr_prod_id, ing_queijo_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '02 - Chevrolet 28', 21.00, 'KITCHEN', 2) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_presunto_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '03 - Corvette', 23.00, 'KITCHEN', 3) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_presunto_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '04 - Mercedes', 26.00, 'KITCHEN', 4) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_presunto_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Calabresa
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '05 - Simca', 20.00, 'KITCHEN', 5) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_calabresa_id), (curr_prod_id, ing_queijo_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '06 - Alfa Romeo', 21.00, 'KITCHEN', 6) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_calabresa_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '07 - Karmann Ghia', 23.00, 'KITCHEN', 7) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_calabresa_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '08 - Impala', 26.00, 'KITCHEN', 8) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_calabresa_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Frango
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '09 - Volvo', 20.00, 'KITCHEN', 9) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_frango_id), (curr_prod_id, ing_queijo_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '10 - Aero Willys', 21.00, 'KITCHEN', 10) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_frango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '11 - Bel Air', 23.00, 'KITCHEN', 11) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_frango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '12 - Thunderbird', 26.00, 'KITCHEN', 12) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_frango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Atum
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '13 - Puma', 22.00, 'KITCHEN', 13) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_atum_id), (curr_prod_id, ing_queijo_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '14 - Dodge', 24.00, 'KITCHEN', 14) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_atum_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '15 - Continental', 28.00, 'KITCHEN', 15) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_atum_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '16 - Jaguar', 30.00, 'KITCHEN', 16) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_atum_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Peito de Peru
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '17 - Ecto-1', 20.00, 'KITCHEN', 17) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_peito_peru_id), (curr_prod_id, ing_queijo_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '18 - Delorean DMC-12', 22.00, 'KITCHEN', 18) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_peito_peru_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_palmito_id), (curr_prod_id, ing_cheddar_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '19 - Barracuda', 26.00, 'KITCHEN', 19) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_peito_peru_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_rucula_id), (curr_prod_id, ing_tomate_seco_id), (curr_prod_id, ing_cheddar_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '20 - Eleanor', 32.00, 'KITCHEN', 20) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_peito_peru_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_palmito_id), (curr_prod_id, ing_cheddar_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Carne de Sol
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '21 - Mach 5', 24.00, 'KITCHEN', 21) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_carne_sol_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_cebola_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '22 - Super Máquina', 26.00, 'KITCHEN', 22) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_carne_sol_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_azeitona_id), (curr_prod_id, ing_catupiry_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '23 - Ford Mercury', 28.00, 'KITCHEN', 23) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_carne_sol_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_cebola_id), (curr_prod_id, ing_azeitona_id), (curr_prod_id, ing_cheddar_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '24 - General Lee', 35.00, 'KITCHEN', 24) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_carne_sol_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_cebola_id), (curr_prod_id, ing_azeitona_id), (curr_prod_id, ing_cheddar_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id);

  -- Vegetariano
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '25 - Fusca', 30.00, 'KITCHEN', 25) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_ovo_id), (curr_prod_id, ing_tomate_seco_id), (curr_prod_id, ing_cebola_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_palmito_id), (curr_prod_id, ing_azeitona_id), (curr_prod_id, ing_tomate_id);

  -- Carro Chefe
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_salgado_id, '26 - Maverick V8tão', 40.00, 'KITCHEN', 26) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_presunto_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_calabresa_id), (curr_prod_id, ing_frango_id), (curr_prod_id, ing_batata_palha_id), (curr_prod_id, ing_bacon_id), (curr_prod_id, ing_ovo_id), (curr_prod_id, ing_milho_id), (curr_prod_id, ing_catupiry_id);

  -- 6. PRODUTOS: KREPS DOCES
  -- Banana
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '27 - DKW Vemag', 23.00, 'KITCHEN', 27) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_acucar_id), (curr_prod_id, ing_canela_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '28 - Galaxy', 23.00, 'KITCHEN', 28) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_acucar_id), (curr_prod_id, ing_canela_id), (curr_prod_id, ing_mel_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '29 - Mustang', 26.00, 'KITCHEN', 29) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_acucar_id), (curr_prod_id, ing_canela_id), (curr_prod_id, ing_chocolate_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '30 - Buick', 26.00, 'KITCHEN', 30) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_acucar_id), (curr_prod_id, ing_canela_id), (curr_prod_id, ing_doce_leite_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '31 - Opala 71', 28.00, 'KITCHEN', 31) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_acucar_id), (curr_prod_id, ing_canela_id), (curr_prod_id, ing_chocolate_id), (curr_prod_id, ing_doce_leite_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '32 - Chevette', 30.00, 'KITCHEN', 32) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_banana_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_nutella_id), (curr_prod_id, ing_sorvete_id);

  -- Morango
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '33 - Landau', 26.00, 'KITCHEN', 33) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_morango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_chocolate_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '34 - Camaro', 28.00, 'KITCHEN', 34) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_morango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_chocolate_id), (curr_prod_id, ing_sorvete_id);

  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '35 - Rolls Royce', 30.00, 'KITCHEN', 35) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_morango_id), (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_nutella_id), (curr_prod_id, ing_sorvete_id);

  -- Romeu e Julieta
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_krep_doce_id, '36 - Cadillac', 22.00, 'KITCHEN', 36) RETURNING id INTO curr_prod_id;
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (curr_prod_id, ing_queijo_id), (curr_prod_id, ing_goiabada_id);

  -- 7. PRODUTOS: BATATA
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_batata_id, 'Porção de Batata', 22.00, 'JUICE_POTATO', 1);

  -- 8. PRODUTOS: BEBIDAS / COMBUSTÍVEIS
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Refrigerante', 6.00, 'NONE', 1);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'H2O', 7.00, 'NONE', 2);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco Limão', 8.00, 'JUICE_POTATO', 3);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Laranja', 8.00, 'JUICE_POTATO', 4);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Polpa + Leite', 10.00, 'JUICE_POTATO', 5);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Polpa + Água', 8.00, 'JUICE_POTATO', 6);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Açaí Creme', 15.00, 'JUICE_POTATO', 7);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Laranja + Morango', 14.00, 'JUICE_POTATO', 8);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Laranja + Acerola', 12.00, 'JUICE_POTATO', 9);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Soda Italiana', 14.00, 'JUICE_POTATO', 10);
  
  -- Sabores específicos como produtos (opcional, mas solicitado)
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Abacaxi com Hortelã', 8.00, 'JUICE_POTATO', 11);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Acerola', 8.00, 'JUICE_POTATO', 12);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Caju', 8.00, 'JUICE_POTATO', 13);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Cajá', 8.00, 'JUICE_POTATO', 14);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Cupuaçu', 8.00, 'JUICE_POTATO', 15);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Manga', 8.00, 'JUICE_POTATO', 16);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Morango', 8.00, 'JUICE_POTATO', 17);
  INSERT INTO products (category_id, name, price, sector, sort_order) VALUES (cat_bebidas_id, 'Suco de Maracujá', 8.00, 'JUICE_POTATO', 18);

  -- 9. VÍNCULO DE ADICIONAIS PERMITIDOS (PRODUCT_ADDONS)
  -- Kreps Salgados (quase todos os adicionais permitidos)
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.category_id = cat_krep_salgado_id
  AND a.name IN ('Ovo', 'Batata Palha', 'Tomate', 'Cebola', 'Tomate Seco', 'Azeitona', 'Palmito', 'Cheddar Cremoso', 'Frango', 'Peito de Peru', 'Calabresa', 'Queijo', 'Bacon', 'Presunto', 'Nutella', 'Carne de Sol', 'Atum');

  -- Kreps Doces (adicionais doces + queijo)
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.category_id = cat_krep_doce_id
  AND a.name IN ('Morango', 'Banana', 'Leite Condensado', 'Queijo', 'Chocolate', 'Doce de Leite', 'Sorvete', 'Nutella');

  -- Batata (adicionais específicos)
  INSERT INTO product_addons (product_id, addon_id)
  SELECT p.id, a.id
  FROM products p, addons a
  WHERE p.category_id = cat_batata_id
  AND a.name IN ('Cheddar Cremoso', 'Bacon', 'Queijo', 'Batata Palha', 'Cebola');

  -- Bebidas e Cremes não possuem adicionais vinculados por padrão no MVP.

END $$;
