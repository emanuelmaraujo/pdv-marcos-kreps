-- Bebidas em lata R$ 7,00; exclusivamente Condo Guará.
-- Dados de catálogo: sem alterar demais filiais, preços de crepes ou pedidos existentes.
-- Reexecutável: inserção somente de ausentes; divergência anterior aborta a operação.
DO $bebidas$
DECLARE
  v_branch uuid;
  v_category uuid;
  v_name text;
  v_existing record;
  v_added integer;
BEGIN
  SELECT id INTO STRICT v_branch
  FROM public.branches
  WHERE slug = 'condo-guara' AND code = 'CG';

  IF (SELECT count(*) FROM public.categories
      WHERE branch_id = v_branch AND name = 'Bebidas') > 1 THEN
    RAISE EXCEPTION 'Categoria Bebidas duplicada no Condo Guará';
  END IF;

  INSERT INTO public.categories (branch_id, name, active, sort_order)
  SELECT v_branch, 'Bebidas', TRUE, 3
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categories WHERE branch_id = v_branch AND name = 'Bebidas'
  );

  SELECT id INTO STRICT v_category FROM public.categories
  WHERE branch_id = v_branch AND name = 'Bebidas' AND active = TRUE;

  FOR v_name IN SELECT unnest(ARRAY[
    'Coca-Cola Original Lata',
    'Coca-Cola Zero Lata',
    'Coca-Cola Triplo Zero Lata'
  ]) LOOP
    SELECT id, category_id, price, active, sector
      INTO v_existing
    FROM public.products
    WHERE branch_id = v_branch AND name = v_name
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.category_id <> v_category
         OR v_existing.price <> 7.00
         OR NOT v_existing.active
         OR v_existing.sector <> 'NONE' THEN
        RAISE EXCEPTION 'Produto existente divergente: %', v_name;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.products
    (branch_id, category_id, name, price, sector, active, sort_order)
  SELECT v_branch, v_category, x.name, 7.00, 'NONE', TRUE, x.ord
  FROM (
    VALUES
      ('Coca-Cola Original Lata', 1),
      ('Coca-Cola Zero Lata', 2),
      ('Coca-Cola Triplo Zero Lata', 3)
  ) AS x(name, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.branch_id = v_branch AND p.name = x.name
  );

  SELECT COUNT(*) INTO v_added FROM public.products p
  WHERE p.branch_id = v_branch AND p.category_id = v_category
    AND p.price = 7.00 AND p.active = TRUE
    AND p.name IN (
      'Coca-Cola Original Lata',
      'Coca-Cola Zero Lata',
      'Coca-Cola Triplo Zero Lata'
    );
  IF v_added <> 3 THEN
    RAISE EXCEPTION 'Esperadas 3 bebidas ativas por R$ 7,00; encontradas %', v_added;
  END IF;
END $bebidas$;
