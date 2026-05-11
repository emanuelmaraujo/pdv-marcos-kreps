import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function inferInternalPaymentMethod(payment: any) {
  const paymentMethodId = String(payment?.payment_method_id ?? "").toLowerCase();
  const paymentTypeId = String(payment?.payment_type_id ?? "").toLowerCase();

  if (paymentMethodId === "pix" || paymentTypeId === "bank_transfer") return "PIX";
  if (paymentTypeId === "debit_card") return "DEBIT_CARD";
  if (paymentTypeId === "credit_card") return "CREDIT_CARD";
  return "PENDING";
}

function mapTransactionPayload(payment: any) {
  const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
  return {
    provider_payment_id: payment?.id ? String(payment.id) : null,
    provider_payment_method_id: payment?.payment_method_id ? String(payment.payment_method_id) : null,
    provider_payment_type_id: payment?.payment_type_id ? String(payment.payment_type_id) : null,
    provider_status: payment?.status ? String(payment.status) : "unknown",
    provider_status_detail: payment?.status_detail ? String(payment.status_detail) : null,
    internal_payment_method: inferInternalPaymentMethod(payment),
    qr_code: transactionData.qr_code ?? null,
    qr_code_base64: transactionData.qr_code_base64 ?? null,
    ticket_url: transactionData.ticket_url ?? null,
    expires_at: payment?.date_of_expiration ?? null,
    raw_provider_payload: payment,
  };
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function parseSignature(header: string | null) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }).filter(([key, value]) => key && value),
  );
}

async function verifyWebhookSignature(req: Request, signedPaymentId: string) {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) return true;

  const signature = parseSignature(req.headers.get("x-signature"));
  const requestId = req.headers.get("x-request-id");
  const ts = signature.ts;
  const received = signature.v1;
  if (!requestId || !ts || !received) return false;

  // Mercado Pago signs a manifest with the resource id, request id and timestamp.
  // Keep this strict only when MERCADO_PAGO_WEBHOOK_SECRET is configured.
  const manifest = `id:${signedPaymentId};request-id:${requestId};ts:${ts};`;
  const expected = await hmacSha256(secret, manifest);
  return expected === received;
}

async function consolidateApprovedPayment(supabaseAdmin: any, order: any, payment: any, transactionId: string | null) {
  const internalMethod = inferInternalPaymentMethod(payment);
  if (internalMethod === "PENDING") {
    throw new Error("Metodo aprovado nao mapeado.");
  }

  const amountPaid = Number(payment?.transaction_amount ?? payment?.transaction_details?.total_paid_amount ?? 0);
  if (Number(amountPaid.toFixed(2)) !== Number(Number(order.total_amount).toFixed(2))) {
    await supabaseAdmin.from("audit_logs").insert({
      action: "PAYMENT_PROVIDER_AMOUNT_MISMATCH",
      table_name: "orders",
      record_id: order.id,
      new_data: {
        provider: "MERCADO_PAGO",
        provider_payment_id: payment?.id ?? null,
        amount_paid: amountPaid,
        order_total: order.total_amount,
      },
    });
    throw new Error("Valor aprovado diverge do total oficial.");
  }

  if (order.payment_status !== "PAID") {
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: internalMethod,
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", order.id);

    if (updateErr) throw new Error("Erro ao atualizar pedido pago.");
  }

  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("payment_status", "PAID")
    .maybeSingle();

  if (!existingPayment) {
    const { error: paymentErr } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        amount: order.total_amount,
        payment_method: internalMethod,
        payment_status: "PAID",
        notes: `Mercado Pago payment ${payment?.id ?? ""}`.trim(),
      });

    if (paymentErr) throw new Error("Erro ao registrar pagamento consolidado.");
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "PAYMENT_PROVIDER_APPROVED",
    table_name: "orders",
    record_id: order.id,
    new_data: {
      provider: "MERCADO_PAGO",
      provider_payment_id: payment?.id ?? null,
      transaction_id: transactionId,
      payment_method: internalMethod,
      status: payment?.status ?? null,
    },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false }, 405);
  }

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return jsonResponse({ success: false, error: "missing_access_token" }, 500);

    const url = new URL(req.url);
    const body = await req.json();
    const type = cleanText(body.type, 80) ?? cleanText(body.topic, 80);
    const queryPaymentId = cleanText(url.searchParams.get("data.id"), 80);
    const paymentId = queryPaymentId ?? cleanText(body?.data?.id, 80) ?? cleanText(body.id, 80);

    if (type !== "payment" || !paymentId) {
      return jsonResponse({ success: true, ignored: true });
    }

    const validSignature = await verifyWebhookSignature(req, queryPaymentId ?? paymentId);
    if (!validSignature) {
      console.error("[mercado-pago-webhook] invalid signature", { paymentId });
      return jsonResponse({ success: false }, 401);
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const payment = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("[mercado-pago-webhook] payment fetch failed", {
        paymentId,
        status: mpResponse.status,
        message: payment?.message,
      });
      return jsonResponse({ success: false }, 502);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const externalReference = cleanText(payment.external_reference, 220);
    const orderIdFromReference = externalReference?.split(":")[0] ?? null;

    let transaction = null;
    const { data: transactionByPayment } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("provider_payment_id", String(payment.id))
      .maybeSingle();

    transaction = transactionByPayment;

    if (!transaction && externalReference) {
      const { data: transactionByReference } = await supabaseAdmin
        .from("payment_transactions")
        .select("*")
        .eq("external_reference", externalReference)
        .maybeSingle();
      transaction = transactionByReference;
    }

    if (transaction) {
      const { data: updatedTransaction, error: txErr } = await supabaseAdmin
        .from("payment_transactions")
        .update(mapTransactionPayload(payment))
        .eq("id", transaction.id)
        .select("*")
        .single();

      if (txErr) throw new Error("Erro ao atualizar transacao.");
      transaction = updatedTransaction;
    } else if (orderIdFromReference) {
      const { data: config } = await supabaseAdmin
        .from("payment_method_configs")
        .select("code")
        .eq("code", "MERCADO_PAGO_PAYMENT_BRICK")
        .single();

      const idempotencyKey = `webhook-${payment.id}`;
      const { data: insertedTransaction, error: insertErr } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          order_id: orderIdFromReference,
          provider: "MERCADO_PAGO",
          external_reference: externalReference,
          idempotency_key: idempotencyKey,
          payment_method_code: config?.code ?? "MERCADO_PAGO_PAYMENT_BRICK",
          amount: payment.transaction_amount,
          ...mapTransactionPayload(payment),
        })
        .select("*")
        .single();

      if (insertErr) throw new Error("Erro ao registrar transacao do webhook.");
      transaction = insertedTransaction;
    }

    const orderId = transaction?.order_id ?? orderIdFromReference;
    if (!orderId) {
      console.error("[mercado-pago-webhook] payment without known order", {
        paymentId,
        externalReference,
      });
      return jsonResponse({ success: true, ignored: true });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, payment_status")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      console.error("[mercado-pago-webhook] order not found", { paymentId, orderId });
      return jsonResponse({ success: true, ignored: true });
    }

    if (payment.status === "approved") {
      await consolidateApprovedPayment(supabaseAdmin, order, payment, transaction?.id ?? null);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("[mercado-pago-webhook] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ success: false }, 500);
  }
});
