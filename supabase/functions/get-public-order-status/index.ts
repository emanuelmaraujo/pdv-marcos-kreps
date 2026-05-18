/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildProductionReceipt, resolveProductionSector } from "../_shared/print-format.ts";

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function settingBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return fallback;
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

async function autoConfirmOnlinePaidOrder(supabaseAdmin: any, orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, daily_number, status, type, customer_name, customer_phone, notes, total_amount, payment_status, payment_method")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "AGUARDANDO_PAGAMENTO") return;

  const { data: existingJobs } = await supabaseAdmin
    .from("printer_jobs")
    .select("sector")
    .eq("order_id", orderId);
  const existingSectors = new Set((existingJobs ?? []).map((job: any) => String(job.sector)));

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
    .in("key", ["printing_enabled", "print_kitchen_copy", "print_juice_potato_copy"]);

  const printingEnabled = settingBool(settings?.find((s: any) => s.key === "printing_enabled")?.value, true);
  const shouldPrintKitchen = printingEnabled && settingBool(settings?.find((s: any) => s.key === "print_kitchen_copy")?.value, true);
  const shouldPrintJuice = printingEnabled && settingBool(settings?.find((s: any) => s.key === "print_juice_potato_copy")?.value, true);
  const timestampNow = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const printerJobsToInsert: any[] = [];

  if (items.some((item: any) => resolveProductionSector(item) === "KITCHEN") && shouldPrintKitchen && !existingSectors.has("KITCHEN")) {
    printerJobsToInsert.push({
      order_id: orderId,
      sector: "KITCHEN",
      content: {
        text: buildProductionReceipt({ ...order, source: "APP" }, items, "KITCHEN", {
          timestamp: timestampNow,
          title: "KREPS",
          source: "PUBLIC",
        }),
      },
    });
  }

  if (items.some((item: any) => resolveProductionSector(item) === "JUICE_POTATO") && shouldPrintJuice && !existingSectors.has("JUICE_POTATO")) {
    printerJobsToInsert.push({
      order_id: orderId,
      sector: "JUICE_POTATO",
      content: {
        text: buildProductionReceipt({ ...order, source: "APP" }, items, "JUICE_POTATO", {
          timestamp: timestampNow,
          title: "COZINHA",
          source: "PUBLIC",
        }),
      },
    });
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
    new_data: { reason: "payment_approved_online_status_reconcile" },
  });
}

async function consolidateApprovedPayment(supabaseAdmin: any, order: any, payment: any, transactionId: string | null) {
  const internalMethod = inferInternalPaymentMethod(payment);
  if (internalMethod === "PENDING") throw new Error("Metodo aprovado nao mapeado.");

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
    const { data: payableItems, error: payableItemsErr } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("order_id", order.id)
      .neq("status", "CANCELLED");
    if (payableItemsErr) throw new Error("Erro ao carregar itens do pedido pago.");

    const orderItemIds = (payableItems ?? []).map((item: any) => item.id);
    if (orderItemIds.length > 0) {
      const { error: itemsPaymentErr } = await supabaseAdmin
        .from("order_items")
        .update({
          payment_status: "PAID",
          payment_method: internalMethod,
          paid_at: nowIso,
        })
        .in("id", orderItemIds);
      if (itemsPaymentErr) throw new Error("Erro ao marcar itens como pagos.");
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: internalMethod,
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", order.id);

    if (error) throw new Error("Erro ao atualizar pedido pago.");
  }

  const { data: existingPayment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("payment_status", "PAID")
    .maybeSingle();

  if (!existingPayment) {
    const { data: paymentItems } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("order_id", order.id)
      .neq("status", "CANCELLED");

    const { error } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        amount: order.total_amount,
        payment_method: internalMethod,
        payment_status: "PAID",
        notes: `Mercado Pago payment ${payment?.id ?? ""}`.trim(),
        order_item_ids: (paymentItems ?? []).map((item: any) => item.id),
      });

    if (error) throw new Error("Erro ao registrar pagamento consolidado.");
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
      reconciled_by: "get-public-order-status",
    },
  });

  await autoConfirmOnlinePaidOrder(supabaseAdmin, order.id);
}

