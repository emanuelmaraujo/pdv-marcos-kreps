-- Seed inicial do PDV Marcos Krep's
-- Desativa os triggers temporariamente se for rodar em produção (não recomendado, esse script é apenas para dev/teste)

-- Inserir Configurações Globais (Settings)
INSERT INTO settings (key, value) VALUES
  ('packaging_fee', '1.00'),
  ('apply_packaging_fee_for_takeaway', 'true'),
  ('print_customer_copy', 'true'),
  ('print_kitchen_copy', 'true'),
  ('print_juice_potato_copy', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Usaremos blocos anônimos para facilitar a inserção com IDs gerados e relacionamentos

DO $$
DECLARE
  cat_salgados_id UUID;
  cat_doces_id UUID;
  cat_batata_id UUID;
  cat_bebidas_id UUID;
  
  prod_mercedes_id UUID;
  prod_batata_id UUID;
  prod_suco_id UUID;

  ing_presunto_id UUID;
  ing_queijo_id UUID;
  ing_milho_id UUID;
  ing_catupiry_id UUID;
  ing_bacon_id UUID;
  ing_ovo_id UUID;
BEGIN
  -- 1. Categorias
  INSERT INTO categories (name, sort_order) VALUES ('Kreps Salgados', 1) RETURNING id INTO cat_salgados_id;
  INSERT INTO categories (name, sort_order) VALUES ('Kreps Doces', 2) RETURNING id INTO cat_doces_id;
  INSERT INTO categories (name, sort_order) VALUES ('Batata', 3) RETURNING id INTO cat_batata_id;
  INSERT INTO categories (name, sort_order) VALUES ('Bebidas', 4) RETURNING id INTO cat_bebidas_id;

  -- 2. Ingredientes
  INSERT INTO ingredients (name) VALUES ('presunto') RETURNING id INTO ing_presunto_id;
  INSERT INTO ingredients (name) VALUES ('queijo') RETURNING id INTO ing_queijo_id;
  INSERT INTO ingredients (name) VALUES ('milho') RETURNING id INTO ing_milho_id;
  INSERT INTO ingredients (name) VALUES ('catupiry') RETURNING id INTO ing_catupiry_id;
  INSERT INTO ingredients (name) VALUES ('bacon') RETURNING id INTO ing_bacon_id;
  INSERT INTO ingredients (name) VALUES ('ovo') RETURNING id INTO ing_ovo_id;

  -- 3. Addons
  INSERT INTO addons (name, price) VALUES ('ovo', 1.00);
  INSERT INTO addons (name, price) VALUES ('batata palha', 1.00);
  INSERT INTO addons (name, price) VALUES ('queijo', 4.00);
  INSERT INTO addons (name, price) VALUES ('bacon', 4.00);
  INSERT INTO addons (name, price) VALUES ('nutella', 5.00);

  -- 4. Produtos
  INSERT INTO products (category_id, name, description, price, sector) 
  VALUES (cat_salgados_id, '04 Mercedes', 'Delicioso krep salgado', 18.00, 'KITCHEN') 
  RETURNING id INTO prod_mercedes_id;

  INSERT INTO products (category_id, name, description, price, sector) 
  VALUES (cat_batata_id, 'Batata Frita', 'Porção de batata palito', 15.00, 'JUICE_POTATO') 
  RETURNING id INTO prod_batata_id;

  INSERT INTO products (category_id, name, description, price, sector) 
  VALUES (cat_bebidas_id, 'Suco de Laranja', 'Copo 500ml', 8.00, 'JUICE_POTATO') 
  RETURNING id INTO prod_suco_id;

  -- 5. Product Ingredients do Mercedes
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_presunto_id);
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_queijo_id);
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_milho_id);
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_catupiry_id);
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_bacon_id);
  INSERT INTO product_ingredients (product_id, ingredient_id) VALUES (prod_mercedes_id, ing_ovo_id);

END $$;
