/* eslint-disable @typescript-eslint/no-explicit-any */
// Worker: processes the whatsapp_messages queue and sends UTILITY templates
// via the official Meta WhatsApp Cloud API.
//
// Auth (any of):
//   - x-cron-secret: <WHATSAPP_CRON_SECRET>   (for scheduled execution)
//   - Authorization: Bearer <ADMIN JWT>       (manual run from /app/configuracoes)
//
// Actions:
//   - process_queue : claim up to BATCH_SIZE PENDING messages whose retry window
//                     elapsed and dispatch them to Meta.
//   - send_test     : admin-only smoke test for a specific template + phone.
//
// Idempotency:
//   - Unique partial index uniq_whatsapp_messages_order_event_live blocks
//     duplicate enqueues (enforced at insert time by _shared/whatsapp-enqueue).
//   - Worker claims a row by guarded UPDATE: bumps attempts + pushes
//     next_retry_at into the future BEFORE calling Meta. Concurrent workers
//     skip rows where next_retry_at > now().
//
// Resilience:
//   - Errors are classified as definitive (no retry, status=FAILED) vs transient
//     (status stays PENDING with exponential backoff via next_retry_at).
//   - Max attempts: 5. Backoff schedule: 1m, 5m, 15m, 1h, 6h.
//
// Privacy:
//   - Phones are masked in logs.
//   - Tokens never appear in logs or audit. PII payload from Meta is dropped;
//     only error.code + sanitized error.message are persisted.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
// Delays after the Nth failed attempt: index 0 = after 1st failure, ...
const RETRY_DELAYS_SEC = [60, 300, 900, 3600, 21600];
// Claim window: how long a row is "soft-locked" while we call Meta.
const CLAIM_LEASE_SEC = 300;

// Permanent failure codes — no retry.
const DEFINITIVE_ERROR_CODES = new Set([
  100,    // Invalid parameter
  131026, // Message undeliverable / recipient not on WhatsApp
  131047, // Re-engagement message outside 24h window (templates should not hit this)
  131051, // Unsupported message type
  132000, // Template number of parameters mismatch
  132001, // Template does not exist
  132005, // Translated text too long
  132012, // Parameter format mismatch
  190,    // Access token expired/invalid — critical
]);

const TOKEN_EXPIRED_CODE = 190;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WhatsAppPayload {
  action?: "process_queue" | "send_test";
  phone?: string;
  template_name?: string;
  event_type?: "order_received" | "order_ready";
  daily_number?: number | string;
}

interface QueueRow {
  id: string;
  order_id: string;
  phone: string;
  event_type: string;
  template_name: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  customer_opt_in: boolean | null;
}

interface DispatchResult {
  id: string;
  success: boolean;
  status: "SENT" | "PENDING" | "FAILED" | "SKIPPED";
  error_code?: number | string;
  retry_in_seconds?: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(sem)";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `+${digits.slice(0, 2)}***${digits.slice(-4)}`;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function parseStringSetting(value: unknown, fallback: string): string {
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeErrorMessage(raw: unknown): string {
  if (typeof raw !== "string") return "Erro desconhecido";
  // Strip anything that looks like a token or phone-like long digit run.
  return raw
    .replace(/\b\d{10,15}\b/g, "***")
    .replace(/EAA[A-Za-z0-9_-]{20,}/g, "***TOKEN***")
    .slice(0, 500);
}

// ---------------------------------------------------------------------------
// Auth: x-cron-secret OR Authorization Bearer (ADMIN)
// ---------------------------------------------------------------------------
async function authorize(req: Request, supabaseAdmin: any): Promise<
  { mode: "cron" } | { mode: "admin"; userId: string } | { error: string; status: number }
> {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const expectedCronSecret = Deno.env.get("WHATSAPP_CRON_SECRET");

  if (cronSecretHeader && expectedCronSecret) {
    // Constant-time-ish compare to avoid trivial timing leaks.
    if (
      cronSecretHeader.length === expectedCronSecret.length &&
      cronSecretHeader === expectedCronSecret
    ) {
      return { mode: "cron" };
    }
    return { error: "Cron secret invalido.", status: 401 };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Nao autorizado: forneca x-cron-secret ou Bearer JWT de admin.", status: 401 };
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) {
    return { error: "Sessao expirada.", status: 401 };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || profile?.role !== "ADMIN") {
    return { error: "Apenas administradores podem operar WhatsApp.", status: 403 };
  }

  return { mode: "admin", userId: user.id };
}

// ---------------------------------------------------------------------------
// Settings (cached per invocation)
// ---------------------------------------------------------------------------
interface RuntimeSettings {
  language: string;
  apiVersion: string;
  templateReady: string;
  templateReceived: string;
}

async function loadSettings(supabaseAdmin: any): Promise<RuntimeSettings> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .in("key", [
      "whatsapp_template_language",
      "whatsapp_api_version",
      "whatsapp_template_ready",
      "whatsapp_template_received",
    ]);
  const get = (k: string, fallback: string) =>
    parseStringSetting(data?.find((row: any) => row.key === k)?.value, fallback);

