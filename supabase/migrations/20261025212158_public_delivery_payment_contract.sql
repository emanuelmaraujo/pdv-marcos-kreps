-- #221: contrato aditivo. Nenhuma filial é habilitada por esta migration.
CREATE TABLE public.branch_cod_policies (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  methods text[] NOT NULL DEFAULT '{}',
  max_amount numeric(10,2),
  max_pending integer NOT NULL DEFAULT 20 CHECK(max_pending BETWEEN 1 AND 200),
  operational_approved_at timestamptz,
  confirmation_minutes integer NOT NULL DEFAULT 30,
  operational_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_cod_policy_valid CHECK (
    confirmation_minutes BETWEEN 5 AND 120
    AND methods <@ ARRAY['CASH','PIX','DEBIT_CARD','CREDIT_CARD']::text[]
    AND (NOT enabled OR (cardinality(methods)>0 AND max_amount>0 AND max_amount IS NOT NULL AND operational_approved_at IS NOT NULL))
  )
);
-- Limiares antifraude não são campos públicos de branches. Configuração
-- operacional somente por backend autorizado; ausência de registro desativa COD.
ALTER TABLE public.branch_cod_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_cod_policies FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.branch_cod_policies TO service_role;
ALTER TABLE public.orders
  ADD COLUMN payment_timing text NOT NULL DEFAULT 'ONLINE' CHECK (payment_timing IN ('ONLINE','ON_DELIVERY')),
  ADD COLUMN expected_payment_method text CHECK (expected_payment_method IN ('CASH','PIX','DEBIT_CARD','CREDIT_CARD')),
  ADD COLUMN cash_change_for numeric(10,2),
  ADD COLUMN cod_received_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN cod_expires_at timestamptz,
  ADD COLUMN cod_contact_verified_at timestamptz,
  ADD COLUMN cod_confirmation_requested_at timestamptz,
  ADD COLUMN public_request_hash text,
  ADD CONSTRAINT orders_cod_contract CHECK (
    (payment_timing = 'ONLINE' AND expected_payment_method IS NULL AND cash_change_for IS NULL)
    OR (payment_timing = 'ON_DELIVERY' AND type = 'ENTREGA' AND source = 'APP'
      AND expected_payment_method IS NOT NULL AND customer_phone IS NOT NULL
      AND (cash_change_for IS NULL OR (expected_payment_method = 'CASH' AND cash_change_for >= total_amount)))
  );
CREATE INDEX orders_cod_expiry ON public.orders(cod_expires_at)
  WHERE payment_timing = 'ON_DELIVERY' AND status = 'AGUARDANDO_CONFIRMACAO';

