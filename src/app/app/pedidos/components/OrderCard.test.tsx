import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/pdv";
import { OrderCard } from "./OrderCard";

const baseOrder: Order = {
  id: "order-1",
  daily_number: 12,
  branch_id: "branch-1",
  public_token: "token",
  type: "BALCAO",
  source: "ATTENDANT",
  status: "NA_FILA",
  payment_status: "PAID",
  payment_method: "PIX",
  discount_amount: 0,
  discount_percentage: 0,
  packing_fee: 0,
  delivery_fee: 0,
  total_amount: 25,
  created_at: "2026-09-13T12:00:00.000Z",
  updated_at: "2026-09-13T12:00:00.000Z",
  items: [],
};

function renderOrder(order: Order) {
  return renderToStaticMarkup(
    <OrderCard
      order={order}
      now={new Date("2026-09-13T12:05:00.000Z").getTime()}
      onClick={vi.fn()}
      onQuickAction={vi.fn()}
      onMarkDelivered={vi.fn()}
    />,
  );
}

describe("OrderCard actions", () => {
  it("shows direct delivery beside mark ready for counter and takeout orders", () => {
    const counterMarkup = renderOrder(baseOrder);
    const takeoutMarkup = renderOrder({ ...baseOrder, type: "VIAGEM" });

    for (const markup of [counterMarkup, takeoutMarkup]) {
      expect(markup).toContain("Entregar");
      expect(markup).toContain("Marcar pronto");
    }
  });

  it("does not allow direct delivery for delivery orders", () => {
    const markup = renderOrder({ ...baseOrder, type: "ENTREGA" });

    expect(markup).not.toContain("Entregar");
    expect(markup).toContain("Marcar pronto");
  });
});
