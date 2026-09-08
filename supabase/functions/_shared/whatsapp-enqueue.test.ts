import { describe, expect, it } from "vitest";
import { matchesOrderContext } from "./whatsapp-enqueue";

describe("WhatsApp order context", () => {
  it("mantém eventos antigos ativos quando não há filtros", () => {
    expect(matchesOrderContext({}, "BALCAO", "ATTENDANT")).toBe(true);
  });

  it("permite entrega nas origens configuradas", () => {
    const override = { order_types: ["ENTREGA"], order_sources: ["ATTENDANT", "APP"] };
    expect(matchesOrderContext(override, "ENTREGA", "APP")).toBe(true);
    expect(matchesOrderContext(override, "ENTREGA", "ATTENDANT")).toBe(true);
  });

  it("bloqueia consumo local e origens não selecionadas", () => {
    const override = { order_types: ["ENTREGA"], order_sources: ["APP"] };
    expect(matchesOrderContext(override, "BALCAO", "APP")).toBe(false);
    expect(matchesOrderContext(override, "ENTREGA", "QR_CODE")).toBe(false);
  });
});
