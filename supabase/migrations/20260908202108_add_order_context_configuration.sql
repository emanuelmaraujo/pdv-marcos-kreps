-- Contexto operacional para notificacoes, impressao e custos de adquirencia.
--
-- As configuracoes JSONB de branches continuam retrocompativeis: ausencia de
-- `order_types`/`order_sources` significa "todos". As regras financeiras usam
-- `ANY` explicitamente para permitir fallback e overrides mais especificos.

SET search_path = public, extensions;

ALTER TABLE public.branch_payment_fee_rules
  ADD COLUMN order_type TEXT NOT NULL DEFAULT 'ANY',
  ADD COLUMN order_source TEXT NOT NULL DEFAULT 'ANY';

ALTER TABLE public.branch_payment_fee_rules
  ADD CONSTRAINT branch_payment_fee_rules_order_type_check
    CHECK (order_type IN ('ANY', 'BALCAO', 'VIAGEM', 'ENTREGA')),
  ADD CONSTRAINT branch_payment_fee_rules_order_source_check
    CHECK (order_source IN ('ANY', 'ATTENDANT', 'QR_CODE', 'WHATSAPP', 'APP'));

COMMENT ON COLUMN public.branch_payment_fee_rules.order_type IS
  'Tipo de pedido ao qual a taxa se aplica; ANY e o fallback da filial.';
COMMENT ON COLUMN public.branch_payment_fee_rules.order_source IS
  'Origem operacional da venda; diferencia atendente/maquininha de pedidos online.';

ALTER TABLE public.branch_payment_fee_rules
  DROP CONSTRAINT branch_payment_fee_rules_no_overlap;

ALTER TABLE public.branch_payment_fee_rules
  ADD CONSTRAINT branch_payment_fee_rules_no_overlap
  EXCLUDE USING gist (
    branch_id WITH =,
    provider_code WITH =,
    channel WITH =,
    payment_method WITH =,
    card_brand WITH =,
    order_type WITH =,
    order_source WITH =,
    int4range(installments_from, installments_to, '[]') WITH &&,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  )
  WHERE (active = TRUE);

CREATE INDEX idx_branch_payment_fee_rules_context_lookup
  ON public.branch_payment_fee_rules (
    branch_id,
    payment_method,
    provider_code,
    channel,
    order_type,
    order_source,
    active,
    effective_from DESC
  );

CREATE OR REPLACE FUNCTION public.snapshot_payment_processing_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_id UUID;
  v_order_type TEXT;
  v_order_source TEXT;
  v_rule public.branch_payment_fee_rules%ROWTYPE;
  v_processing NUMERIC(12,2);
  v_anticipation NUMERIC(12,2);
BEGIN
  IF NEW.fee_rule_id IS NOT NULL OR NEW.fee_calculation_status = 'CONFIGURED' THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_method NOT IN ('DEBIT_CARD', 'CREDIT_CARD') THEN
    NEW.estimated_processing_fee := 0;
    NEW.estimated_anticipation_fee := 0;
    NEW.estimated_net_amount := NEW.amount;
    NEW.fee_calculation_status := 'NOT_APPLICABLE';
    NEW.reconciliation_status := 'NOT_APPLICABLE';
    RETURN NEW;
  END IF;

  SELECT o.branch_id, o.type::TEXT, o.source::TEXT
  INTO v_branch_id, v_order_type, v_order_source
  FROM public.orders AS o
  WHERE o.id = NEW.order_id;

  IF v_branch_id IS NULL THEN
    NEW.estimated_processing_fee := NULL;
    NEW.estimated_anticipation_fee := NULL;
    NEW.estimated_net_amount := NULL;
    NEW.fee_calculation_status := 'UNCONFIGURED';
    NEW.reconciliation_status := 'MANUAL_REVIEW';
    RETURN NEW;
  END IF;

  SELECT rule.* INTO v_rule
  FROM public.branch_payment_fee_rules AS rule
  WHERE rule.branch_id = v_branch_id
    AND rule.active = TRUE
    AND rule.payment_method = NEW.payment_method
    AND rule.provider_code = upper(COALESCE(NULLIF(NEW.payment_provider, ''), 'MANUAL'))
    AND rule.channel = NEW.payment_channel
    AND rule.card_brand IN (upper(COALESCE(NULLIF(NEW.card_brand, ''), 'ANY')), 'ANY')
    AND rule.order_type IN (v_order_type, 'ANY')
    AND rule.order_source IN (v_order_source, 'ANY')
    AND NEW.installments BETWEEN rule.installments_from AND rule.installments_to
    AND CURRENT_DATE >= rule.effective_from
    AND (rule.effective_to IS NULL OR CURRENT_DATE <= rule.effective_to)
  ORDER BY
    (
      CASE WHEN rule.card_brand = upper(COALESCE(NULLIF(NEW.card_brand, ''), 'ANY')) THEN 1 ELSE 0 END
      + CASE WHEN rule.order_type = v_order_type THEN 1 ELSE 0 END
      + CASE WHEN rule.order_source = v_order_source THEN 1 ELSE 0 END
    ) DESC,
    CASE WHEN rule.order_source = v_order_source THEN 1 ELSE 0 END DESC,
    CASE WHEN rule.order_type = v_order_type THEN 1 ELSE 0 END DESC,
    CASE WHEN rule.card_brand = upper(COALESCE(NULLIF(NEW.card_brand, ''), 'ANY')) THEN 1 ELSE 0 END DESC,
    rule.effective_from DESC,
    rule.id
  LIMIT 1;

  IF NOT FOUND THEN
    NEW.estimated_processing_fee := NULL;
    NEW.estimated_anticipation_fee := NULL;
    NEW.estimated_net_amount := NULL;
    NEW.fee_calculation_status := 'UNCONFIGURED';
    NEW.reconciliation_status := 'MANUAL_REVIEW';
    RETURN NEW;
  END IF;

  v_processing := round((NEW.amount * v_rule.fee_percent / 100) + v_rule.fee_fixed, 2);
  v_anticipation := round(NEW.amount * v_rule.anticipation_percent / 100, 2);

  NEW.fee_rule_id := v_rule.id;
  NEW.fee_percent_snapshot := v_rule.fee_percent;
  NEW.fee_fixed_snapshot := v_rule.fee_fixed;
  NEW.anticipation_percent_snapshot := v_rule.anticipation_percent;
  NEW.estimated_processing_fee := v_processing;
  NEW.estimated_anticipation_fee := v_anticipation;
  NEW.estimated_net_amount := NEW.amount - v_processing - v_anticipation;
  NEW.settlement_expected_at := NOW() + make_interval(days => v_rule.settlement_days);
  NEW.fee_calculation_status := 'CONFIGURED';
  NEW.reconciliation_status := 'PENDING';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_payment_processing_fee() FROM PUBLIC, anon, authenticated;

RESET search_path;
