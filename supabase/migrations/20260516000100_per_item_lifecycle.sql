-- Migration: Per-item lifecycle — Phase 1B (columns, triggers, backfill)
-- Date: 2026-05-16
-- Notes:
--   * Adiciona estado e numeração sequencial por item, mais campos de pagamento
--     por item. orders.status e orders.payment_status passam a ser derivados
--     dos itens via triggers (trust no client, trust no app — só o DB decide).
--   * Backwards-compatible: pedidos com 1 item se comportam como hoje.
--   * Aditiva: nenhum DROP, nenhum NOT NULL sem default.

-- ============================================================================
-- 1. Novas colunas em order_items
-- ============================================================================
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS status             order_item_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS sequence_no        SMALLINT,
  ADD COLUMN IF NOT EXISTS prep_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS item_ready_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status     payment_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS payment_method     payment_method NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ;

-- ============================================================================
-- 2. Coluna opcional em payments para rastrear quais itens o pagamento cobriu
-- ============================================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_item_ids UUID[] NULL;

-- ============================================================================
-- 3. Backfill — itens existentes herdam o estado do pedido
-- ============================================================================
UPDATE order_items oi SET
  status = CASE o.status
    WHEN 'ENTREGUE'  THEN 'DELIVERED'::order_item_status
    WHEN 'PRONTO'    THEN 'READY'::order_item_status
    WHEN 'CANCELADO' THEN 'CANCELLED'::order_item_status
    WHEN 'EXPIRADO'  THEN 'CANCELLED'::order_item_status
    ELSE 'PENDING'::order_item_status
  END,
  item_ready_at  = COALESCE(oi.item_ready_at,  o.ready_at),
  delivered_at   = COALESCE(oi.delivered_at,   o.delivered_at),
  cancelled_at   = COALESCE(oi.cancelled_at,   o.cancelled_at),
  payment_status = o.payment_status,
  payment_method = o.payment_method,
  paid_at        = COALESCE(oi.paid_at, o.paid_at)
FROM orders o
WHERE oi.order_id = o.id
  AND oi.status = 'PENDING';  -- só backfill quem ainda tá no default

-- Backfill da numeração sequencial (1, 2, 3, ... por pedido).
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at, id) AS seq
    FROM order_items
   WHERE sequence_no IS NULL
)
UPDATE order_items oi
   SET sequence_no = n.seq
  FROM numbered n
 WHERE oi.id = n.id;

-- ============================================================================
-- 4. Índice e constraint para a numeração sequencial
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_order_seq
  ON order_items(order_id, sequence_no)
  WHERE sequence_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_status
  ON order_items(order_id, status);

-- ============================================================================
-- 5. Trigger BEFORE INSERT — atribui sequence_no automaticamente
--    Usa advisory lock por order_id para evitar race com inserts simultâneos.
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_order_item_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('order_item_seq:' || NEW.order_id::text, 0)
    );
    SELECT COALESCE(MAX(sequence_no), 0) + 1
      INTO NEW.sequence_no
      FROM order_items
     WHERE order_id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_order_item_sequence ON order_items;
CREATE TRIGGER trg_assign_order_item_sequence
BEFORE INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION assign_order_item_sequence();

-- ============================================================================
-- 6. Funções auxiliares de derivação
-- ============================================================================

