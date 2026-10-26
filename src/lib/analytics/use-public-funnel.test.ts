import { describe, expect, it } from "vitest";
import { orderFailureCategory } from "./use-public-funnel";

describe("categoria de falha do pedido no funil", () => {
  it("separa horário fechado, recusa do servidor e falha de rede", () => {
    expect(orderFailureCategory(new Error("x"), true)).toBe("CLOSED");
    expect(orderFailureCategory(new Error("[create-public-order] Status: 400 | Error: Pagamento na entrega indisponível"), false)).toBe("ORDER");
    expect(orderFailureCategory(new Error("[create-public-order] Failed to send a request to the Edge Function"), false)).toBe("NETWORK");
    expect(orderFailureCategory("offline", false)).toBe("NETWORK");
  });
});
