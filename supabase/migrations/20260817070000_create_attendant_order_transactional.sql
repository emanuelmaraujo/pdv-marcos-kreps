-- Migration: Criação atômica de pedido do atendente (Fase P0.2)
-- Date: 2026-08-17
-- Notes:
--   * create-attendant-order inseria orders, order_items, order_item_addons,
--     order_item_removed_ingredients, discounts, payments, printer_jobs e
--     audit_logs em chamadas supabase-js separadas. Uma falha no meio do
--     caminho (rede, constraint, timeout) podia deixar um pedido sem itens,
--     sem pagamento ou sem job de impressão.
--   * A validação de negócio (produto ativo, addon permitido, ingrediente
--     removível, cálculo de preço/taxa/desconto) continua na Edge Function —
--     ela já lê tudo do banco via supabaseAdmin antes de montar o payload, e
--     portar isso pra SQL não mudaria o resultado, só duplicaria a lógica.
--     Esta RPC garante que, uma vez que o payload já validado chega aqui,
--     pedido + itens + addons + removidos + desconto + pagamento + auditoria
--     acontecem em uma única transação: se qualquer INSERT falhar, tudo é
--     revertido — nenhum pedido/pagamento parcial fica no banco.
--   * Os jobs de impressão continuam sendo inseridos pela Edge Function DEPOIS
--     da RPC retornar, não dentro dela — o conteúdo do recibo (buildProductionReceipt/
--     buildCustomerReceipt, helpers TS compartilhados) inclui orders.daily_number,
--     que só existe depois que o trigger set_daily_order_number roda no INSERT.
--     Isso deixa uma janela pequena e já pré-existente (pedido pago sem job de
--     impressão se a 2ª chamada falhar) — bem menor que o risco original de
--     pedido sem itens/pagamento, e recuperável via reprint-order.

