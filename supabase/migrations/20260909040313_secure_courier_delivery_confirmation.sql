-- A confirmação final de um delivery pertence exclusivamente ao motoboy
-- cadastrado e atribuído ao pedido. A operação é atômica para impedir que os
-- itens sejam concluídos sem que o pedido (ou a auditoria) também seja.

-- Os triggers antigos dependiam do search_path herdado da sessão. Como a
-- confirmação abaixo usa search_path vazio por segurança, fixe explicitamente
-- o schema das funções chamadas quando um item muda de estado.
ALTER FUNCTION public.trg_order_items_recompute_order()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_order_status_from_items(UUID)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_order_payment_status_from_items(UUID)
  SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.confirm_courier_delivery_transactional(
  p_order_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_courier_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_order_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Pedido e entregador são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  SELECT c.id
    INTO v_courier_id
  FROM public.couriers AS c
  JOIN public.profiles AS p ON p.id = c.profile_id
  WHERE c.profile_id = p_actor_id
    AND c.active = TRUE
    AND p.active = TRUE
    AND p.role = 'COURIER';

  IF v_courier_id IS NULL THEN
    RAISE EXCEPTION 'Somente um entregador ativo pode confirmar a entrega.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.type <> 'ENTREGA' THEN
    RAISE EXCEPTION 'Só pedidos do tipo ENTREGA podem usar esta confirmação.' USING ERRCODE = '22023';
  END IF;

  IF v_order.status <> 'SAIU_PARA_ENTREGA' THEN
    RAISE EXCEPTION 'O pedido precisa estar em rota para ser confirmado.' USING ERRCODE = '22023';
  END IF;

  IF v_order.courier_id IS DISTINCT FROM v_courier_id THEN
    RAISE EXCEPTION 'Pedido não pertence a este entregador.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.order_items
  SET status = 'DELIVERED',
      delivered_at = v_now
  WHERE order_id = v_order.id
    AND status IN ('READY', 'PENDING', 'IN_PREPARATION');

  UPDATE public.orders
  SET status = 'ENTREGUE',
      delivered_at = v_now,
      delivery_delivered_at = v_now
  WHERE id = v_order.id;

  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    branch_id,
    new_data
  ) VALUES (
    'ORDER_DELIVERY_CONFIRMED',
    'orders',
    v_order.id,
    p_actor_id,
    v_order.branch_id,
    jsonb_build_object(
      'from', 'SAIU_PARA_ENTREGA',
      'to', 'ENTREGUE',
      'confirmation_source', 'COURIER_HOLD',
      'courier_id', v_courier_id
    )
  );

  RETURN jsonb_build_object(
    'id', v_order.id,
    'daily_number', v_order.daily_number,
    'status', 'ENTREGUE',
    'delivered_at', v_now,
    'delivery_delivered_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_courier_delivery_transactional(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_courier_delivery_transactional(UUID, UUID)
  TO service_role;

-- Bancos locais recriados por migrations não herdam necessariamente os grants
-- do Dashboard. Mantém a Data API alinhada às policies já existentes e garante
-- que as Edge Functions continuem operando com service_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON TABLE
  public.branches,
  public.profiles,
  public.profile_branches,
  public.categories,
  public.products,
  public.ingredients,
  public.addons,
  public.product_ingredients,
  public.product_addons,
  public.orders,
  public.order_items,
  public.order_item_addons,
  public.order_item_removed_ingredients,
  public.couriers,
  public.payments,
  public.payment_transactions
TO authenticated;
