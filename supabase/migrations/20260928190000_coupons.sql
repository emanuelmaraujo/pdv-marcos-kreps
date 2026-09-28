-- Cupons promocionais por filial.
-- Escopo deliberadamente isolado: checkout publico aplica desconto somente sobre
-- produtos + adicionais; embalagem e entrega continuam com seus valores integrais.

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coupons_code_format CHECK (
    code = upper(code)
    AND code ~ '^[A-Z0-9_-]{2,40}$'
  ),
  CONSTRAINT coupons_percent_limit CHECK (
    discount_type <> 'PERCENT' OR discount_value <= 100
  ),
  CONSTRAINT coupons_valid_window CHECK (valid_until > valid_from),
  CONSTRAINT coupons_branch_code_unique UNIQUE (branch_id, code)
);

COMMENT ON TABLE public.coupons IS
  'Cupons promocionais por filial. Desconto do checkout publico nao incide sobre entrega ou embalagem.';

CREATE INDEX idx_coupons_public_lookup
  ON public.coupons (branch_id, code, active, valid_from, valid_until);

CREATE OR REPLACE FUNCTION public.bump_coupon_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  NEW.updated_by := COALESCE(NEW.updated_by, (SELECT auth.uid()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER coupons_version
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.bump_coupon_version();

CREATE OR REPLACE FUNCTION public.log_coupon_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.coupons%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, branch_id
  )
  VALUES (
    COALESCE((SELECT auth.uid()), v_row.updated_by, v_row.created_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'COUPON_CREATED'
      WHEN 'UPDATE' THEN 'COUPON_UPDATED'
      ELSE 'COUPON_DELETED'
    END,
    'coupons',
    v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_row.branch_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER coupons_audit
AFTER INSERT OR UPDATE OR DELETE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.log_coupon_change();

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coupons FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons TO authenticated;
GRANT SELECT ON TABLE public.coupons TO service_role;

CREATE POLICY "Administrador le cupons da filial"
  ON public.coupons FOR SELECT TO authenticated
  USING (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador cria cupons da filial"
  ON public.coupons FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_branch(branch_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY "Administrador atualiza cupons da filial"
  ON public.coupons FOR UPDATE TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (
    public.can_manage_branch(branch_id)
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY "Administrador remove cupons da filial"
  ON public.coupons FOR DELETE TO authenticated
  USING (public.can_manage_branch(branch_id));

REVOKE ALL ON FUNCTION public.bump_coupon_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_coupon_change() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_id
  ON public.orders (coupon_id)
  WHERE coupon_id IS NOT NULL;

-- Reaplica a RPC de pedido publico com os campos de desconto/cupom. Todo o
-- restante do fluxo permanece igual ao snapshot mais recente
-- (20260821000000_delivery_geolocation.sql).
CREATE OR REPLACE FUNCTION public.create_public_order_transactional(
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
  v_discount      JSONB;
BEGIN
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id ausente.' USING ERRCODE = '22023';
  END IF;

  IF p_payload->'items' IS NULL OR jsonb_typeof(p_payload->'items') <> 'array'
     OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.orders (
    branch_id, type, source, status, payment_status, payment_method,
    customer_name, customer_phone, customer_email, customer_id,
    discount_amount, discount_percentage, discount_reason,
    coupon_id, coupon_code,
    packing_fee, delivery_fee,
    delivery_street, delivery_number, delivery_complement, delivery_neighborhood,
    delivery_city, delivery_state, delivery_postal_code, delivery_reference,
    delivery_latitude, delivery_longitude,
    total_amount, notes
  ) VALUES (
    v_branch_id, (p_payload->>'order_type')::order_type, 'APP', 'AGUARDANDO_PAGAMENTO', 'PENDING', 'PENDING',
    NULLIF(p_payload->>'customer_name', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_id', ''),
    COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'discount_percentage')::NUMERIC, 0),
    NULLIF(p_payload->>'discount_reason', ''),
    NULLIF(p_payload->>'coupon_id', '')::UUID,
    NULLIF(p_payload->>'coupon_code', ''),
    COALESCE((p_payload->>'packing_fee')::NUMERIC, 0),
    COALESCE((p_payload->>'delivery_fee')::NUMERIC, 0),
    p_payload#>>'{delivery,street}', p_payload#>>'{delivery,number}',
    p_payload#>>'{delivery,complement}', p_payload#>>'{delivery,neighborhood}',
    p_payload#>>'{delivery,city}', p_payload#>>'{delivery,state}',
    p_payload#>>'{delivery,postal_code}', p_payload#>>'{delivery,reference}',
    NULLIF(p_payload#>>'{delivery,latitude}', '')::DOUBLE PRECISION,
    NULLIF(p_payload#>>'{delivery,longitude}', '')::DOUBLE PRECISION,
    COALESCE((p_payload->>'total_amount')::NUMERIC, 0),
    NULLIF(p_payload->>'notes', '')
  )
  RETURNING id, daily_number, public_token, total_amount
    INTO v_order_id, v_daily_number, v_public_token, v_total_amount;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO public.order_items (
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
      INSERT INTO public.order_item_removed_ingredients (order_item_id, ingredient_id, ingredient_name_snapshot)
      VALUES (v_item_id, NULLIF(v_removed->>'ingredient_id', '')::UUID, v_removed->>'ingredient_name_snapshot');
    END LOOP;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons', '[]'::jsonb))
    LOOP
      INSERT INTO public.order_item_addons (order_item_id, addon_id, quantity, addon_name_snapshot, addon_price_snapshot)
      VALUES (
        v_item_id,
        NULLIF(v_addon->>'addon_id', '')::UUID,
        (v_addon->>'quantity')::INT,
        v_addon->>'addon_name_snapshot',
        (v_addon->>'addon_price_snapshot')::NUMERIC
      );
    END LOOP;
  END LOOP;

  v_discount := p_payload->'discount';
  IF COALESCE((p_payload->>'discount_amount')::NUMERIC, 0) > 0 AND v_discount IS NOT NULL THEN
    INSERT INTO public.discounts (
      order_id, type, value, amount_applied, reason, granted_by
    ) VALUES (
      v_order_id,
      v_discount->>'type',
      (v_discount->>'value')::NUMERIC,
      COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
      COALESCE(NULLIF(v_discount->>'reason', ''), 'Cupom promocional'),
      NULL
    );
  END IF;

  INSERT INTO public.audit_logs (action, table_name, record_id, branch_id, new_data)
  VALUES (
    'PUBLIC_ORDER_CREATED_AWAITING_PAYMENT',
    'orders',
    v_order_id,
    v_branch_id,
    jsonb_build_object(
      'daily_number', v_daily_number,
      'total_amount', v_total_amount,
      'discount_amount', COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
      'coupon_code', p_payload->>'coupon_code',
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
    'discount_amount', COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    'discount_percentage', COALESCE((p_payload->>'discount_percentage')::NUMERIC, 0),
    'coupon_code', p_payload->>'coupon_code',
    'status', 'AGUARDANDO_PAGAMENTO',
    'payment_status', 'PENDING'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order_transactional(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order_transactional(JSONB) TO service_role;

-- Cupom solicitado para hoje (segunda-feira, 28/09/2026), apenas na unidade
-- padrao do /pedir (slug nb). Expira automaticamente a meia-noite de Brasilia.
INSERT INTO public.coupons (
  branch_id, code, description, discount_type, discount_value,
  min_subtotal, active, valid_from, valid_until
)
SELECT
  b.id,
  'SEGUNDA10',
  '10% de desconto - Segunda 28/09/2026',
  'PERCENT',
  10,
  0,
  TRUE,
  '2026-09-28 00:00:00-03'::timestamptz,
  '2026-09-29 00:00:00-03'::timestamptz
FROM public.branches AS b
WHERE b.slug = 'nb'
ON CONFLICT (branch_id, code) DO NOTHING;
