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
    expect(getMessage(makeOrder())).toContain("pedido #42 está pronto!");
    expect(getMessage(makeOrder())).not.toContain("Condo Guará");
    expect(getMessage(makeOrder())).not.toContain("Marcos Krep's");
  });

  it("usa aviso objetivo também em pedidos de entrega, sem localização ou tipo", () => {
    const message = getMessage(makeOrder({ type: "ENTREGA" }));
    expect(message).toContain("pedido #42 está pronto!");
    expect(message).not.toContain("Condo Guará");
    expect(message).not.toContain("entrega");
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

  it("mantém a numeração curta e não exige nome ou filial", () => {
    const msg = getMessage(makeOrder({ daily_number: 3, branch: undefined, customer_name: undefined }));
    expect(msg).toBe("Olá!\nSeu pedido #03 está pronto!\nObrigado pela preferência!");
  });
});
