/**
 * Contagens pendentes exibidas como badge na tab bar mobile.
 *
 * Hoje retorna stub (0). Quando houver um polling/contexto global de
 * pendências, basta trocar a implementação aqui — a UI já está pronta.
 */
export type NavBadges = Record<string, number>;

export function useNavBadges(): NavBadges {
  return {
    "/app/pedidos": 0,
    "/app/impressao": 0,
  };
}
