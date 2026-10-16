/**
 * Realtime ajuda a antecipar atualizações, mas não substitui reconciliação.
 * A fila é um serviço operacional mesmo se checkout público estiver fechado.
 */
export const ORDER_BOARD_RECONCILE_INTERVAL_MS = 20_000;

export function shouldReconcileOrderBoard(
  visibilityState: string,
  isOnline: boolean,
): boolean {
  return visibilityState === "visible" && isOnline;
}
