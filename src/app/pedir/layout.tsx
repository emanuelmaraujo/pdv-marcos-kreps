import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
//
// `data-context="public"` ativa os tokens da identidade pública (bege + marrom
// + Plus Jakarta Sans) definidos em globals.css. Todos os componentes
// compartilhados (Button, Card, Badge) se adaptam automaticamente via
// CSS custom properties.
export default function PedirLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <div data-context="public" className={`${jakarta.variable} min-h-screen`}>
        {children}
      </div>
    </Suspense>
  );
}
