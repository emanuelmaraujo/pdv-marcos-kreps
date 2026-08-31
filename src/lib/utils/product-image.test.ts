import { describe, expect, it } from "vitest";
import {
  buildImageCandidates,
  extractDriveFileId,
  getSafeProductImageUrl,
  looksLikeImagePath,
  normalizeProductImageUrl,
} from "./product-image";

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

describe("normalizeProductImageUrl", () => {
  it("trata vazio/nulo como produto sem foto", () => {
    for (const input of [null, undefined, "", "   "]) {
      expect(normalizeProductImageUrl(input)).toMatchObject({ url: null, error: null });
    }
  });

  it("limpa sujeira do copiar/colar", () => {
    expect(normalizeProductImageUrl('  "https://cdn.site.com/a.jpg"  ').url).toBe(
      "https://cdn.site.com/a.jpg",
    );
    expect(normalizeProductImageUrl("<https://cdn.site.com/a.jpg>").url).toBe(
      "https://cdn.site.com/a.jpg",
    );
    expect(normalizeProductImageUrl("https://cdn.site.com/a.jpg\n").url).toBe(
      "https://cdn.site.com/a.jpg",
    );
  });

  it("completa endereço sem esquema em vez de recusar", () => {
    const result = normalizeProductImageUrl("www.site.com/foto.jpg");
    expect(result.url).toBe("https://www.site.com/foto.jpg");
    expect(result.error).toBeNull();
    expect(result.notice).toContain("https://");
  });

  it("sobe http para https (senão o navegador bloqueia a imagem)", () => {
    const result = normalizeProductImageUrl("http://cdn.site.com/a.jpg");
    expect(result.url).toBe("https://cdn.site.com/a.jpg");
    expect(result.notice).toBeTruthy();
  });

  it("aceita caminho local das fotos que vêm com o app", () => {
    expect(normalizeProductImageUrl("/cardapio/bebidas/refri-cola-lata.svg")).toMatchObject({
      url: "/cardapio/bebidas/refri-cola-lata.svg",
      error: null,
    });
  });

  it("converte todo formato de link do Drive para o endereço que serve a imagem", () => {
    const esperado = `https://drive.google.com/thumbnail?id=${ID}&sz=w1000`;
    const links = [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      `https://drive.google.com/open?id=${ID}`,
      `https://drive.google.com/uc?export=view&id=${ID}`,
      `https://drive.usercontent.google.com/download?id=${ID}&export=download`,
      `https://docs.google.com/uc?id=${ID}`,
      `https://lh3.googleusercontent.com/d/${ID}=w800`,
      `  https://drive.google.com/file/d/${ID}/view  `,
      `drive.google.com/file/d/${ID}/view`,
    ];
    for (const link of links) {
      const result = normalizeProductImageUrl(link);
      expect(result.error, link).toBeNull();
      expect(result.url, link).toBe(esperado);
    }
  });

  it("não avisa \"converti\" quando o link do Drive já está no formato final", () => {
    const direct = `https://drive.google.com/thumbnail?id=${ID}&sz=w1000`;
    expect(normalizeProductImageUrl(direct)).toMatchObject({ url: direct, notice: null });
  });

  it("recusa link de pasta do Drive com explicação", () => {
    const result = normalizeProductImageUrl("https://drive.google.com/drive/folders/1AbC");
    expect(result.url).toBeNull();
    expect(result.error).toContain("pasta");
  });

  it("extrai a imagem de dentro do link de resultado do Google Imagens", () => {
    const result = normalizeProductImageUrl(
      "https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.site.com%2Ffoto.jpg&imgrefurl=https%3A%2F%2Fsite.com",
    );
    expect(result.url).toBe("https://cdn.site.com/foto.jpg");
    expect(result.error).toBeNull();
  });

  it("converte Dropbox, GitHub e página do Imgur para o arquivo direto", () => {
    expect(normalizeProductImageUrl("https://www.dropbox.com/s/abc/foto.jpg?dl=0").url).toBe(
      "https://dl.dropboxusercontent.com/s/abc/foto.jpg?raw=1",
    );
    expect(
      normalizeProductImageUrl("https://github.com/user/repo/blob/main/foto.png").url,
    ).toBe("https://raw.githubusercontent.com/user/repo/main/foto.png");
    expect(normalizeProductImageUrl("https://imgur.com/AbC12").url).toBe(
      "https://i.imgur.com/AbC12.jpeg",
    );
  });

  it("recusa com mensagem os links que não têm como abrir de fora", () => {
    const cases = [
      "https://photos.app.goo.gl/abc123",
      "https://images.app.goo.gl/xyz",
      "https://www.instagram.com/p/Cabc123/",
      "https://br.pinterest.com/pin/12345/",
    ];
    for (const input of cases) {
      const result = normalizeProductImageUrl(input);
      expect(result.url).toBeNull();
      expect(result.error).toBeTruthy();
    }
  });

  it("recusa esquema que não é http(s)", () => {
    expect(normalizeProductImageUrl("javascript:alert(1)").error).toBeTruthy();
    expect(normalizeProductImageUrl("data:image/png;base64,AAAA").error).toBeTruthy();
  });

  it("mantém intacto um link direto normal", () => {
    const url = "https://cdn.site.com/fotos/produto-1.webp?v=2";
    expect(normalizeProductImageUrl(url)).toMatchObject({ url, error: null, notice: null });
  });
});

