import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Pedir · Marcos Krep's",
  description: "Faça seu pedido online no Marcos Krep's — crepes na hora, pagamento seguro.",
  openGraph: {
    title: "Pedir · Marcos Krep's",
    description: "Faça seu pedido online no Marcos Krep's — crepes na hora, pagamento seguro.",
    images: ["/logo.png"],
  },
};

// Suspense necessário porque /pedir/page usa useSearchParams()
// (Next.js 16 exige boundary quando há leitura de search params em páginas)
export default function PedirLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