  return {
    language: get("whatsapp_template_language", "pt_BR"),
    apiVersion: get(
      "whatsapp_api_version",
      Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0",
    ),
    templateReady: get("whatsapp_template_ready", "pedido_pronto"),
    templateReceived: get("whatsapp_template_received", "novo_pedido"),
  };
}

function resolveTemplateName(row: QueueRow, settings: RuntimeSettings): string {
  if (row.template_name) return row.template_name;
  return row.event_type === "order_received"
    ? settings.templateReceived
    : settings.templateReady;
}

// ---------------------------------------------------------------------------
// Claim: atomic guarded UPDATE
//   Returns the rows we successfully leased. Concurrent workers see the
//   updated next_retry_at and skip these rows naturally.
// ---------------------------------------------------------------------------
async function claimBatch(supabaseAdmin: any): Promise<QueueRow[]> {
  const nowIso = new Date().toISOString();
  const leaseUntilIso = new Date(Date.now() + CLAIM_LEASE_SEC * 1000).toISOString();

  // 1. Pick candidates
  const { data: candidates, error: candidatesErr } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, attempts, next_retry_at, scheduled_at")
    .eq("status", "PENDING")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .lte("scheduled_at", nowIso)
    .order("next_retry_at", { ascending: true, nullsFirst: true })
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (candidatesErr || !candidates || candidates.length === 0) return [];

  const claimed: QueueRow[] = [];
  for (const candidate of candidates) {
    // Guarded UPDATE: succeeds only if no one else moved the row.
    const { data: leased, error: leaseErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        attempts: (candidate.attempts ?? 0) + 1,
        last_attempt_at: nowIso,
        next_retry_at: leaseUntilIso,
      })
      .eq("id", candidate.id)
      .eq("status", "PENDING")
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .select(
        "id, order_id, phone, event_type, template_name, payload, attempts, customer_opt_in",
      )
      .maybeSingle();

    if (leaseErr || !leased) continue; // another worker won the race
    claimed.push(leased as QueueRow);
  }
  return claimed;
}

// ---------------------------------------------------------------------------
// Re-check opt-in just before dispatch (LGPD: user may have opted out
// between enqueue and send).
// ---------------------------------------------------------------------------
async function customerStillOptedIn(supabaseAdmin: any, phone: string): Promise<boolean> {
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("whatsapp_opt_in")
    .eq("phone_e164", phone)
    .maybeSingle();
  // If no customer record exists, default to opted-in (transactional, first contact).
  return !customer || customer.whatsapp_opt_in !== false;
}

