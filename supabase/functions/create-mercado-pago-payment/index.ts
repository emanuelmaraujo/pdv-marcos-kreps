import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type JsonRecord = Record<string, unknown>;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function toNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getNested(record: any, keys: string[]) {
  let current = record;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function inferInternalPaymentMethod(payment: any) {
  const paymentMethodId = String(payment?.payment_method_id ?? "").toLowerCase();
  const paymentTypeId = String(payment?.payment_type_id ?? "").toLowerCase();

  if (paymentMethodId === "pix" || paymentTypeId === "bank_transfer") return "PIX";
  if (paymentTypeId === "debit_card") return "DEBIT_CARD";
  if (paymentTypeId === "credit_card") return "CREDIT_CARD";
  return "PENDING";
}

function splitCustomerName(value: unknown) {
  const name = cleanText(value, 120);
  if (!name) return { firstName: null, lastName: null };
  const parts = name.split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
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

async function consolidateApprovedPayment(supabaseAdmin: any, order: any, payment: any, transactionId: string | null) {
  const internalMethod = inferInternalPaymentMethod(payment);
  if (internalMethod === "PENDING") {
    throw new Error("Metodo aprovado nao mapeado para o caixa.");
  }

  const amountPaid = Number(payment?.transaction_amount ?? payment?.transaction_details?.total_paid_amount ?? 0);
  if (Number(amountPaid.toFixed(2)) !== Number(Number(order.total_amount).toFixed(2))) {
    throw new Error("Valor aprovado diverge do total oficial do pedido.");
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

    if (updateErr) throw new Error("Erro ao marcar pedido como pago.");
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

    if (paymentErr) throw new Error("Erro ao registrar pagamento.");
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return jsonResponse(req, {
        success: false,
        configuration_required: true,
        error: "Mercado Pago ainda nao configurado.",
      }, 503);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const orderId = cleanText(body.order_id, 64);
    const publicToken = cleanText(body.public_token, 128);
    const paymentMethodCode = cleanText(body.payment_method_code, 80) ?? "MERCADO_PAGO_PAYMENT_BRICK";
    const directPaymentMethod = cleanText(body.direct_payment_method, 40)?.toLowerCase() ?? null;
    const idempotencyKey = cleanText(
      req.headers.get("x-idempotency-key") ?? body.idempotency_key,
      120,
    ) ?? crypto.randomUUID();
    const formData = typeof body.form_data === "object" && body.form_data !== null ? body.form_data as any : {};

    if (!orderId || !publicToken) throw new Error("Pedido invalido.");

    const { data: methodConfig, error: methodErr } = await supabaseAdmin
      .from("payment_method_configs")
      .select("code, provider, enabled")
      .eq("code", paymentMethodCode)
      .single();

    if (methodErr || !methodConfig || !methodConfig.enabled || methodConfig.provider !== "MERCADO_PAGO") {
      throw new Error("Metodo de pagamento indisponivel.");
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, public_token, status, payment_status, total_amount, customer_name, customer_phone, customer_email")
      .eq("id", orderId)
      .eq("public_token", publicToken)
      .single();

    if (orderErr || !order) throw new Error("Pedido nao encontrado.");
    if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      throw new Error("Pedido nao esta disponivel para pagamento.");
    }
    if (order.payment_status === "PAID") {
      return jsonResponse(req, { success: true, already_paid: true, order: { payment_status: "PAID" } });
    }

    const { data: existingTx } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingTx) {
      return jsonResponse(req, {
        success: true,
        transaction: existingTx,
        payment: existingTx.raw_provider_payload,
      });
    }

    const paymentMethodId =
      directPaymentMethod === "pix" ? "pix" :
      cleanText(formData.payment_method_id, 80) ??
      cleanText(formData.paymentMethodId, 80) ??
      cleanText(getNested(formData, ["payment_method", "id"]), 80);

    if (!paymentMethodId) throw new Error("Metodo de pagamento nao informado pelo Brick.");
    const isPix = paymentMethodId.toLowerCase() === "pix";

    if (isPix) {
      const { data: existingPendingPix } = await supabaseAdmin
        .from("payment_transactions")
        .select("*")
        .eq("order_id", order.id)
        .eq("provider", "MERCADO_PAGO")
        .eq("provider_payment_method_id", "pix")
        .in("provider_status", ["pending", "in_process"])
        .gt("expires_at", new Date().toISOString())
        .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPendingPix) {
        return jsonResponse(req, {
          success: true,
          transaction: {
            id: existingPendingPix.id,
            status: existingPendingPix.provider_status,
            payment_method: existingPendingPix.internal_payment_method,
            qr_code: existingPendingPix.qr_code,
            qr_code_base64: existingPendingPix.qr_code_base64,
            ticket_url: existingPendingPix.ticket_url,
            expires_at: existingPendingPix.expires_at,
            created_at: existingPendingPix.created_at,
          },
          payment: {
            id: existingPendingPix.provider_payment_id,
            status: existingPendingPix.provider_status,
            status_detail: existingPendingPix.provider_status_detail,
            payment_method_id: existingPendingPix.provider_payment_method_id,
            payment_type_id: existingPendingPix.provider_payment_type_id,
            point_of_interaction: {
              transaction_data: {
                qr_code: existingPendingPix.qr_code,
                qr_code_base64: existingPendingPix.qr_code_base64,
                ticket_url: existingPendingPix.ticket_url,
              },
            },
          },
        });
      }
    }

    const payerEmail =
      cleanText(getNested(formData, ["payer", "email"]), 254) ??
      cleanText(formData.email, 254) ??
      cleanText(order.customer_email, 254);

    if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      throw new Error("Informe um e-mail valido no pagamento.");
    }

    const externalReference = `${order.id}:${idempotencyKey}`;
    const notificationUrl = cleanText(Deno.env.get("MERCADO_PAGO_WEBHOOK_URL"), 500);
    const { firstName, lastName } = splitCustomerName(order.customer_name);
    const customerPhoneDigits = cleanText(order.customer_phone, 24)?.replace(/\D/g, "");
    const paymentPayload: any = {
      transaction_amount: Number(order.total_amount),
      description: `Pedido #${String(order.daily_number).padStart(3, "0")} - Marcos Krep's`,
      payment_method_id: paymentMethodId,
      external_reference: externalReference,
      statement_descriptor: "MARCOSKREPS",
      payer: {
        email: payerEmail,
      },
    };

    if (firstName) paymentPayload.payer.first_name = firstName;
    if (lastName) paymentPayload.payer.last_name = lastName;
    if (customerPhoneDigits && customerPhoneDigits.length >= 10) {
      paymentPayload.payer.phone = {
        area_code: customerPhoneDigits.slice(0, 2),
        number: customerPhoneDigits.slice(2),
      };
    }

    if (notificationUrl) paymentPayload.notification_url = notificationUrl;
    if (isPix) paymentPayload.date_of_expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    if (formData.token) paymentPayload.token = String(formData.token);
    if (formData.installments) paymentPayload.installments = Math.max(1, Math.trunc(toNumber(formData.installments)));
    if (formData.issuer_id || formData.issuerId) paymentPayload.issuer_id = String(formData.issuer_id ?? formData.issuerId);

    const identificationType = cleanText(getNested(formData, ["payer", "identification", "type"]) ?? formData.identificationType, 20);
    const identificationNumber = cleanText(getNested(formData, ["payer", "identification", "number"]) ?? formData.identificationNumber, 32);
    if (identificationType && identificationNumber) {
      paymentPayload.payer.identification = {
        type: identificationType,
        number: identificationNumber.replace(/\D/g, ""),
      };
    }

    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("product_id, product_name_snapshot, product_price_snapshot, quantity, observation")
      .eq("order_id", order.id);

    if (orderItems && orderItems.length > 0) {
      paymentPayload.additional_info = {
        items: orderItems.map((item: any) => ({
          id: String(item.product_id),
          title: String(item.product_name_snapshot).slice(0, 256),
          description: cleanText(item.observation, 256) ?? String(item.product_name_snapshot).slice(0, 256),
          quantity: Number(item.quantity),
          unit_price: Number(item.product_price_snapshot),
          category_id: "food",
        })),
      };
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const payment = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("[create-mercado-pago-payment] Mercado Pago error", {
        status: mpResponse.status,
        message: payment?.message,
        error: payment?.error,
        cause: payment?.cause,
      });
      return jsonResponse(req, {
        success: false,
        error: "Nao foi possivel processar o pagamento. Verifique os dados e tente novamente.",
        provider_status: mpResponse.status,
      }, 400);
    }

    const txPayload = mapTransactionPayload(payment);
    const { data: transaction, error: txErr } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        provider: "MERCADO_PAGO",
        external_reference: externalReference,
        idempotency_key: idempotencyKey,
        payment_method_code: paymentMethodCode,
        amount: order.total_amount,
        ...txPayload,
      })
      .select("*")
      .single();

    if (txErr) throw new Error("Erro ao registrar transacao de pagamento.");

    if (payment.status === "approved") {
      await consolidateApprovedPayment(supabaseAdmin, order, payment, transaction.id);
    }

    return jsonResponse(req, {
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        payment_method_id: payment.payment_method_id,
        payment_type_id: payment.payment_type_id,
        point_of_interaction: payment.point_of_interaction,
      },
      transaction: {
        id: transaction.id,
        status: transaction.provider_status,
        payment_method: transaction.internal_payment_method,
        qr_code: transaction.qr_code,
        qr_code_base64: transaction.qr_code_base64,
        ticket_url: transaction.ticket_url,
        expires_at: transaction.expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar pagamento.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
