/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveProductionSector } from "../_shared/print-format.ts";

type JsonRecord = Record<string, unknown>;

const DEFAULT_PAYMENT_METHOD_CODE = "MERCADO_PAGO_PAYMENT_BRICK";
const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const ORDERING_TIME_ZONE = "America/Sao_Paulo";

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

function normalizeBrazilPhone(value: unknown) {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return `+55${digits}`;
}

function toNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function settingBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.replace(/^"|"$/g, "").toLowerCase() === "true";
  return fallback;
}

function settingNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/^"|"$/g, "").replace(",", ".")) || 0;
  return 0;
}

function settingString(value: unknown, fallback: string) {
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseTimeToMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getSaoPauloMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: ORDERING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hours * 60 + minutes;
}

function isWithinOrderingWindow(startTime: unknown, endTime: unknown) {
  const start = parseTimeToMinutes(startTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_START)!;
  const end = parseTimeToMinutes(endTime) ?? parseTimeToMinutes(DEFAULT_ORDERING_END)!;
  const now = getSaoPauloMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function logDbError(context: string, error: any) {
  console.error(`[create-public-order] ${context}`, {
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    code: error?.code ?? null,
  });
}

async function registerCustomer(supabaseAdmin: any, payload: {
  customerPhone: string | null;
  customerName: string | null;
  customerEmail: string | null;
  orderType: "BALCAO" | "VIAGEM";
  marketingOptIn: boolean;
  rememberCheckoutData: boolean;
  nowIso: string;
}) {
  const {
    customerPhone,
    customerName,
    customerEmail,
    orderType,
    marketingOptIn,
    rememberCheckoutData,
    nowIso,
  } = payload;

  if (!customerPhone) return null;

  const { data: existingCustomer, error: existingCustomerErr } = await supabaseAdmin
    .from("customers")
    .select("orders_count, marketing_opt_in, marketing_opt_in_at")
    .eq("id", customerPhone)
    .maybeSingle();

  if (existingCustomerErr) {
    logDbError("customer lookup failed", existingCustomerErr);
  }

  const baseCustomer = {
    id: customerPhone,
    phone_e164: customerPhone,
    name: customerName || "Cliente",
    last_seen_at: nowIso,
    last_order_at: nowIso,
    orders_count: Number(existingCustomer?.orders_count ?? 0) + 1,
    marketing_opt_in: marketingOptIn || existingCustomer?.marketing_opt_in === true,
    marketing_opt_in_at: existingCustomer?.marketing_opt_in_at ?? (marketingOptIn ? nowIso : null),
    source: "APP",
  };

  const { error: customerErr } = await supabaseAdmin
    .from("customers")
    .upsert({
      ...baseCustomer,
      email: rememberCheckoutData ? customerEmail : null,
      last_order_type: rememberCheckoutData ? orderType : null,
      remember_checkout_data: rememberCheckoutData,
      checkout_profile_updated_at: rememberCheckoutData ? nowIso : null,
    }, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

  if (!customerErr) return customerPhone;

  logDbError("customer profile upsert failed", customerErr);

  const { error: fallbackErr } = await supabaseAdmin
    .from("customers")
    .upsert(baseCustomer, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

  if (!fallbackErr) return customerPhone;

  logDbError("customer fallback upsert failed", fallbackErr);
  return null;
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

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error("Content-Type deve ser application/json.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const customerName = cleanText(body.customer_name, 80);
    const customerPhone = normalizeBrazilPhone(body.customer_phone);
    const customerEmail = cleanEmail(body.customer_email);
    const marketingOptIn = body.marketing_opt_in === true;
    const rememberCheckoutData = body.remember_checkout_data === true;
    const notes = cleanText(body.notes, 500);
    const orderType = body.order_type;
    const paymentMethodCode = cleanText(body.payment_method_code, 80) ?? DEFAULT_PAYMENT_METHOD_CODE;
    const branchSlug = cleanText(body.branch_slug, 32);

    if (items.length === 0) throw new Error("Carrinho vazio.");
    if (items.length > 50) throw new Error("Carrinho excede o limite de itens.");
    if (body.customer_phone && !customerPhone) throw new Error("Informe um WhatsApp valido com DDD.");
    if (orderType !== "BALCAO" && orderType !== "VIAGEM") {
      throw new Error("Tipo de pedido invalido.");
    }

    // Resolve filial:
    // - Com slug: caminho normal (/pedir/{slug})
    // - Sem slug + 1 filial ativa: usa ela (deployment de filial única)
    // - Sem slug + 2+ filiais ativas: erro claro pedindo escolha
    let branch: {
      id: string;
      code: string;
      name: string;
      active: boolean;
      packing_fee: number | null;
      ordering_enabled: boolean;
      ordering_start_time: string | null;
      ordering_end_time: string | null;
    } | null = null;

    if (branchSlug) {
      const { data, error: branchErr } = await supabaseAdmin
        .from("branches")
        .select("id, code, name, active, packing_fee, ordering_enabled, ordering_start_time, ordering_end_time")
        .eq("slug", branchSlug)
        .single();
      if (branchErr || !data) throw new Error("Filial inexistente.");
      branch = data;
    } else {
      const { data: activeBranches } = await supabaseAdmin
        .from("branches")
        .select("id, code, name, active, packing_fee, ordering_enabled, ordering_start_time, ordering_end_time")
        .eq("active", true)
        .eq("ordering_enabled", true)
        .limit(2);

      if (!activeBranches || activeBranches.length === 0) {
        throw new Error("Nenhuma filial disponível para pedidos.");
      }
      if (activeBranches.length > 1) {
        throw new Error("Escolha uma filial para continuar.");
      }
      branch = activeBranches[0];
    }

    if (!branch) throw new Error("Filial inexistente.");
    if (!branch.active || !branch.ordering_enabled) {
      return jsonResponse(req, {
        success: false,
        error: "No momento essa unidade não está recebendo pedidos.",
        ordering_disabled: true,
      }, 403);
    }

    const { data: methodConfig, error: methodErr } = await supabaseAdmin
      .from("payment_method_configs")
      .select("code, provider, enabled")
      .eq("code", paymentMethodCode)
      .single();

    if (methodErr || !methodConfig || !methodConfig.enabled) {
      throw new Error("Metodo de pagamento indisponivel.");
    }
    if (methodConfig.provider !== "MERCADO_PAGO") {
      throw new Error("Metodo ainda nao habilitado para checkout online.");
    }

    const productIds = uniq(items.map((item: any) => String(item.product_id ?? "")));
    if (productIds.length === 0) throw new Error("Carrinho sem produtos validos.");

    const { data: settingsData, error: settingsErr } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .in("key", [
        "public_ordering_enabled",
        "public_ordering_start_time",
        "public_ordering_end_time",
        "packaging_fee",
        "apply_packaging_fee_for_takeout",
      ]);

    if (settingsErr) throw new Error("Erro ao buscar configuracoes.");

    const publicOrderingEnabled = settingBool(
      settingsData?.find((s) => s.key === "public_ordering_enabled")?.value,
      true,
    );
    if (!publicOrderingEnabled) {
      return jsonResponse(req, {
        success: false,
        error: "No momento nao estamos recebendo pedidos.",
        ordering_disabled: true,
      }, 403);
    }

    // Horários por filial sobrescrevem o global (se nulo, cai no global).
    const orderingStart = branch.ordering_start_time ?? settingString(
      settingsData?.find((s) => s.key === "public_ordering_start_time")?.value,
      DEFAULT_ORDERING_START,
    );
    const orderingEnd = branch.ordering_end_time ?? settingString(
      settingsData?.find((s) => s.key === "public_ordering_end_time")?.value,
      DEFAULT_ORDERING_END,
    );
    if (!isWithinOrderingWindow(orderingStart, orderingEnd)) {
      return jsonResponse(req, {
        success: false,
        error: `No momento nao estamos recebendo pedidos. Atendimento online das ${orderingStart} as ${orderingEnd}.`,
        ordering_closed: true,
      }, 403);
    }

    let packingFeeValue = 0;
    if (orderType === "VIAGEM") {
      const applyFee = settingBool(settingsData?.find((s) => s.key === "apply_packaging_fee_for_takeout")?.value);
      if (applyFee) {
        // Filial pode ter taxa própria (>0 sobrescreve o global).
        const branchFee = Number(branch.packing_fee ?? 0);
        packingFeeValue = branchFee > 0
          ? branchFee
          : settingNumber(settingsData?.find((s) => s.key === "packaging_fee")?.value);
      }
    }

    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, sector, active, branch_id, category:categories(name), product_ingredients(ingredient_id)")
      .in("id", productIds)
      .eq("branch_id", branch.id);

    if (prodErr) throw new Error("Erro ao buscar produtos.");

    const { data: productAddons, error: paErr } = await supabaseAdmin
      .from("product_addons")
      .select("product_id, addon_id")
      .in("product_id", productIds);

    if (paErr) throw new Error("Erro ao buscar adicionais permitidos.");

    const addonIds = uniq(items.flatMap((item: any) => (item.addons || []).map((addon: any) => String(addon.addon_id ?? ""))));
    const { data: addons, error: addonErr } = addonIds.length > 0
      ? await supabaseAdmin.from("addons").select("id, name, price, active").in("id", addonIds)
      : { data: [], error: null };

    if (addonErr) throw new Error("Erro ao buscar adicionais.");

    const removedIngredientIds = uniq(items.flatMap((item: any) => item.removed_ingredient_ids || []));
    const { data: ingredients, error: ingErr } = removedIngredientIds.length > 0
      ? await supabaseAdmin.from("ingredients").select("id, name, active").in("id", removedIngredientIds)
      : { data: [], error: null };

    if (ingErr) throw new Error("Erro ao buscar ingredientes.");

    let productsSubtotal = 0;
    let addonsTotal = 0;

    for (const item of items) {
      const productId = String(item.product_id ?? "");
      const product = products?.find((p: any) => p.id === productId);
      if (!product) throw new Error("Produto inexistente.");
      if (!product.active) throw new Error(`Produto indisponivel: ${product.name}`);

      const quantity = Math.trunc(toNumber(item.quantity));
      if (quantity < 1 || quantity > 99) {
        throw new Error(`Quantidade invalida para ${product.name}.`);
      }

      productsSubtotal += toNumber(product.price) * quantity;

      const productIngredientIds = (product.product_ingredients || []).map((pi: any) => pi.ingredient_id);
      for (const removedId of item.removed_ingredient_ids || []) {
        const ingredient = ingredients?.find((ing: any) => ing.id === removedId);
        if (!ingredient || !ingredient.active) throw new Error("Ingrediente removido invalido.");
        if (!productIngredientIds.includes(removedId)) {
          throw new Error(`Ingrediente removido invalido para ${product.name}.`);
        }
      }

      for (const itemAddon of item.addons || []) {
        const addonId = String(itemAddon.addon_id ?? "");
        const addon = addons?.find((candidate: any) => candidate.id === addonId);
        if (!addon) throw new Error("Adicional inexistente.");
        if (!addon.active) throw new Error(`Adicional indisponivel: ${addon.name}`);

        const isAllowed = productAddons?.some((pa: any) => pa.product_id === product.id && pa.addon_id === addonId);
        if (!isAllowed) throw new Error(`Adicional nao permitido para ${product.name}.`);

        const addonQuantity = Math.trunc(toNumber(itemAddon.quantity || 1));
        if (addonQuantity < 1 || addonQuantity > 20) throw new Error(`Quantidade invalida para adicional ${addon.name}.`);
        addonsTotal += toNumber(addon.price) * addonQuantity * quantity;
      }
    }

    const totalAmount = Number((productsSubtotal + addonsTotal + packingFeeValue).toFixed(2));
    const nowIso = new Date().toISOString();
    const customerId = await registerCustomer(supabaseAdmin, {
      customerPhone,
      customerName,
      customerEmail,
      orderType,
      marketingOptIn,
      rememberCheckoutData,
      nowIso,
    });

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        branch_id: branch.id,
        type: orderType,
        source: "APP",
        status: "AGUARDANDO_PAGAMENTO",
        payment_status: "PENDING",
        payment_method: "PENDING",
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_id: customerId,
        packing_fee: packingFeeValue,
        total_amount: totalAmount,
        notes,
      })
      .select("id, daily_number, public_token, total_amount, status, payment_status")
      .single();

    if (orderErr) throw new Error("Erro ao criar pedido.");

    for (const item of items) {
      const product = products?.find((p: any) => p.id === item.product_id);
      const quantity = Math.trunc(toNumber(item.quantity));
      let itemTotalPrice = toNumber(product.price) * quantity;

      for (const itemAddon of item.addons || []) {
        const addon = addons?.find((candidate: any) => candidate.id === itemAddon.addon_id);
        itemTotalPrice += toNumber(addon.price) * Math.trunc(toNumber(itemAddon.quantity || 1)) * quantity;
      }

      const { data: orderItem, error: itemErr } = await supabaseAdmin
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: product.id,
          product_name_snapshot: product.name,
          product_price_snapshot: product.price,
          production_sector: resolveProductionSector(product),
          quantity,
          observation: cleanText(item.notes, 300),
          total_price: Number(itemTotalPrice.toFixed(2)),
        })
        .select("id")
        .single();

      if (itemErr) throw new Error("Erro ao inserir item do pedido.");

      if (Array.isArray(item.removed_ingredient_ids) && item.removed_ingredient_ids.length > 0) {
        const removedRows = item.removed_ingredient_ids.map((removedId: string) => {
          const ingredient = ingredients?.find((candidate: any) => candidate.id === removedId);
          return {
            order_item_id: orderItem.id,
            ingredient_id: removedId,
            ingredient_name_snapshot: ingredient.name,
          };
        });
        const { error } = await supabaseAdmin.from("order_item_removed_ingredients").insert(removedRows);
        if (error) throw new Error("Erro ao inserir ingredientes removidos.");
      }

      if (Array.isArray(item.addons) && item.addons.length > 0) {
        const addonRows = item.addons.map((itemAddon: any) => {
          const addon = addons?.find((candidate: any) => candidate.id === itemAddon.addon_id);
          return {
            order_item_id: orderItem.id,
            addon_id: addon.id,
            quantity: Math.trunc(toNumber(itemAddon.quantity || 1)),
            addon_name_snapshot: addon.name,
            addon_price_snapshot: addon.price,
          };
        });
        const { error } = await supabaseAdmin.from("order_item_addons").insert(addonRows);
        if (error) throw new Error("Erro ao inserir adicionais do item.");
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      action: "PUBLIC_ORDER_CREATED_AWAITING_PAYMENT",
      table_name: "orders",
      record_id: order.id,
      new_data: {
        daily_number: order.daily_number,
        total_amount: order.total_amount,
        payment_method_code: paymentMethodCode,
        source: "APP",
      },
    });

    return jsonResponse(req, {
      success: true,
      order: {
        order_id: order.id,
        daily_number: order.daily_number,
        public_token: order.public_token,
        total_amount: Number(order.total_amount),
        status: order.status,
        payment_status: order.payment_status,
        payment_method_code: paymentMethodCode,
      },
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
