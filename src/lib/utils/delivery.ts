// Normalização de bairro para matching de zonas de entrega. Espelha
// supabase/functions/_shared/delivery.ts — mesma regra dos dois lados
// (frontend cadastra/mostra, backend recalcula com autoridade).
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeNeighborhood(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export type PublicOrderType = 'BALCAO' | 'VIAGEM' | 'ENTREGA';

/** Modalidade padrão quando a escolhida não existe na filial atual. */
export const FALLBACK_ORDER_TYPE: PublicOrderType = 'VIAGEM';

/**
 * A filial atual oferece esta modalidade?
 *
 * `branchConfigLoaded` é o detalhe que faz a regra funcionar: `deliveryEnabled`
 * nasce `false` e só reflete a filial depois que a config responde. Enquanto
 * isso, nada é bloqueado — bloquear cedo derrubaria a escolha legítima de quem
 * já tinha selecionado Entrega, que é pior que o problema original.
 */
export function isOrderTypeAvailableForBranch(
  orderType: PublicOrderType,
  branch: { branchConfigLoaded: boolean; deliveryEnabled: boolean },
): boolean {
  if (orderType !== 'ENTREGA') return true;
  if (!branch.branchConfigLoaded) return true;
  return branch.deliveryEnabled;
}

/**
 * Modalidade que deve valer agora, dada a escolhida e a filial.
 *
 * O carrinho guarda `orderType` no localStorage, então quem escolheu Entrega
 * numa filial que entrega chegava com ENTREGA numa que não entrega: o botão
 * sumia da UI mas o formulário de endereço continuava aparecendo e o servidor
 * recusava o pedido no fim. Devolve a mesma modalidade quando não há nada a
 * corrigir, pra chamada ser idempotente.
 */
export function resolveAvailableOrderType(
  orderType: PublicOrderType,
  branch: { branchConfigLoaded: boolean; deliveryEnabled: boolean },
): PublicOrderType {
  return isOrderTypeAvailableForBranch(orderType, branch) ? orderType : FALLBACK_ORDER_TYPE;
}
