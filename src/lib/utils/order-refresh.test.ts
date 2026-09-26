import { describe, expect, it } from "vitest";
import { getSelectedOrderSyncCandidate, hasOrderBoardChanged, mergeRefreshedOrders } from "./order-refresh";

interface TestOrder {
  id: string;
  version: number;
}

describe("getSelectedOrderSyncCandidate", () => {
  const openOrder: TestOrder = { id: "pedido-1", version: 1 };
  const refreshedOrders: TestOrder[] = [
    { id: "pedido-1", version: 2 },
    { id: "pedido-2", version: 1 },
  ];

  it("nao substitui o pedido aberto durante atualizacao automatica", () => {
    expect(getSelectedOrderSyncCandidate(openOrder, refreshedOrders, false)).toBeNull();
  });

  it("sincroniza o pedido aberto depois de uma acao explicita", () => {
    expect(getSelectedOrderSyncCandidate(openOrder, refreshedOrders, true)).toEqual({
      id: "pedido-1",
      version: 2,
    });
  });

  it("nao abre nem fecha pedidos quando nao existe correspondente", () => {
    expect(
      getSelectedOrderSyncCandidate(
        { id: "pedido-inexistente", version: 1 },
        refreshedOrders,
        true,
      ),
    ).toBeNull();
    expect(getSelectedOrderSyncCandidate(null, refreshedOrders, true)).toBeNull();
  });
});

describe("hasOrderBoardChanged", () => {
  const current = [{ id: "pedido-1", updated_at: "2026-09-01T10:00:00Z", status: "NA_FILA" }];

  it("ignora respostas equivalentes com novas referências de objeto", () => {
    expect(hasOrderBoardChanged(current, [{ ...current[0] }])).toBe(false);
  });

  it("detecta pedidos novos, removidos ou atualizados", () => {
    expect(hasOrderBoardChanged(current, [])).toBe(true);
    expect(hasOrderBoardChanged(current, [{ ...current[0], updated_at: "2026-09-01T10:01:00Z" }])).toBe(true);
    expect(hasOrderBoardChanged(current, [{ ...current[0], status: "PRONTO" }])).toBe(true);
  });
});


describe("mergeRefreshedOrders", () => {
  const current = [
    { id: "pedido-2", version: 1, created_at: "2026-09-25T20:00:00Z" },
    { id: "pedido-1", version: 1, created_at: "2026-09-25T19:00:00Z" },
    { id: "pedido-intocado", version: 1, created_at: "2026-09-25T18:00:00Z" },
  ];

  it("substitui somente os IDs consultados e preserva os demais", () => {
    const untouched = current[2];
    const result = mergeRefreshedOrders(
      current,
      [{ id: "pedido-1", version: 2, created_at: "2026-09-25T19:00:00Z" }],
      ["pedido-1"],
    );

    expect(result.find((order) => order.id === "pedido-1")?.version).toBe(2);
    expect(result.find((order) => order.id === "pedido-intocado")).toBe(untouched);
  });

  it("remove do quadro um ID consultado que nao voltou da API", () => {
    const result = mergeRefreshedOrders(current, [], ["pedido-2"]);
    expect(result.some((order) => order.id === "pedido-2")).toBe(false);
  });

  it("insere pedido novo mantendo a ordenacao por created_at", () => {
    const result = mergeRefreshedOrders(
      current,
      [{ id: "pedido-3", version: 1, created_at: "2026-09-25T21:00:00Z" }],
      ["pedido-3"],
    );

    expect(result.map((order) => order.id)[0]).toBe("pedido-3");
  });
});
