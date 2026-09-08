import { createClient } from "@/lib/supabase/client";

export type CardPaymentMethod = "DEBIT_CARD" | "CREDIT_CARD";
export type PaymentRuleOrderType = "ANY" | "BALCAO" | "VIAGEM" | "ENTREGA";
export type PaymentRuleOrderSource = "ANY" | "ATTENDANT" | "QR_CODE" | "WHATSAPP" | "APP";

export type PaymentFeeRule = {
  id: string;
  branch_id: string;
  provider_code: string;
  channel: "IN_PERSON" | "ONLINE";
  payment_method: CardPaymentMethod;
  card_brand: string;
  order_type: PaymentRuleOrderType;
  order_source: PaymentRuleOrderSource;
  installments_from: number;
  installments_to: number;
  fee_percent: number;
  fee_fixed: number;
  anticipation_percent: number;
  settlement_days: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  change_reason: string;
  version: number;
  updated_at: string;
};

export type CreatePaymentFeeRule = Omit<PaymentFeeRule, "id" | "version" | "updated_at">;

const columns = "id, branch_id, provider_code, channel, payment_method, card_brand, order_type, order_source, installments_from, installments_to, fee_percent, fee_fixed, anticipation_percent, settlement_days, effective_from, effective_to, active, change_reason, version, updated_at";

export const paymentFeesApi = {
  async list(branchId: string): Promise<PaymentFeeRule[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("branch_payment_fee_rules")
      .select(columns)
      .eq("branch_id", branchId)
      .order("payment_method")
      .order("installments_from");
    if (error) throw error;
    return (data ?? []) as PaymentFeeRule[];
  },

  async create(input: CreatePaymentFeeRule): Promise<PaymentFeeRule> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const { data, error } = await supabase
      .from("branch_payment_fee_rules")
      .insert({ ...input, created_by: user.id, updated_by: user.id })
      .select(columns)
      .single();
    if (error) throw error;
    return data as PaymentFeeRule;
  },

  async setActive(rule: PaymentFeeRule, active: boolean): Promise<PaymentFeeRule> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const { data, error } = await supabase
      .from("branch_payment_fee_rules")
      .update({ active, updated_by: user.id, change_reason: active ? "Regra reativada" : "Regra desativada" })
      .eq("id", rule.id)
      .eq("version", rule.version)
      .select(columns)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Esta regra foi alterada por outra pessoa. Atualize a tela.");
    return data as PaymentFeeRule;
  },

  async update(rule: PaymentFeeRule, input: CreatePaymentFeeRule): Promise<PaymentFeeRule> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const { data, error } = await supabase
      .from("branch_payment_fee_rules")
      .update({ ...input, updated_by: user.id })
      .eq("id", rule.id)
      .eq("version", rule.version)
      .select(columns)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Esta regra foi alterada por outra pessoa. Atualize a tela.");
    return data as PaymentFeeRule;
  },

  async remove(rule: PaymentFeeRule): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("branch_payment_fee_rules")
      .delete()
      .eq("id", rule.id)
      .eq("version", rule.version)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Esta regra foi alterada por outra pessoa. Atualize a tela.");
  },
};
