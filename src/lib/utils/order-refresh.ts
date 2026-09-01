export function getSelectedOrderSyncCandidate<T extends { id: string }>(
  currentOrder: T | null,
  refreshedOrders: T[],
  syncSelectedOrder: boolean,
): T | null {
  if (!syncSelectedOrder || !currentOrder) return null;

  return refreshedOrders.find((order) => order.id === currentOrder.id) ?? null;
}

/** Identifica uma mudança material no quadro sem depender da identidade dos objetos. */
export function hasOrderBoardChanged<
  T extends { id: string; updated_at?: string; status?: string; payment_status?: string },
>(currentOrders: T[], refreshedOrders: T[]) {
  if (currentOrders.length !== refreshedOrders.length) return true;

  const currentById = new Map(currentOrders.map((order) => [order.id, order]));
  return refreshedOrders.some((order) => {
    const current = currentById.get(order.id);
    if (!current) return true;

    return current.updated_at !== order.updated_at
      || current.status !== order.status
      || current.payment_status !== order.payment_status;
  });
}
