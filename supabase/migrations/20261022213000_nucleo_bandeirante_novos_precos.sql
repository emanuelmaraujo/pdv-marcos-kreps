-- Atualiza SOMENTE os preços da unidade Núcleo Bandeirante (slug = 'nb').
-- Fonte: DOC-20261021-WA0017.pdf, páginas 1-2 (cardápio informado em 21/10/2026).
-- Escopo: 36 crepes, porção de batata, 10 bebidas, 23 adicionais e embalagem.
-- IMPORTANTE: migration de DADOS para aprovação/aplicação manual. Não altera outros
-- cardápios nem recria produtos. Se faltar algum item, aborta sem aplicar mudanças.
-- Valores são em reais (numeric); atualizações idempotentes; pedidos antigos não
-- devem ter seus preços históricos recalculados.
BEGIN;
DO $update_nb$
DECLARE
  v_branch_id uuid;
  v_crepes jsonb := '[{"code":"01","price":22},{"code":"02","price":23},{"code":"03","price":26},{"code":"04","price":30},{"code":"05","price":22},{"code":"06","price":23},{"code":"07","price":26},{"code":"08","price":30},{"code":"09","price":22},{"code":"10","price":23},{"code":"11","price":26},{"code":"12","price":30},{"code":"13","price":25},{"code":"14","price":26},{"code":"15","price":30},{"code":"16","price":35},{"code":"17","price":22},{"code":"18","price":25},{"code":"19","price":30},{"code":"20","price":35},{"code":"21","price":26},{"code":"22","price":28},{"code":"23","price":38},{"code":"24","price":40},{"code":"25","price":30},{"code":"26","price":45},{"code":"27","price":26},{"code":"28","price":26},{"code":"29","price":29},{"code":"30","price":29},{"code":"31","price":31},{"code":"32","price":34},{"code":"33","price":29},{"code":"34","price":31},{"code":"35","price":34},{"code":"36","price":25}]'::jsonb;
  v_beverages jsonb := '[{"name":"Refrigerante","price":7},{"name":"H2O","price":7},{"name":"Suco Limão","price":8},{"name":"Laranja","price":8},{"name":"Polpa + Leite","price":10},{"name":"Polpa + Água","price":8},{"name":"Açaí Creme","price":15},{"name":"Laranja + Morango","price":14},{"name":"Laranja + Acerola","price":12},{"name":"Soda Italiana","price":14}]'::jsonb;
  v_addons jsonb := '[{"name":"Ovo","price":1},{"name":"Batata Palha","price":1},{"name":"Tomate","price":1},{"name":"Cebola","price":1},{"name":"Tomate Seco","price":2},{"name":"Azeitona","price":2},{"name":"Palmito","price":2},{"name":"Cheddar Cremoso","price":2},{"name":"Morango","price":2},{"name":"Banana","price":2},{"name":"Leite Condensado","price":2},{"name":"Frango","price":4},{"name":"Peito de Peru","price":4},{"name":"Calabresa","price":4},{"name":"Queijo","price":4},{"name":"Bacon","price":4},{"name":"Presunto","price":4},{"name":"Chocolate","price":4},{"name":"Doce de Leite","price":4},{"name":"Sorvete","price":4},{"name":"Nutella","price":5},{"name":"Carne de Sol","price":5},{"name":"Atum","price":5}]'::jsonb;
  v_found integer;
  v_distinct integer;
BEGIN
  SELECT id INTO STRICT v_branch_id
  FROM public.branches
  WHERE slug = 'nb';

  -- Pré-valida TODOS os itens ANTES de alterar qualquer valor. Números 01–36
  -- são os identificadores de item presentes nos nomes do cardápio do PDV.
  SELECT count(*), count(DISTINCT entry.code)
    INTO v_found, v_distinct
  FROM public.products AS p
  JOIN jsonb_to_recordset(v_crepes) AS entry(code text, price numeric)
    ON p.name LIKE (entry.code || ' - %')
  WHERE p.branch_id = v_branch_id;
  IF v_found <> 36 OR v_distinct <> 36 THEN
    RAISE EXCEPTION 'NB: esperados 36 crepes distintos pelos códigos 01–36, encontrados % registros e % códigos.', v_found, v_distinct;
  END IF;

  SELECT count(*) INTO v_found
  FROM public.products AS p
  JOIN jsonb_to_recordset(v_beverages) AS entry(name text, price numeric)
    ON lower(btrim(p.name)) = lower(entry.name)
  WHERE p.branch_id = v_branch_id;
  IF v_found <> 10 THEN
    RAISE EXCEPTION 'NB: esperadas 10 bebidas com nomes correspondentes, encontradas %.', v_found;
  END IF;

  SELECT count(*) INTO v_found
  FROM public.addons AS a
  JOIN jsonb_to_recordset(v_addons) AS entry(name text, price numeric)
    ON lower(btrim(a.name)) = lower(entry.name)
  WHERE a.branch_id = v_branch_id;
  IF v_found <> 23 THEN
    RAISE EXCEPTION 'NB: esperados 23 adicionais com nomes correspondentes, encontrados %.', v_found;
  END IF;

  SELECT count(*) INTO v_found FROM public.products
  WHERE branch_id = v_branch_id AND lower(btrim(name)) = lower('Porção de Batata');
  IF v_found <> 1 THEN
    RAISE EXCEPTION 'NB: esperada 1 Porção de Batata, encontradas %.', v_found;
  END IF;

  -- Crepes 01–36.
  UPDATE public.products AS p
  SET price = entry.price
  FROM jsonb_to_recordset(v_crepes) AS entry(code text, price numeric)
  WHERE p.branch_id = v_branch_id
    AND p.name LIKE (entry.code || ' - %')
    AND p.price IS DISTINCT FROM entry.price;

  -- Batata frita (R$ 25).
  UPDATE public.products
  SET price = 25.00
  WHERE branch_id = v_branch_id
    AND lower(btrim(name)) = lower('Porção de Batata')
    AND price IS DISTINCT FROM 25.00;

  -- Bebidas do cardápio impresso. Outras opções cadastradas são preservadas.
  UPDATE public.products AS p
  SET price = entry.price
  FROM jsonb_to_recordset(v_beverages) AS entry(name text, price numeric)
  WHERE p.branch_id = v_branch_id
    AND lower(btrim(p.name)) = lower(entry.name)
    AND p.price IS DISTINCT FROM entry.price;

  -- Adicionais cobrados separadamente.
  UPDATE public.addons AS a
  SET price = entry.price
  FROM jsonb_to_recordset(v_addons) AS entry(name text, price numeric)
  WHERE a.branch_id = v_branch_id
    AND lower(btrim(a.name)) = lower(entry.name)
    AND a.price IS DISTINCT FROM entry.price;

  -- Embalagem para viagem conforme cardápio (R$ 1,00 por embalagem).
  UPDATE public.branches
  SET packing_fee = 1.00
  WHERE id = v_branch_id AND packing_fee IS DISTINCT FROM 1.00;

  RAISE NOTICE 'NB: valores alinhados ao cardápio de 21/10/2026 (36 crepes, 1 batata, 10 bebidas, 23 adicionais, embalagem R$ 1).';
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'Filial Núcleo Bandeirante (slug nb) não encontrada. Nenhum preço atualizado.';
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Slug nb não é único. Nenhum preço atualizado.';
END
$update_nb$;
COMMIT;
