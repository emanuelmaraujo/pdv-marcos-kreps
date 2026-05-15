/* eslint-disable @typescript-eslint/no-explicit-any */
// Webhook receiver for Meta WhatsApp Cloud API.
//
// Subscribes to: "messages" (delivery statuses + inbound user messages) and
// "message_template_status_update" (template approval/rejection — logged for audit).
//
// Public endpoint (no JWT). Auth is enforced via:
//   GET  : hub.verify_token must equal env WHATSAPP_WEBHOOK_VERIFY_TOKEN.
//   POST : X-Hub-Signature-256 must match HMAC-SHA256(env WHATSAPP_APP_SECRET, raw body).
//
// Always responds 200 to Meta when signature is valid — Meta retries on non-2xx
// and we don't want exponential webhook redelivery to amplify partial failures.
//
// Privacy: phones masked in logs; raw inbound message text is not echoed in logs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const OPT_OUT_KEYWORDS = new Set(["stop", "sair", "parar", "cancelar"]);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(sem)";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `+${digits.slice(0, 2)}***${digits.slice(-4)}`;
}

function toCanonicalE164Br(rawDigits: string): string | null {
  const digits = rawDigits.replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("55") && (local.length === 12 || local.length === 13)) {
    local = local.slice(2);
  }
  if (local.length !== 10 && local.length !== 11) return null;
  return `+55${local}`;
}

function normalizeKeyword(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim();
}

function isOptOutMessage(text: string): boolean {
  const normalized = normalizeKeyword(text);
  if (OPT_OUT_KEYWORDS.has(normalized)) return true;
  // Accept simple variations like "stop please" or "quero parar"
  return [...OPT_OUT_KEYWORDS].some((kw) => {
    const re = new RegExp(`(^|\\s)${kw}(\\s|$)`);
    return re.test(normalized);
  });
}

