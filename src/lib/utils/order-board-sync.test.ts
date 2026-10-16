import { describe, expect, it } from "vitest";
import { ORDER_BOARD_RECONCILE_INTERVAL_MS, shouldReconcileOrderBoard } from "./order-board-sync";

describe("reconciliação do quadro de pedidos", () => {
  it("reconsulta com aba visível mesmo que pedidos públicos estejam desativados", () => {
    expect(shouldReconcileOrderBoard("visible", true)).toBe(true);
  });
  it("não consome polling na aba oculta", () => {
    expect(shouldReconcileOrderBoard("hidden", true)).toBe(false);
  });
  it("não tenta consultar o servidor enquanto offline", () => {
    expect(shouldReconcileOrderBoard("visible", false)).toBe(false);
  });
  it("mantém intervalo de recuperação de até 20 segundos com aba visível", () => {
    expect(ORDER_BOARD_RECONCILE_INTERVAL_MS).toBe(20_000);
  });
});
