import { describe, expect, it } from "vitest";
import { resolveInitialCategoryId } from "./productTags";

const cat = (id: string) => ({ id });
const prod = (category_id: string) => ({ category_id });

describe("resolveInitialCategoryId", () => {
  it("devolve a primeira categoria quando ela tem produto", () => {
    expect(
      resolveInitialCategoryId([cat("salgados"), cat("doces")], [prod("salgados"), prod("doces")]),
    ).toBe("salgados");
  });

  it("pula categorias vazias no começo da lista", () => {
    expect(
      resolveInitialCategoryId([cat("vazia"), cat("doces")], [prod("doces")]),
    ).toBe("doces");
  });

  it("respeita a ordem recebida, não a ordem dos produtos", () => {
    expect(
      resolveInitialCategoryId(
        [cat("a"), cat("b"), cat("c")],
        [prod("c"), prod("b")],
      ),
    ).toBe("b");
  });

  it("devolve null quando nenhuma categoria tem produto", () => {
    expect(resolveInitialCategoryId([cat("a"), cat("b")], [])).toBeNull();
  });

  it("devolve null sem categorias", () => {
    expect(resolveInitialCategoryId([], [prod("orfao")])).toBeNull();
  });

  it("ignora produto de categoria que não está na lista", () => {
    expect(resolveInitialCategoryId([cat("a")], [prod("categoria-de-outra-filial")])).toBeNull();
  });
});
