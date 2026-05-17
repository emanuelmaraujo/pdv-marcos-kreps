import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meu pedido · Marcos Krep's",
  description: "Acompanhe o status do seu pedido em tempo real.",
};

// `data-context="public"` ativa os tokens da identidade pública (bege + marrom)
// definidos em globals.css. As páginas internas de tracking compartilham
// o mesmo design system que /pedir.
export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-context="public" className={`${jakarta.variable} min-h-screen`}>
      {children}
    </div>
  );
}
