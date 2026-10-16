import { describe, expect, it } from "vitest";
import type { Order } from "@/types/pdv";
import { orderReadyWhatsAppUrl } from "./order-ready-whatsapp";

const makeOrder = (overrides: Partial<Order> = {}) => ({
  customer_phone: "(61) 99999-8888",
  customer_name: "Maria",
  daily_number: 42,
  type: "VIAGEM",
  branch: { id: "f", code: "CG", name: "Condo Guará", slug: "condo-guara" },
  ...overrides,
}) as Order;
function getMessage(order: Order): string {
  const url = orderReadyWhatsAppUrl(order);
  if (!url) throw new Error("Expected WhatsApp URL");
  return new URL(url).searchParams.get("text") ?? "";
}

describe("aviso manual de pedido pronto no WhatsApp", () => {
  it("usa wa.me com telefone brasileiro válido e texto codificado", () => {
    const url = orderReadyWhatsAppUrl(makeOrder())!;
    expect(url).toMatch(/^https:\/\/wa\.me\/5561999998888\?text=/);
    expect(getMessage(makeOrder())).toContain("pedido #42 da Marcos Krep's (Condo Guará) está pronto!");
    expect(getMessage(makeOrder())).toContain("retirar no balcão");
  });

  it("gera mensagem para entrega sem indicar retirada no balcão", () => {
    const message = getMessage(makeOrder({ type: "ENTREGA" }));
    expect(message).toContain("Vamos organizar a entrega.");
    expect(message).not.toContain("retirar no balcão");
  });

  it("aceita número +55 e nome vazio", () => {
    const url = orderReadyWhatsAppUrl(makeOrder({ customer_phone: "+55 61 99999-8888", customer_name: "" }))!;
    expect(url).toContain("https://wa.me/5561999998888?");
    expect(new URL(url).searchParams.get("text")).toContain("Olá!");
  });

  it("não gera link para ausência de telefone ou número inválido", () => {
    expect(orderReadyWhatsAppUrl(makeOrder({ customer_phone: null as unknown as string }))).toBeNull();
    expect(orderReadyWhatsAppUrl(makeOrder({ customer_phone: "619999" }))).toBeNull();
    expect(orderReadyWhatsAppUrl(makeOrder({ customer_phone: "javascript:alert(1)" }))).toBeNull();
  });

  it("mantém a numeração curta e não exige nome/filial", () => {
    const msg = getMessage(makeOrder({ daily_number: 3, branch: undefined, customer_name: undefined }));
    expect(msg).toContain("pedido #03 da Marcos Krep's está pronto!");
  });
});