// ---------------------------------------------------------------------------
// Meta dispatch
// ---------------------------------------------------------------------------
async function dispatch(
  supabaseAdmin: any,
  row: QueueRow,
  settings: RuntimeSettings,
  token: string,
  phoneNumberId: string,
): Promise<DispatchResult> {
  const tag = `[send-whatsapp ${row.event_type} order=${row.order_id}]`;

  // 1. Opt-out check
  if (!(await customerStillOptedIn(supabaseAdmin, row.phone))) {
    await finalize(supabaseAdmin, row, {
      status: "SKIPPED",
      errorMessage: "Cliente saiu (opt-out) antes do envio.",
    });
    console.log(`${tag} SKIPPED: cliente sem opt-in`);
    return { id: row.id, success: false, status: "SKIPPED" };
  }

  // 2. Payload — apenas {{1}} = numero do pedido
  const dailyNumber = row.payload && typeof row.payload === "object"
    ? (row.payload as any).daily_number
    : undefined;

  const components = [{
    type: "body",
    parameters: [{ type: "text", text: String(dailyNumber ?? "") }],
  }];

  const templateName = resolveTemplateName(row, settings);

  const waPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: digitsOnly(row.phone), // Meta expects digits only
    type: "template",
    template: {
      name: templateName,
      language: { code: settings.language },
      components,
    },
  };

  // 3. Call Meta
  const endpoint = `https://graph.facebook.com/${settings.apiVersion}/${phoneNumberId}/messages`;
  let response: Response;
  let data: any;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(waPayload),
    });
    data = await response.json().catch(() => ({}));
  } catch (e: any) {
    // Network failure → transient
    return await handleTransientFailure(supabaseAdmin, row, {
      code: "NETWORK",
      message: sanitizeErrorMessage(e?.message),
    }, tag);
  }

  if (response.ok && data?.messages?.[0]?.id) {
    const providerId = data.messages[0].id as string;
    await finalize(supabaseAdmin, row, {
      status: "SENT",
      providerId,
      deliveryStatus: "SENT",
    });
    await supabaseAdmin.from("audit_logs").insert({
      action: "WHATSAPP_SENT",
      table_name: "whatsapp_messages",
      record_id: row.order_id,
      new_data: {
        whatsapp_message_id: row.id,
        event_type: row.event_type,
        template: templateName,
        provider_message_id: providerId,
      },
    });
    console.log(`${tag} SENT to=${maskPhone(row.phone)} provider=${providerId}`);
    return { id: row.id, success: true, status: "SENT" };
  }

  // Error path
  const errCode: number = Number(data?.error?.code ?? response.status);
  const errMessage = sanitizeErrorMessage(data?.error?.message ?? `HTTP ${response.status}`);

  // 5xx and 429 are transient; otherwise consult the definitive set.
  const isTransient =
    response.status === 429 ||
    (response.status >= 500 && response.status <= 599) ||
    (!DEFINITIVE_ERROR_CODES.has(errCode) && errCode === 80007);

  if (isTransient) {
    return await handleTransientFailure(
      supabaseAdmin,
      row,
      { code: errCode, message: errMessage },
      tag,
    );
  }

  // Definitive failure
  await finalize(supabaseAdmin, row, {
    status: "FAILED",
    errorCode: String(errCode),
    errorMessage: errMessage,
  });
  await supabaseAdmin.from("audit_logs").insert({
    action: "WHATSAPP_FAILED",
    table_name: "whatsapp_messages",
    record_id: row.order_id,
    new_data: {
      whatsapp_message_id: row.id,
      event_type: row.event_type,
      template: templateName,
      error_code: errCode,
      definitive: true,
      token_expired: errCode === TOKEN_EXPIRED_CODE,
    },
  });
  console.error(`${tag} FAILED definitivo code=${errCode} to=${maskPhone(row.phone)}`);
  return { id: row.id, success: false, status: "FAILED", error_code: errCode };
}

