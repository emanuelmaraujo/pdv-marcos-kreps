// Rota pública por filial: /pedir/[slug]
// Redireciona para /pedir?branch=[slug] mantendo a lógica de checkout centralizada.
import { redirect } from "next/navigation";

export default function PedirFilialPage({ params }: { params: { slug?: string } }) {
  const slug = params.slug;
  // Guarda contra slug ausente ou inválido (evita ?branch=undefined na URL)
  if (!slug || slug === "undefined") {
    redirect("/pedir");
  }
  redirect(`/pedir?branch=${encodeURIComponent(slug)}`);
}
