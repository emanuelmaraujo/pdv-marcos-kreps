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


/**
 * Mescla somente os pedidos que foram consultados novamente.
 * Pedidos fora de requestedIds preservam a mesma referência e não são
 * baixados/processados de novo. Se um ID consultado não voltar da API,
 * ele é removido do quadro (ex.: saiu do recorte atual).
 */
export function mergeRefreshedOrders<
  T extends { id: string; created_at?: string },
>(
  currentOrders: T[],
  refreshedOrders: T[],
  requestedIds: Iterable<string>,
): T[] {
  const requested = new Set(requestedIds);
  const refreshedById = new Map(refreshedOrders.map((order) => [order.id, order]));

  const merged = [
    ...currentOrders.filter((order) => !requested.has(order.id)),
    ...refreshedById.values(),
  ];

  return merged.sort((a, b) => {
    if (!a.created_at || !b.created_at) return 0;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
