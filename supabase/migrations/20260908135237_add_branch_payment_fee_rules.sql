-- Regras de custo de adquirencia por filial e snapshot financeiro por pagamento.
-- O custo interno da loja nao representa acrescimo cobrado do cliente.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE public.branch_payment_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (provider_code ~ '^[A-Z0-9_-]{2,40}$'),
  channel TEXT NOT NULL DEFAULT 'IN_PERSON'
    CHECK (channel IN ('IN_PERSON', 'ONLINE')),
  payment_method public.payment_method NOT NULL
    CHECK (payment_method IN ('DEBIT_CARD', 'CREDIT_CARD')),
  card_brand TEXT NOT NULL DEFAULT 'ANY'
    CHECK (card_brand ~ '^[A-Z0-9_-]{2,40}$'),
  installments_from SMALLINT NOT NULL DEFAULT 1
    CHECK (installments_from BETWEEN 1 AND 24),
  installments_to SMALLINT NOT NULL DEFAULT 1
    CHECK (installments_to BETWEEN 1 AND 24),
  fee_percent NUMERIC(9,6) NOT NULL DEFAULT 0
    CHECK (fee_percent BETWEEN 0 AND 100),
  fee_fixed NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (fee_fixed >= 0),
  anticipation_percent NUMERIC(9,6) NOT NULL DEFAULT 0
    CHECK (anticipation_percent BETWEEN 0 AND 100),
  settlement_days SMALLINT NOT NULL DEFAULT 0
    CHECK (settlement_days BETWEEN 0 AND 365),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  change_reason TEXT NOT NULL CHECK (length(btrim(change_reason)) BETWEEN 3 AND 500),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (installments_from <= installments_to),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (
    payment_method <> 'DEBIT_CARD'
    OR (installments_from = 1 AND installments_to = 1)
  )
);

COMMENT ON TABLE public.branch_payment_fee_rules IS
  'Custo contratual da adquirente por filial. Nao e acrescimo ao consumidor.';

CREATE INDEX idx_branch_payment_fee_rules_lookup
  ON public.branch_payment_fee_rules (
    branch_id,
    payment_method,
    provider_code,
    channel,
    active,
    effective_from DESC
  );

ALTER TABLE public.branch_payment_fee_rules
  ADD CONSTRAINT branch_payment_fee_rules_no_overlap
  EXCLUDE USING gist (
    branch_id WITH =,
    provider_code WITH =,
    channel WITH =,
    payment_method WITH =,
    card_brand WITH =,
    int4range(installments_from, installments_to, '[]') WITH &&,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  )
  WHERE (active = TRUE);

CREATE OR REPLACE FUNCTION public.bump_payment_fee_rule_version()
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

CREATE TRIGGER branch_payment_fee_rules_version
BEFORE UPDATE ON public.branch_payment_fee_rules
FOR EACH ROW EXECUTE FUNCTION public.bump_payment_fee_rule_version();

CREATE OR REPLACE FUNCTION public.log_payment_fee_rule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.branch_payment_fee_rules%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    branch_id
  )
  VALUES (
    COALESCE((SELECT auth.uid()), v_row.updated_by, v_row.created_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'PAYMENT_FEE_RULE_CREATED'
      WHEN 'UPDATE' THEN 'PAYMENT_FEE_RULE_UPDATED'
      ELSE 'PAYMENT_FEE_RULE_DELETED'
    END,
    'branch_payment_fee_rules',
    v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_row.branch_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER branch_payment_fee_rules_audit
AFTER INSERT OR UPDATE OR DELETE ON public.branch_payment_fee_rules
FOR EACH ROW EXECUTE FUNCTION public.log_payment_fee_rule_change();

ALTER TABLE public.branch_payment_fee_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.branch_payment_fee_rules FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branch_payment_fee_rules TO authenticated;

CREATE POLICY "Administrador le taxas da filial"
  ON public.branch_payment_fee_rules FOR SELECT TO authenticated
  USING (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador cria taxas da filial"
  ON public.branch_payment_fee_rules FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_branch(branch_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY "Administrador atualiza taxas da filial"
  ON public.branch_payment_fee_rules FOR UPDATE TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (
    public.can_manage_branch(branch_id)
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY "Administrador remove taxas da filial"
  ON public.branch_payment_fee_rules FOR DELETE TO authenticated
  USING (public.can_manage_branch(branch_id));

REVOKE ALL ON FUNCTION public.bump_payment_fee_rule_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_payment_fee_rule_change() FROM PUBLIC, anon, authenticated;

-- O pagamento preserva tanto a regra estimada no momento da venda quanto os
-- valores efetivos recebidos posteriormente na conciliacao.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS payment_channel TEXT NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS installments SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fee_rule_id UUID REFERENCES public.branch_payment_fee_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_percent_snapshot NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS fee_fixed_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS anticipation_percent_snapshot NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS estimated_processing_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estimated_anticipation_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estimated_net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_processing_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_anticipation_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS settlement_expected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_calculation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE';

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_channel_check,
  DROP CONSTRAINT IF EXISTS payments_installments_check,
  DROP CONSTRAINT IF EXISTS payments_fee_calculation_status_check,
  DROP CONSTRAINT IF EXISTS payments_reconciliation_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_channel_check
    CHECK (payment_channel IN ('IN_PERSON', 'ONLINE')),
  ADD CONSTRAINT payments_installments_check
    CHECK (installments BETWEEN 1 AND 24),
  ADD CONSTRAINT payments_fee_calculation_status_check
    CHECK (fee_calculation_status IN ('NOT_APPLICABLE', 'CONFIGURED', 'UNCONFIGURED')),
  ADD CONSTRAINT payments_reconciliation_status_check
    CHECK (reconciliation_status IN ('NOT_APPLICABLE', 'PENDING', 'MATCHED', 'DIVERGENT', 'MANUAL_REVIEW'));

CREATE INDEX IF NOT EXISTS idx_payments_fee_reconciliation_pending
  ON public.payments (reconciliation_status, settlement_expected_at)
  WHERE reconciliation_status IN ('PENDING', 'DIVERGENT', 'MANUAL_REVIEW');

CREATE OR REPLACE FUNCTION public.snapshot_payment_processing_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_id UUID;
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

  SELECT o.branch_id INTO v_branch_id
  FROM public.orders AS o
  WHERE o.id = NEW.order_id;

  SELECT rule.* INTO v_rule
  FROM public.branch_payment_fee_rules AS rule
  WHERE rule.branch_id = v_branch_id
    AND rule.active = TRUE
    AND rule.payment_method = NEW.payment_method
    AND rule.provider_code = upper(COALESCE(NULLIF(NEW.payment_provider, ''), 'MANUAL'))
    AND rule.channel = NEW.payment_channel
    AND rule.card_brand IN (upper(COALESCE(NULLIF(NEW.card_brand, ''), 'ANY')), 'ANY')
    AND NEW.installments BETWEEN rule.installments_from AND rule.installments_to
    AND CURRENT_DATE >= rule.effective_from
    AND (rule.effective_to IS NULL OR CURRENT_DATE <= rule.effective_to)
  ORDER BY
    CASE WHEN rule.card_brand = upper(COALESCE(NULLIF(NEW.card_brand, ''), 'ANY')) THEN 0 ELSE 1 END,
    rule.effective_from DESC
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

CREATE TRIGGER payments_snapshot_processing_fee
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.snapshot_payment_processing_fee();

REVOKE ALL ON FUNCTION public.snapshot_payment_processing_fee() FROM PUBLIC, anon, authenticated;

RESET search_path;
