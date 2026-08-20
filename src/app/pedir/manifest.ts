import type { MetadataRoute } from "next";

// Manifest próprio do /pedir — o manifest raiz (src/app/manifest.ts) aponta
// start_url para /app (o PDV interno do atendente). Sem este arquivo, um
// cliente que instala o /pedir na tela inicial abriria o app errado (o painel
// interno, que exige login) em vez de voltar pro cardápio público.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pedir · Marcos Krep's",
    short_name: "Marcos Krep's",
    description: "Peça online no Marcos Krep's — crepes na hora, pagamento seguro via Pix ou cartão.",
    start_url: "/pedir",
    // scope "/" (não só "/pedir") porque o fluxo do cliente sai desse prefixo
    // ao acompanhar o pedido em /pedido/[token] — restringir o scope faria
    // essa navegação "vazar" pra fora do app instalado em alguns navegadores.
    scope: "/",
    display: "standalone",
    background_color: "#FAF5EE",
    theme_color: "#E73335",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
