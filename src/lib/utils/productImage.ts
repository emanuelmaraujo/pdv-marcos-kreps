/**
 * Normalização de URL de foto de produto — com atenção especial ao Google Drive,
 * que é onde as fotos do cardápio ficam hospedadas.
 *
 * Contexto: o admin cola um link qualquer no cadastro do produto. Na prática o
 * que ele cola quase nunca é o endereço direto do arquivo de imagem — é link de
 * compartilhamento do Drive, resultado do Google Imagens, link do Fotos, página
 * do Instagram, endereço sem "https://" etc. Antes, qualquer um desses era
 * salvo como veio (ou nem salvava, porque o input `type="url"` bloqueava o
 * submit em silêncio) e o cardápio ficava com um buraco no lugar da foto.
 *
 * Aqui a gente:
 *   1. limpa o que veio (espaço, aspas, <>, quebra de linha do copiar/colar);
 *   2. converte os formatos de compartilhamento conhecidos para o link direto;
 *   3. recusa, com mensagem explicando o porquê, os que não têm como funcionar.
 */

export type NormalizedImageUrl = {
  /** URL pronta pra usar em <img src>, ou null quando o produto fica sem foto. */
  url: string | null;
  /** Mensagem pro admin quando o link não serve. Quando presente, não salve. */
  error: string | null;
  /** Aviso: o link foi ajustado (ex.: convertido do Drive). Salva mesmo assim. */
  notice: string | null;
};

const ok = (url: string | null, notice: string | null = null): NormalizedImageUrl => ({
  url,
  error: null,
  notice,
});
const fail = (error: string): NormalizedImageUrl => ({ url: null, error, notice: null });

/**
 * Hosts que servem *página*, não arquivo de imagem, e ainda bloqueiam quem tenta
 * embutir a foto de fora. Não dá pra consertar por transformação de URL — o
 * jeito é o admin baixar a imagem e subir em outro lugar.
 */
const PAGE_ONLY_HOSTS: { match: (host: string, url: URL) => boolean; message: string }[] = [
  {
    match: (h) => h === "photos.google.com" || h === "photos.app.goo.gl",
    message:
      "Link do Google Fotos não abre a imagem direto — ele exige login. Baixe a foto e suba em outro lugar (ou use o link do Google Drive com o arquivo compartilhado para \"qualquer pessoa com o link\").",
  },
  {
    match: (h) => h === "images.app.goo.gl" || h === "goo.gl" || h === "g.co",
    message:
      "Esse é um link encurtado do Google, não o endereço da imagem. Abra a foto, clique com o botão direito e use \"Copiar endereço da imagem\".",
  },
  {
    match: (h) => h.endsWith("instagram.com") || h.endsWith("facebook.com") || h.endsWith("fb.com"),
    message:
      "Instagram e Facebook bloqueiam foto usada fora do site deles. Salve a imagem no celular e suba em outro lugar (Google Drive, por exemplo).",
  },
  {
    match: (h) => h.endsWith("pinterest.com") || h === "pin.it",
    message:
      "Link do Pinterest é a página, não a imagem. Abra a foto em tamanho cheio e use \"Copiar endereço da imagem\".",
  },
  {
    match: (h) => h.endsWith("whatsapp.com"),
    message: "Link do WhatsApp não serve como foto. Salve a imagem e suba em um serviço de fotos.",
  },
  {
    match: (h, u) => h === "drive.google.com" && u.pathname.includes("/folders/"),
    message:
      "Esse link é de uma pasta do Drive, não de um arquivo. Abra a foto dentro da pasta e copie o link dela.",
  },
];

/** Hosts que servem arquivo do Google Drive, em qualquer um dos formatos. */
const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

/**
 * Extrai o ID do arquivo de qualquer link do Drive:
 *   drive.google.com/file/d/<id>/view?usp=sharing   (o "Copiar link")
 *   drive.google.com/open?id=<id>
 *   drive.google.com/uc?export=view&id=<id>         (formato antigo)
 *   drive.google.com/thumbnail?id=<id>&sz=w1000
 *   drive.usercontent.google.com/download?id=<id>
 *   lh3.googleusercontent.com/d/<id>=w1000          (CDN)
 */
