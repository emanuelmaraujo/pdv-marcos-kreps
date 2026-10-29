import { describe, expect, it } from "vitest";
import type { CartItem } from "@/features/cart/useCart";
import type { Product } from "@/types/pdv";
import {
  countProductInCart,
  findPlainCartItem,
  getCartItemTotal,
  getFallbackArt,
  getFirstName,
  getProductsRequiringChoice,
} from "./public-menu-ui";

const product = (id: string, price = 20) => ({ id, name: `Produto ${id}`, price } as Product);
const item = (overrides: Partial<CartItem> & { product: Product }): CartItem => ({
  id: crypto.randomUUID(), quantity: 1, removed_ingredients: [], addons: [], ...overrides,
});

describe("ilustração quando não há foto", () => {
  it("usa a arte da categoria para kreps e batata", () => {
    expect(getFallbackArt("Kreps Salgados", "Calabresa")).toBe("/cardapio/fallback/krep-salgado.svg");
    expect(getFallbackArt("Kreps doces", "Nutella")).toBe("/cardapio/fallback/krep-doce.svg");
    expect(getFallbackArt("Batata", "Porção de Batata")).toBe("/cardapio/fallback/batata.svg");
  });

  it("só usa copo de suco para bebida que é suco", () => {
    expect(getFallbackArt("Bebidas", "Suco de Cajá")).toBe("/cardapio/bebidas/suco-natural.svg");
    expect(getFallbackArt("Bebidas", "Água mineral")).toBeNull();
    expect(getFallbackArt("Outros", "Brinde")).toBeNull();
  });
});

describe("botão + do cardápio", () => {
  it("identifica produtos com adicional obrigatório", () => {
    const ids = getProductsRequiringChoice([
      { product_id: "a", is_required: true },
      { product_id: "b", is_required: false },
    ]);
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(false);
  });

  it("soma no item puro e não em item personalizado", () => {
    const p = product("a");
    const custom = item({ product: p, addons: [{ addon_id: "x", quantity: 1, price: 2 }] });
    const withNote = item({ product: p, notes: "sem sal" });
    const plain = item({ product: p, quantity: 2 });
    expect(findPlainCartItem([custom, withNote], "a")).toBeUndefined();
    expect(findPlainCartItem([custom, plain], "a")).toBe(plain);
  });

  it("conta todas as versões do produto na sacola", () => {
    const p = product("a");
    expect(countProductInCart([item({ product: p, quantity: 2 }), item({ product: p }), item({ product: product("b") })], "a")).toBe(3);
  });
});

describe("totais e nome na confirmação", () => {
  it("calcula a linha com adicionais multiplicados pela quantidade", () => {
    expect(getCartItemTotal(item({ product: product("a", 22.9), quantity: 2, addons: [{ addon_id: "x", quantity: 1, price: 4 }] }))).toBeCloseTo(53.8);
  });

  it("extrai o primeiro nome", () => {
    expect(getFirstName("  Ana Maria Souza ")).toBe("Ana");
    expect(getFirstName("")).toBe("");
  });
});
