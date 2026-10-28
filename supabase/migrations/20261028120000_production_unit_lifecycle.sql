-- #229 / 1B. Ciclo de preparo e entrega por unidade e operações em lote atômicas.
-- Preserva modelagem por unidade da 1A, compatibilidade financeira e auditoria.

-- 1. Colunas de ciclo de produção nas unidades existentes
ALTER TABLE public.production_handoff_units
  ADD COLUMN IF NOT EXISTS prep_status text NOT NULL DEFAULT 'PENDING'
    CHECK (prep_status IN ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED')),
  ADD COLUMN IF NOT EXISTS prep_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS prep_actor_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS prep_version bigint NOT NULL DEFAULT 1 CHECK (prep_version > 0);

CREATE INDEX IF NOT EXISTS handoff_units_prep_status
  ON public.production_handoff_units(order_id, prep_status);

-- Sincroniza estado inicial das unidades já existentes com o status do item correspondente
UPDATE public.production_handoff_units u
SET
  prep_status = CASE
    WHEN i.status IN ('IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED') THEN i.status::text
    ELSE 'PENDING'
  END,
  prep_started_at = i.prep_started_at,
  ready_at = i.item_ready_at,
  delivered_at = i.delivered_at,
  cancelled_at = i.cancelled_at
FROM public.order_items i
WHERE i.id = u.order_item_id AND u.state <> 'SUPERSEDED' AND u.prep_status = 'PENDING'
  AND i.status <> 'PENDING';

-- 2. Sincronização do status da linha order_items a partir de suas unidades
CREATE OR REPLACE FUNCTION handoff_private.sync_item_status_from_units(p_order_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_total int;
  v_delivered int;
  v_ready int;
  v_in_prep int;
  v_pending int;
  v_cancelled int;
  v_new_status text;
  v_current_status text;
BEGIN
  SELECT status::text INTO v_current_status FROM public.order_items WHERE id = p_order_item_id;
  IF v_current_status = 'CANCELLED' OR v_current_status IS NULL THEN RETURN; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE prep_status = 'DELIVERED'),
    count(*) FILTER (WHERE prep_status = 'READY'),
    count(*) FILTER (WHERE prep_status = 'IN_PREPARATION'),
    count(*) FILTER (WHERE prep_status = 'PENDING'),
    count(*) FILTER (WHERE prep_status = 'CANCELLED')
  INTO v_total, v_delivered, v_ready, v_in_prep, v_pending, v_cancelled
  FROM public.production_handoff_units
  WHERE order_item_id = p_order_item_id AND state <> 'SUPERSEDED';

  IF v_total = 0 THEN RETURN; END IF;

  IF (v_total - v_cancelled) > 0 AND v_delivered = (v_total - v_cancelled) THEN
    v_new_status := 'DELIVERED';
  ELSIF (v_total - v_cancelled) > 0 AND (v_ready + v_delivered) = (v_total - v_cancelled) THEN
    v_new_status := 'READY';
  ELSIF (v_in_prep + v_ready + v_delivered) > 0 THEN
    v_new_status := 'IN_PREPARATION';
  ELSE
    v_new_status := 'PENDING';
  END IF;

  IF v_new_status IS DISTINCT FROM v_current_status THEN
    UPDATE public.order_items
    SET status = v_new_status::public.order_item_status
    WHERE id = p_order_item_id;
  END IF;
END;
$$;

-- 3. Sincronização reversa quando order_items for alterado diretamente (ex.: legado)
CREATE OR REPLACE FUNCTION handoff_private.trg_sync_units_from_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.production_handoff_units SET
      prep_status = NEW.status::text,
      prep_started_at = CASE WHEN NEW.status = 'IN_PREPARATION' AND prep_started_at IS NULL THEN now() ELSE prep_started_at END,
      ready_at = CASE WHEN NEW.status = 'READY' AND ready_at IS NULL THEN now() ELSE ready_at END,
      delivered_at = CASE WHEN NEW.status = 'DELIVERED' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
      cancelled_at = CASE WHEN NEW.status = 'CANCELLED' AND cancelled_at IS NULL THEN now() ELSE cancelled_at END,
      prep_version = prep_version + 1
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED' AND prep_status IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_sync_units ON public.order_items;
CREATE TRIGGER trg_order_items_sync_units
AFTER UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION handoff_private.trg_sync_units_from_item();

-- 4. Recálculo integral de orders.status considerando unidades e itens sem unidades
CREATE OR REPLACE FUNCTION public.recompute_order_status_from_items(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_old public.order_status;
  v_new public.order_status;
  v_now TIMESTAMPTZ := NOW();
  v_active INT := 0;
  v_delivered INT := 0;
  v_ready INT := 0;
  v_in_prep INT := 0;
  v_pending INT := 0;
BEGIN
  SELECT status INTO v_old FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_old IS NULL OR v_old IN (
    'AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO',
    'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO'
  ) THEN
    RETURN;
  END IF;

  WITH unit_counts AS (
    SELECT
      u.prep_status AS status,
      1 AS weight
    FROM public.production_handoff_units u
    JOIN public.order_items i ON i.id = u.order_item_id AND i.handoff_revision = u.revision
    WHERE u.order_id = p_order_id
      AND u.state <> 'SUPERSEDED'
      AND i.status <> 'CANCELLED'
  ),
  non_unit_counts AS (
    SELECT
      i.status::text AS status,
      i.quantity AS weight
    FROM public.order_items i
    WHERE i.order_id = p_order_id
      AND i.status <> 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM public.production_handoff_units u
        WHERE u.order_item_id = i.id AND u.state <> 'SUPERSEDED'
      )
  ),
  all_entities AS (
    SELECT * FROM unit_counts
    UNION ALL
    SELECT * FROM non_unit_counts
  )
  SELECT
    COALESCE(SUM(weight), 0),
    COALESCE(SUM(weight) FILTER (WHERE status = 'DELIVERED'), 0),
    COALESCE(SUM(weight) FILTER (WHERE status = 'READY'), 0),
    COALESCE(SUM(weight) FILTER (WHERE status = 'IN_PREPARATION'), 0),
    COALESCE(SUM(weight) FILTER (WHERE status = 'PENDING'), 0)
  INTO v_active, v_delivered, v_ready, v_in_prep, v_pending
  FROM all_entities;

  IF v_active = 0 THEN
    IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN
      v_new := 'CANCELADO';
    ELSE
      v_new := 'NA_FILA';
    END IF;
  ELSIF v_delivered = v_active THEN
    v_new := 'ENTREGUE';
  ELSIF (v_pending + v_in_prep + v_delivered) = 0 AND v_ready > 0 THEN
    v_new := 'PRONTO';
  ELSIF v_ready > 0 OR (v_delivered > 0 AND (v_pending + v_in_prep) > 0) THEN
    v_new := 'PRONTO_PARCIAL';
  ELSE
    v_new := 'NA_FILA';
  END IF;

  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE public.orders SET
      status                  = v_new,
      preparation_finished_at = CASE
        WHEN v_new IN ('PRONTO', 'ENTREGUE') AND preparation_finished_at IS NULL
        THEN v_now ELSE preparation_finished_at END,
      ready_at                = CASE
        WHEN v_new IN ('PRONTO', 'ENTREGUE') AND ready_at IS NULL
        THEN v_now ELSE ready_at END,
      delivered_at            = CASE
        WHEN v_new = 'ENTREGUE' AND delivered_at IS NULL
        THEN v_now ELSE delivered_at END,
      cancelled_at            = CASE
        WHEN v_new = 'CANCELADO' AND cancelled_at IS NULL
        THEN v_now ELSE cancelled_at END
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger de atualização de status ao mudar unidades
CREATE OR REPLACE FUNCTION handoff_private.trg_unit_prep_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.prep_status IS DISTINCT FROM NEW.prep_status THEN
    PERFORM handoff_private.sync_item_status_from_units(NEW.order_item_id);
    PERFORM public.recompute_order_status_from_items(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handoff_unit_prep_status_trigger ON public.production_handoff_units;
CREATE TRIGGER handoff_unit_prep_status_trigger
AFTER UPDATE OF prep_status ON public.production_handoff_units
FOR EACH ROW EXECUTE FUNCTION handoff_private.trg_unit_prep_update();

-- 5. RPC Atômica para mutação de unidades e itens em lote
CREATE OR REPLACE FUNCTION handoff_private.batch_update_production(
  p_order_id uuid,
  p_unit_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_item_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_new_status text DEFAULT 'READY',
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  o public.orders;
  u public.production_handoff_units;
  i public.order_items;
  v_unit_id uuid;
  v_item_id uuid;
  v_changed_units int := 0;
  v_changed_items int := 0;
  v_now timestamptz := now();
  v_target_items uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Status de produção inválido: %', p_new_status;
  END IF;

  IF p_new_status = 'CANCELLED' AND coalesce(length(btrim(p_reason)), 0) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório para cancelamento.';
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_branch(o.branch_id) OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active AND role IN ('ADMIN', 'ATTENDANT')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta filial.' USING ERRCODE = '42501';
  END IF;

  IF o.status IN ('AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'Pedido em % não aceita alterações de produção.', o.status;
  END IF;

  IF o.type = 'ENTREGA' AND p_new_status = 'DELIVERED' THEN
    RAISE EXCEPTION 'Itens de delivery só são concluídos pela confirmação do motoboy.';
  END IF;

  IF o.payment_timing = 'ON_DELIVERY' AND p_new_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Pedido com pagamento na entrega não permite cancelar item isolado.';
  END IF;

  -- 5.1 Atualização de Unidades Selecionadas
  IF coalesce(cardinality(p_unit_ids), 0) > 0 THEN
    FOR u IN
      SELECT * FROM public.production_handoff_units
      WHERE id = ANY(p_unit_ids) AND order_id = p_order_id
      ORDER BY id FOR UPDATE
    LOOP
      IF u.state = 'SUPERSEDED' OR u.prep_status = p_new_status THEN
        CONTINUE;
      END IF;

      -- Validação de transições
      IF u.prep_status = 'DELIVERED' OR u.prep_status = 'CANCELLED' THEN
        CONTINUE;
      END IF;

      UPDATE public.production_handoff_units SET
        prep_status = p_new_status,
        prep_started_at = CASE WHEN p_new_status = 'IN_PREPARATION' AND prep_started_at IS NULL THEN v_now ELSE prep_started_at END,
        ready_at = CASE WHEN p_new_status = 'READY' AND ready_at IS NULL THEN v_now ELSE ready_at END,
        delivered_at = CASE WHEN p_new_status = 'DELIVERED' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
        cancelled_at = CASE WHEN p_new_status = 'CANCELLED' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END,
        prep_actor_id = auth.uid(),
        prep_version = prep_version + 1
      WHERE id = u.id;

      INSERT INTO public.audit_logs(action, table_name, record_id, user_id, branch_id, old_data, new_data)
      VALUES (
        'UNIT_' || p_new_status, 'production_handoff_units', u.id, auth.uid(), o.branch_id,
        jsonb_build_object('prep_status', u.prep_status),
        jsonb_build_object('prep_status', p_new_status, 'unit_no', u.unit_no, 'order_item_id', u.order_item_id, 'reason', p_reason)
      );

      v_changed_units := v_changed_units + 1;
      IF NOT (u.order_item_id = ANY(v_target_items)) THEN
        v_target_items := array_append(v_target_items, u.order_item_id);
      END IF;
    END LOOP;
  END IF;

  -- 5.2 Atualização de Itens Selecionados (ex.: itens sem unidade ou alteração direta da linha)
  IF coalesce(cardinality(p_item_ids), 0) > 0 THEN
    FOR i IN
      SELECT * FROM public.order_items
      WHERE id = ANY(p_item_ids) AND order_id = p_order_id
      ORDER BY id FOR UPDATE
    LOOP
      IF i.status::text = p_new_status OR i.status = 'CANCELLED' THEN
        CONTINUE;
      END IF;

      -- Atualiza unidades ativas vinculadas a este item, caso existam
      UPDATE public.production_handoff_units SET
        prep_status = p_new_status,
        prep_started_at = CASE WHEN p_new_status = 'IN_PREPARATION' AND prep_started_at IS NULL THEN v_now ELSE prep_started_at END,
        ready_at = CASE WHEN p_new_status = 'READY' AND ready_at IS NULL THEN v_now ELSE ready_at END,
        delivered_at = CASE WHEN p_new_status = 'DELIVERED' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
        cancelled_at = CASE WHEN p_new_status = 'CANCELLED' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END,
        prep_actor_id = auth.uid(),
        prep_version = prep_version + 1
      WHERE order_item_id = i.id AND state <> 'SUPERSEDED' AND prep_status <> p_new_status
        AND prep_status NOT IN ('DELIVERED', 'CANCELLED');

      -- Atualiza o item diretamente
      UPDATE public.order_items SET
        status = p_new_status::public.order_item_status,
        prep_started_at = CASE WHEN p_new_status = 'IN_PREPARATION' AND prep_started_at IS NULL THEN v_now ELSE prep_started_at END,
        item_ready_at = CASE WHEN p_new_status = 'READY' AND item_ready_at IS NULL THEN v_now ELSE item_ready_at END,
        delivered_at = CASE WHEN p_new_status = 'DELIVERED' AND delivered_at IS NULL THEN v_now ELSE delivered_at END,
        cancelled_at = CASE WHEN p_new_status = 'CANCELLED' AND cancelled_at IS NULL THEN v_now ELSE cancelled_at END
      WHERE id = i.id;

      INSERT INTO public.audit_logs(action, table_name, record_id, user_id, branch_id, old_data, new_data)
      VALUES (
        'ITEM_' || p_new_status, 'order_items', i.id, auth.uid(), o.branch_id,
        jsonb_build_object('status', i.status),
        jsonb_build_object('status', p_new_status, 'reason', p_reason)
      );

      v_changed_items := v_changed_items + 1;
      IF NOT (i.id = ANY(v_target_items)) THEN
        v_target_items := array_append(v_target_items, i.id);
      END IF;
    END LOOP;
  END IF;

  -- 5.3 Sincroniza status das linhas de itens alteradas
  FOREACH v_item_id IN ARRAY v_target_items LOOP
    PERFORM handoff_private.sync_item_status_from_units(v_item_id);
  END LOOP;

  -- 5.4 Recalcula status do pedido
  PERFORM public.recompute_order_status_from_items(p_order_id);

  SELECT * INTO o FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'changed_units', v_changed_units,
    'changed_items', v_changed_items,
    'order_id', p_order_id,
    'order_status', o.status,
    'payment_status', o.payment_status,
    'ready_at', o.ready_at,
    'delivered_at', o.delivered_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_update_production_status(
  p_order_id uuid,
  p_unit_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_item_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_new_status text DEFAULT 'READY',
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT handoff_private.batch_update_production(p_order_id, p_unit_ids, p_item_ids, p_new_status, p_reason);
$$;

REVOKE ALL ON FUNCTION handoff_private.batch_update_production(uuid, uuid[], uuid[], text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.batch_update_production_status(uuid, uuid[], uuid[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION handoff_private.batch_update_production(uuid, uuid[], uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_production_status(uuid, uuid[], uuid[], text, text) TO authenticated;
