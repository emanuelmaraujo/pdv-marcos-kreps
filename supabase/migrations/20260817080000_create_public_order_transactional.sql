-- Migration: Criação atômica de pedido público (Fase P0.3)
-- Date: 2026-08-17
-- Notes:
--   * create-public-order inseria orders e depois order_items/addons/removidos
--     em loop via supabase-js. Uma falha no meio do loop podia deixar um
--     pedido público sem todos os itens (o cliente pagaria por menos do que
--     pediu, ou o pedido chegaria incompleto na cozinha).
--   * A validação de negócio (produto ativo, addon permitido, ingrediente
--     removível, filial aberta, janela de atendimento, taxa de entrega por
--     zona) continua inteiramente na Edge Function — ela nunca confia em
--     preço/taxa vindos do cliente, só no que ela mesma calculou lendo o
--     banco. Esta RPC só garante que a escrita final é atômica.
--   * Sem actor_id: pedido público é criado por usuário anônimo (a Edge
--     Function já roda com service_role). Só service_role pode chamar esta
--     RPC — nunca é exposta a um client anon direto.

CREATE OR REPLACE FUNCTION create_public_order_transactional(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id     UUID;
  v_order_id      UUID;
  v_daily_number  INT;
  v_public_token  TEXT;
  v_total_amount  NUMERIC;
  v_item          JSONB;
  v_removed       JSONB;
  v_addon         JSONB;
  v_item_id       UUID;
BEGIN
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id ausente.' USING ERRCODE = '22023';
  END IF;

  IF p_payload->'items' IS NULL OR jsonb_typeof(p_payload->'items') <> 'array'
     OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO orders (
    branch_id, type, source, status, payment_status, payment_method,
    customer_name, customer_phone, customer_email, customer_id,
    packing_fee, delivery_fee,
    delivery_street, delivery_number, delivery_complement, delivery_neighborhood,
    delivery_city, delivery_state, delivery_postal_code, delivery_reference,
    total_amount, notes
  ) VALUES (
    v_branch_id, (p_payload->>'order_type')::order_type, 'APP', 'AGUARDANDO_PAGAMENTO', 'PENDING', 'PENDING',
    NULLIF(p_payload->>'customer_name', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_id', ''),
    COALESCE((p_payload->>'packing_fee')::NUMERIC, 0),
    COALESCE((p_payload->>'delivery_fee')::NUMERIC, 0),
    p_payload#>>'{delivery,street}', p_payload#>>'{delivery,number}',
    p_payload#>>'{delivery,complement}', p_payload#>>'{delivery,neighborhood}',
    p_payload#>>'{delivery,city}', p_payload#>>'{delivery,state}',
    p_payload#>>'{delivery,postal_code}', p_payload#>>'{delivery,reference}',
    COALESCE((p_payload->>'total_amount')::NUMERIC, 0),
    NULLIF(p_payload->>'notes', '')
  )
  RETURNING id, daily_number, public_token, total_amount
    INTO v_order_id, v_daily_number, v_public_token, v_total_amount;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name_snapshot, product_price_snapshot,
      cost_price_snapshot, production_sector, quantity, observation, total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'product_price_snapshot')::NUMERIC,
      COALESCE((v_item->>'cost_price_snapshot')::NUMERIC, 0),
      (v_item->>'production_sector')::production_sector,
      (v_item->>'quantity')::INT,
      NULLIF(v_item->>'observation', ''),
      (v_item->>'total_price')::NUMERIC
    )
    RETURNING id INTO v_item_id;

    FOR v_removed IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'removed_ingredients', '[]'::jsonb))
    LOOP
      INSERT INTO order_item_removed_ingredients (order_item_id, ingredient_id, ingredient_name_snapshot)
      VALUES (v_item_id, NULLIF(v_removed->>'ingredient_id', '')::UUID, v_removed->>'ingredient_name_snapshot');
    END LOOP;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons', '[]'::jsonb))
    LOOP
      INSERT INTO order_item_addons (order_item_id, addon_id, quantity, addon_name_snapshot, addon_price_snapshot)
      VALUES (
        v_item_id,
        NULLIF(v_addon->>'addon_id', '')::UUID,
        (v_addon->>'quantity')::INT,
        v_addon->>'addon_name_snapshot',
        (v_addon->>'addon_price_snapshot')::NUMERIC
      );
    END LOOP;
  END LOOP;

  INSERT INTO audit_logs (action, table_name, record_id, branch_id, new_data)
  VALUES (
    'PUBLIC_ORDER_CREATED_AWAITING_PAYMENT',
    'orders',
    v_order_id,
    v_branch_id,
    jsonb_build_object(
      'daily_number', v_daily_number,
      'total_amount', v_total_amount,
      'payment_method_code', p_payload->>'payment_method_code',
      'source', 'APP',
      'order_type', p_payload->>'order_type',
      'delivery_fee', p_payload->>'delivery_fee'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'daily_number', v_daily_number,
    'public_token', v_public_token,
    'total_amount', v_total_amount,
    'status', 'AGUARDANDO_PAGAMENTO',
    'payment_status', 'PENDING'
  );
END;
$$;

REVOKE ALL ON FUNCTION create_public_order_transactional(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_public_order_transactional(JSONB) TO service_role;