CREATE OR REPLACE FUNCTION create_attendant_order_transactional(
  p_payload  JSONB,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role     user_role;
  v_actor_active   BOOLEAN;
  v_branch_id      UUID;
  v_is_split       BOOLEAN;
  v_status         order_status;
  v_order_id       UUID;
  v_daily_number   INT;
  v_now            TIMESTAMPTZ := NOW();
  v_discount       JSONB;
  v_item           JSONB;
  v_removed        JSONB;
  v_addon          JSONB;
  v_item_id        UUID;
  v_item_pay_status payment_status;
  v_item_pay_method payment_method;
  v_item_paid_at   TIMESTAMPTZ;
  v_payment_status payment_status;
BEGIN
  SELECT role, active INTO v_actor_role, v_actor_active
    FROM profiles WHERE id = p_actor_id;

  IF v_actor_role IS NULL OR v_actor_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuário sem profile ou inativo.' USING ERRCODE = '28000';
  END IF;
  IF v_actor_role NOT IN ('ADMIN', 'ATTENDANT') THEN
    RAISE EXCEPTION 'Role não autorizada.' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id ausente.' USING ERRCODE = '22023';
  END IF;

  IF p_payload->'items' IS NULL OR jsonb_typeof(p_payload->'items') <> 'array'
     OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'O carrinho está vazio.' USING ERRCODE = '22023';
  END IF;

  v_is_split       := COALESCE((p_payload->>'is_split_bill')::BOOLEAN, FALSE);
  v_status         := CASE WHEN v_is_split THEN 'AGUARDANDO_PAGAMENTO' ELSE 'NA_FILA' END;
  v_payment_status := (p_payload->>'payment_status')::payment_status;

  INSERT INTO orders (
    branch_id, source, type, status,
    customer_name, customer_phone, customer_id, notes,
    discount_amount, packing_fee, delivery_fee,
    delivery_street, delivery_number, delivery_complement, delivery_neighborhood,
    delivery_city, delivery_state, delivery_postal_code, delivery_reference,
    courier_name, courier_phone,
    total_amount, payment_method, payment_status,
    created_by, confirmed_by, confirmed_at, queue_entered_at, paid_at
  ) VALUES (
    v_branch_id, 'ATTENDANT', (p_payload->>'order_type')::order_type, v_status,
    NULLIF(p_payload->>'customer_name', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'customer_id', ''),
    NULLIF(p_payload->>'notes', ''),
    COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'packing_fee')::NUMERIC, 0),
    COALESCE((p_payload->>'delivery_fee')::NUMERIC, 0),
    p_payload#>>'{delivery,street}', p_payload#>>'{delivery,number}',
    p_payload#>>'{delivery,complement}', p_payload#>>'{delivery,neighborhood}',
    p_payload#>>'{delivery,city}', p_payload#>>'{delivery,state}',
    p_payload#>>'{delivery,postal_code}', p_payload#>>'{delivery,reference}',
    NULLIF(p_payload->>'courier_name', ''), NULLIF(p_payload->>'courier_phone', ''),
    COALESCE((p_payload->>'total_amount')::NUMERIC, 0),
    (p_payload->>'payment_method')::payment_method,
    v_payment_status,
    p_actor_id,
    CASE WHEN v_is_split THEN NULL ELSE p_actor_id END,
    CASE WHEN v_is_split THEN NULL ELSE v_now END,
    CASE WHEN v_is_split THEN NULL ELSE v_now END,
    CASE WHEN v_payment_status IN ('PAID', 'COURTESY') THEN v_now ELSE NULL END
  )
  RETURNING id, daily_number INTO v_order_id, v_daily_number;

  INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id)
  VALUES ('ORDER_CREATED', 'orders', v_order_id, p_actor_id, v_branch_id);
  IF NOT v_is_split THEN
    INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id)
    VALUES ('ORDER_SENT_TO_QUEUE', 'orders', v_order_id, p_actor_id, v_branch_id);
  END IF;

  -- Desconto
  v_discount := p_payload->'discount';
  IF v_discount IS NOT NULL AND jsonb_typeof(v_discount) = 'object' THEN
    INSERT INTO discounts (order_id, type, value, amount_applied, reason, granted_by)
    VALUES (
      v_order_id,
      v_discount->>'type',
      (v_discount->>'value')::NUMERIC,
      (v_discount->>'amount_applied')::NUMERIC,
      v_discount->>'reason',
      p_actor_id
    );
    INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id)
    VALUES ('DISCOUNT_APPLIED', 'orders', v_order_id, p_actor_id, v_branch_id);
  END IF;

  -- Pagamento no ato (independe de split_bill — mesmo comportamento da Edge Function original)
  IF v_payment_status = 'PAID' THEN
    INSERT INTO payments (order_id, amount, payment_method, payment_status, received_by, notes)
    VALUES (
      v_order_id,
      COALESCE((p_payload->>'payment_amount')::NUMERIC, (p_payload->>'total_amount')::NUMERIC),
      (p_payload->>'payment_method')::payment_method,
      'PAID',
      p_actor_id,
      NULLIF(p_payload->>'payment_notes', '')
    );
    INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id)
    VALUES ('PAYMENT_MARKED_PAID', 'orders', v_order_id, p_actor_id, v_branch_id);
  ELSIF v_payment_status = 'COURTESY' THEN
    INSERT INTO payments (order_id, amount, payment_method, payment_status, received_by)
    VALUES (v_order_id, COALESCE((p_payload->>'total_amount')::NUMERIC, 0), 'COURTESY', 'COURTESY', p_actor_id);
    INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id)
    VALUES ('PAYMENT_MARKED_COURTESY', 'orders', v_order_id, p_actor_id, v_branch_id);
  END IF;

  -- Itens — nascem com o payment_status do pedido quando pago no ato e
  -- não é split_bill (mesma regra da Edge Function: em split_bill os itens
  -- ficam PENDING até cada um ser pago via pay_order_items_transactional).
  IF NOT v_is_split AND v_payment_status IN ('PAID', 'COURTESY') THEN
    v_item_pay_status := v_payment_status;
    v_item_pay_method := (p_payload->>'payment_method')::payment_method;
    v_item_paid_at    := v_now;
  ELSE
    v_item_pay_status := 'PENDING';
    v_item_pay_method := 'PENDING';
    v_item_paid_at    := NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name_snapshot, product_price_snapshot,
      cost_price_snapshot, production_sector, quantity, observation, is_takeout,
      total_price, payment_status, payment_method, paid_at
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name_snapshot',
      (v_item->>'product_price_snapshot')::NUMERIC,
      COALESCE((v_item->>'cost_price_snapshot')::NUMERIC, 0),
      (v_item->>'production_sector')::production_sector,
      (v_item->>'quantity')::INT,
      NULLIF(v_item->>'observation', ''),
      COALESCE((v_item->>'is_takeout')::BOOLEAN, FALSE),
      (v_item->>'total_price')::NUMERIC,
      v_item_pay_status,
      v_item_pay_method,
      v_item_paid_at
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

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'daily_number', v_daily_number,
    'status', v_status,
    'payment_status', v_payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION create_attendant_order_transactional(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_attendant_order_transactional(JSONB, UUID) TO service_role;
