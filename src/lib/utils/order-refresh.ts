export function getSelectedOrderSyncCandidate<T extends { id: string }>(
  currentOrder: T | null,
  refreshedOrders: T[],
  syncSelectedOrder: boolean,
): T | null {
  if (!syncSelectedOrder || !currentOrder) return null;

  return refreshedOrders.find((order) => order.id === currentOrder.id) ?? null;
}
