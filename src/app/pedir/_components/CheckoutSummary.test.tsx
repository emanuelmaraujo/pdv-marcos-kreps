import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckoutSummary } from "./CheckoutSummary";

const base: ComponentProps<typeof CheckoutSummary> = {
  orderType: "BALCAO", subtotal: 40, packagingFee: 0, deliveryFee: 0,
  deliveryFeeKnown: true, deliveryBlocked: false, couponDiscount: 0,
  freeDelivery: false, total: 40,
};
const render = (overrides: Partial<typeof base>) => renderToStaticMarkup(createElement(CheckoutSummary, { ...base, ...overrides }));
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

describe("resumo público antes de enviar o pedido", () => {
  it("discrimina embalagem de VIAGEM e total, sem multiplicar a taxa pela quantidade", () => {
    const html = render({ orderType: "VIAGEM", packagingFee: 2, total: 42 });
    expect(html).toContain("Embalagem para viagem");
    expect(html).toContain(money(2));
    expect(html).toContain(money(42));
    expect(html).toContain("Não se aplica");
  });

  it("explicita embalagem sem cobrança quando a regra está desativada", () => {
    const html = render({ orderType: "VIAGEM" });
    expect(html).toContain("Embalagem para viagem");
    expect(html).toContain(money(0));
    expect(html).toContain("Total estimado");
  });

  it("mostra frete validado e desconto no último resumo", () => {
    const html = render({ orderType: "ENTREGA", deliveryFee: 5, couponCode: "TESTE", couponDiscount: 4, total: 41 });
    expect(html).toContain(money(5));
    expect(html).toContain("Desconto (TESTE)");
    expect(html).toContain(`- ${money(4)}`);
    expect(html).toContain(money(41));
  });

  it("não apresenta frete desconhecido como grátis ou total final", () => {
    const html = render({ orderType: "ENTREGA", deliveryFeeKnown: false });
    expect(html).toContain("A calcular após validar o endereço");
    expect(html).toContain("Total parcial");
    expect(html).not.toContain("Total estimado");
    expect(html).not.toContain("Grátis");
  });

  it("não promete frete grátis antes da validação mesmo com cupom", () => {
    const html = render({ orderType: "ENTREGA", deliveryFeeKnown: false, freeDelivery: true, couponCode: "FERIADOU" });
    expect(html).toContain("A calcular após validar o endereço");
    expect(html).not.toContain("Grátis com");
  });

  it("identifica região não atendida sem prometer total completo", () => {
    const html = render({ orderType: "ENTREGA", deliveryBlocked: true, deliveryFeeKnown: false });
    expect(html).toContain("Região não atendida");
    expect(html).toContain("Total parcial");
  });

  it("apresenta frete grátis por cupom sem mostrá-lo como cobrança", () => {
    const html = render({ orderType: "ENTREGA", deliveryFee: 5, freeDelivery: true, couponCode: "FERIADOU" });
    expect(html).toContain("Grátis com FERIADOU");
    expect(html).not.toContain(money(5));
    expect(html).not.toContain("Desconto");
    expect(html).toContain(money(40));
  });
});
