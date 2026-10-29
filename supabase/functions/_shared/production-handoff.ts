import { resolveProductionSector } from './print-format.ts';

/** Snapshot de revisão lido na mesma consulta dos campos usados na comanda.
 * Sem ID/revisão (cliente/função legado), não há evidência de cobertura.
 * Não muda texto ESC/POS, quantidade de cópias ou condições para imprimir.
 */
export function productionHandoffMetadata(
  items: Array<{ id?: string; handoff_revision?: number; status?: string; [key: string]: unknown }> | null,
  sector: 'KITCHEN' | 'JUICE_POTATO',
) {
  return {
    handoff_items: (items ?? [])
      .filter((item) => item.status !== 'CANCELLED' && resolveProductionSector(item) === sector)
      .filter((item) => item.id && Number.isSafeInteger(item.handoff_revision) && Number(item.handoff_revision) > 0)
      .map((item) => ({ id: item.id, revision: item.handoff_revision })),
  };
}
