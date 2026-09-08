import { describe, expect, it } from "vitest";
import {
  courierPeriodRange,
  formatBusinessDayLabel,
  formatRangeLabel,
  groupCourierOrdersByDay,
  orderBusinessDayKey,
  summarizeCourierOrders,
} from "./courier-orders";

type TestOrder = Parameters<typeof summarizeCourierOrders>[0][number];

function makeOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    id: "pedido-1",
    status: "ENTREGUE",
    delivery_fee: 8,
    total_amount: 50,
    payment_status: "PAID",
    dispatched_at: "2026-09-08T22:00:00Z",
    ...overrides,
  } as TestOrder;
}

describe("orderBusinessDayKey", () => {
  it("usa dispatched_at como âncora do dia comercial", () => {
    // 2026-09-08 19:00 em Brasília.
    expect(orderBusinessDayKey(makeOrder({ dispatched_at: "2026-09-08T22:00:00Z" }))).toBe("2026-09-08");
  });

  it("mantem a madrugada no dia comercial anterior", () => {
    // 2026-09-09 01:30 em Brasília → ainda é o turno de 08/09.
    expect(orderBusinessDayKey(makeOrder({ dispatched_at: "2026-09-09T04:30:00Z" }))).toBe("2026-09-08");
  });

  it("cai para delivery_delivered_at e created_at quando nao ha despacho", () => {
    expect(
      orderBusinessDayKey(
        makeOrder({ dispatched_at: undefined, delivery_delivered_at: "2026-09-08T22:00:00Z" }),
      ),
    ).toBe("2026-09-08");
    expect(
      orderBusinessDayKey(
        makeOrder({ dispatched_at: undefined, delivery_delivered_at: undefined, created_at: "2026-09-08T22:00:00Z" }),
      ),
    ).toBe("2026-09-08");
    expect(
      orderBusinessDayKey(
        makeOrder({ dispatched_at: undefined, delivery_delivered_at: undefined, created_at: undefined }),
      ),
    ).toBeNull();
  });
});

describe("summarizeCourierOrders", () => {
  it("soma ganhos so das corridas concluidas e separa as que estao na rua", () => {
    const balance = summarizeCourierOrders([
      makeOrder({ id: "a", status: "ENTREGUE", delivery_fee: 8 }),
      makeOrder({ id: "b", status: "ENTREGUE", delivery_fee: 12 }),
      makeOrder({ id: "c", status: "SAIU_PARA_ENTREGA", delivery_fee: 10 }),
      makeOrder({ id: "d", status: "CANCELADO", delivery_fee: 9 }),
    ]);

    expect(balance.totalOrders).toBe(4);
    expect(balance.delivered).toBe(2);
    expect(balance.onRoute).toBe(1);
    expect(balance.cancelled).toBe(1);
    expect(balance.earnings).toBe(20);
    expect(balance.pendingEarnings).toBe(10);
    expect(balance.averageEarning).toBe(10);
  });

  it("conta como valor a repassar apenas o pedido entregue sem pagamento", () => {
    const balance = summarizeCourierOrders([
      makeOrder({ id: "a", payment_status: "PENDING", total_amount: 70 }),
      makeOrder({ id: "b", payment_status: "PARTIAL", total_amount: 30 }),
      makeOrder({ id: "c", payment_status: "PAID", total_amount: 100 }),
      makeOrder({ id: "d", payment_status: "COURTESY", total_amount: 40 }),
      makeOrder({ id: "e", status: "SAIU_PARA_ENTREGA", payment_status: "PENDING", total_amount: 999 }),
    ]);

    expect(balance.collectedOnDelivery).toBe(100);
    expect(balance.ordersAmount).toBe(240);
  });

  it("nao quebra com lista vazia nem com taxa nula", () => {
    expect(summarizeCourierOrders([]).averageEarning).toBe(0);
    expect(summarizeCourierOrders([makeOrder({ delivery_fee: null as never })]).earnings).toBe(0);
  });
});

describe("groupCourierOrdersByDay", () => {
  it("agrupa por dia comercial em ordem decrescente com saldo por dia", () => {
    const groups = groupCourierOrdersByDay([
      makeOrder({ id: "a", dispatched_at: "2026-09-07T22:00:00Z", delivery_fee: 5 }),
      makeOrder({ id: "b", dispatched_at: "2026-09-08T22:00:00Z", delivery_fee: 8 }),
      makeOrder({ id: "c", dispatched_at: "2026-09-09T04:30:00Z", delivery_fee: 7 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-09-08", "2026-09-07"]);
    expect(groups[0].orders.map((order) => order.id)).toEqual(["c", "b"]);
    expect(groups[0].balance.earnings).toBe(15);
    expect(groups[1].balance.earnings).toBe(5);
  });

  it("ignora pedidos sem nenhuma data utilizavel", () => {
    const groups = groupCourierOrdersByDay([
      makeOrder({ id: "sem-data", dispatched_at: undefined, delivery_delivered_at: undefined, created_at: undefined }),
    ]);
    expect(groups).toEqual([]);
  });
});

describe("courierPeriodRange", () => {
  // 2026-09-08 19:00 em Brasília.
  const reference = new Date("2026-09-08T22:00:00Z");

  it("hoje cobre o dia comercial corrente", () => {
    const range = courierPeriodRange("today", undefined, reference);
    expect(range.start.toISOString()).toBe("2026-09-08T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-09T06:00:00.000Z");
  });

  it("ontem termina onde hoje comeca", () => {
    const range = courierPeriodRange("yesterday", undefined, reference);
    expect(range.start.toISOString()).toBe("2026-09-07T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-08T06:00:00.000Z");
  });

  it("7 e 30 dias incluem o dia de hoje", () => {
    expect(courierPeriodRange("last7", undefined, reference).start.toISOString()).toBe("2026-09-02T06:00:00.000Z");
    expect(courierPeriodRange("last7", undefined, reference).end.toISOString()).toBe("2026-09-09T06:00:00.000Z");
    expect(courierPeriodRange("last30", undefined, reference).start.toISOString()).toBe("2026-08-10T06:00:00.000Z");
  });

  it("dia escolhido usa o dia comercial daquela data", () => {
    const range = courierPeriodRange("custom", "2026-09-01", reference);
    expect(range.start.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-02T06:00:00.000Z");
  });

  it("dia escolhido sem data cai para hoje", () => {
    const range = courierPeriodRange("custom", undefined, reference);
    expect(range.start.toISOString()).toBe("2026-09-08T06:00:00.000Z");
  });
});

describe("rotulos de data", () => {
  const reference = new Date("2026-09-08T22:00:00Z");

  it("nomeia hoje e ontem, e formata os demais dias", () => {
    expect(formatBusinessDayLabel("2026-09-08", reference)).toBe("Hoje");
    expect(formatBusinessDayLabel("2026-09-07", reference)).toBe("Ontem");
    expect(formatBusinessDayLabel("2026-09-01", reference)).toContain("01/09");
  });

  it("resume o intervalo mostrando o ultimo dia incluido", () => {
    expect(formatRangeLabel(courierPeriodRange("today", undefined, reference))).toBe("08/09");
    expect(formatRangeLabel(courierPeriodRange("last7", undefined, reference))).toBe("02/09 até 08/09");
  });
});
