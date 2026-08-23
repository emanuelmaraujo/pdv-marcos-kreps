// Lembra a última filial pública (/pedir/[slug]) visitada neste dispositivo.
// Usado só como fallback pra "Fazer novo pedido" saber pra onde voltar
// quando não há um jeito mais preciso (ex: query param ?branch=) de saber
// qual filial o pedido pertence — nunca é a fonte de verdade do pedido em si.
const LAST_BRANCH_SLUG_KEY = "pdv-last-branch-slug";

export function rememberLastBranchSlug(slug: string) {
  try {
    localStorage.setItem(LAST_BRANCH_SLUG_KEY, slug);
  } catch {
    // localStorage indisponível (modo privado etc.) — não é crítico, ignora.
  }
}

export function getLastBranchSlug(): string | null {
  try {
    return localStorage.getItem(LAST_BRANCH_SLUG_KEY);
  } catch {
    return null;
  }
}
