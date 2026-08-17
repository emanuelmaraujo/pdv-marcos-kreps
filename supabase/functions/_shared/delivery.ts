/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared helper: cálculo autoritativo da taxa de entrega (Fase 2).
//
// Regra (confirmada com o usuário para a Fase 2):
//   * Filial com ao menos uma zona ativa cadastrada: o bairro do pedido PRECISA
//     bater com uma zona ativa (normalizado); fora da lista, o pedido é bloqueado.
//   * Filial sem nenhuma zona cadastrada ainda: usa branches.default_delivery_fee
//     como taxa fixa única (mesmo comportamento da Fase 1), permitindo adoção
//     gradual de zonas por filial sem quebrar o fluxo existente.
//   * Nunca confia em taxa vinda do cliente — chamar sempre a partir do servidor
//     (create-attendant-order, create-public-order), nunca no client.

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeNeighborhood(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export type DeliveryFeeResult =
  | { blocked: false; fee: number }
  | { blocked: true; reason: string };

export async function resolveDeliveryFee(
  supabaseAdmin: any,
  branchId: string,
  neighborhood: string,
): Promise<DeliveryFeeResult> {
  const normalized = normalizeNeighborhood(neighborhood);
  if (!normalized) {
    return { blocked: true, reason: "Bairro é obrigatório para calcular a taxa de entrega." };
  }

  const { data: zones, error: zonesErr } = await supabaseAdmin
    .from("delivery_zones")
    .select("neighborhood_normalized, fee")
    .eq("branch_id", branchId)
    .eq("active", true);

  if (zonesErr) {
    throw new Error("Erro ao consultar zonas de entrega.");
  }

  if (!zones || zones.length === 0) {
    const { data: branch, error: branchErr } = await supabaseAdmin
      .from("branches")
      .select("default_delivery_fee")
      .eq("id", branchId)
      .single();
    if (branchErr || !branch) {
      throw new Error("Erro ao consultar taxa de entrega padrão da filial.");
    }
    return { blocked: false, fee: Number(branch.default_delivery_fee ?? 0) };
  }

  const match = zones.find((zone: any) => zone.neighborhood_normalized === normalized);
  if (!match) {
    return { blocked: true, reason: "Não realizamos entregas nesse bairro no momento." };
  }

  return { blocked: false, fee: Number(match.fee ?? 0) };
}
