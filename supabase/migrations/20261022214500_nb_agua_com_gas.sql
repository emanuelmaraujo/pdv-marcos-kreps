-- Unidade Núcleo Bandeirante: cadastrar Água com gás com preço igual
-- ao produto "Água" (sem gás) já existente na MESMA filial.
--
-- Referência conferida em 22/10/2026: Água = R$ 4,00 na filial nb.
-- O valor é lido do banco na aplicação para preservar a igualdade mesmo
-- se o preço da água normal for atualizado antes da execução desta migration.
-- Não altera outras filiais nem sobrescreve imagens de produtos existentes.
-- Migration de dados: aplicar somente após revisão e aprovação humana.

BEGIN;

DO $nb_agua_gas$
DECLARE
  v_branch_id uuid;
  v_water_category_id uuid;
  v_water_price numeric(10,2);
  v_water_count integer;
  v_gas_count integer;
BEGIN
  SELECT id INTO STRICT v_branch_id
  FROM public.branches
  WHERE slug = 'nb';

  -- Há um único item de água sem gás nessa unidade?
  -- btrim trata o cadastro real existente, que possui espaço no final.
  -- PostgreSQL não fornece max(uuid). A cardinalidade é validada abaixo;
  -- array_agg preserva a categoria do único produto sem agregar UUID por ordem.
  SELECT count(*), (array_agg(p.category_id))[1], max(p.price)
    INTO v_water_count, v_water_category_id, v_water_price
  FROM public.products AS p
  WHERE p.branch_id = v_branch_id
    AND lower(btrim(p.name)) IN ('água', 'agua');

  IF v_water_count <> 1 OR v_water_price IS NULL OR v_water_price < 0 THEN
    RAISE EXCEPTION
      'NB: esperado exatamente um produto Água (sem gás) válido; encontrados %.',
      v_water_count;
  END IF;

  -- Evita duplicar e reconhece registro homônimo preexistente.
  SELECT count(*) INTO v_gas_count
  FROM public.products AS p
  WHERE p.branch_id = v_branch_id
    AND lower(btrim(p.name)) IN ('água com gás', 'agua com gas');

  IF v_gas_count > 1 THEN
    RAISE EXCEPTION
      'NB: existem % produtos Água com gás; abortando para evitar duplicidade.',
      v_gas_count;
  END IF;

  IF v_gas_count = 0 THEN
    INSERT INTO public.products
      (branch_id, category_id, name, price, sector, active, sort_order)
    VALUES
      (v_branch_id, v_water_category_id, 'Água com gás', v_water_price,
       'NONE', TRUE,
       (SELECT COALESCE(MAX(sort_order), 0) + 1
        FROM public.products
        WHERE branch_id = v_branch_id AND category_id = v_water_category_id));
  ELSE
    UPDATE public.products
       SET price = v_water_price, active = TRUE
     WHERE branch_id = v_branch_id
       AND lower(btrim(name)) IN ('água com gás', 'agua com gas')
       AND (price IS DISTINCT FROM v_water_price OR active IS DISTINCT FROM TRUE);
  END IF;

  RAISE NOTICE
    'NB: Água com gás cadastrada/alinhada à Água sem gás no valor de R$ %.',
    v_water_price;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION
      'NB: filial slug=nb não encontrada. Nenhuma alteração realizada.';
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION
      'NB: cadastro duplicado para slug=nb. Nenhuma alteração realizada.';
END
$nb_agua_gas$;

COMMIT;
