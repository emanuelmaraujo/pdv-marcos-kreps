/**
 * Filial padrão do fluxo público (/pedir).
 *
 * O QR Code divulgado aponta pra `/pedir` "seco" — sem slug. Antes isso
 * caía na landing (picker de filiais), e o cliente precisava dar mais um
 * toque pra chegar no cardápio. Como o Núcleo Bandeirante é a unidade
 * principal, `/pedir` abre direto no cardápio dela.
 *
 * A lista de filiais continua acessível em `/pedir/filiais`, e cada
 * unidade segue com sua URL própria em `/pedir/[slug]`.
 */
export const DEFAULT_BRANCH_SLUG = "nb";

/** Rota da lista pública de filiais (antiga landing de `/pedir`). */
export const BRANCHES_PAGE_PATH = "/pedir/filiais";
