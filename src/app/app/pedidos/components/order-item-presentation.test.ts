import { describe, expect, it } from "vitest";
import type { OrderItem } from "@/types/pdv";
import { groupOrderItems } from "./order-item-presentation";

function item(id: string, categoryId: string, additionBatchNo = 0, sequenceNo = 1): OrderItem {
  return {
    id,
    order_id: "order",
    product_id: `product-${id}`,
    product_name_snapshot: id,
    product_price_snapshot: 10,
    production_sector: "KITCHEN",
    quantity: 1,
    total_price: 10,
    status: "PENDING",
    payment_status: "PENDING",
    payment_method: "PENDING",
    addition_batch_no: additionBatchNo,
    sequence_no: sequenceNo,
    product: { id: `product-${id}`, category_id: categoryId, name: id, price: 10, sector: "KITCHEN", active: true },
  };
}

describe("groupOrderItems", () => {
  it("respeita a ordem configurada das categorias e mantém adicionais depois do lote original", () => {
    const groups = groupOrderItems([
      item("Suco", "drinks"),
      item("Crepe adicionado", "savory", 2, 4),
      item("Crepe inicial", "savory", 0, 1),
      item("Batata", "potato"),
    ], {
      savory: { name: "Crepes salgados", sort_order: 1 },
      drinks: { name: "Bebidas", sort_order: 3 },
      potato: { name: "Batatas", sort_order: 4 },
    });

    expect(groups.map((group) => group.label)).toEqual(["Crepes salgados", "Bebidas", "Batatas"]);
    expect(groups[0].items.map((entry) => entry.product_name_snapshot)).toEqual(["Crepe inicial", "Crepe adicionado"]);
  });
});
