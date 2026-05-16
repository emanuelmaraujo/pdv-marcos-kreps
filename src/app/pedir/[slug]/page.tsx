// Rota pública por filial: /pedir/[slug]
// Redireciona para /pedir?branch=[slug] mantendo a lógica de checkout centralizada.
import { redirect } from "next/navigation";

export default function PedirFilialPage({ params }: { params: { slug: string } }) {
  redirect(`/pedir?branch=${encodeURIComponent(params.slug)}`);
}