-- Funil mínimo: sem sessão, contato, endereço, token, URL ou payload livre.
CREATE TABLE public.public_funnel_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK(event_name IN ('menu_view','product_view','add_to_cart','cart_view','checkout_start','delivery_check','payment_option_select','order_submit','order_created','payment_approved','cod_order_confirmed','cod_payment_received','order_failure')),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_type public.order_type NOT NULL,
  device text NOT NULL DEFAULT 'UNKNOWN' CHECK(device IN ('MOBILE','TABLET','DESKTOP','UNKNOWN')),
  source text NOT NULL DEFAULT 'UNKNOWN' CHECK(source IN ('DIRECT','INSTAGRAM','WHATSAPP','QR','GOOGLE','OTHER','UNKNOWN')),
  error_category text NOT NULL DEFAULT 'NONE' CHECK(error_category IN ('NONE','NETWORK','ADDRESS','CLOSED','ORDER')),
  payment_option text CHECK(payment_option IN ('PIX','CARD','ON_DELIVERY')),
  origin text NOT NULL CHECK(origin IN ('CLIENT','SERVER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(origin='SERVER' OR event_name NOT IN ('order_created','payment_approved','cod_order_confirmed','cod_payment_received'))
);
CREATE INDEX public_funnel_branch_date ON public.public_funnel_events(branch_id,created_at);
ALTER TABLE public.public_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_funnel_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.public_funnel_events TO service_role;
ALTER TABLE public.orders
 ADD COLUMN analytics_consent boolean NOT NULL DEFAULT false,
 ADD COLUMN analytics_device text NOT NULL DEFAULT 'UNKNOWN' CHECK(analytics_device IN ('MOBILE','TABLET','DESKTOP','UNKNOWN')),
 ADD COLUMN analytics_source text NOT NULL DEFAULT 'UNKNOWN' CHECK(analytics_source IN ('DIRECT','INSTAGRAM','WHATSAPP','QR','GOOGLE','OTHER','UNKNOWN'));
CREATE FUNCTION public.record_order_funnel_event(p_order_id uuid,p_event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
 IF p_event NOT IN ('order_created','payment_approved','cod_order_confirmed','cod_payment_received') THEN RETURN; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id;
 IF v_order.analytics_consent IS NOT TRUE OR v_order.source<>'APP' THEN RETURN; END IF;
 INSERT INTO public.public_funnel_events(event_id,event_name,branch_id,order_type,device,source,origin)
 VALUES(md5(p_order_id::text||':'||p_event)::uuid,p_event,v_order.branch_id,v_order.type,v_order.analytics_device,v_order.analytics_source,'SERVER')
 ON CONFLICT(event_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
 -- Métrica não é uma razão para perder um pedido/recebimento.
 RETURN;
END $$;
CREATE FUNCTION public.record_order_funnel_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.analytics_consent THEN
  IF NEW.payment_status='PAID' AND OLD.payment_status IS DISTINCT FROM 'PAID' THEN
   PERFORM public.record_order_funnel_event(NEW.id,CASE WHEN NEW.payment_timing='ON_DELIVERY' THEN 'cod_payment_received' ELSE 'payment_approved' END);
  END IF;
  IF NEW.payment_timing='ON_DELIVERY' AND OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
   PERFORM public.record_order_funnel_event(NEW.id,'cod_order_confirmed');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_order_funnel_transition AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.record_order_funnel_transition();
CREATE FUNCTION public.purge_public_funnel_events() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 DELETE FROM public.public_funnel_events WHERE event_id IN (
  SELECT event_id FROM public.public_funnel_events WHERE created_at<now()-interval '30 days' LIMIT 10000
 );
$$;
REVOKE ALL ON FUNCTION public.record_order_funnel_event(uuid,text),public.record_order_funnel_transition(),public.purge_public_funnel_events() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_public_funnel_events() TO service_role;

-- A RPC anterior só recebe payload já precificado pela Edge Function. Mantém-se
-- privada ao service_role e é chamada na mesma transação que grava a chave.
ALTER FUNCTION public.create_public_order_transactional(jsonb) RENAME TO create_public_order_priced_v1;

CREATE FUNCTION public.lookup_public_order_retry(p_key text, p_branch_id uuid, p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders%ROWTYPE; v_hash text;
BEGIN
  IF p_key IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_order FROM public.orders WHERE public_idempotency_key = p_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_hash := encode(sha256(convert_to((p_request - ARRAY['analytics_consent','analytics_context'])::text, 'UTF8')), 'hex');
  IF v_order.branch_id <> p_branch_id OR
     (v_order.public_request_hash IS NOT NULL AND v_order.public_request_hash <> v_hash) OR
     (v_order.public_request_hash IS NULL AND COALESCE(p_request->>'payment_timing','ONLINE') <> 'ONLINE') THEN
    RAISE EXCEPTION 'Chave de tentativa incompatível com o pedido.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('success',true,'replayed',true,'order_id',v_order.id,
    'daily_number',v_order.daily_number,'public_token',v_order.public_token,
    'total_amount',v_order.total_amount,'discount_amount',v_order.discount_amount,
    'discount_percentage',v_order.discount_percentage,'coupon_code',v_order.coupon_code,
    'status',v_order.status,'payment_status',v_order.payment_status,
    'payment_timing',v_order.payment_timing,'expected_payment_method',v_order.expected_payment_method,
    'cash_change_for',v_order.cash_change_for);
END $$;

CREATE FUNCTION public.create_public_order_transactional(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key text := NULLIF(p_payload->>'idempotency_key','');
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_timing text := COALESCE(p_payload->>'payment_timing','ONLINE');
  v_method text := p_payload->>'expected_payment_method';
  v_change numeric := (p_payload->>'cash_change_for')::numeric;
  v_branch public.branches%ROWTYPE;
  v_policy public.branch_cod_policies%ROWTYPE;
  v_result jsonb;
  v_total numeric := (p_payload->>'total_amount')::numeric;
BEGIN
  IF v_timing NOT IN ('ONLINE','ON_DELIVERY') THEN RAISE EXCEPTION 'Momento de pagamento inválido.'; END IF;
  IF v_key IS NOT NULL THEN
    IF length(v_key) > 100 OR p_payload->'request' IS NULL THEN RAISE EXCEPTION 'Tentativa inválida.'; END IF;
    -- Inclui o lookup e o insert no mesmo lock transacional. Nenhum pedido
    -- perdedor sobrevive a um conflito na chave, mesmo com requests simultâneos.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 221));
    v_result := public.lookup_public_order_retry(v_key,v_branch_id,p_payload->'request');
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;
  IF v_timing = 'ON_DELIVERY' THEN
    SELECT * INTO v_branch FROM public.branches WHERE id = v_branch_id FOR SHARE;
    SELECT * INTO v_policy FROM public.branch_cod_policies WHERE branch_id=v_branch_id FOR UPDATE;
    IF v_key IS NULL OR v_policy.enabled IS NOT TRUE OR v_branch.active IS NOT TRUE
       OR v_branch.delivery_enabled IS NOT TRUE OR v_policy.operational_approved_at IS NULL
       OR v_policy.max_amount IS NULL OR v_total IS NULL OR v_total <= 0 OR v_total > v_policy.max_amount
       OR v_method IS NULL OR NOT (v_method = ANY(v_policy.methods))
       OR p_payload->>'order_type' <> 'ENTREGA'
       -- create-public-order grava E.164 (+55DDDNÚMERO).
       OR COALESCE(p_payload->>'customer_phone','') !~ '^\+55[1-9][0-9]{9,10}$' THEN
      RAISE EXCEPTION 'Pagamento na entrega indisponível para este pedido.' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM public.orders WHERE branch_id=v_branch_id AND payment_timing='ON_DELIVERY'
      AND status='AGUARDANDO_CONFIRMACAO' AND cod_expires_at>now()) >= v_policy.max_pending THEN
      RAISE EXCEPTION 'Pagamento na entrega indisponível para este pedido.' USING ERRCODE='22023';
    END IF;
    IF v_change IS NOT NULL AND (v_method <> 'CASH' OR v_change < v_total OR v_change > 100000) THEN
      RAISE EXCEPTION 'Valor para troco inválido.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_method IS NOT NULL OR v_change IS NOT NULL THEN
    RAISE EXCEPTION 'Opção presencial incompatível com pagamento online.' USING ERRCODE = '22023';
  END IF;
  v_result := public.create_public_order_priced_v1(p_payload);
  PERFORM set_config('app.public_create','yes',true);
  UPDATE public.orders SET public_idempotency_key = v_key,
    public_request_hash = CASE WHEN v_key IS NOT NULL THEN encode(sha256(convert_to(((p_payload->'request') - ARRAY['analytics_consent','analytics_context'])::text,'UTF8')),'hex') END,
    analytics_consent = COALESCE((p_payload->>'analytics_consent')::boolean,false),
    analytics_device = COALESCE(p_payload->>'analytics_device','UNKNOWN'), analytics_source = COALESCE(p_payload->>'analytics_source','UNKNOWN'),
    payment_timing = v_timing, expected_payment_method = v_method, cash_change_for = v_change,
    status = CASE WHEN v_timing = 'ON_DELIVERY' THEN 'AGUARDANDO_CONFIRMACAO'::public.order_status ELSE status END,
    cod_expires_at = CASE WHEN v_timing = 'ON_DELIVERY' THEN now() + make_interval(mins => v_policy.confirmation_minutes) END
  WHERE id = (v_result->>'order_id')::uuid;
  PERFORM set_config('app.public_create','no',true);
  IF v_timing = 'ON_DELIVERY' THEN
    INSERT INTO public.audit_logs(action,table_name,record_id,branch_id,new_data)
    VALUES('COD_ORDER_RECEIVED','orders',(v_result->>'order_id')::uuid,v_branch_id,
      jsonb_build_object('expected_payment_method',v_method,'payment_status','PENDING'));
  END IF;
  PERFORM public.record_order_funnel_event((v_result->>'order_id')::uuid,'order_created');
  -- A resposta vem da linha efetiva; não da opção enviada pelo navegador.
  IF v_key IS NOT NULL THEN
    v_result := public.lookup_public_order_retry(v_key,v_branch_id,p_payload->'request') - 'replayed';
  END IF;
  RETURN v_result;
END $$;

-- Fila e jobs de COD são uma única transação. A identidade continua sendo
-- validada pelo endpoint existente; a RPC repete escopo/role com ator confiável.
CREATE FUNCTION public.review_delivery_order_transactional(
  p_order_id uuid, p_actor_id uuid, p_action text,
  p_contact_confirmed boolean DEFAULT false, p_reason text DEFAULT NULL,
  p_jobs jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders%ROWTYPE; v_job jsonb; v_role public.user_role;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  SELECT role INTO v_role FROM public.profiles WHERE id=p_actor_id AND active;
  IF v_order.id IS NULL OR v_role IS NULL OR v_role NOT IN ('ADMIN','ATTENDANT')
     OR NOT (public.is_global_admin(p_actor_id) OR EXISTS (
       SELECT 1 FROM public.profile_branches WHERE profile_id=p_actor_id AND branch_id=v_order.branch_id)) THEN
    RAISE EXCEPTION 'Pedido inexistente ou sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_order.payment_timing <> 'ON_DELIVERY' OR p_action NOT IN ('CONFIRM','REJECT','REQUEST_CONFIRMATION') THEN
    RAISE EXCEPTION 'Revisão incompatível com o pedido.';
  END IF;
  IF p_action='CONFIRM' AND v_order.confirmed_at IS NOT NULL
      AND v_order.status IN ('NA_FILA','PRONTO','PRONTO_PARCIAL','SAIU_PARA_ENTREGA','ENTREGUE') THEN
    RETURN jsonb_build_object('success',true,'replayed',true,'status',v_order.status);
  END IF;
  -- Rejeitar continua possível entre o fim do prazo e a varredura de expiração.
  IF v_order.status <> 'AGUARDANDO_CONFIRMACAO' OR (p_action <> 'REJECT' AND v_order.cod_expires_at <= now()) THEN
    RAISE EXCEPTION 'Pedido fora do prazo de confirmação ou já encerrado.';
  END IF;
  IF p_action='CONFIRM' THEN
    IF p_contact_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'Confirme o contato com o cliente antes de liberar.'; END IF;
    IF jsonb_typeof(p_jobs) <> 'array' OR jsonb_array_length(p_jobs)>3 THEN RAISE EXCEPTION 'Jobs inválidos.'; END IF;
    PERFORM set_config('app.cod_review','yes',true);
    UPDATE public.orders SET status='NA_FILA',confirmed_by=p_actor_id,confirmed_at=now(),
      queue_entered_at=now(),cod_contact_verified_at=now(),updated_at=now() WHERE id=p_order_id;
    PERFORM set_config('app.cod_review','no',true);
    FOR v_job IN SELECT value FROM jsonb_array_elements(p_jobs) LOOP
      INSERT INTO public.printer_jobs(order_id,branch_id,sector,content)
      VALUES(p_order_id,v_order.branch_id,v_job->>'sector',v_job->'content');
    END LOOP;
  ELSIF p_action='REJECT' THEN
    IF length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo da rejeição.'; END IF;
    UPDATE public.orders SET status='CANCELADO',cancelled_at=now(),updated_at=now() WHERE id=p_order_id;
  ELSE
    UPDATE public.orders SET cod_confirmation_requested_at=now(),updated_at=now() WHERE id=p_order_id;
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,branch_id,new_data)
  VALUES(p_actor_id,'COD_'||p_action,'orders',p_order_id,v_order.branch_id,
    jsonb_build_object('contact_confirmed',p_contact_confirmed,'reason',p_reason));
  RETURN jsonb_build_object('success',true,'status',CASE p_action WHEN 'CONFIRM' THEN 'NA_FILA' WHEN 'REJECT' THEN 'CANCELADO' ELSE 'AGUARDANDO_CONFIRMACAO' END);
END $$;

-- Impede que endpoints legados promovam COD ou aceitem pagamento online.
CREATE FUNCTION public.guard_cod_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.payment_timing='ON_DELIVERY' THEN RAISE EXCEPTION 'Use a criação pública transacional.'; END IF;
      RETURN NEW;
    END IF;
    IF NEW.payment_timing='ON_DELIVERY' AND
       ((OLD.cod_contact_verified_at IS NULL AND NEW.cod_contact_verified_at IS NOT NULL) OR (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL))
       AND current_setting('app.cod_review',true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION 'Use a confirmação operacional do pedido.';
    END IF;
    IF NEW.payment_timing='ON_DELIVERY' AND NEW.cod_received_amount IS DISTINCT FROM OLD.cod_received_amount
       AND current_setting('app.cod_receipt',true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION 'Saldo de recebimento é derivado dos pagamentos.';
    END IF;

    IF (NEW.payment_timing IS DISTINCT FROM OLD.payment_timing OR NEW.expected_payment_method IS DISTINCT FROM OLD.expected_payment_method
        OR NEW.cash_change_for IS DISTINCT FROM OLD.cash_change_for) AND current_setting('app.public_create',true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION 'Compromisso de pagamento não pode ser alterado após criação.';
    END IF;
    IF NEW.payment_timing='ON_DELIVERY' AND OLD.status='AGUARDANDO_CONFIRMACAO' AND NEW.status='NA_FILA'
        AND current_setting('app.cod_review',true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION 'Use a confirmação operacional do pedido.';
    END IF;
    IF NEW.payment_timing='ON_DELIVERY' AND NEW.payment_status IN ('PAID','COURTESY') AND OLD.payment_status NOT IN ('PAID','COURTESY')
        AND current_setting('app.cod_receipt',true) IS DISTINCT FROM 'yes' THEN
      RAISE EXCEPTION 'Registre o recebimento presencial efetivo antes da baixa.';
    END IF;
    IF NEW.payment_timing='ON_DELIVERY' AND NEW.status NOT IN ('AGUARDANDO_CONFIRMACAO','CANCELADO','EXPIRADO')
       AND (NEW.confirmed_by IS NULL OR NEW.cod_contact_verified_at IS NULL) THEN
      RAISE EXCEPTION 'Pagamento na entrega exige confirmação operacional.';
    END IF;
  ELSE
    SELECT * INTO v_order FROM public.orders WHERE id=NEW.order_id;
    IF v_order.payment_timing='ON_DELIVERY' THEN
      IF TG_TABLE_NAME='payment_transactions' OR (TG_TABLE_NAME='printer_jobs' AND v_order.confirmed_at IS NULL) THEN
        RAISE EXCEPTION 'Operação incompatível com pagamento na entrega pendente.';
      END IF;
      IF TG_TABLE_NAME='order_items' THEN
        IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Não é possível adicionar itens ao pedido na entrega já enviado.'; END IF;
        -- Cancelar item isolado deixaria total_amount cobrando o que não foi entregue.
        -- A API direta da equipe não cancela item; o pedido inteiro é cancelado pelo backend.
        IF NEW.status='CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED'
           AND COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''),
                 NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role')='authenticated' THEN
          RAISE EXCEPTION 'Pedido com pagamento na entrega não permite cancelar item isolado.';
        END IF;
        IF NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.total_price IS DISTINCT FROM OLD.total_price
           OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.product_price_snapshot IS DISTINCT FROM OLD.product_price_snapshot THEN
          RAISE EXCEPTION 'Itens de pagamento na entrega não podem ser alterados após envio.';
        END IF;
        IF NEW.payment_status IN ('PAID','COURTESY') AND NEW.payment_status IS DISTINCT FROM OLD.payment_status AND
            (v_order.cod_contact_verified_at IS NULL OR current_setting('app.cod_receipt',true) IS DISTINCT FROM 'yes') THEN
          RAISE EXCEPTION 'Registre o recebimento presencial efetivo antes da baixa.';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_cod_order BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cod_lifecycle();
CREATE TRIGGER guard_cod_online BEFORE INSERT ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_cod_lifecycle();
CREATE TRIGGER guard_cod_print BEFORE INSERT ON public.printer_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_cod_lifecycle();
CREATE TRIGGER guard_cod_receipt BEFORE INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_cod_lifecycle();

ALTER FUNCTION public.pay_order_items_transactional(uuid,uuid,public.payment_method,public.payment_status,numeric,uuid[],text,numeric)
  RENAME TO pay_order_items_before_cod;
CREATE OR REPLACE FUNCTION public.pay_order_items_before_cod(
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

    IF v_order.payment_timing = 'ON_DELIVERY' THEN
      IF v_unpaid_outside = 0 THEN
        -- Última parcela recebe o saldo exato: desconto, taxas e arredondamentos.
        SELECT GREATEST(0,v_order.total_amount-COALESCE(SUM(amount),0)) INTO v_target_total
          FROM public.payments WHERE order_id=p_order_id AND payment_status IN ('PAID','REFUNDED');
      ELSE
        SELECT GREATEST(0,v_target_total-ROUND(v_order.discount_amount*v_target_total/NULLIF(SUM(total_price),0),2))
          INTO v_target_total FROM public.order_items WHERE order_id=p_order_id AND status<>'CANCELLED';
      END IF;
    ELSIF v_unpaid_outside = 0 AND v_order.paid_at IS NULL THEN
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

CREATE FUNCTION public.pay_order_items_transactional(
  p_order_id uuid,p_actor_id uuid,p_payment_method public.payment_method,p_payment_status public.payment_status,
  p_amount numeric,p_item_ids uuid[] DEFAULT NULL,p_notes text DEFAULT NULL,p_ifood_charged_amount numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE; v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF v_order.payment_timing='ON_DELIVERY' THEN
    IF NOT (public.is_global_admin(p_actor_id) OR EXISTS(SELECT 1 FROM public.profile_branches WHERE profile_id=p_actor_id AND branch_id=v_order.branch_id)) THEN
      RAISE EXCEPTION 'Sem permissão para esta filial.' USING ERRCODE='42501';
    END IF;
    IF p_payment_status='REFUNDED' AND (p_amount IS NULL OR p_amount<=0 OR p_amount>v_order.cod_received_amount) THEN
      RAISE EXCEPTION 'Valor de estorno excede o recebimento registrado.';
    END IF;
    IF p_payment_status IN ('PAID','COURTESY') THEN
      IF v_order.confirmed_at IS NULL OR v_order.status IN ('AGUARDANDO_CONFIRMACAO','CANCELADO','EXPIRADO')
         OR p_payment_status <> 'PAID' OR p_payment_method NOT IN ('CASH','PIX','DEBIT_CARD','CREDIT_CARD') THEN
        RAISE EXCEPTION 'Recebimento presencial incompatível com o pedido.';
      END IF;
      PERFORM set_config('app.cod_receipt','yes',true);
    END IF;
  END IF;
  v_result:=public.pay_order_items_before_cod(p_order_id,p_actor_id,p_payment_method,p_payment_status,p_amount,p_item_ids,p_notes,p_ifood_charged_amount);
  IF v_order.payment_timing='ON_DELIVERY' THEN
    PERFORM set_config('app.cod_receipt','yes',true);
    UPDATE public.orders SET cod_received_amount=(
      SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE order_id=p_order_id AND payment_status IN ('PAID','REFUNDED')
    ) WHERE id=p_order_id;
  END IF;
  PERFORM set_config('app.cod_receipt','no',true);
  RETURN v_result;
END $$;

CREATE FUNCTION public.expire_unconfirmed_delivery_orders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.orders SET status='EXPIRADO',cancelled_at=now(),updated_at=now()
    WHERE payment_timing='ON_DELIVERY' AND status='AGUARDANDO_CONFIRMACAO' AND cod_expires_at<=now()
    RETURNING id,branch_id
  ) INSERT INTO public.audit_logs(action,table_name,record_id,branch_id)
    SELECT 'COD_CONFIRMATION_EXPIRED','orders',id,branch_id FROM expired;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.create_public_order_priced_v1(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pay_order_items_before_cod(uuid,uuid,public.payment_method,public.payment_status,numeric,uuid[],text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lookup_public_order_retry(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_order_transactional(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_delivery_order_transactional(uuid,uuid,text,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_cod_lifecycle() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pay_order_items_transactional(uuid,uuid,public.payment_method,public.payment_status,numeric,uuid[],text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_unconfirmed_delivery_orders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_public_order_retry(text,uuid,jsonb), public.create_public_order_transactional(jsonb),
  public.review_delivery_order_transactional(uuid,uuid,text,boolean,text,jsonb),
  public.pay_order_items_transactional(uuid,uuid,public.payment_method,public.payment_status,numeric,uuid[],text,numeric),
  public.expire_unconfirmed_delivery_orders() TO service_role;

-- Painel administrativo: leitura e gravação da política sem acesso direto à
-- tabela. Reusa can_manage_branch (ADMIN ativo da filial ou global); a
-- aprovação operacional é carimbada pelo servidor, nunca enviada pelo navegador.
CREATE FUNCTION public.get_branch_cod_policy(p_branch_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_policy public.branch_cod_policies%ROWTYPE; v_pending integer;
BEGIN
  IF NOT public.can_manage_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Sem permissão para configurar esta filial.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_policy FROM public.branch_cod_policies WHERE branch_id=p_branch_id;
  SELECT count(*) INTO v_pending FROM public.orders WHERE branch_id=p_branch_id
    AND payment_timing='ON_DELIVERY' AND status='AGUARDANDO_CONFIRMACAO';
  RETURN jsonb_build_object(
    'enabled',COALESCE(v_policy.enabled,false),'methods',to_jsonb(COALESCE(v_policy.methods,'{}'::text[])),
    'max_amount',v_policy.max_amount,'max_pending',COALESCE(v_policy.max_pending,20),
    'confirmation_minutes',COALESCE(v_policy.confirmation_minutes,30),
    'operational_approved_at',v_policy.operational_approved_at,'updated_at',v_policy.updated_at,
    'pending_confirmation',v_pending);
END $$;

CREATE FUNCTION public.set_branch_cod_policy(
  p_branch_id uuid, p_enabled boolean, p_methods text[], p_max_amount numeric,
  p_max_pending integer, p_confirmation_minutes integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old public.branch_cod_policies%ROWTYPE; v_branch public.branches%ROWTYPE; v_methods text[];
BEGIN
  IF NOT public.can_manage_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Sem permissão para configurar esta filial.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_branch FROM public.branches WHERE id=p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial inexistente.' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(array_agg(DISTINCT m ORDER BY m),'{}') INTO v_methods FROM unnest(COALESCE(p_methods,'{}')) AS m;
  IF NOT v_methods <@ ARRAY['CASH','PIX','DEBIT_CARD','CREDIT_CARD']::text[] THEN
    RAISE EXCEPTION 'Forma de pagamento presencial inválida.' USING ERRCODE='22023';
  END IF;
  IF p_max_pending IS NULL OR p_max_pending NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Limite de pedidos aguardando deve ficar entre 1 e 200.' USING ERRCODE='22023';
  END IF;
  IF p_confirmation_minutes IS NULL OR p_confirmation_minutes NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'Prazo de confirmação deve ficar entre 5 e 120 minutos.' USING ERRCODE='22023';
  END IF;
  IF p_max_amount IS NOT NULL AND (p_max_amount <= 0 OR p_max_amount > 100000) THEN
    RAISE EXCEPTION 'Valor máximo inválido.' USING ERRCODE='22023';
  END IF;
  IF p_enabled IS TRUE AND (v_branch.delivery_enabled IS NOT TRUE OR cardinality(v_methods)=0 OR p_max_amount IS NULL) THEN
    RAISE EXCEPTION 'Para ativar, ligue a entrega da filial, escolha ao menos uma forma e informe o valor máximo.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_old FROM public.branch_cod_policies WHERE branch_id=p_branch_id FOR UPDATE;
  INSERT INTO public.branch_cod_policies AS p(branch_id,enabled,methods,max_amount,max_pending,confirmation_minutes,
      operational_approved_at,operational_approved_by,updated_by,updated_at)
  VALUES(p_branch_id,p_enabled IS TRUE,v_methods,p_max_amount,p_max_pending,p_confirmation_minutes,
      CASE WHEN p_enabled IS TRUE THEN now() END,CASE WHEN p_enabled IS TRUE THEN auth.uid() END,auth.uid(),now())
  ON CONFLICT(branch_id) DO UPDATE SET enabled=EXCLUDED.enabled,methods=EXCLUDED.methods,max_amount=EXCLUDED.max_amount,
    max_pending=EXCLUDED.max_pending,confirmation_minutes=EXCLUDED.confirmation_minutes,
    -- Reativar ou mudar limites é uma nova aprovação operacional; desligar remove a aprovação.
    operational_approved_at=EXCLUDED.operational_approved_at,operational_approved_by=EXCLUDED.operational_approved_by,
    updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,branch_id,old_data,new_data)
  VALUES(auth.uid(),'COD_POLICY_UPDATED','branch_cod_policies',p_branch_id,p_branch_id,
    CASE WHEN v_old.branch_id IS NOT NULL THEN jsonb_build_object('enabled',v_old.enabled,'methods',v_old.methods,
      'max_amount',v_old.max_amount,'max_pending',v_old.max_pending,'confirmation_minutes',v_old.confirmation_minutes) END,
    jsonb_build_object('enabled',p_enabled IS TRUE,'methods',v_methods,'max_amount',p_max_amount,
      'max_pending',p_max_pending,'confirmation_minutes',p_confirmation_minutes));
  RETURN public.get_branch_cod_policy(p_branch_id);
END $$;
REVOKE ALL ON FUNCTION public.get_branch_cod_policy(uuid),
  public.set_branch_cod_policy(uuid,boolean,text[],numeric,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_branch_cod_policy(uuid),
  public.set_branch_cod_policy(uuid,boolean,text[],numeric,integer,integer) TO authenticated;

