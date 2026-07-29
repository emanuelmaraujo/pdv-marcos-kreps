-- Migration: Delivery — Fase 1 (protege SAIU_PARA_ENTREGA na trigger de status)
-- Notes:
--   * Pedidos de ENTREGA usam um passo extra fora do ciclo de vida dos itens:
--     o despacho (orders.status = SAIU_PARA_ENTREGA) é setado explicitamente
--     pela Edge Function dispatch-delivery, sem alterar order_items.status
--     (os itens continuam READY — foram produzidos e entregues ao entregador,
--     não ao cliente final). Por isso a trigger de recomputo não pode
--     sobrescrever esse estado automaticamente, do mesmo jeito que já protege
--     AGUARDANDO_CONFIRMACAO/AGUARDANDO_PAGAMENTO/EXPIRADO hoje.
--   * A confirmação final de entrega (Edge Function confirm-delivery) marca os
--     itens como DELIVERED E atualiza orders.status = ENTREGUE explicitamente
--     na mesma chamada — como SAIU_PARA_ENTREGA agora fica protegido contra
--     sobrescrita automática (igual aos demais estados desta lista), a trigger
--     não faria essa transição sozinha.

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

  IF v_old IN ('AGUARDANDO_CONFIRMACAO', 'AGUARDANDO_PAGAMENTO', 'EXPIRADO', 'SAIU_PARA_ENTREGA') THEN
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
