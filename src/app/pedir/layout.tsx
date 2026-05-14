import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedir · Marcos Krep's",
  description: "Faça seu pedido online no Marcos Krep's — crepes na hora, pagamento seguro.",
  openGraph: {
    title: "Pedir · Marcos Krep's",
    description: "Faça seu pedido online no Marcos Krep's — crepes na hora, pagamento seguro.",
    images: ["/logo.png"],
  },
};

export default function PedirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
