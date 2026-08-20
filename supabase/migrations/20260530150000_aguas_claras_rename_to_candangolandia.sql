-- Migration: Renomeia produtos de Águas Claras para usar EXATAMENTE os nomes
-- atuais da Candangolândia (lidos do próprio DB em tempo de execução —
-- evita drift caso alguém tenha renomeado lá pela UI).
--
-- Mapping por sort_order (1↔1):
--   AC sort_order 3   → Candangolândia sort_order 1   (Presunto base)
--   AC sort_order 4   → Candangolândia sort_order 2   (Presunto + bacon/ovo)
--   AC sort_order 7   → Candangolândia sort_order 3   (Calabresa base)
--   AC sort_order 8   → Candangolândia sort_order 4   (Calabresa + bacon/ovo)
--   AC sort_order 11  → Candangolândia sort_order 5   (Frango base)
--   AC sort_order 12  → Candangolândia sort_order 6   (Frango + bacon/ovo)
--   AC sort_order 27  → Candangolândia sort_order 7   (Banana c/ canela)
--   AC sort_order 29  → Candangolândia sort_order 8   (Banana c/ canela + choc)
--   AC sort_order 32  → Candangolândia sort_order 9   (Banana c/ Nutella)
--   AC sort_order 33  → Candangolândia sort_order 10  (Morango c/ choc)
--   AC sort_order 35  → Candangolândia sort_order 11  (Morango c/ Nutella)
--
-- Preserva os preços atuais de Águas Claras (R$30/R$36 do PDF).

DO $$
DECLARE
  v_ac_branch  UUID;
  v_fc_branch  UUID;
  v_map        RECORD;
  v_fc_name    TEXT;
BEGIN
  SELECT id INTO v_ac_branch
  FROM branches
  WHERE name ILIKE '%águas%claras%' OR name ILIKE '%aguas%claras%' OR slug = 'aguas-claras'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_ac_branch IS NULL THEN
    -- Mesma razão do seed de Águas Claras: filial é dado operacional, pode
    -- legitimamente não existir ainda num ambiente novo (reset local, CI).
    RAISE NOTICE 'Filial Águas Claras não encontrada — pulando rename.';
    RETURN;
  END IF;

  SELECT id INTO v_fc_branch
  FROM branches
  WHERE name ILIKE '%candang%' OR slug = 'feira-candangolandia' OR code = 'FC'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_fc_branch IS NULL THEN
    RAISE EXCEPTION 'Filial Candangolândia não encontrada — não há de onde copiar os nomes.';
  END IF;

  -- Faz o UPDATE par a par. Se algum AC product não existir mais (renomeado
  -- pela UI), o WHERE não casa e pula em silêncio (idempotente).
  FOR v_map IN
    SELECT * FROM (VALUES
      ( 3,  1),
      ( 4,  2),
      ( 7,  3),
      ( 8,  4),
      (11,  5),
      (12,  6),
      (27,  7),
      (29,  8),
      (32,  9),
      (33, 10),
      (35, 11)
    ) AS m(ac_sort, fc_sort)
  LOOP
    SELECT name INTO v_fc_name
    FROM products
    WHERE branch_id = v_fc_branch AND sort_order = v_map.fc_sort
    LIMIT 1;

    IF v_fc_name IS NULL THEN
      RAISE NOTICE 'Candangolândia sort_order=% não encontrado — pulando.', v_map.fc_sort;
      CONTINUE;
    END IF;

    UPDATE products
    SET name = v_fc_name, sort_order = v_map.fc_sort
    WHERE branch_id = v_ac_branch AND sort_order = v_map.ac_sort;
  END LOOP;
END $$;
