// Rota pública por filial: /pedir/[slug]
//
// Em vez de redirecionar para /pedir?branch=[slug] (que apaga o slug
// da URL e quebra deep links), renderizamos a MESMA página principal.
// A page principal lê o slug via useParams() com fallback para
// useSearchParams() — então funciona em ambos os caminhos:
//   /pedir/principal       → useParams() retorna {slug: "principal"}
//   /pedir?branch=principal → useSearchParams() retorna "principal"
import PedirPublicPage from "../page";

export default function PedirFilialPage() {
  return <PedirPublicPage />;
}
