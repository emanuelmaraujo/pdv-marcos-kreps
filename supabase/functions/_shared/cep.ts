// Shared helper: consulta de CEP via ViaCEP — usada tanto pelo endpoint
// público de autofill (lookup-cep) quanto pela revalidação autoritativa do
// servidor na criação de pedidos (create-public-order, create-attendant-order).
//
// Regra: o bairro retornado aqui é a fonte de verdade para o match de zona de
// entrega (resolveDeliveryFee) — nunca o texto que o cliente digitou. Se o CEP
// não existir ou a consulta falhar/der timeout, o chamador deve bloquear o
// pedido (sem fallback manual — decisão confirmada com o usuário).

import { normalizeNeighborhood } from "./delivery.ts";

const VIACEP_TIMEOUT_MS = 5000;
const CEP_FORMAT = /^\d{8}$/;

export type CepAddress = {
  street: string;
  neighborhood: string;
  neighborhoodNormalized: string;
  city: string;
  state: string;
};

export function isValidCepFormat(cep: string): boolean {
  return CEP_FORMAT.test(cep);
}

/** Retorna null se o CEP for inválido, inexistente, ou a consulta falhar/der timeout. */
export async function fetchCepAddress(cepRaw: string): Promise<CepAddress | null> {
  const cep = cepRaw.replace(/\D/g, "");
  if (!isValidCepFormat(cep)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    if (!data || data.erro) return null;

    const street = typeof data.logradouro === "string" ? data.logradouro.trim() : "";
    const neighborhood = typeof data.bairro === "string" ? data.bairro.trim() : "";
    const city = typeof data.localidade === "string" ? data.localidade.trim() : "";
    const state = typeof data.uf === "string" ? data.uf.trim() : "";

    if (!neighborhood || !city) return null;

    return {
      street,
      neighborhood,
      neighborhoodNormalized: normalizeNeighborhood(neighborhood),
      city,
      state,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
