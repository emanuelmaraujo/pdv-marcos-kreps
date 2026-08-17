-- Migration: Pagamento transacional (Fase P0.1)
-- Date: 2026-08-17
-- Notes:
--   * Move a regra financeira crítica de mark-payment (Edge Function) para o
--     banco via RPC transacional. Elimina a corrida entre leitura, cálculo e
--     escrita que existia quando essas etapas rodavam separadas via
--     supabase-js a partir da Edge Function.
--   * SELECT ... FOR UPDATE no pedido e nos itens-alvo serializa chamadas
--     concorrentes: a segunda chamada só prossegue depois que a primeira
--     confirma (ou reverte), e nesse ponto os itens já não estarão mais
--     elegíveis (idempotência via a mesma checagem de "já pago" que existia
--     na Edge Function).
--   * Fix de drift: orders.ifood_charged_amount era referenciado por
--     mark-payment/index.ts mas nunca tinha sido criado por nenhuma migration.

-- ============================================================================
-- 0. Fix de drift — coluna usada pela Edge Function mas nunca migrada.
-- ============================================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ifood_charged_amount NUMERIC(10, 2);

-- ============================================================================
-- 1. RPC transacional de pagamento
-- ============================================================================
CREATE OR REPLACE FUNCTION pay_order_items_transactional(
  p_order_id             UUID,
  p_actor_id              UUID,
  p_payment_method        payment_method,
  p_payment_status        payment_status,
  p_amount                NUMERIC,
  p_item_ids              UUID[] DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL,
  p_ifood_charged_amount  NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role      user_role;
  v_actor_active    BOOLEAN;
  v_order           orders%ROWTYPE;
  v_target_ids      UUID[];
  v_target_total    NUMERIC := 0;
  v_unpaid_outside  INT;
  v_payment_amount  NUMERIC := 0;
  v_now             TIMESTAMPTZ := NOW();
  v_order_after     JSONB;
BEGIN
  IF p_payment_status NOT IN ('PENDING', 'PAID', 'REFUNDED', 'CANCELED', 'COURTESY') THEN
    RAISE EXCEPTION 'payment_status inválido: %', p_payment_status USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id ausente.' USING ERRCODE = '22023';
  END IF;

  -- Actor validado dentro da função — não confiamos apenas na checagem da
  -- Edge Function, já que a RPC é o limite de segurança real (SECURITY DEFINER).
  SELECT role, active INTO v_actor_role, v_actor_active
    FROM profiles WHERE id = p_actor_id;

  IF v_actor_role IS NULL OR v_actor_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuário sem profile ou inativo.' USING ERRCODE = '28000';
  END IF;
  IF v_actor_role NOT IN ('ADMIN', 'ATTENDANT') THEN
    RAISE EXCEPTION 'Role não autorizada.' USING ERRCODE = '42501';
  END IF;
  IF p_payment_status = 'REFUNDED' AND v_actor_role <> 'ADMIN' THEN
    RAISE EXCEPTION 'Apenas ADMIN pode estornar (REFUNDED).' USING ERRCODE = '42501';
  END IF;

  IF p_payment_method = 'IFOOD'
     AND (p_ifood_charged_amount IS NULL OR p_ifood_charged_amount < 0) THEN
    RAISE EXCEPTION 'ifood_charged_amount inválido.' USING ERRCODE = '22023';
  END IF;

  -- Lock do pedido — serializa qualquer outra chamada concorrente sobre o mesmo pedido.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido inexistente.' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status IN ('CANCELADO', 'EXPIRADO') THEN
    RAISE EXCEPTION 'Não é possível alterar pagamento de pedido cancelado/expirado.' USING ERRCODE = '22023';
  END IF;

  -- Determina e trava (FOR UPDATE) os itens-alvo.
  IF p_item_ids IS NOT NULL AND array_length(p_item_ids, 1) > 0 THEN
    -- FOR UPDATE não pode ser combinado com agregação (array_agg) na mesma
    -- consulta: trava as linhas num CTE e agrega o resultado já travado fora dele.
    WITH locked AS (
      SELECT id FROM order_items WHERE id = ANY(p_item_ids) FOR UPDATE
    )
    SELECT array_agg(id) INTO v_target_ids FROM locked;

    IF v_target_ids IS NULL OR array_length(v_target_ids, 1) <> array_length(p_item_ids, 1) THEN
      RAISE EXCEPTION 'Algum order_item_id é inválido.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM order_items WHERE id = ANY(p_item_ids) AND order_id <> p_order_id) THEN
      RAISE EXCEPTION 'Itens devem pertencer ao mesmo pedido.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM order_items WHERE id = ANY(p_item_ids) AND status = 'CANCELLED') THEN
      RAISE EXCEPTION 'Item cancelado não pode receber pagamento.' USING ERRCODE = '22023';
    END IF;

    IF p_payment_status IN ('PAID', 'COURTESY') THEN
      IF EXISTS (
        SELECT 1 FROM order_items
         WHERE id = ANY(p_item_ids) AND payment_status IN ('PAID', 'COURTESY')
      ) THEN
        RAISE EXCEPTION 'Um ou mais itens selecionados ja foram pagos.' USING ERRCODE = '22023';
      END IF;
    END IF;

    SELECT COALESCE(SUM(total_price), 0) INTO v_target_total
      FROM order_items WHERE id = ANY(p_item_ids);
  ELSE
    WITH locked AS (
      SELECT id FROM order_items
       WHERE order_id = p_order_id
         AND status <> 'CANCELLED'
         AND payment_status NOT IN ('PAID', 'COURTESY')
         FOR UPDATE
    )
    SELECT array_agg(id) INTO v_target_ids FROM locked;

    SELECT COALESCE(SUM(total_price), 0) INTO v_target_total
      FROM order_items WHERE id = ANY(v_target_ids);
  END IF;

  IF v_target_ids IS NULL OR array_length(v_target_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens elegíveis pra pagamento.' USING ERRCODE = '22023';
  END IF;

  -- Ao quitar o restante do pedido (nenhum outro item pendente fora do alvo,
  -- e pedido ainda não tinha sido pago), inclui packing_fee/delivery_fee.
  IF p_payment_status IN ('PAID', 'COURTESY') THEN
    SELECT COUNT(*) INTO v_unpaid_outside
      FROM order_items
     WHERE order_id = p_order_id
       AND status <> 'CANCELLED'
       AND payment_status NOT IN ('PAID', 'COURTESY')
       AND NOT (id = ANY(v_target_ids));

    IF v_unpaid_outside = 0 AND v_order.paid_at IS NULL THEN
      v_target_total := v_target_total + COALESCE(v_order.packing_fee, 0) + COALESCE(v_order.delivery_fee, 0);
    END IF;
  END IF;

  IF p_payment_status = 'PAID' THEN
    IF p_amount IS NULL OR ROUND(p_amount * 100) <> ROUND(v_target_total * 100) THEN
      RAISE EXCEPTION 'Valor (R$ %) difere do total (R$ %).', p_amount, ROUND(v_target_total, 2)
        USING ERRCODE = '22023';
    END IF;
    v_payment_amount := v_target_total;
  ELSIF p_payment_status = 'COURTESY' THEN
    v_payment_amount := v_target_total;
  ELSIF p_payment_status = 'REFUNDED' THEN
    v_payment_amount := -ABS(COALESCE(p_amount, v_target_total));
  END IF;

  UPDATE order_items
     SET payment_status = p_payment_status,
         payment_method = p_payment_method,
         paid_at = CASE
                     WHEN p_payment_status IN ('PAID', 'COURTESY') THEN v_now
                     WHEN p_payment_status = 'PENDING' THEN NULL
                     ELSE paid_at
                   END
   WHERE id = ANY(v_target_ids);

  -- order_items_status_change / state_update triggers derivam
  -- orders.status e orders.payment_status automaticamente aqui.

  IF p_payment_status IN ('PAID', 'COURTESY', 'REFUNDED') THEN
    INSERT INTO payments (order_id, amount, payment_method, payment_status, received_by, notes, order_item_ids)
    VALUES (p_order_id, v_payment_amount, p_payment_method, p_payment_status, p_actor_id, p_notes, v_target_ids);
  END IF;

  IF p_payment_method = 'IFOOD' THEN
    UPDATE orders SET ifood_charged_amount = p_ifood_charged_amount WHERE id = p_order_id;
  END IF;

  INSERT INTO audit_logs (action, table_name, record_id, user_id, branch_id, new_data)
  VALUES (
    'PAYMENT_' || p_payment_status::TEXT,
    'orders',
    p_order_id,
    p_actor_id,
    v_order.branch_id,
    jsonb_build_object(
      'payment_method', p_payment_method,
      'amount', v_payment_amount,
      'item_ids_count', array_length(v_target_ids, 1),
      'scope', CASE WHEN p_item_ids IS NOT NULL THEN 'ITEMS' ELSE 'ORDER' END
    )
  );

  SELECT to_jsonb(o.*) INTO v_order_after FROM orders o WHERE o.id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order', v_order_after,
    'items_paid', array_length(v_target_ids, 1),
    'target_item_ids', to_jsonb(v_target_ids),
    'amount', v_payment_amount
  );
END;
$$;

-- Só a Edge Function (via service_role) deve poder chamar esta RPC — ela
-- confia em p_actor_id como o usuário já autenticado via JWT, então não pode
-- ficar exposta a clientes autenticados comuns (que poderiam forjar o ator).
REVOKE ALL ON FUNCTION pay_order_items_transactional(
  UUID, UUID, payment_method, payment_status, NUMERIC, UUID[], TEXT, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pay_order_items_transactional(
  UUID, UUID, payment_method, payment_status, NUMERIC, UUID[], TEXT, NUMERIC
) TO service_role;
