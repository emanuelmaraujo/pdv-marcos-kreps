/**
 * Prévia de embalagem do PDV interno.
 * A tarifa é por unidade do item marcado Para levar; na entrega, todos vão embalados.
 * O backend continua sendo a autoridade sobre cobrança e total final.
 */
export interface PackagingPreviewItem {
  quantity: number;
  is_takeout?: boolean;
}

export function calculatePackagingEstimate({
  items,
  isDelivery,
  enabled,
  feePerItem,
}: {
  items: readonly PackagingPreviewItem[];
  isDelivery: boolean;
  enabled: boolean;
  feePerItem: number;
}): { quantity: number; fee: number } {
  const quantity = items.reduce(
    (sum, item) => sum + ((isDelivery || item.is_takeout) ? item.quantity : 0),
    0,
  );
  const rate = Number.isFinite(feePerItem) && feePerItem > 0 ? feePerItem : 0;
  return {
    quantity,
    fee: enabled ? Math.round(quantity * rate * 100) / 100 : 0,
  };
}
