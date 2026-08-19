import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "PDV Marcos Krep's",
  title: "PDV Marcos Krep's",
  description:
    "Sistema de ponto de venda para o Marcos Krep's — pedidos, caixa e gestão operacional.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PDV Krep's",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2F2F31",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* Aplica o tema antes do React montar para evitar flash do tema errado.
            next/script com beforeInteractive injeta no <head> automaticamente
            (independente de onde é declarado) sem conflitar com a hidratação,
            diferente de um <script> bruto colocado manualmente no <head>. */}
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
