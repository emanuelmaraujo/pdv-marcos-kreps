import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Metodo nao permitido." }, 405);
  }

  try {
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
    const customerPhone = cleanText(body.customer_phone, 24);
    const customerEmail = cleanEmail(body.customer_email);
    const notes = cleanText(body.notes, 500);
    const orderType = body.order_type;
    const paymentMethodCode = cleanText(body.payment_method_code, 80) ?? DEFAULT_PAYMENT_METHOD_CODE;

    if (items.length === 0) throw new Error("Carrinho vazio.");
    if (items.length > 50) throw new Error("Carrinho excede o limite de itens.");
    if (orderType !== "BALCAO" && orderType !== "VIAGEM") {
      throw new Error("Tipo de pedido invalido.");
    }
    if (customerPhone && customerPhone.replace(/\D/g, "").length < 8) {
      throw new Error("Telefone invalido.");
    }

    const { data: methodConfig, error: methodErr } = await supabaseAdmin
      .from("payment_method_configs")
      .select("code, provider, enabled, requires_email")
      .eq("code", paymentMethodCode)
      .single();

    if (methodErr || !methodConfig || !methodConfig.enabled) {
      throw new Error("Metodo de pagamento indisponivel.");
    }
    if (methodConfig.provider !== "MERCADO_PAGO") {
      throw new Error("Metodo ainda nao habilitado para checkout online.");
    }
    if (methodConfig.requires_email && !customerEmail) {
      throw new Error("Informe um e-mail valido para continuar com o pagamento.");
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

    const orderingStart = settingString(
      settingsData?.find((s) => s.key === "public_ordering_start_time")?.value,
      DEFAULT_ORDERING_START,
    );
    const orderingEnd = settingString(
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
        packingFeeValue = settingNumber(settingsData?.find((s) => s.key === "packaging_fee")?.value);
      }
    }

    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, sector, active, product_ingredients(ingredient_id)")
      .in("id", productIds);

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

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        type: orderType,
        source: "APP",
        status: "AGUARDANDO_PAGAMENTO",
        payment_status: "PENDING",
        payment_method: "PENDING",
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
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
          production_sector: product.sector,
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
