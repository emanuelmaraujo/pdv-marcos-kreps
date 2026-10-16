-- Cardápio oficial enviado para feira do Condomínio Guará em 16/10/2026.
-- Dados operacionais independentes por filial; não altera nenhuma filial existente.
-- Loja ativa no PDV; pedidos públicos, entrega, WhatsApp e impressoras desativados
-- Atendimento presencial no balcão, das 18:00 às 22:00.
-- Horário é informação operacional, não restringe automaticamente pedidos internos.
-- Pedidos públicos/delivery, WhatsApp e impressoras permanecem desativados.
-- 16 salgados + 5 doces; embalagem viagem R$ 1,00. Não há bebidas/adicionais no PDF.
DO $seed$
DECLARE
  v_items jsonb := '[{"n":1,"title":"Presunto e queijo","price":22,"kind":"S","ingredients":["presunto","queijo"]},{"n":2,"title":"Presunto, queijo e milho","price":23,"kind":"S","ingredients":["presunto","queijo","milho"]},{"n":3,"title":"Presunto, queijo, milho e catupiry","price":25,"kind":"S","ingredients":["presunto","queijo","milho","catupiry"]},{"n":4,"title":"Presunto, queijo, milho, catupiry, bacon e ovo","price":28,"kind":"S","ingredients":["presunto","queijo","milho","catupiry","bacon","ovo"]},{"n":5,"title":"Calabresa e queijo","price":22,"kind":"S","ingredients":["calabresa","queijo"]},{"n":6,"title":"Calabresa, queijo e milho","price":23,"kind":"S","ingredients":["calabresa","queijo","milho"]},{"n":7,"title":"Calabresa, queijo, milho e catupiry","price":25,"kind":"S","ingredients":["calabresa","queijo","milho","catupiry"]},{"n":8,"title":"Calabresa, queijo, milho, catupiry, bacon e ovo","price":28,"kind":"S","ingredients":["calabresa","queijo","milho","catupiry","bacon","ovo"]},{"n":9,"title":"Frango e queijo","price":22,"kind":"S","ingredients":["frango","queijo"]},{"n":10,"title":"Frango, queijo e milho","price":23,"kind":"S","ingredients":["frango","queijo","milho"]},{"n":11,"title":"Frango, queijo, milho e catupiry","price":25,"kind":"S","ingredients":["frango","queijo","milho","catupiry"]},{"n":12,"title":"Frango, queijo, milho, catupiry, bacon e ovo","price":28,"kind":"S","ingredients":["frango","queijo","milho","catupiry","bacon","ovo"]},{"n":21,"title":"Carne de sol, queijo e cebola","price":26,"kind":"S","ingredients":["carne de sol","queijo","cebola"]},{"n":22,"title":"Carne de sol, queijo, azeitona e catupiry","price":28,"kind":"S","ingredients":["carne de sol","queijo","azeitona","catupiry"]},{"n":23,"title":"Carne de sol, queijo, cebola, azeitona e cheddar","price":30,"kind":"S","ingredients":["carne de sol","queijo","cebola","azeitona","cheddar"]},{"n":24,"title":"Carne de sol, queijo, cebola, azeitona, cheddar, bacon e ovo","price":40,"kind":"S","ingredients":["carne de sol","queijo","cebola","azeitona","cheddar","bacon","ovo"]},{"n":27,"title":"Banana, queijo, açúcar e canela","price":25,"kind":"D","ingredients":["banana","queijo","açúcar","canela"]},{"n":29,"title":"Banana, queijo, açúcar, canela e chocolate","price":29,"kind":"D","ingredients":["banana","queijo","açúcar","canela","chocolate"]},{"n":32,"title":"Banana, queijo e Nutella","price":35,"kind":"D","ingredients":["banana","queijo","nutella"]},{"n":33,"title":"Morango, queijo e chocolate","price":29,"kind":"D","ingredients":["morango","queijo","chocolate"]},{"n":35,"title":"Morango, queijo e Nutella","price":35,"kind":"D","ingredients":["morango","queijo","nutella"]}]'::jsonb;
  v_branch uuid;
  v_category uuid;
  v_product uuid;
  v_ingredient uuid;
  v_name text;
  v_ing text;
  v_expected_price numeric;
  v_existing integer;
  r record;
