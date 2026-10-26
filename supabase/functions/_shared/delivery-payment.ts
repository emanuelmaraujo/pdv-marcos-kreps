export const DELIVERY_PAYMENT_METHODS = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"] as const;
export type DeliveryPaymentMethod = typeof DELIVERY_PAYMENT_METHODS[number];
// Sem acentos: a impressora térmica usa a mesma régua ASCII do restante da via.
export const DELIVERY_PAYMENT_RECEIPT_LABELS: Record<DeliveryPaymentMethod, string> = {
  CASH: "Dinheiro", PIX: "Pix na entrega", DEBIT_CARD: "Debito na maquininha", CREDIT_CARD: "Credito na maquininha",
};

export function parsePublicPaymentOption(body: Record<string, unknown>) {
  const timing = body.payment_timing ?? "ONLINE";
  if (timing !== "ONLINE" && timing !== "ON_DELIVERY") throw new Error("Momento de pagamento inválido.");
  const method = body.expected_payment_method ?? null;
  const change = body.cash_change_for ?? null;
  if (timing === "ONLINE") {
    if (method !== null || change !== null) throw new Error("Opção presencial incompatível com pagamento online.");
  } else {
    if (body.order_type !== "ENTREGA" || !DELIVERY_PAYMENT_METHODS.includes(method as DeliveryPaymentMethod)) {
      throw new Error("Pagamento na entrega indisponível para este pedido.");
    }
    if (change !== null && (method !== "CASH" || typeof change !== "number" || !Number.isFinite(change)
      || change < 0 || change > 100000 || Math.abs(change * 100 - Math.round(change * 100)) > 0.00001)) {
      throw new Error("Valor para troco inválido.");
    }
  }
  return { timing, method: method as DeliveryPaymentMethod | null, change: change as number | null };
}
