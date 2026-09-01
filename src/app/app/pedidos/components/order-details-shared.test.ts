import { describe, expect, it } from "vitest";
import type { Order } from "@/types/pdv";
import {
  formatDuration,
  getOutstandingOrderAmount,
  additionWindowRemainingMinutes,
  isOrderOpenForAdditions,
  POST_PAYMENT_ADDITION_WINDOW_MS,
  ORDER_DETAILS_PAYMENT_LABELS,
  ORDER_DETAILS_PAYMENT_METHODS,
} from "./order-details-shared";

describe("detalhe compartilhado de pedido", () => {
  it("mantém o mesmo catálogo de pagamentos para mobile e desktop", () => {
    expect(ORDER_DETAILS_PAYMENT_METHODS.map((method) => method.value)).toEqual([
      "PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "IFOOD", "COURTESY", "PENDING",
    ]);
    expect(ORDER_DETAILS_PAYMENT_LABELS.CREDIT_CARD).toBe("Crédito");
  });

  it("soma itens em aberto e taxas somente antes da quitação", () => {
    const order = {
      items: [
        { status: "ACTIVE", payment_status: "PENDING", total_price: 12.5 },
        { status: "ACTIVE", payment_status: "PAID", total_price: 7 },
        { status: "CANCELLED", payment_status: "PENDING", total_price: 9 },
      ],
      packing_fee: 2,
      delivery_fee: 3.5,
      paid_at: null,
    } as unknown as Order;

    expect(getOutstandingOrderAmount(order)).toBe(18);
    expect(getOutstandingOrderAmount({ ...order, paid_at: "2026-09-01T12:00:00.000Z" })).toBe(12.5);
  });

  it("formata durações sem alterar a semântica exibida", () => {
    expect(formatDuration(null)).toBe("--");
    expect(formatDuration(42)).toBe("42min");
    expect(formatDuration(65)).toBe("1h 5min");
  });

  it("mantém uma comanda paga aberta por uma hora apenas para acréscimos", () => {
    const now = Date.parse("2026-09-01T12:00:00.000Z");
    const order = { status: "ENTREGUE", paid_at: new Date(now - 20 * 60_000).toISOString() } as Order;

    expect(isOrderOpenForAdditions(order, now)).toBe(true);
    expect(additionWindowRemainingMinutes(order, now)).toBe(40);
    expect(isOrderOpenForAdditions({ ...order, paid_at: new Date(now - POST_PAYMENT_ADDITION_WINDOW_MS - 1).toISOString() }, now)).toBe(false);
  });
});
