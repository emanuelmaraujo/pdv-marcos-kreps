import { describe, expect, it } from "vitest";
import { formatWhatsAppInput, normalizeBrazilPhone } from "./phone";

describe("normalizeBrazilPhone", () => {
  it.each([
    ["(61) 99999-9999", "+5561999999999"],
    ["61999999999", "+5561999999999"],
    ["+55 61 99999-9999", "+5561999999999"],
    ["5561999999999", "+5561999999999"],
    ["005561999999999", "+5561999999999"],
  ])("normaliza %s", (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it("preserva o DDD 55 em numero nacional", () => {
    expect(normalizeBrazilPhone("(55) 99999-9999")).toBe("+5555999999999");
  });

  it.each(["", "1234", "(10) 99999-9999", "(61) 89999-9999"])(
    "rejeita telefone invalido: %s",
    (input) => {
      expect(normalizeBrazilPhone(input)).toBeNull();
    },
  );
});

describe("formatWhatsAppInput", () => {
  it("formata celular com DDD 55 sem remover o DDD", () => {
    expect(formatWhatsAppInput("55999999999")).toBe("(55) 99999-9999");
  });
});