-- Recalcula orders.status a partir do estado dos itens.
-- Regra (considerando apenas itens NÃO cancelados como "ativos"):
--   * Sem itens ativos                       -> CANCELADO
--   * Todos ativos DELIVERED                 -> ENTREGUE
--   * Ativos só READY (sem D, sem P, sem I)  -> PRONTO
--   * Algum READY OU (algum D e algum P/I)   -> PRONTO_PARCIAL
--   * Restante (todos P/I)                   -> NA_FILA
-- Não mexe em pedidos ainda em AGUARDANDO_CONFIRMACAO, AGUARDANDO_PAGAMENTO
-- ou EXPIRADO — esses estados precedem a fila e são gerenciados a nível de pedido.
CREATE OR REPLACE FUNCTION recompute_order_status_from_items(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total     INT;
  v_cancelled INT;
  v_delivered INT;
  v_ready     INT;
  v_in_prep   INT;
  v_pending   INT;
  v_active    INT;
  v_old       order_status;
  v_new       order_status;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  SELECT status INTO v_old FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_old IS NULL THEN
    RETURN;
  END IF;

  IF v_old IN ('AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO') THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'CANCELLED'),
    COUNT(*) FILTER (WHERE status = 'DELIVERED'),
    COUNT(*) FILTER (WHERE status = 'READY'),
    COUNT(*) FILTER (WHERE status = 'IN_PREPARATION'),
    COUNT(*) FILTER (WHERE status = 'PENDING')
  INTO v_total, v_cancelled, v_delivered, v_ready, v_in_prep, v_pending
  FROM order_items
  WHERE order_id = p_order_id;

  v_active := v_total - v_cancelled;

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
    UPDATE orders SET
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
$$ LANGUAGE plpgsql;

-- Recalcula orders.payment_status a partir do estado dos itens.
-- Considera apenas itens não cancelados.
--   * Todos cortesia              -> COURTESY
--   * Todos pagos ou cortesia     -> PAID
--   * Algum pago/cortesia mas não tudo -> PARTIAL
--   * Todos reembolsados          -> REFUNDED
--   * Caso contrário              -> PENDING
CREATE OR REPLACE FUNCTION recompute_order_payment_status_from_items(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_active   INT;
  v_paid     INT;
  v_courtesy INT;
  v_refunded INT;
  v_old      payment_status;
  v_new      payment_status;
BEGIN
  SELECT payment_status INTO v_old FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_old IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)                                                 FILTER (WHERE status <> 'CANCELLED'),
    COUNT(*) FILTER (WHERE payment_status = 'PAID'     AND status <> 'CANCELLED'),
    COUNT(*) FILTER (WHERE payment_status = 'COURTESY' AND status <> 'CANCELLED'),
    COUNT(*) FILTER (WHERE payment_status = 'REFUNDED' AND status <> 'CANCELLED')
  INTO v_active, v_paid, v_courtesy, v_refunded
  FROM order_items
  WHERE order_id = p_order_id;

  IF v_active = 0 THEN
    -- pedido todo cancelado: deixa o payment_status como estava
    RETURN;
  END IF;

  IF v_courtesy = v_active THEN
    v_new := 'COURTESY';
  ELSIF (v_paid + v_courtesy) = v_active THEN
    v_new := 'PAID';
  ELSIF (v_paid + v_courtesy) > 0 THEN
    v_new := 'PARTIAL';
  ELSIF v_refunded = v_active THEN
    v_new := 'REFUNDED';
  ELSE
    v_new := 'PENDING';
  END IF;

  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE orders SET
      payment_status = v_new,
      paid_at        = CASE WHEN v_new IN ('PAID', 'COURTESY') AND paid_at IS NULL
                            THEN NOW() ELSE paid_at END
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Triggers de derivação em order_items
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_order_items_recompute_order()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM recompute_order_status_from_items(v_order_id);
  PERFORM recompute_order_payment_status_from_items(v_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_items_status_change ON order_items;
CREATE TRIGGER trg_order_items_status_change
AFTER INSERT OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION trg_order_items_recompute_order();

DROP TRIGGER IF EXISTS trg_order_items_state_update ON order_items;
CREATE TRIGGER trg_order_items_state_update
AFTER UPDATE OF status, payment_status ON order_items
FOR EACH ROW
WHEN (
  OLD.status         IS DISTINCT FROM NEW.status OR
  OLD.payment_status IS DISTINCT FROM NEW.payment_status
)
EXECUTE FUNCTION trg_order_items_recompute_order();