BEGIN
  IF EXISTS(SELECT 1 FROM public.branches WHERE code = 'CG' AND slug <> 'condo-guara') THEN
    RAISE EXCEPTION 'Código CG já pertence a outra unidade';
  END IF;
  IF EXISTS(SELECT 1 FROM public.branches WHERE slug = 'condo-guara' AND (code <> 'CG' OR name <> 'Condo Guará')) THEN
    RAISE EXCEPTION 'Slug condo-guara já pertence a cadastro divergente';
  END IF;

  INSERT INTO public.branches
    (code, slug, name, type, active, address, packing_fee, ordering_enabled, ordering_start_time, ordering_end_time, delivery_enabled, whatsapp_enabled, printer_config)
  VALUES
    ('CG','condo-guara','Condo Guará','FAIR',true,'Condomínio Guará, Guará, Brasília - DF',1.00,false,'18:00','22:00',false,false,
     '{"kitchen":{"enabled":false},"juice":{"enabled":false},"customer":{"enabled":false}}'::jsonb)
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO STRICT v_branch FROM public.branches WHERE slug = 'condo-guara';

  SELECT count(*) INTO v_existing FROM public.products WHERE branch_id=v_branch;
  IF v_existing NOT IN (0,21) THEN
    RAISE EXCEPTION 'Unidade com % produtos preexistentes: abortando para evitar mistura de cardápios',v_existing;
  END IF;
  IF v_existing = 21 THEN
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_items) AS e(item)
      LEFT JOIN public.products p ON p.branch_id=v_branch
        AND p.name=(lpad(e.item->>'n',2,'0') || ' - ' || (e.item->>'title'))
      WHERE p.id IS NULL OR p.price IS DISTINCT FROM (e.item->>'price')::numeric
    ) THEN
      RAISE EXCEPTION 'Cardápio já existente diverge dos nomes/preços oficiais';
    END IF;
  END IF;

  INSERT INTO public.categories(branch_id,name,sort_order)
    SELECT v_branch,'Crepes Salgados',1
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE branch_id=v_branch AND name='Crepes Salgados');
  INSERT INTO public.categories(branch_id,name,sort_order)
    SELECT v_branch,'Crepes Doces',2
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE branch_id=v_branch AND name='Crepes Doces');

  FOR r IN SELECT e.item FROM jsonb_array_elements(v_items) e(item) LOOP
    SELECT id INTO STRICT v_category FROM public.categories
     WHERE branch_id=v_branch AND name=CASE WHEN r.item->>'kind'='S' THEN 'Crepes Salgados' ELSE 'Crepes Doces' END;
    v_name := lpad(r.item->>'n',2,'0') || ' - ' || (r.item->>'title');
    v_expected_price := (r.item->>'price')::numeric;
    SELECT id INTO v_product FROM public.products WHERE branch_id=v_branch AND name=v_name;
    IF v_product IS NULL THEN
      INSERT INTO public.products(branch_id,category_id,name,price,sector,active,sort_order)
      VALUES (v_branch,v_category,v_name,v_expected_price,'KITCHEN',true,(r.item->>'n')::integer)
      RETURNING id INTO v_product;
    END IF;
    IF EXISTS (SELECT 1 FROM public.products WHERE id=v_product AND
      (price IS DISTINCT FROM v_expected_price OR category_id <> v_category OR NOT active OR sector <> 'KITCHEN')) THEN
       RAISE EXCEPTION 'Produto divergente: %',v_name;
    END IF;
    FOR v_ing IN SELECT ingredient FROM jsonb_array_elements_text(r.item->'ingredients') AS x(ingredient) LOOP
      INSERT INTO public.ingredients(branch_id,name)
      SELECT v_branch,v_ing
      WHERE NOT EXISTS(SELECT 1 FROM public.ingredients WHERE branch_id=v_branch AND name=v_ing);
      SELECT id INTO STRICT v_ingredient FROM public.ingredients WHERE branch_id=v_branch AND name=v_ing;
      INSERT INTO public.product_ingredients(product_id,ingredient_id) VALUES(v_product,v_ingredient)
      ON CONFLICT(product_id,ingredient_id) DO NOTHING;
    END LOOP;
  END LOOP;

  IF (SELECT count(*) FROM public.products WHERE branch_id=v_branch) <> 21 THEN
    RAISE EXCEPTION 'Falha na integridade do cardápio: esperado 21 produtos';
  END IF;
  IF (SELECT count(*) FROM public.product_ingredients pi
       JOIN public.products p ON p.id=pi.product_id WHERE p.branch_id=v_branch) <> 82 THEN
    RAISE EXCEPTION 'Vínculos de ingredientes divergentes';
  END IF;
END $seed$;
