import { DELIVERY_PAYMENT_LABELS, isDeliveryPaymentMethod, type DeliveryPaymentMethod } from "./delivery-payment";

/** Política vista pelo painel; o servidor revalida tudo em set_branch_cod_policy. */
export type CodPolicy = {
  enabled: boolean;
  methods: DeliveryPaymentMethod[];
  max_amount: number | null;
  max_pending: number;
  confirmation_minutes: number;
  operational_approved_at: string | null;
  updated_at: string | null;
  pending_confirmation: number;
};

export type CodPolicyForm = {
  enabled: boolean;
  methods: DeliveryPaymentMethod[];
  maxAmount: string;
  maxPending: string;
  confirmationMinutes: string;
};

export const COD_METHOD_OPTIONS = Object.keys(DELIVERY_PAYMENT_LABELS) as DeliveryPaymentMethod[];

export function parseCodPolicy(raw: unknown): CodPolicy {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const methods = Array.isArray(data.methods) ? data.methods.filter(isDeliveryPaymentMethod) : [];
  const num = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback);
  return {
    enabled: data.enabled === true,
    methods,
    max_amount: data.max_amount == null ? null : num(data.max_amount, 0),
    max_pending: num(data.max_pending, 20),
    confirmation_minutes: num(data.confirmation_minutes, 30),
    operational_approved_at: typeof data.operational_approved_at === "string" ? data.operational_approved_at : null,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
    pending_confirmation: num(data.pending_confirmation, 0),
  };
}

export function codPolicyToForm(policy: CodPolicy): CodPolicyForm {
  return {
    enabled: policy.enabled,
    methods: policy.methods,
    maxAmount: policy.max_amount == null ? "" : policy.max_amount.toFixed(2).replace(".", ","),
    maxPending: String(policy.max_pending),
    confirmationMinutes: String(policy.confirmation_minutes),
  };
}

// "1.250,50" e "150.50" são aceitos; com vírgula, pontos são separadores de milhar.
const decimal = (value: string) => { const v = value.trim(); return Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v); };

/** Mesmas regras do servidor, para o operador corrigir antes de enviar. */
export function validateCodPolicyForm(form: CodPolicyForm, deliveryEnabled: boolean) {
  const maxAmount = form.maxAmount.trim() ? decimal(form.maxAmount) : null;
  const maxPending = Number(form.maxPending);
  const confirmationMinutes = Number(form.confirmationMinutes);
  let error: string | null = null;
  if (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount <= 0 || maxAmount > 100000)) error = "Informe um valor máximo entre R$ 0,01 e R$ 100.000,00.";
  else if (!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 200) error = "O limite de pedidos aguardando deve ficar entre 1 e 200.";
  else if (!Number.isInteger(confirmationMinutes) || confirmationMinutes < 5 || confirmationMinutes > 120) error = "O prazo de confirmação deve ficar entre 5 e 120 minutos.";
  else if (form.enabled && !deliveryEnabled) error = "Ligue e salve a entrega desta filial antes de ativar o pagamento na entrega.";
  else if (form.enabled && form.methods.length === 0) error = "Escolha ao menos uma forma de pagamento aceita na entrega.";
  else if (form.enabled && maxAmount === null) error = "Informe o valor máximo por pedido para ativar.";
  return {
    error,
    payload: { enabled: form.enabled, methods: [...form.methods].sort(), maxAmount, maxPending, confirmationMinutes },
  };
}
