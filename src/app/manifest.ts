import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PDV Marcos Krep's",
    short_name: "PDV Krep's",
    description:
      "Sistema de ponto de venda para o Marcos Krep's - pedidos, caixa e gestao operacional.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#2F2F31",
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
