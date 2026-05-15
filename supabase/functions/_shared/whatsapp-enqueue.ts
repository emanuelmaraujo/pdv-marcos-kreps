/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared helper: enqueue WhatsApp transactional notifications (UTILITY templates).
//
// Design:
//   * Non-blocking: never throws. Caller code must not depend on its return.
//   * Idempotent: the partial UNIQUE index uniq_whatsapp_messages_order_event_live
//     on (order_id, event_type) WHERE status IN ('PENDING','SENT','SKIPPED')
//     guarantees at most one live row per event per order. We swallow unique
//     violations as "already enqueued".
//   * Opt-in aware: snapshots customer.whatsapp_opt_in into the row for audit (LGPD).
//   * No PII in logs: only event_type, order_id and masked phone.

export type WhatsAppEventType = "order_received" | "order_ready";

interface EnqueuePayload {
  orderId: string;
  eventType: WhatsAppEventType;
  phone: string | null | undefined;
  customerName: string | null | undefined;
  dailyNumber: number | string | null | undefined;
}

const SETTING_ENABLED = "whatsapp_enabled";
const SETTING_TEMPLATE_RECEIVED = "whatsapp_template_received";
const SETTING_TEMPLATE_READY = "whatsapp_template_ready";

function parseBoolSetting(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.replace(/^"|"$/g, "").toLowerCase();
    return trimmed === "true";
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

/**
 * Normalize a Brazilian phone into canonical +E.164. Accepts raw digits with or
 * without country code, with or without "+". Returns null if invalid.
 * Examples:
 *   "(61) 99999-9999" -> "+5561999999999"
 *   "61999999999"     -> "+5561999999999"
 *   "+5561999999999"  -> "+5561999999999"
 *   "5561999999999"   -> "+5561999999999"
 */
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
 * Enqueue a WhatsApp transactional message. Best-effort, never throws.
 *
 * Skips silently when:
 *   - whatsapp_enabled setting is false
 *   - phone is missing / not a valid Brazilian E.164
 *   - customer has whatsapp_opt_in = false
 *   - a live row already exists for (order_id, event_type) — handled by unique index
 */
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

    // 1. Settings
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .in("key", [SETTING_ENABLED, SETTING_TEMPLATE_RECEIVED, SETTING_TEMPLATE_READY]);

    const enabled = parseBoolSetting(
      settings?.find((s: any) => s.key === SETTING_ENABLED)?.value,
      false,
    );
    if (!enabled) {
      console.log(`${tag} SKIP: whatsapp_enabled=false`);
      return { enqueued: false, reason: "feature_disabled" };
    }

    const templateName = payload.eventType === "order_received"
      ? parseStringSetting(
        settings?.find((s: any) => s.key === SETTING_TEMPLATE_RECEIVED)?.value,
        "novo_pedido",
      )
      : parseStringSetting(
        settings?.find((s: any) => s.key === SETTING_TEMPLATE_READY)?.value,
        "pedido_pronto",
      );

    // 2. Opt-in snapshot (look up by phone_e164; tolerate missing customer row)
    let optIn = true;
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("whatsapp_opt_in")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (customer && customer.whatsapp_opt_in === false) {
      optIn = false;
    }

    if (!optIn) {
      // Persist a SKIPPED row to keep audit trail; rely on unique index for dedup.
      const { error: skipErr } = await supabaseAdmin
        .from("whatsapp_messages")
        .insert({
          order_id: payload.orderId,
          phone,
          event_type: payload.eventType,
          message_type: payload.eventType,
          template_name: templateName,
          status: "SKIPPED",
          customer_opt_in: false,
          error_message: "Cliente com whatsapp_opt_in=false",
          payload: {
            customer_name: firstName(payload.customerName),
            daily_number: payload.dailyNumber ?? null,
          },
        });
      if (skipErr && skipErr.code !== "23505") {
        console.error(`${tag} ERRO ao gravar SKIPPED:`, skipErr.message);
      } else {
        console.log(`${tag} SKIP: cliente sem opt-in (${maskPhone(phone)})`);
      }
      return { enqueued: false, reason: "opt_out" };
    }

    // 3. Insert PENDING. Unique partial index handles concurrent inserts.
    const { error: insertErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        order_id: payload.orderId,
        phone,
        event_type: payload.eventType,
        message_type: payload.eventType, // legacy column kept in sync
        template_name: templateName,
        status: "PENDING",
        customer_opt_in: true,
        payload: {
          customer_name: firstName(payload.customerName),
          daily_number: payload.dailyNumber ?? null,
        },
      });

    if (insertErr) {
      // 23505 = unique_violation — significa: ja existe linha viva (PENDING/SENT/SKIPPED).
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
