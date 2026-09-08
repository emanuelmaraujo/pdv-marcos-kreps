import { describe, it, expect } from "vitest";
import { extractOrderToken, looksLikePhone } from "./order-tracking-helpers";

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("extractOrderToken", () => {
  it("aceita a URL completa que o cliente recebe no WhatsApp", () => {
    expect(extractOrderToken(`https://marcoskreps.com.br/pedido/${TOKEN}`)).toBe(TOKEN);
  });

  it("aceita o caminho relativo e o token solto", () => {
    expect(extractOrderToken(`/pedido/${TOKEN}`)).toBe(TOKEN);
    expect(extractOrderToken(`pedido/${TOKEN}`)).toBe(TOKEN);
    expect(extractOrderToken(TOKEN)).toBe(TOKEN);
  });

  it("ignora espaços e maiúsculas coladas junto", () => {
    expect(extractOrderToken(`  ${TOKEN.toUpperCase()}  `)).toBe(TOKEN.toUpperCase());
  });

  it("preserva a query da URL sem levá-la junto no token", () => {
    expect(extractOrderToken(`https://marcoskreps.com.br/pedido/${TOKEN}?branch=principal`)).toBe(TOKEN);
  });

  it("devolve null quando não há token de 32 hex", () => {
    expect(extractOrderToken("")).toBeNull();
    expect(extractOrderToken("   ")).toBeNull();
    expect(extractOrderToken("meu pedido")).toBeNull();
    expect(extractOrderToken("(11) 99999-9999")).toBeNull();
    // 31 caracteres — token truncado no copiar/colar não vale
    expect(extractOrderToken(TOKEN.slice(0, 31))).toBeNull();
  });
});

describe("looksLikePhone", () => {
  it("aceita os formatos que o cliente digita", () => {
    expect(looksLikePhone("(11) 99999-9999")).toBe(true);
    expect(looksLikePhone("11999999999")).toBe(true);
    expect(looksLikePhone("+55 11 99999 9999")).toBe(true);
  });

  it("rejeita vazio e qualquer coisa com letra", () => {
    expect(looksLikePhone("")).toBe(false);
    expect(looksLikePhone("   ")).toBe(false);
    expect(looksLikePhone(TOKEN)).toBe(false);
    expect(looksLikePhone("meu pedido")).toBe(false);
  });
});
