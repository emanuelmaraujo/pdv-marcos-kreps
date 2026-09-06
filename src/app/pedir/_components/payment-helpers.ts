// Constantes e helpers compartilhados pelo checkout de pagamento do /pedir
// (MercadoPagoBrick, PixCheckout, PixResult).

export const PAYMENT_METHOD_CODE = "MERCADO_PAGO_PAYMENT_BRICK";
export const PIX_PAYMENT_METHOD_CODE = "PIX";
export const PIX_WAIT_MINUTES = 5;

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: Record<string, unknown>) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

export function loadMercadoPagoScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Erro ao carregar Mercado Pago.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Erro ao carregar Mercado Pago."));
    document.body.appendChild(script);
  });
}

/** Resultado da leitura do status de um pagamento do Mercado Pago. */
export type MercadoPagoStatusKind = "approved" | "pending" | "rejected";

export type MercadoPagoStatusResult = {
  kind: MercadoPagoStatusKind;
  /** Mensagem pronta pro cliente. Nunca contém código cru do provedor. */
  message: string;
};

const REJECTION_MESSAGES: Record<string, string> = {
  // Erro de digitação — dá pra corrigir e tentar de novo no mesmo cartão.
  cc_rejected_bad_filled_card_number: "Confira o número do cartão e tente de novo.",
  cc_rejected_bad_filled_date: "Confira a data de validade do cartão e tente de novo.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV) e tente de novo.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão e tente de novo.",
  // Recusa do banco emissor — em geral exige outro cartão ou contato com o banco.
  cc_rejected_call_for_authorize: "Seu banco pediu autorização para esta compra. Ligue para o banco e tente de novo.",
  cc_rejected_card_disabled: "Este cartão está desativado. Use outro cartão ou pague com Pix.",
  cc_rejected_duplicated_payment: "Já existe um pagamento igual a este. Confira antes de tentar de novo.",
  cc_rejected_insufficient_amount: "Saldo ou limite insuficiente. Use outro cartão ou pague com Pix.",
  cc_rejected_invalid_installments: "Este cartão não aceita esse parcelamento. Escolha outro número de parcelas.",
  cc_rejected_max_attempts: "Muitas tentativas seguidas. Aguarde alguns minutos ou pague com Pix.",
  // Prevenção a fraude — não detalhar o motivo pro cliente.
  cc_rejected_blacklist: "Não foi possível concluir o pagamento com este cartão. Use outro cartão ou pague com Pix.",
  cc_rejected_high_risk: "Não foi possível concluir o pagamento com este cartão. Use outro cartão ou pague com Pix.",
  cc_rejected_other_reason: "Seu banco recusou o pagamento. Use outro cartão ou pague com Pix.",
};

const GENERIC_REJECTION = "Não foi possível concluir o pagamento. Use outro cartão ou pague com Pix.";

/**
 * Traduz o par (status, status_detail) do Mercado Pago numa decisão de UI.
 *
 * Existe porque um cartão recusado pelo motor de risco volta como HTTP 200 com
 * `status: "rejected"` — ou seja, `success: true` na nossa Edge Function. Sem
 * essa leitura, a recusa mais comum passava batida e o cliente ficava olhando a
 * tela de pagamento sem nenhuma mensagem.
 *
 * Códigos conforme a documentação oficial ("Por que um pagamento é recusado?").
 * Qualquer status_detail fora da lista cai na mensagem genérica: nunca expor o
 * código cru do provedor pro cliente.
 */
export function mapMercadoPagoStatus(
  status: string | null | undefined,
  statusDetail?: string | null,
): MercadoPagoStatusResult {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "approved" || normalized === "authorized") {
    return { kind: "approved", message: "Pagamento aprovado." };
  }

  // `in_process`/`pending` são análise em andamento: o pedido segue válido e o
  // polling da tela de pagamento leva pra confirmação quando o MP aprovar.
  if (normalized === "pending" || normalized === "in_process" || normalized === "in_mediation") {
    return {
      kind: "pending",
      message: "Pagamento em análise pelo Mercado Pago. Deixe esta tela aberta — avisamos assim que for aprovado.",
    };
  }

  const detail = String(statusDetail ?? "").toLowerCase();
  return { kind: "rejected", message: REJECTION_MESSAGES[detail] ?? GENERIC_REJECTION };
}

export function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function formatCpfInput(value: string) {
  const digits = cpfDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
