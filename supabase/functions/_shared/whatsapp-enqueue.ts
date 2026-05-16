/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared helper: enqueue WhatsApp transactional notifications (UTILITY templates).
//
// Design:
//   * Non-blocking: never throws. Caller code must not depend on its return.
//   * Idempotent: the partial UNIQUE index uniq_whatsapp_messages_order_event_live
//     on (order_id, event_type) WHERE status IN ('PENDING','SENT','SKIPPED')
//     guarantees at most one live row per event per order. Unique violations are
//     swallowed as "already enqueued".
//   * Multi-branch: when `branchId` is provided, the branch's own configuration
//     overrides the global one:
//        - branches.whatsapp_enabled (toggle por filial)
//        - branches.whatsapp_templates[event_type] = { template_name, language, enabled? }
//     Global settings.whatsapp_enabled e settings.whatsapp_template_* permanecem
//     como fallback quando a filial nao tem override ou quando branchId nao foi passado.
//   * Opt-in aware: snapshots customer.whatsapp_opt_in into the row for audit (LGPD).

export type WhatsAppEventType =
  | "order_received"
  | "order_ready"
  | "order_partial_ready";

interface EnqueuePayload {
  orderId: string;
  branchId?: string | null;
  eventType: WhatsAppEventType;
  phone: string | null | undefined;
  customerName: string | null | undefined;
  dailyNumber: number | string | null | undefined;
  branchCode?: string | null;       // ex.: "P", "F" — entra no payload pra renderizar P-42
  branchName?: string | null;       // ex.: "Loja Principal" — pode entrar no template
}

const SETTING_ENABLED = "whatsapp_enabled";
const SETTING_TEMPLATE: Record<WhatsAppEventType, string> = {
  order_received:      "whatsapp_template_received",
  order_ready:         "whatsapp_template_ready",
  order_partial_ready: "whatsapp_template_partial_ready",
};
const DEFAULT_TEMPLATE: Record<WhatsAppEventType, string> = {
  order_received:      "novo_pedido",
  order_ready:         "pedido_pronto",
  order_partial_ready: "pedido_parcial_pronto",
};

function parseBoolSetting(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.replace(/^"|"$/g, "").toLowerCase() === "true";
  }
  return fallback;
}

function parseStringSetting(value: unknown, fallback: string): string {
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(sem telefone)";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `+${digits.slice(0, 2)}***${digits.slice(-4)}`;
}

function normalizeBrazilPhoneE164(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return `+55${digits}`;
}

function firstName(name: string | null | undefined): string {
  if (!name) return "Cliente";
  const trimmed = name.trim().split(/\s+/)[0] ?? "Cliente";
  return trimmed.slice(0, 30);
}

/**
 * Resolve template + enabled state combinando branches.whatsapp_templates com
 * as settings globais. Retorna `null` se o evento estiver desabilitado.
 */
async function resolveTemplate(
  supabaseAdmin: any,
  branchId: string | null | undefined,
  eventType: WhatsAppEventType,
): Promise<{ enabled: boolean; templateName: string }> {
  // 1) Settings globais — fallback
  const settingKey = SETTING_TEMPLATE[eventType];
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .in("key", [SETTING_ENABLED, settingKey]);

  const globalEnabled = parseBoolSetting(
    settings?.find((s: any) => s.key === SETTING_ENABLED)?.value,
    false,
  );
  let templateName = parseStringSetting(
    settings?.find((s: any) => s.key === settingKey)?.value,
    DEFAULT_TEMPLATE[eventType],
  );
  let enabled = globalEnabled;

  // 2) Override por filial
  if (branchId) {
    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("whatsapp_enabled, whatsapp_templates")
      .eq("id", branchId)
      .maybeSingle();

    if (branch) {
      enabled = enabled && branch.whatsapp_enabled !== false;

      const override = branch.whatsapp_templates?.[eventType];
      if (override && typeof override === "object") {
        if (override.enabled === false) enabled = false;
        if (typeof override.template_name === "string" && override.template_name.trim()) {
          templateName = override.template_name.trim();
        }
      }
    }
  }

  return { enabled, templateName };
}

export async function enqueueWhatsAppMessage(
  supabaseAdmin: any,
  payload: EnqueuePayload,
): Promise<{ enqueued: boolean; reason?: string }> {
  const tag = `[whatsapp-enqueue ${payload.eventType} order=${payload.orderId}]`;
  try {
    if (!payload.orderId) return { enqueued: false, reason: "missing_order_id" };

    const phoneRaw = (payload.phone ?? "").toString().trim();
    const phone = phoneRaw ? normalizeBrazilPhoneE164(phoneRaw) : null;
    if (!phone) {
      console.log(`${tag} SKIP: telefone ausente ou invalido (${maskPhone(phoneRaw)})`);
      return { enqueued: false, reason: "invalid_phone" };
    }

    // Resolução de template/enabled com override por filial.
    const { enabled, templateName } = await resolveTemplate(
      supabaseAdmin,
      payload.branchId ?? null,
      payload.eventType,
    );
    if (!enabled) {
      console.log(`${tag} SKIP: whatsapp desabilitado (global ou na filial)`);
      return { enqueued: false, reason: "feature_disabled" };
    }

    // Opt-in snapshot.
    let optIn = true;
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("whatsapp_opt_in")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (customer && customer.whatsapp_opt_in === false) optIn = false;

    const messagePayload = {
      customer_name: firstName(payload.customerName),
      daily_number:  payload.dailyNumber ?? null,
      branch_code:   payload.branchCode ?? null,
      branch_name:   payload.branchName ?? null,
    };

    if (!optIn) {
      const { error: skipErr } = await supabaseAdmin
        .from("whatsapp_messages")
        .insert({
          order_id:        payload.orderId,
          branch_id:       payload.branchId ?? null,
          phone,
          event_type:      payload.eventType,
          message_type:    payload.eventType,
          template_name:   templateName,
          status:          "SKIPPED",
          customer_opt_in: false,
          error_message:   "Cliente com whatsapp_opt_in=false",
          payload:         messagePayload,
        });
      if (skipErr && skipErr.code !== "23505") {
        console.error(`${tag} ERRO ao gravar SKIPPED:`, skipErr.message);
      } else {
        console.log(`${tag} SKIP: cliente sem opt-in (${maskPhone(phone)})`);
      }
      return { enqueued: false, reason: "opt_out" };
    }

    const { error: insertErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        order_id:        payload.orderId,
        branch_id:       payload.branchId ?? null,
        phone,
        event_type:      payload.eventType,
        message_type:    payload.eventType,
        template_name:   templateName,
        status:          "PENDING",
        customer_opt_in: true,
        payload:         messagePayload,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        console.log(`${tag} SKIP: mensagem ja enfileirada (idempotencia)`);
        return { enqueued: false, reason: "duplicate" };
      }
      console.error(`${tag} ERRO ao enfileirar:`, insertErr.message);
      return { enqueued: false, reason: "insert_error" };
    }

    console.log(`${tag} ENFILEIRADO template=${templateName} to=${maskPhone(phone)}`);
    return { enqueued: true };
  } catch (e: any) {
    console.error(`${tag} EXCEPTION:`, e?.message ?? "unknown");
    return { enqueued: false, reason: "exception" };
  }
}