async function refreshMercadoPagoTransaction(supabaseAdmin: any, order: any, transaction: any) {
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!accessToken || !transaction?.provider_payment_id || transaction.provider !== "MERCADO_PAGO") {
    return { order, transaction };
  }

  const providerStatus = String(transaction.provider_status ?? "").toLowerCase();
  if (!["pending", "in_process"].includes(providerStatus)) {
    return { order, transaction };
  }

  const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${transaction.provider_payment_id}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const payment = await parseJsonResponse(mpResponse);

  if (!mpResponse.ok) {
    console.error("[get-public-order-status] Mercado Pago refresh failed", {
      provider_payment_id: transaction.provider_payment_id,
      status: mpResponse.status,
      message: payment?.message,
      error: payment?.error,
    });
    return { order, transaction };
  }

  const { data: updatedTransaction, error: txErr } = await supabaseAdmin
    .from("payment_transactions")
    .update(mapTransactionPayload(payment))
    .eq("id", transaction.id)
    .select("id, provider, provider_status, provider_status_detail, internal_payment_method, qr_code, qr_code_base64, ticket_url, expires_at, provider_payment_id, updated_at")
    .single();

  if (txErr) throw new Error("Erro ao atualizar transacao.");

  if (payment.status === "approved" && order.payment_status !== "PAID") {
    await consolidateApprovedPayment(supabaseAdmin, order, payment, transaction.id);
    const { data: refreshedOrder } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, payment_status, payment_method, total_amount, customer_name, created_at, confirmed_at, ready_at, delivered_at")
      .eq("id", order.id)
      .single();
    return { order: refreshedOrder ?? order, transaction: updatedTransaction };
  }

  return { order, transaction: updatedTransaction };
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { success: false, error: 'Metodo nao permitido.' }, 405);
  }

  try {
    if (!isAllowedOrigin(req)) {
      return jsonResponse(req, { success: false, error: 'Origem nao autorizada.' }, 403);
    }

    // Usamos Service Role para ignorar RLS nas policies de read. O acesso publico
    // e autorizado apenas pelo public_token, que e um segredo longo e unico.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { public_token } = await req.json();

    if (!public_token || typeof public_token !== 'string') {
      throw new Error('Link de acompanhamento invalido.');
    }

    // Busca exata pelo token publico. Nao aceitar daily_number na URL evita
    // enumeracao visual de pedidos como /pedido/123.
    let { data: order, error } = await supabaseClient
      .from('orders')
      .select('id, daily_number, status, payment_status, payment_method, total_amount, customer_name, created_at, confirmed_at, ready_at, delivered_at')
      .eq('public_token', public_token)
      .single();

    // Se error for Not Found, ou order for null, a mensagem é genérica para não vazar info.
    if (error || !order) {
      throw new Error('Pedido não encontrado ou credenciais inválidas.');
    }

    let { data: transaction } = await supabaseClient
      .from('payment_transactions')
      .select('id, provider, provider_status, provider_status_detail, internal_payment_method, qr_code, qr_code_base64, ticket_url, expires_at, provider_payment_id, updated_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order.payment_status === "PENDING" && transaction) {
      const refreshed = await refreshMercadoPagoTransaction(supabaseClient, order, transaction);
      order = refreshed.order;
      transaction = refreshed.transaction;
    }

    // Busca pedido com branch para exibir o prefixo correto (P-042, F-012).
    const { data: orderWithBranch } = await supabaseClient
      .from('orders')
      .select('id, daily_number, status, payment_status, payment_method, total_amount, customer_name, created_at, confirmed_at, ready_at, delivered_at, branch:branches(code, name)')
      .eq('id', order.id)
      .single();

    const branch = (orderWithBranch as any)?.branch ?? null;

    const { data: items } = await supabaseClient
      .from('order_items')
      .select(`
        id,
        sequence_no,
        status,
        production_sector,
        payment_status,
        item_ready_at,
        delivered_at,
        product_name_snapshot,
        product_price_snapshot,
        quantity,
        observation,
        total_price,
        order_item_addons(addon_name_snapshot, quantity, addon_price_snapshot),
        order_item_removed_ingredients(ingredient_name_snapshot)
      `)
      .eq('order_id', order.id)
      .order('sequence_no', { ascending: true, nullsFirst: false });

    return jsonResponse(req, {
      success: true,
      order: {
        daily_number: order.daily_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total: order.total_amount,
        customer_name: order.customer_name,
        created_at: order.created_at,
        confirmed_at: order.confirmed_at,
        ready_at: order.ready_at,
        delivered_at: order.delivered_at,
        branch,
      },
      transaction,
      items: (items ?? []).map((item: any) => ({
        // item.id (UUID interno) não é exposto ao público — desnecessário para o cliente
        // e reduz superfície de ataque caso a validação server-side mude no futuro.
        sequence_no: item.sequence_no,
        status: item.status,
        production_sector: item.production_sector,
        payment_status: item.payment_status,
        item_ready_at: item.item_ready_at,
        delivered_at: item.delivered_at,
        product_name: item.product_name_snapshot,
        product_price: item.product_price_snapshot,
        quantity: item.quantity,
        observation: item.observation,
        total_price: item.total_price,
        addons: (item.order_item_addons ?? []).map((addon: any) => ({
          name: addon.addon_name_snapshot,
          quantity: addon.quantity,
          price: addon.addon_price_snapshot,
        })),
        removed_ingredients: (item.order_item_removed_ingredients ?? []).map((removed: any) => removed.ingredient_name_snapshot),
      })),
    }, 200);

  } catch (error: any) {
    return jsonResponse(req, { success: false, error: error.message }, 400);
  }
});
