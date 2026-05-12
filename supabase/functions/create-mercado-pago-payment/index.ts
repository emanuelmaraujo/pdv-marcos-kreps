/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type JsonRecord = Record<string, unknown>;
const PIX_EXPIRATION_MINUTES = 60;

// Wallet codes supported in sandbox via Mercado Pago Payment Brick.
// Production enablement requires domain validation (Apple Pay) and account confirmation.
const WALLET_TYPE_BY_CODE: Record<string, string> = {
  GOOGLE_PAY: "google_pay",
  APPLE_PAY: "apple_pay",
};

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

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  if (configured === "*" || !origin) return true;
  return configured.split(",").map((value) => value.trim()).filter(Boolean).includes(origin);
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

function cleanEmail(value: unknown) {
  const email = cleanText(value, 254);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null;
}

function cleanDigits(value: unknown, maxLength: number) {
  const text = cleanText(value, maxLength * 3);
  if (!text) return null;
  const digits = text.replace(/\D/g, "").slice(0, maxLength);
  return digits || null;
}

function isValidCpf(value: unknown) {
  const digits = cleanDigits(value, 11);
  if (!digits || digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

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

function maskEmail(email: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function sanitizePaymentPayload(payload: any) {
  return {
    transaction_amount: payload.transaction_amount,
    description: payload.description,
    payment_method_id: payload.payment_method_id,
    external_reference: payload.external_reference,
    statement_descriptor: payload.statement_descriptor,
    date_of_expiration: payload.date_of_expiration ?? null,
    notification_url_present: Boolean(payload.notification_url),
    payer: {
      email: maskEmail(payload.payer?.email ?? null),
      first_name_present: Boolean(payload.payer?.first_name),
      last_name_present: Boolean(payload.payer?.last_name),
      phone_present: Boolean(payload.payer?.phone),
      identification_present: Boolean(payload.payer?.identification),
    },
    token_present: Boolean(payload.token),
    installments: payload.installments ?? null,
    issuer_id_present: Boolean(payload.issuer_id),
    additional_info_items_count: Array.isArray(payload.additional_info?.items)
      ? payload.additional_info.items.length
      : 0,
  };
}

function sanitizeProviderCauses(cause: unknown) {
  if (!Array.isArray(cause)) return [];
  return cause.slice(0, 5).map((item: any) => ({
    code: item?.code ?? null,
    description: item?.description ?? item?.message ?? null,
    data: item?.data ?? null,
  }));
}

function providerCauseText(payment: any) {
  const parts = [
    payment?.message,
    payment?.error,
    ...(Array.isArray(payment?.cause)
      ? payment.cause.flatMap((item: any) => [item?.code, item?.description, item?.message, item?.data])
      : []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function safeProviderErrorMessage(payment: any) {
  const text = providerCauseText(payment);
  if (text.includes("payer") && text.includes("email")) {
    return "Informe um e-mail valido para gerar o Pix pelo Mercado Pago.";
  }
  if (text.includes("identification") || text.includes("cpf") || text.includes("document")) {
    return "Informe um CPF valido para gerar o Pix pelo Mercado Pago.";
  }
  if (text.includes("collector") && text.includes("payer")) {
    return "Use um e-mail de comprador diferente do e-mail da conta Mercado Pago.";
  }
  if (text.includes("pix") || text.includes("payment_method")) {
    return "Pix nao esta habilitado ou disponivel nesta conta Mercado Pago.";
  }
  if (text.includes("wallet") || text.includes("google") || text.includes("apple")) {
    return "Carteira digital nao disponivel. Tente outro metodo de pagamento.";
  }
  return "Nao foi possivel processar o pagamento. Verifique os dados e tente novamente.";
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function settingBool(value: unknown): boolean {
  return value === true || value === "true";
}

async function autoConfirmOnlinePaidOrder(supabaseAdmin: any, orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, daily_number, status, type, customer_name, discount_amount, packing_fee, total_amount, payment_status, payment_method")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "AGUARDANDO_PAGAMENTO") return;

  const { data: existingJobs } = await supabaseAdmin
    .from("printer_jobs")
    .select("id")
    .eq("order_id", orderId);
  if (existingJobs && existingJobs.length > 0) return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select(`
      id, quantity, observation, product_name_snapshot, product_price_snapshot, total_price, production_sector,
      order_item_removed_ingredients ( ingredient_name_snapshot ),
      order_item_addons ( addon_name_snapshot, quantity, addon_price_snapshot )
    `)
    .eq("order_id", orderId);

  if (!items || items.length === 0) return;

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .in("key", ["printing_enabled", "print_customer_copy", "print_kitchen_copy", "print_juice_potato_copy"]);

  const printingEnabled = settingBool(settings?.find((s: any) => s.key === "printing_enabled")?.value);
  const shouldPrintKitchen = printingEnabled && settingBool(settings?.find((s: any) => s.key === "print_kitchen_copy")?.value);
  const shouldPrintJuice = printingEnabled && settingBool(settings?.find((s: any) => s.key === "print_juice_potato_copy")?.value);
  const shouldPrintCustomer = printingEnabled && settingBool(settings?.find((s: any) => s.key === "print_customer_copy")?.value);

  const kitchenItems = items.filter((i: any) => i.production_sector === "KITCHEN");
  const juicePotatoItems = items.filter((i: any) => i.production_sector === "JUICE_POTATO");
  const printerJobsToInsert: any[] = [];
  const timestampNow = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const formatBRL = (val: number) => `R$ ${parseFloat(val as any).toFixed(2).replace(".", ",")}`;

  if (kitchenItems.length > 0 && shouldPrintKitchen) {
    let content = `MARCOS KREP'S\n`;
    content += `PEDIDO #${String(order.daily_number).padStart(3, "0")}\n`;
    content += `COZINHA / KREP\n`;
    content += `Tipo: ${order.type}\n`;
    content += `Horário: ${timestampNow}\n`;
    content += `------------------------\n`;
    for (const item of kitchenItems) {
      content += `${item.quantity}x ${item.product_name_snapshot}\n`;
      if (item.order_item_removed_ingredients.length > 0) {
        content += `  SEM: ${item.order_item_removed_ingredients.map((r: any) => r.ingredient_name_snapshot).join(", ")}\n`;
      }
      if (item.order_item_addons.length > 0) {
        content += `  COM: ${item.order_item_addons.map((a: any) => `${a.quantity}x ${a.addon_name_snapshot}`).join(", ")}\n`;
      }
      if (item.observation) content += `  OBS: ${item.observation}\n`;
      content += `\n`;
    }
    content += `------------------------\n`;
    printerJobsToInsert.push({ order_id: orderId, sector: "KITCHEN", content: { text: content } });
  }

  if (juicePotatoItems.length > 0 && shouldPrintJuice) {
    let content = `MARCOS KREP'S\n`;
    content += `PEDIDO #${String(order.daily_number).padStart(3, "0")}\n`;
    content += `SUCOS / BATATA\n`;
    content += `Tipo: ${order.type}\n`;
    content += `Horário: ${timestampNow}\n`;
    content += `------------------------\n`;
    for (const item of juicePotatoItems) {
      content += `${item.quantity}x ${item.product_name_snapshot}\n`;
      if (item.observation) content += `  OBS: ${item.observation}\n`;
      content += `\n`;
    }
    content += `------------------------\n`;
    printerJobsToInsert.push({ order_id: orderId, sector: "JUICE_POTATO", content: { text: content } });
  }

  if (shouldPrintCustomer) {
    let content = `MARCOS KREP'S\n`;
    content += `PEDIDO #${String(order.daily_number).padStart(3, "0")}\n`;
    content += `CLIENTE / SENHA\n`;
    content += `Tipo: ${order.type}\n`;
    if (order.customer_name) content += `Cliente: ${order.customer_name}\n`;
    content += `Horário: ${timestampNow}\n`;
    content += `------------------------\n`;
    for (const item of items) {
      content += `${item.quantity}x ${item.product_name_snapshot} - ${formatBRL(item.product_price_snapshot)}\n`;
      if (item.order_item_addons.length > 0) {
        for (const add of item.order_item_addons) {
          content += `  + ${add.quantity}x ${add.addon_name_snapshot} - ${formatBRL(add.addon_price_snapshot)}\n`;
        }
      }
    }
    content += `------------------------\n`;
    if (order.discount_amount > 0) content += `Desconto: -${formatBRL(order.discount_amount)}\n`;
    if (order.packing_fee > 0) content += `Taxa Embalagem: ${formatBRL(order.packing_fee)}\n`;
    content += `TOTAL: ${formatBRL(order.total_amount)}\n`;
    content += `Pagamento: ${order.payment_method}\n`;
    content += `------------------------\n`;
    content += `Guarde este número para retirada.\n`;
    printerJobsToInsert.push({ order_id: orderId, sector: "CUSTOMER", content: { text: content } });
  }

  if (printerJobsToInsert.length > 0) {
    await supabaseAdmin.from("printer_jobs").insert(printerJobsToInsert);
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("orders")
    .update({ status: "NA_FILA", confirmed_by: null, confirmed_at: nowIso, queue_entered_at: nowIso, updated_at: nowIso })
    .eq("id", orderId)
    .eq("status", "AGUARDANDO_PAGAMENTO");

  await supabaseAdmin.from("audit_logs").insert({
    action: "ORDER_AUTO_CONFIRMED",
    table_name: "orders",
    record_id: orderId,
    new_data: { reason: "payment_approved_online" },
  });
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

  try {
    await autoConfirmOnlinePaidOrder(supabaseAdmin, order.id);
  } catch (autoConfirmErr) {
    console.error("[create-mercado-pago-payment] autoConfirmOnlinePaidOrder failed:", autoConfirmErr);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    if (!isAllowedOrigin(req)) {
      return jsonResponse(req, { success: false, error: "Origem nao autorizada." }, 403);
    }

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
    const directPaymentMethod = cleanText(body.direct_payment_method, 40)?.toLowerCase() ?? null;
    const paymentMethodCode =
      cleanText(body.payment_method_code, 80) ??
      (directPaymentMethod === "pix" ? "PIX" : "MERCADO_PAGO_PAYMENT_BRICK");
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
    if (order.status !== "AGUARDANDO_PAGAMENTO" || order.payment_status !== "PENDING") {
      throw new Error("Pedido nao esta aguardando pagamento.");
    }
    if (Number(order.total_amount) <= 0) {
      throw new Error("Valor do pedido invalido para pagamento.");
    }

    const { data: existingTx } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .eq("order_id", orderId)
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
      cleanEmail(getNested(formData, ["payer", "email"])) ??
      cleanEmail(formData.email) ??
      cleanEmail(order.customer_email);

    if (!payerEmail) {
      const message = isPix
        ? "O Mercado Pago exige um e-mail valido para gerar Pix neste checkout."
        : "Informe um e-mail valido no pagamento.";
      throw new Error(message);
    }

    const externalReference = `${order.id}:${idempotencyKey}`;
    const notificationUrl = cleanText(Deno.env.get("MERCADO_PAGO_WEBHOOK_URL"), 500);
    const { firstName, lastName } = splitCustomerName(order.customer_name);
    const rawPhoneDigits = cleanText(order.customer_phone, 24)?.replace(/\D/g, "") ?? "";
    const customerPhoneDigits = rawPhoneDigits.startsWith("55") ? rawPhoneDigits.slice(2) : rawPhoneDigits;
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
    if ((customerPhoneDigits.length === 10 || customerPhoneDigits.length === 11)) {
      paymentPayload.payer.phone = {
        area_code: customerPhoneDigits.slice(0, 2),
        number: customerPhoneDigits.slice(2),
      };
    }

    if (notificationUrl && /^https:\/\//i.test(notificationUrl)) {
      paymentPayload.notification_url = notificationUrl;
    } else if (notificationUrl) {
      console.error("[create-mercado-pago-payment] Ignoring invalid Mercado Pago webhook URL", {
        order_id: order.id,
        external_reference: externalReference,
      });
    }
    if (isPix) {
      paymentPayload.date_of_expiration = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
    }
    if (formData.token) paymentPayload.token = String(formData.token);
    if (formData.installments) paymentPayload.installments = Math.max(1, Math.trunc(toNumber(formData.installments)));
    if (formData.issuer_id || formData.issuerId) paymentPayload.issuer_id = String(formData.issuer_id ?? formData.issuerId);

    const identificationType = cleanText(getNested(formData, ["payer", "identification", "type"]) ?? formData.identificationType, 20)?.toUpperCase() ?? null;
    const identificationNumber = cleanDigits(getNested(formData, ["payer", "identification", "number"]) ?? formData.identificationNumber, 20);
    if ((identificationType || identificationNumber) && (identificationType !== "CPF" || !isValidCpf(identificationNumber))) {
      throw new Error("Informe um CPF valido para gerar o Pix pelo Mercado Pago.");
    }
    if (identificationType && identificationNumber) {
      paymentPayload.payer.identification = {
        type: identificationType,
        number: identificationNumber,
      };
    }

    if (!order.customer_email && payerEmail) {
      await supabaseAdmin
        .from("orders")
        .update({ customer_email: payerEmail })
        .eq("id", order.id)
        .is("customer_email", null);
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

    const payment = await parseJsonResponse(mpResponse);
    if (!mpResponse.ok) {
      const safeError = safeProviderErrorMessage(payment);
      const providerCauses = sanitizeProviderCauses(payment?.cause);
      console.error("[create-mercado-pago-payment] Mercado Pago error", {
        status: mpResponse.status,
        message: payment?.message,
        error: payment?.error,
        cause: payment?.cause,
        order_id: order.id,
        external_reference: externalReference,
        sanitized_payload: sanitizePaymentPayload(paymentPayload),
      });
      await supabaseAdmin.from("audit_logs").insert({
        action: "PAYMENT_PROVIDER_CREATE_FAILED",
        table_name: "orders",
        record_id: order.id,
        new_data: {
          provider: "MERCADO_PAGO",
          provider_status: mpResponse.status,
          message: payment?.message ?? null,
          error: payment?.error ?? null,
          cause: providerCauses.length > 0 ? providerCauses : payment?.cause ?? null,
          payment_method_id: paymentMethodId,
        },
      });
      return jsonResponse(req, {
        success: false,
        error: safeError,
        debug_code: "MERCADO_PAGO_PAYMENT_REJECTED",
        provider_status: mpResponse.status,
        provider_message: payment?.message ?? payment?.error ?? null,
        provider_causes: providerCauses,
      }, 400);
    }

    const txPayload = mapTransactionPayload(payment);
    const walletType = WALLET_TYPE_BY_CODE[paymentMethodCode] ?? null;
    const { data: transaction, error: txErr } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        provider: "MERCADO_PAGO",
        external_reference: externalReference,
        idempotency_key: idempotencyKey,
        payment_method_code: paymentMethodCode,
        amount: order.total_amount,
        wallet_type: walletType,
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
