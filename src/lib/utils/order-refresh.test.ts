import { describe, expect, it } from "vitest";
import { getSelectedOrderSyncCandidate, hasOrderBoardChanged } from "./order-refresh";

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
