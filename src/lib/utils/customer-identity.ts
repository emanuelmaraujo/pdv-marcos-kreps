/**
 * Regras puras da identificação do cliente (nome + WhatsApp) usadas tanto pelo
 * checkout do atendente (`OrderSummarySheet`) quanto pelo checkout público
 * (`/pedir`).
 *
 * Dois problemas que estas regras resolvem:
 *
 * 1. **Nome digitado à mão é do atendente, não da consulta.** Antes, qualquer
 *    mudança no telefone (apagar, corrigir um dígito) apagava o nome, mesmo
 *    quando ele tinha sido escrito na mão. Agora só o nome que veio de uma
 *    consulta (`LOOKUP`) é descartado; o que foi digitado (`MANUAL`) fica.
 * 2. **Telefone incompleto virava erro do servidor no fim do fluxo.** O
 *    atendente só descobria o problema depois de escolher pagamento, com uma
 *    mensagem genérica. Agora o estado do número é classificado na hora e o
 *    número só é enviado quando normalizável — nunca "(11) 9999" cru.
 */

import { normalizeBrazilPhone } from "./phone";

/** De onde veio o nome que está no campo. */
export type CustomerNameSource = "NONE" | "MANUAL" | "LOOKUP";

export type CustomerPhoneStatus = "EMPTY" | "INCOMPLETE" | "INVALID" | "VALID";

export interface CustomerPhoneState {
  status: CustomerPhoneStatus;
  /** `+55DDDNUMERO` quando o número é válido; `null` caso contrário. */
  e164: string | null;
  /** Dígitos nacionais (sem código do país), úteis pra medir o preenchimento. */
  digits: string;
  /** Aviso curto pro campo. `null` quando não há o que avisar. */
  message: string | null;
}

const INCOMPLETE_MESSAGE = "Número incompleto — informe DDD + número (10 ou 11 dígitos).";
const INVALID_MESSAGE = "Número inválido — confira o DDD e o 9 do celular.";
const REQUIRED_MESSAGE = "Informe um WhatsApp válido com DDD.";

/**
 * Dígitos nacionais do que foi digitado. Espelha o pré-processamento de
 * `normalizeBrazilPhone` (00 internacional, +55 e zeros à esquerda) pra que a
 * contagem de dígitos concorde com a validação.
 */
function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits.replace(/^0+/, "");
}

/** Classifica o que está no campo de WhatsApp sem precisar submeter o pedido. */
export function describeCustomerPhone(raw: string): CustomerPhoneState {
  const digits = nationalDigits(raw ?? "");
  const e164 = normalizeBrazilPhone(raw ?? "");

  if (e164) return { status: "VALID", e164, digits, message: null };
  if (digits.length === 0) return { status: "EMPTY", e164: null, digits, message: null };
  if (digits.length < 10) return { status: "INCOMPLETE", e164: null, digits, message: INCOMPLETE_MESSAGE };
  return { status: "INVALID", e164: null, digits, message: INVALID_MESSAGE };
}

/**
 * Mensagem de bloqueio do fluxo, ou `null` quando dá pra seguir.
 *
 * O nome nunca bloqueia: pedido de balcão sem nome e sem telefone é legítimo
 * (fila do caixa). O telefone só bloqueia quando foi digitado pela metade — ou
 * quando a modalidade exige contato (entrega).
 */
export function validateCustomerIdentity(
  rawPhone: string,
  options: { requirePhone?: boolean; requiredMessage?: string } = {},
): string | null {
  const state = describeCustomerPhone(rawPhone);
  if (state.status === "VALID") return null;
  if (state.status === "EMPTY") {
    return options.requirePhone ? (options.requiredMessage ?? REQUIRED_MESSAGE) : null;
  }
  return state.message;
}

/** Telefone pronto pro payload: E.164 ou `undefined`. Nunca texto cru. */
export function toSubmittablePhone(rawPhone: string): string | undefined {
  return describeCustomerPhone(rawPhone).e164 ?? undefined;
}

export interface ResolvedCustomerName {
  name: string;
  source: CustomerNameSource;
  /**
   * Nome do perfil que existe no banco mas *não* foi aplicado porque o campo
   * tem um nome digitado à mão. A interface oferece como sugestão em vez de
   * sobrescrever silenciosamente.
   */
  suggestion: string | null;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Origem do nome depois de o campo ser editado à mão. */
export function resolveNameFromInput(value: string): ResolvedCustomerName {
  return {
    name: value,
    source: value.trim() ? "MANUAL" : "NONE",
    suggestion: null,
  };
}

/**
 * O que fazer com o nome quando a consulta por telefone volta.
 *
 * Preenche o campo vazio e substitui um nome que a própria consulta havia
 * preenchido. Um nome digitado à mão é preservado — o do banco vira sugestão.
 */
export function resolveNameFromLookup(input: {
  currentName: string;
  nameSource: CustomerNameSource;
  profileName?: string | null;
}): ResolvedCustomerName {
  const profileName = (input.profileName ?? "").trim();
  const currentName = input.currentName ?? "";
  const keep: ResolvedCustomerName = {
    name: currentName,
    source: currentName.trim() ? input.nameSource : "NONE",
    suggestion: null,
  };

  if (!profileName) return keep;
  if (!currentName.trim() || input.nameSource !== "MANUAL") {
    return { name: profileName, source: "LOOKUP", suggestion: null };
  }
  if (sameName(currentName, profileName)) {
    return { name: profileName, source: "LOOKUP", suggestion: null };
  }
  return { ...keep, suggestion: profileName };
}

/**
 * O que fazer com o nome quando o telefone é apagado ou trocado. Só some o que
 * veio da consulta anterior; o que o atendente digitou continua no campo.
 */
export function resolveNameAfterPhoneChange(input: {
  currentName: string;
  nameSource: CustomerNameSource;
}): ResolvedCustomerName {
  if (input.nameSource === "LOOKUP") return { name: "", source: "NONE", suggestion: null };
  return {
    name: input.currentName,
    source: input.currentName.trim() ? input.nameSource : "NONE",
    suggestion: null,
  };
}