async function handleTransientFailure(
  supabaseAdmin: any,
  row: QueueRow,
  err: { code: number | string; message: string },
  tag: string,
): Promise<DispatchResult> {
  const attempts = row.attempts; // already incremented by claim
  if (attempts >= MAX_ATTEMPTS) {
    await finalize(supabaseAdmin, row, {
      status: "FAILED",
      errorCode: String(err.code),
      errorMessage: `Max tentativas atingido. Ultimo erro: ${err.message}`,
    });
    await supabaseAdmin.from("audit_logs").insert({
      action: "WHATSAPP_FAILED",
      table_name: "whatsapp_messages",
      record_id: row.order_id,
      new_data: {
        whatsapp_message_id: row.id,
        event_type: row.event_type,
        error_code: err.code,
        definitive: false,
        exhausted_retries: true,
      },
    });
    console.error(`${tag} FAILED apos ${attempts} tentativas code=${err.code}`);
    return { id: row.id, success: false, status: "FAILED", error_code: err.code };
  }

  const delaySec = RETRY_DELAYS_SEC[Math.min(attempts - 1, RETRY_DELAYS_SEC.length - 1)];
  const nextRetryAt = new Date(Date.now() + delaySec * 1000).toISOString();
  await supabaseAdmin
    .from("whatsapp_messages")
    .update({
      status: "PENDING",
      error_code: String(err.code),
      error_message: err.message,
      next_retry_at: nextRetryAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  console.log(
    `${tag} retry agendado em ${delaySec}s (tentativa ${attempts}/${MAX_ATTEMPTS}) code=${err.code}`,
  );
  return { id: row.id, success: false, status: "PENDING", error_code: err.code, retry_in_seconds: delaySec };
}

interface FinalizeUpdate {
  status: "SENT" | "FAILED" | "SKIPPED";
  providerId?: string;
  deliveryStatus?: string;
  errorCode?: string;
  errorMessage?: string;
}

async function finalize(
  supabaseAdmin: any,
  row: QueueRow,
  update: FinalizeUpdate,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: update.status,
    next_retry_at: null,
    updated_at: nowIso,
  };
  if (update.status === "SENT") {
    patch.sent_at = nowIso;
    if (update.providerId) patch.provider_message_id = update.providerId;
    if (update.deliveryStatus) patch.delivery_status = update.deliveryStatus;
    patch.error_message = null;
    patch.error_code = null;
  } else {
    if (update.errorCode) patch.error_code = update.errorCode;
    if (update.errorMessage) patch.error_message = update.errorMessage;
  }
  await supabaseAdmin.from("whatsapp_messages").update(patch).eq("id", row.id);
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // 1. Auth
  const auth = await authorize(req, supabaseAdmin);
  if ("error" in auth) {
    return jsonResponse({ success: false, error: auth.error }, auth.status);
  }

  // 2. Secrets check
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) {
    return jsonResponse(
      { success: false, error: "Secrets WhatsApp ausentes no servidor." },
      500,
    );
  }

  let body: WhatsAppPayload = {};
  try {
    body = await req.json();
  } catch {
    // Empty body = process_queue (cron friendly)
  }
  const action = body.action ?? "process_queue";

  const settings = await loadSettings(supabaseAdmin);

  // 3. Test path (admin only)
  if (action === "send_test") {
    if (auth.mode !== "admin") {
      return jsonResponse({ success: false, error: "Apenas admin pode disparar teste." }, 403);
    }
    const phone = (body.phone ?? "").trim();
    if (!phone || digitsOnly(phone).length < 12) {
      return jsonResponse({ success: false, error: "Telefone de teste invalido." }, 400);
    }
    const templateEvent = body.event_type === "order_received" ? "order_received" : "order_ready";
    const templateName = body.template_name?.trim() ||
      (templateEvent === "order_received" ? settings.templateReceived : settings.templateReady);
    const dailyNumber = body.daily_number ?? 999;

    const testRow: QueueRow = {
      id: "test-only",
      order_id: "00000000-0000-0000-0000-000000000000",
      phone,
      event_type: templateEvent,
      template_name: templateName,
      payload: { daily_number: dailyNumber },
      attempts: 1,
      customer_opt_in: true,
    };

    // For tests we skip the DB write — call Meta directly and return raw outcome.
    const endpoint =
      `https://graph.facebook.com/${settings.apiVersion}/${phoneNumberId}/messages`;
    const components = [{
      type: "body",
      parameters: [{ type: "text", text: String(dailyNumber) }],
    }];
    const waPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly(phone),
      type: "template",
      template: { name: templateName, language: { code: settings.language }, components },
    };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(waPayload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.messages?.[0]?.id) {
        console.log(
          `[send-whatsapp send_test] OK template=${templateName} to=${maskPhone(phone)} provider=${data.messages[0].id}`,
        );
        return jsonResponse({
          success: true,
          template: templateName,
          to_masked: maskPhone(phone),
          provider_message_id: data.messages[0].id,
        });
      }
      const code = data?.error?.code ?? response.status;
      const message = sanitizeErrorMessage(data?.error?.message ?? `HTTP ${response.status}`);
      console.error(`[send-whatsapp send_test] FAIL code=${code} to=${maskPhone(phone)}`);
      return jsonResponse({ success: false, error_code: code, error: message }, 200);
    } catch (e: any) {
      return jsonResponse(
        { success: false, error: sanitizeErrorMessage(e?.message) },
        200,
      );
    } finally {
      // Reference testRow so the unused-vars linter stays quiet in case template_name extraction changes.
      void testRow;
    }
  }

  // 4. process_queue
  if (action !== "process_queue") {
    return jsonResponse({ success: false, error: "Acao desconhecida." }, 400);
  }

  const claimed = await claimBatch(supabaseAdmin);
  if (claimed.length === 0) {
    return jsonResponse({ success: true, processed: 0, message: "Fila vazia." });
  }

  const results: DispatchResult[] = [];
  for (const row of claimed) {
    const result = await dispatch(supabaseAdmin, row, settings, accessToken, phoneNumberId);
    results.push(result);
  }

  const summary = {
    success: true,
    processed: results.length,
    sent: results.filter((r) => r.status === "SENT").length,
    pending: results.filter((r) => r.status === "PENDING").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
  };
  console.log(
    `[send-whatsapp] batch done sent=${summary.sent} pending=${summary.pending} failed=${summary.failed} skipped=${summary.skipped}`,
  );
  return jsonResponse(summary);
});