// Timing-safe-ish hex string compare.
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mapProviderStatus(status: string): string | null {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
      return "SENT";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED_BY_PROVIDER";
    case "deleted":
    case "warning":
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Status updates from Meta (delivery receipts)
// ---------------------------------------------------------------------------
async function handleStatus(supabaseAdmin: any, status: any): Promise<void> {
  const providerId: string | undefined = status?.id;
  if (!providerId) return;

  const mapped = mapProviderStatus(status?.status ?? "");
  if (!mapped) return;

  const errors = Array.isArray(status?.errors) ? status.errors : [];
  const firstError = errors[0];
  const errorCode = firstError?.code != null ? String(firstError.code) : null;

  const patch: Record<string, unknown> = {
    delivery_status: mapped,
    updated_at: new Date().toISOString(),
  };
  if (mapped === "FAILED_BY_PROVIDER" && errorCode) {
    patch.error_code = errorCode;
  }

  const { error } = await supabaseAdmin
    .from("whatsapp_messages")
    .update(patch)
    .eq("provider_message_id", providerId);

  if (error) {
    console.error(
      `[whatsapp-webhook] status update falhou provider=${providerId}: ${error.message}`,
    );
    return;
  }
  console.log(
    `[whatsapp-webhook] delivery_status=${mapped} provider=${providerId}${errorCode ? ` err=${errorCode}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Inbound user message (look for STOP intent)
// ---------------------------------------------------------------------------
async function handleInboundMessage(supabaseAdmin: any, message: any): Promise<void> {
  const fromRaw: string | undefined = message?.from;
  const text: string | undefined = message?.text?.body;
  const buttonText: string | undefined = message?.button?.text;
  const interactiveTitle: string | undefined =
    message?.interactive?.button_reply?.title ??
    message?.interactive?.list_reply?.title;

  const candidate = text ?? buttonText ?? interactiveTitle ?? "";
  const phone = fromRaw ? toCanonicalE164Br(fromRaw) : null;
  if (!phone) return;

  if (!isOptOutMessage(candidate)) {
    console.log(
      `[whatsapp-webhook] inbound de ${maskPhone(phone)} sem STOP keyword`,
    );
    return;
  }

  // Mark opt-out (LGPD)
  const nowIso = new Date().toISOString();
  const { error: updErr, data: updated } = await supabaseAdmin
    .from("customers")
    .update({
      whatsapp_opt_in: false,
      whatsapp_opt_in_updated_at: nowIso,
    })
    .eq("phone_e164", phone)
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error(
      `[whatsapp-webhook] erro ao gravar opt-out ${maskPhone(phone)}: ${updErr.message}`,
    );
    return;
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "WHATSAPP_OPT_OUT",
    table_name: "customers",
    record_id: updated?.id ?? null,
    new_data: { phone_masked: maskPhone(phone) },
  });

  console.log(
    `[whatsapp-webhook] OPT-OUT registrado para ${maskPhone(phone)} (cliente=${updated?.id ?? "desconhecido"})`,
  );
}

// ---------------------------------------------------------------------------
// Template status updates (approved / rejected / paused)
// ---------------------------------------------------------------------------
async function handleTemplateStatusUpdate(
  supabaseAdmin: any,
  change: any,
): Promise<void> {
  const value = change?.value;
  if (!value) return;
  await supabaseAdmin.from("audit_logs").insert({
    action: "WHATSAPP_TEMPLATE_STATUS",
    table_name: "settings",
    record_id: null,
    new_data: {
      template_name: value?.message_template_name ?? null,
      language: value?.message_template_language ?? null,
      event: value?.event ?? null,
      reason: value?.reason ?? null,
    },
  });
  console.log(
    `[whatsapp-webhook] template_status template=${value?.message_template_name} event=${value?.event}`,
  );
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------
serve(async (req) => {
  const url = new URL(req.url);

  // ---- GET: verification handshake ---------------------------------------
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (!expected) {
      console.error("[whatsapp-webhook] verify token nao configurado no servidor");
      return new Response("Misconfigured", { status: 500 });
    }
    if (mode === "subscribe" && token && safeCompare(token, expected) && challenge) {
      console.log("[whatsapp-webhook] verify handshake OK");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    console.error("[whatsapp-webhook] verify handshake FALHOU");
    return new Response("Forbidden", { status: 403 });
  }

  // ---- POST: event notifications -----------------------------------------
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) {
    console.error("[whatsapp-webhook] WHATSAPP_APP_SECRET nao configurado");
    return new Response("Misconfigured", { status: 500 });
  }

  // Read raw body BEFORE parsing — signature is computed over raw bytes.
  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  if (!sigHeader.startsWith("sha256=")) {
    console.error("[whatsapp-webhook] header X-Hub-Signature-256 ausente/invalido");
    return new Response("Unauthorized", { status: 401 });
  }
  const expectedHex = await hmacSha256Hex(appSecret, rawBody);
  const receivedHex = sigHeader.slice("sha256=".length).trim();
  if (!safeCompare(expectedHex, receivedHex)) {
    console.error("[whatsapp-webhook] assinatura invalida");
    return new Response("Unauthorized", { status: 401 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Iterate the standard envelope: entry[].changes[].value...
  const entries = Array.isArray(parsed?.entry) ? parsed.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const field = change?.field;

      if (field === "message_template_status_update") {
        await handleTemplateStatusUpdate(supabaseAdmin, change);
        continue;
      }

      if (field !== "messages") continue;
      const value = change?.value ?? {};

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        try {
          await handleStatus(supabaseAdmin, status);
        } catch (e: any) {
          console.error(`[whatsapp-webhook] erro status: ${e?.message ?? "?"}`);
        }
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        try {
          await handleInboundMessage(supabaseAdmin, message);
        } catch (e: any) {
          console.error(`[whatsapp-webhook] erro inbound: ${e?.message ?? "?"}`);
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
});