describe("extractDriveFileId", () => {
  it("acha o id em qualquer formato do Drive", () => {
    expect(extractDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
    expect(extractDriveFileId(`https://lh3.googleusercontent.com/d/${ID}=w1000`)).toBe(ID);
    expect(extractDriveFileId(`https://drive.google.com/thumbnail?id=${ID}&sz=w1000`)).toBe(ID);
  });

  it("ignora o que não é arquivo do Drive", () => {
    expect(extractDriveFileId("https://cdn.site.com/a.jpg")).toBeNull();
    expect(extractDriveFileId(`https://drive.google.com/drive/folders/${ID}`)).toBeNull();
    expect(extractDriveFileId("/cardapio/bebidas/suco-uva.svg")).toBeNull();
    expect(extractDriveFileId(null)).toBeNull();
  });
});

describe("buildImageCandidates", () => {
  it("dá ao Drive uma fila de endereços alternativos da mesma foto", () => {
    const candidatos = buildImageCandidates(`https://drive.google.com/file/d/${ID}/view`);
    expect(candidatos).toEqual([
      `https://drive.google.com/thumbnail?id=${ID}&sz=w1000`,
      `https://lh3.googleusercontent.com/d/${ID}=w1000`,
      `https://lh3.googleusercontent.com/d/${ID}`,
      `https://drive.google.com/uc?export=view&id=${ID}`,
    ]);
    // Qualquer formato de entrada gera a mesma fila — inclusive o que já foi
    // salvo no banco antes, no formato antigo.
    expect(buildImageCandidates(`https://lh3.googleusercontent.com/d/${ID}`)).toEqual(candidatos);
  });

  it("para link comum, a fila é só o próprio endereço", () => {
    expect(buildImageCandidates("https://cdn.site.com/a.jpg")).toEqual(["https://cdn.site.com/a.jpg"]);
    expect(buildImageCandidates("/cardapio/bebidas/suco-uva.svg")).toEqual([
      "/cardapio/bebidas/suco-uva.svg",
    ]);
    expect(buildImageCandidates(null)).toEqual([]);
  });
});

describe("looksLikeImagePath", () => {
  it("reconhece extensão de imagem", () => {
    expect(looksLikeImagePath("https://cdn.site.com/a.jpg")).toBe(true);
    expect(looksLikeImagePath("/cardapio/bebidas/agua.svg")).toBe(true);
    expect(looksLikeImagePath("https://cdn.site.com/imagem")).toBe(false);
  });
});
