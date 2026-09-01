import { describe, expect, it } from "vitest";
import { getSafeProductImageUrl } from "./product-image";

describe("getSafeProductImageUrl", () => {
  it("aceita URLs web absolutas para visualizar a imagem", () => {
    expect(getSafeProductImageUrl(" https://cdn.example.com/krep.jpg ")).toBe("https://cdn.example.com/krep.jpg");
    expect(getSafeProductImageUrl("http://localhost:54321/storage/v1/object/public/menu/krep.png")).toBe(
      "http://localhost:54321/storage/v1/object/public/menu/krep.png",
    );
  });

  it("recusa valores inválidos ou esquemas que não podem virar link", () => {
    expect(getSafeProductImageUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeProductImageUrl("data:image/png;base64,abc")).toBeNull();
    expect(getSafeProductImageUrl("imagem.jpg")).toBeNull();
    expect(getSafeProductImageUrl(" ")).toBeNull();
  });
});
