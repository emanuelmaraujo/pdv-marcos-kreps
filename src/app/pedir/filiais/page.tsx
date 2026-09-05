// Rota pública da lista de filiais: /pedir/filiais
//
// Era a landing de /pedir (sem slug). Como /pedir agora abre direto no
// cardápio da filial principal (Núcleo Bandeirante), o "hub" — picker de
// filiais + acompanhar pedido — ganhou rota própria com nome explícito.
//
// Segmento estático tem precedência sobre /pedir/[slug] no Next.js, então
// "filiais" nunca é interpretado como slug de filial.
import type { Metadata } from "next";
import { PedirLanding } from "../PedirLanding";

export const metadata: Metadata = {
  title: "Filiais · Marcos Krep's",
  description: "Escolha a unidade do Marcos Krep's onde quer pedir ou acompanhe um pedido em andamento.",
};

export default function PedirFiliaisPage() {
  return <PedirLanding />;
}
