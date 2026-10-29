-- #229 / 1B. Ciclo de preparo e entrega por unidade e operações em lote atômicas.
-- Preserva modelagem por unidade da 1A, compatibilidade financeira e auditoria.
--
-- Contrato (revisado):
--   * Unidades só avançam: PENDING -> IN_PREPARATION -> READY -> DELIVERED
--     (PENDING -> READY permitido; DELIVERED exige READY). Nada retrocede pela RPC.
--   * CANCELLED por unidade não existe na RPC: cancelar muda o contrato financeiro
--     e continua exclusivo do cancelamento da linha (update-order-item-status) ou
--     do pedido (update-order-status), que já tratam COD (#221) e snapshot.
--   * Comandos legados por linha/pedido continuam válidos e são espelhados nas
--     unidades sem regredir unidades já entregues.
--   * Notificações WhatsApp/Push não saem do banco: a transição para
--     PRONTO_PARCIAL/PRONTO grava um pedido de aviso na fila
--     production_notification_outbox, na mesma transação; a Edge Function
--     update-order-item-status (modo lote) reivindica, envia e marca.

-- 1. Colunas de ciclo de produção nas unidades existentes
ALTER TABLE public.production_handoff_units
  ADD COLUMN IF NOT EXISTS prep_status text NOT NULL DEFAULT 'PENDING'
    CHECK (prep_status IN ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED')),
  ADD COLUMN IF NOT EXISTS prep_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS prep_status_before_cancel text
    CHECK (prep_status_before_cancel IS NULL OR prep_status_before_cancel IN ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED')),
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

-- Ordem de avanço; CANCELLED fica fora da escala.
CREATE OR REPLACE FUNCTION handoff_private.prep_rank(p_status text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE p_status
    WHEN 'PENDING' THEN 0 WHEN 'IN_PREPARATION' THEN 1
    WHEN 'READY' THEN 2 WHEN 'DELIVERED' THEN 3 ELSE NULL END
$$;

-- 2. Sincronização do status da linha order_items a partir de suas unidades
CREATE OR REPLACE FUNCTION handoff_private.sync_item_status_from_units(p_order_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_total int;
  v_delivered int;
  v_ready int;
  v_in_prep int;
  v_cancelled int;
  v_new_status text;
  v_current_status text;
  v_now timestamptz := now();
BEGIN
  SELECT status::text INTO v_current_status FROM public.order_items WHERE id = p_order_item_id;
  IF v_current_status = 'CANCELLED' OR v_current_status IS NULL THEN RETURN; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE prep_status = 'DELIVERED'),
    count(*) FILTER (WHERE prep_status = 'READY'),
    count(*) FILTER (WHERE prep_status = 'IN_PREPARATION'),
    count(*) FILTER (WHERE prep_status = 'CANCELLED')
  INTO v_total, v_delivered, v_ready, v_in_prep, v_cancelled
  FROM public.production_handoff_units
  WHERE order_item_id = p_order_item_id AND state <> 'SUPERSEDED';

  IF v_total = 0 OR v_total = v_cancelled THEN RETURN; END IF;

  IF v_delivered = (v_total - v_cancelled) THEN
    v_new_status := 'DELIVERED';
  ELSIF (v_ready + v_delivered) = (v_total - v_cancelled) THEN
    v_new_status := 'READY';
  ELSIF (v_in_prep + v_ready + v_delivered) > 0 THEN
    v_new_status := 'IN_PREPARATION';
  ELSE
    v_new_status := 'PENDING';
  END IF;

  IF v_new_status IS DISTINCT FROM v_current_status THEN
    -- Timestamps da linha seguem o contrato legado (relatórios e restauração usam).
    -- A flag impede que o espelho legado (seção 3) devolva o agregado às unidades.
    PERFORM set_config('pdv.units_to_item_sync', 'on', true);
    UPDATE public.order_items SET
      status = v_new_status::public.order_item_status,
      prep_started_at = CASE WHEN v_new_status <> 'PENDING' THEN coalesce(prep_started_at, v_now) ELSE prep_started_at END,
      item_ready_at = CASE WHEN v_new_status IN ('READY', 'DELIVERED') THEN coalesce(item_ready_at, v_now) ELSE item_ready_at END,
      delivered_at = CASE WHEN v_new_status = 'DELIVERED' THEN coalesce(delivered_at, v_now) ELSE delivered_at END
    WHERE id = p_order_item_id;
    PERFORM set_config('pdv.units_to_item_sync', 'off', true);
  END IF;
END;
$$;

-- 3. Espelho dos comandos legados (status da linha alterado diretamente) nas unidades.
--    Avanço só move unidades atrasadas; reversão legada (PRONTO -> NA_FILA) nunca
--    toca unidades entregues; cancelamento guarda o estado anterior para restaurar.
CREATE OR REPLACE FUNCTION handoff_private.trg_sync_units_from_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_now timestamptz := now();
  v_new text := NEW.status::text;
  v_rank int := handoff_private.prep_rank(NEW.status::text);
BEGIN
  -- Atualizações feitas pela própria sincronização (unidades -> linha) não voltam.
  IF current_setting('pdv.units_to_item_sync', true) = 'on'
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF v_new = 'CANCELLED' THEN
    UPDATE public.production_handoff_units SET
      prep_status_before_cancel = prep_status,
      prep_status = 'CANCELLED',
      cancelled_at = coalesce(NEW.cancelled_at, v_now),
      prep_version = prep_version + 1
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED' AND prep_status <> 'CANCELLED';
  ELSIF OLD.status = 'CANCELLED' THEN
    -- Restauração: devolve cada unidade ao estado anterior ao cancelamento.
    UPDATE public.production_handoff_units SET
      prep_status = coalesce(prep_status_before_cancel, v_new),
      prep_status_before_cancel = NULL,
      cancelled_at = NULL,
      prep_version = prep_version + 1
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED' AND prep_status = 'CANCELLED';
  ELSIF v_rank > handoff_private.prep_rank(OLD.status::text) THEN
    UPDATE public.production_handoff_units SET
      prep_status = v_new,
      prep_started_at = CASE WHEN v_rank >= 1 THEN coalesce(prep_started_at, NEW.prep_started_at, v_now) ELSE prep_started_at END,
      ready_at = CASE WHEN v_rank >= 2 THEN coalesce(ready_at, NEW.item_ready_at, v_now) ELSE ready_at END,
      delivered_at = CASE WHEN v_rank = 3 THEN coalesce(delivered_at, NEW.delivered_at, v_now) ELSE delivered_at END,
      prep_version = prep_version + 1
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED' AND prep_status <> 'CANCELLED'
      AND handoff_private.prep_rank(prep_status) < v_rank;
  ELSE
    UPDATE public.production_handoff_units SET
      prep_status = v_new,
      ready_at = CASE WHEN v_rank < 2 THEN NULL ELSE ready_at END,
      prep_version = prep_version + 1
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED'
      AND prep_status NOT IN ('CANCELLED', 'DELIVERED')
      AND handoff_private.prep_rank(prep_status) > v_rank;
  END IF;
  RETURN NEW;
END;
$$;

-- Unidade entregue foi consumida e continua cobrável: a linha que a contém não pode
-- ser cancelada (nem pelo cancelamento do pedido), como já valia para linha DELIVERED.
CREATE OR REPLACE FUNCTION handoff_private.guard_cancel_delivered_units()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED' AND EXISTS (
    SELECT 1 FROM public.production_handoff_units
    WHERE order_item_id = NEW.id AND state <> 'SUPERSEDED' AND prep_status = 'DELIVERED'
  ) THEN
    RAISE EXCEPTION 'Item com unidade já entregue não pode ser cancelado: a unidade entregue continua cobrável.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_guard_delivered_units ON public.order_items;
CREATE TRIGGER trg_order_items_guard_delivered_units
BEFORE UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION handoff_private.guard_cancel_delivered_units();

DROP TRIGGER IF EXISTS trg_order_items_sync_units ON public.order_items;
CREATE TRIGGER trg_order_items_sync_units
AFTER UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION handoff_private.trg_sync_units_from_item();

-- 4. Recálculo de orders.status considerando unidades e itens sem unidades.
--    Mantém a semântica, a segurança (INVOKER) e o search_path do contrato legado:
--    ENTREGUE/CANCELADO continuam recalculáveis (acréscimo após entrega e
--    restauração de cancelamento dependem disso).
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
    'AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO', 'SAIU_PARA_ENTREGA'
  ) THEN
    RETURN;
  END IF;

  -- Itens com unidades ativas contam por unidade; demais itens, pela linha.
  WITH unit_counts AS (
    SELECT u.prep_status AS status
    FROM public.production_handoff_units u
    JOIN public.order_items i ON i.id = u.order_item_id AND i.handoff_revision = u.revision
    WHERE u.order_id = p_order_id
      AND u.state <> 'SUPERSEDED'
      AND u.prep_status <> 'CANCELLED'
      AND i.status <> 'CANCELLED'
  ),
  non_unit_counts AS (
    SELECT i.status::text AS status
    FROM public.order_items i
    WHERE i.order_id = p_order_id
      AND i.status <> 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM public.production_handoff_units u
        WHERE u.order_item_id = i.id AND u.revision = i.handoff_revision AND u.state <> 'SUPERSEDED'
      )
  ),
  all_entities AS (
    SELECT status FROM unit_counts
    UNION ALL
    SELECT status FROM non_unit_counts
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'DELIVERED'),
    count(*) FILTER (WHERE status = 'READY'),
    count(*) FILTER (WHERE status = 'IN_PREPARATION'),
    count(*) FILTER (WHERE status = 'PENDING')
  INTO v_active, v_delivered, v_ready, v_in_prep, v_pending
  FROM all_entities;

  IF v_active = 0 THEN
    v_new := 'CANCELADO';
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
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

-- Trigger de atualização de status ao mudar unidades. Dentro do lote, a RPC
-- recalcula uma única vez no fim para não gravar estados intermediários.
CREATE OR REPLACE FUNCTION handoff_private.trg_unit_prep_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.prep_status IS DISTINCT FROM NEW.prep_status
     AND current_setting('pdv.production_batch', true) IS DISTINCT FROM 'on' THEN
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

-- 5. Fila transacional de avisos ao cliente. A linha nasce na MESMA transação que
--    leva o pedido a PRONTO_PARCIAL/PRONTO; a Edge Function reivindica, envia e marca.
--    Se a função cair depois do commit, a repetição do comando reenvia o pendente.
--    PK (pedido, evento) impede segundo aviso do mesmo tipo.
CREATE TABLE IF NOT EXISTS public.production_notification_outbox (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('order_partial_ready', 'order_ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  processed_at timestamptz,
  outcome text,
  PRIMARY KEY (order_id, event_type)
);
ALTER TABLE public.production_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.production_notification_outbox TO service_role;

-- Reivindicação atômica (lease de 30 s): chamadas concorrentes não enviam o mesmo aviso; se a
-- função cair após reivindicar, o próximo comando no pedido depois do prazo reenvia.
CREATE OR REPLACE FUNCTION public.claim_production_notifications(p_order_id uuid)
RETURNS SETOF public.production_notification_outbox
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  UPDATE public.production_notification_outbox SET claimed_at = now()
  WHERE order_id = p_order_id AND processed_at IS NULL
    AND (claimed_at IS NULL OR claimed_at < now() - interval '30 seconds')
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_production_notifications(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_production_notifications(uuid) TO service_role;

-- 6. RPC atômica para avanço de unidades e itens em lote.
--    Idempotente: alvo já atingido (ou ultrapassado) é ignorado sem auditoria.
--    Qualquer alvo inválido rejeita o lote inteiro (nada é gravado).
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
  v_prev_status public.order_status;
  v_unit_ids uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_unit_ids, ARRAY[]::uuid[])) x WHERE x IS NOT NULL);
  v_item_ids uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_item_ids, ARRAY[]::uuid[])) x WHERE x IS NOT NULL);
  v_target_rank int := handoff_private.prep_rank(p_new_status);
  v_found int;
  v_item_id uuid;
  v_changed_units int := 0;
  v_changed_items int := 0;
  v_skipped int := 0;
  v_now timestamptz := now();
  v_touched_items uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN ('IN_PREPARATION', 'READY', 'DELIVERED') THEN
    RAISE EXCEPTION 'Status de produção inválido: %. Cancelamento e reversão usam os comandos do item ou do pedido.', coalesce(p_new_status, 'nulo')
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_unit_ids) + cardinality(v_item_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma unidade ou item.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_unit_ids) + cardinality(v_item_ids) > 200 THEN
    RAISE EXCEPTION 'Seleção grande demais para uma operação.' USING ERRCODE = '22023';
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

  IF o.status IN ('AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO', 'CANCELADO', 'SAIU_PARA_ENTREGA', 'ENTREGUE') THEN
    RAISE EXCEPTION 'Pedido em % não aceita alterações de produção.', o.status USING ERRCODE = '22023';
  END IF;

  IF o.type = 'ENTREGA' AND p_new_status = 'DELIVERED' THEN
    RAISE EXCEPTION 'Itens de delivery só são concluídos pela confirmação do motoboy.' USING ERRCODE = '22023';
  END IF;

  v_prev_status := o.status;

  -- Locks na ordem pedido -> itens -> unidades (mesma ordem em todos os lotes).
  PERFORM 1 FROM public.order_items
  WHERE id = ANY(v_item_ids) AND order_id = p_order_id ORDER BY id FOR UPDATE;
  GET DIAGNOSTICS v_found = ROW_COUNT;
  IF v_found <> cardinality(v_item_ids) THEN
    RAISE EXCEPTION 'Item inexistente ou de outro pedido.' USING ERRCODE = '22023';
  END IF;

  -- Itens com unidades ativas são expandidos em suas unidades.
  v_unit_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(v_unit_ids || ARRAY(
      SELECT u2.id FROM public.production_handoff_units u2
      JOIN public.order_items i2 ON i2.id = u2.order_item_id AND i2.handoff_revision = u2.revision
      WHERE u2.order_item_id = ANY(v_item_ids) AND u2.state <> 'SUPERSEDED'
    )) x
  );

  PERFORM set_config('pdv.production_batch', 'on', true);

  v_found := 0;
  FOR u IN
    SELECT * FROM public.production_handoff_units
    WHERE id = ANY(v_unit_ids) AND order_id = p_order_id
    ORDER BY id FOR UPDATE
  LOOP
    v_found := v_found + 1;
    IF u.state = 'SUPERSEDED' THEN
      RAISE EXCEPTION 'O item foi alterado por outro operador. Atualize e revise.' USING ERRCODE = '40001';
    END IF;
    IF u.prep_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Unidade % de item cancelado não pode avançar.', u.unit_no USING ERRCODE = '40001';
    END IF;
    IF handoff_private.prep_rank(u.prep_status) >= v_target_rank THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF p_new_status = 'DELIVERED' AND u.prep_status <> 'READY' THEN
      RAISE EXCEPTION 'Só unidades prontas podem ser entregues (unidade % está em %).', u.unit_no, u.prep_status
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.production_handoff_units SET
      prep_status = p_new_status,
      prep_started_at = coalesce(prep_started_at, v_now),
      ready_at = CASE WHEN v_target_rank >= 2 THEN coalesce(ready_at, v_now) ELSE ready_at END,
      delivered_at = CASE WHEN v_target_rank = 3 THEN coalesce(delivered_at, v_now) ELSE delivered_at END,
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
    IF NOT (u.order_item_id = ANY(v_touched_items)) THEN
      v_touched_items := array_append(v_touched_items, u.order_item_id);
    END IF;
  END LOOP;
  IF v_found <> cardinality(v_unit_ids) THEN
    RAISE EXCEPTION 'Unidade inexistente ou de outro pedido.' USING ERRCODE = '22023';
  END IF;

  -- Itens sem unidades (setores sem repasse) avançam pela linha.
  FOR i IN
    SELECT * FROM public.order_items it
    WHERE it.id = ANY(v_item_ids) AND it.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.production_handoff_units u3
        WHERE u3.order_item_id = it.id AND u3.revision = it.handoff_revision AND u3.state <> 'SUPERSEDED'
      )
    ORDER BY it.id
  LOOP
    IF i.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Item cancelado não pode avançar.' USING ERRCODE = '40001';
    END IF;
    IF handoff_private.prep_rank(i.status::text) >= v_target_rank THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF p_new_status = 'DELIVERED' AND i.status <> 'READY' THEN
      RAISE EXCEPTION 'Só itens prontos podem ser entregues.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.order_items SET
      status = p_new_status::public.order_item_status,
      prep_started_at = coalesce(prep_started_at, v_now),
      item_ready_at = CASE WHEN v_target_rank >= 2 THEN coalesce(item_ready_at, v_now) ELSE item_ready_at END,
      delivered_at = CASE WHEN v_target_rank = 3 THEN coalesce(delivered_at, v_now) ELSE delivered_at END
    WHERE id = i.id;

    INSERT INTO public.audit_logs(action, table_name, record_id, user_id, branch_id, old_data, new_data)
    VALUES (
      'ITEM_' || p_new_status, 'order_items', i.id, auth.uid(), o.branch_id,
      jsonb_build_object('status', i.status),
      jsonb_build_object('from', i.status, 'to', p_new_status, 'reason', p_reason)
    );
    v_changed_items := v_changed_items + 1;
  END LOOP;

  PERFORM set_config('pdv.production_batch', 'off', true);

  FOREACH v_item_id IN ARRAY v_touched_items LOOP
    PERFORM handoff_private.sync_item_status_from_units(v_item_id);
  END LOOP;
  PERFORM public.recompute_order_status_from_items(p_order_id);

  SELECT * INTO o FROM public.orders WHERE id = p_order_id;

  IF o.status = 'PRONTO' AND v_prev_status IS DISTINCT FROM 'PRONTO' THEN
    INSERT INTO public.production_notification_outbox(order_id, event_type)
    VALUES (p_order_id, 'order_ready') ON CONFLICT DO NOTHING;
  ELSIF o.status = 'PRONTO_PARCIAL' AND v_prev_status = 'NA_FILA' THEN
    INSERT INTO public.production_notification_outbox(order_id, event_type)
    VALUES (p_order_id, 'order_partial_ready') ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'changed_units', v_changed_units,
    'changed_items', v_changed_items,
    'skipped', v_skipped,
    'order_id', p_order_id,
    'previous_order_status', v_prev_status,
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

REVOKE ALL ON FUNCTION handoff_private.prep_rank(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION handoff_private.sync_item_status_from_units(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION handoff_private.batch_update_production(uuid, uuid[], uuid[], text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.batch_update_production_status(uuid, uuid[], uuid[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION handoff_private.batch_update_production(uuid, uuid[], uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_production_status(uuid, uuid[], uuid[], text, text) TO authenticated;