export function extractDriveFileId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!DRIVE_HOSTS.has(host)) return null;
  if (url.pathname.includes("/folders/")) return null;

  const byPath =
    url.pathname.match(/\/file\/d\/([^/?#]+)/) ?? url.pathname.match(/^\/d\/([^/?#]+)/);
  // No lh3 o tamanho vem grudado no id ("<id>=w1000") — corta no "=".
  const fromPath = byPath?.[1]?.split("=")[0];
  if (fromPath) return fromPath;

  const byQuery = url.searchParams.get("id")?.trim();
  return byQuery || null;
}

/** Endereço que serve a imagem em si, a partir do id do arquivo. */
function driveImageUrl(id: string): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}

/**
 * Endereços alternativos da MESMA foto do Drive, em ordem de tentativa.
 *
 * O Google serve arquivo do Drive por mais de um endpoint e nenhum deles
 * responde para 100% dos arquivos: depende de quando o arquivo foi criado, do
 * tipo e de como está compartilhado. Em vez de apostar num só e deixar o
 * cardápio com buraco, a foto tenta um por um e só desiste no fim.
 *
 * Para link que não é do Drive, a lista tem só o próprio endereço.
 */
export function buildImageCandidates(url: string | null | undefined): string[] {
  const clean = url?.trim();
  if (!clean) return [];
  const id = extractDriveFileId(clean);
  if (!id) return [clean];
  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://lh3.googleusercontent.com/d/${id}=w1000`,
    `https://lh3.googleusercontent.com/d/${id}`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

export function normalizeProductImageUrl(raw: string | null | undefined): NormalizedImageUrl {
  if (raw == null) return ok(null);

  // Copiar/colar traz lixo em volta com frequência: espaço, quebra de linha,
  // aspas do editor de texto, <> do e-mail.
  let value = raw.replace(/\s+/g, " ").trim().replace(/^[<"'`]+|[>"'`]+$/g, "").trim();
  if (!value) return ok(null);

  // Caminho local (fotos que vêm com o próprio app, em /public).
  if (value.startsWith("/") && !value.startsWith("//")) return ok(value);

  // Resultado do Google Imagens: a URL da imagem está no parâmetro imgurl.
  const imgres = value.match(/[?&](?:imgurl|url|mediaurl|imgrefurl)=([^&]+)/i);
  if (/^https?:\/\/(www\.)?(google\.[a-z.]+|bing\.com)\//i.test(value) && imgres) {
    const inner = decodeURIComponent(imgres[1]);
    // Só reaproveita se o que veio dentro for de fato outro endereço.
    if (/^https?:\/\//i.test(inner)) {
      const nested = normalizeProductImageUrl(inner);
      return nested.error
        ? nested
        : ok(nested.url, "Peguei o endereço da imagem de dentro do link do Google.");
    }
  }

  let notice: string | null = null;

  // Sem esquema ("www.site.com/foto.jpg") — o caso que antes travava o formulário.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
    notice = "Completei o endereço com https://.";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("Não consegui entender esse link. Cole o endereço completo da imagem (começando com https://).");
  }

  if (url.protocol === "http:") {
    // Navegador bloqueia imagem http dentro de página https; tenta o equivalente
    // seguro em vez de salvar algo que nunca vai aparecer.
    url.protocol = "https:";
    notice = "Troquei http:// por https:// — o navegador bloqueia foto sem https.";
  }

  if (url.protocol !== "https:") {
    return fail("Só dá pra usar link https:// (ou uma foto que já venha com o sistema).");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const blocked of PAGE_ONLY_HOSTS) {
    if (blocked.match(host, url)) return fail(blocked.message);
  }

  // Google Drive: link de compartilhamento → endereço que serve a imagem.
  if (DRIVE_HOSTS.has(host)) {
    const id = extractDriveFileId(url.toString());
    if (!id) {
      return fail("Não achei o arquivo nesse link do Drive. Na foto, use \"Compartilhar → Copiar link\".");
    }
    const direct = driveImageUrl(id);
    return ok(
      direct,
      url.toString() === direct
        ? null
        : "Converti o link do Drive. A foto precisa estar compartilhada como \"qualquer pessoa com o link\".",
    );
  }

  // Dropbox: a página de preview vira o arquivo em si.
  if (host === "dropbox.com") {
    url.hostname = "dl.dropboxusercontent.com";
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
    return ok(url.toString(), "Converti o link do Dropbox para o arquivo direto.");
  }

  // GitHub: página do arquivo → conteúdo cru.
  if (host === "github.com" && url.pathname.includes("/blob/")) {
    return ok(
      `https://raw.githubusercontent.com${url.pathname.replace("/blob/", "/")}`,
      "Converti o link do GitHub para o arquivo direto.",
    );
  }

  // Página do Imgur (imgur.com/AbC123) → arquivo (i.imgur.com/AbC123.jpeg).
  if (host === "imgur.com") {
    const id = url.pathname.match(/^\/(?:gallery\/)?([A-Za-z0-9]{5,})$/);
    if (id) {
      return ok(`https://i.imgur.com/${id[1]}.jpeg`, "Converti o link do Imgur para o arquivo direto.");
    }
  }

  return ok(url.toString(), notice);
}

/**
 * Extensões que o navegador desenha. Usado só pra *avisar* — muita CDN serve
 * imagem sem extensão nenhuma, então isso nunca bloqueia o salvamento.
 */
export function looksLikeImagePath(url: string): boolean {
  try {
    const path = url.startsWith("/") ? url : new URL(url).pathname;
    return /\.(jpe?g|png|webp|gif|avif|svg|bmp)$/i.test(path);
  } catch {
    return false;
  }
}
