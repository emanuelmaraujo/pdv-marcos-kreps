import { describe, expect, it } from "vitest";
import { shouldResetPaymentItemsDraft } from "./payment-items-state";

describe("shouldResetPaymentItemsDraft", () => {
  it("preserva o rascunho durante polling ou Realtime do mesmo pedido", () => {
    expect(shouldResetPaymentItemsDraft("pedido-1", "pedido-1")).toBe(false);
  });

  it("inicia um novo rascunho somente ao trocar de pedido", () => {
    expect(shouldResetPaymentItemsDraft("pedido-1", "pedido-2")).toBe(true);
    expect(shouldResetPaymentItemsDraft(null, "pedido-1")).toBe(true);
  });
});
