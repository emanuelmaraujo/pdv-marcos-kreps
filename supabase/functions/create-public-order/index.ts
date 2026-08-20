/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveProductionSector } from "../_shared/print-format.ts";
import { resolveDeliveryFee } from "../_shared/delivery.ts";
import { fetchCepAddress } from "../_shared/cep.ts";
import { isAllowedOrigin, publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

type JsonRecord = Record<string, unknown>;

const DEFAULT_PAYMENT_METHOD_CODE = "MERCADO_PAGO_PAYMENT_BRICK";
const DEFAULT_ORDERING_START = "17:00";
const DEFAULT_ORDERING_END = "23:30";
const ORDERING_TIME_ZONE = "America/Sao_Paulo";

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req, { extraHeaders: "x-idempotency-key" });
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
  orderType: "BALCAO" | "VIAGEM" | "ENTREGA";
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
    const isDelivery = orderType === "ENTREGA";
    const saveAddress = body.save_address === true;

    if (items.length === 0) throw new Error("Carrinho vazio.");
    if (items.length > 50) throw new Error("Carrinho excede o limite de itens.");
    if (body.customer_phone && !customerPhone) throw new Error("Informe um WhatsApp valido com DDD.");
    if (orderType !== "BALCAO" && orderType !== "VIAGEM" && orderType !== "ENTREGA") {
      throw new Error("Tipo de pedido invalido.");
    }
    if (isDelivery && !customerPhone) {
      throw new Error("Informe um WhatsApp valido com DDD para pedidos de entrega.");
    }

    // Rate limit: sem isso, um script pode floodar a fila (e a impressora da
    // cozinha, uma vez pago) com pedidos falsos. Por IP sempre; por telefone
    // quando informado (BALCAO/VIAGEM podem não ter telefone).
    const clientIp = getClientIp(req);
    const rateLimitChecks = [checkRateLimit(supabaseAdmin, `order-ip:${clientIp}`, 10, 15 * 60)];
    if (customerPhone) {
      rateLimitChecks.push(checkRateLimit(supabaseAdmin, `order-phone:${customerPhone}`, 5, 15 * 60));
    }
    const rateLimitResults = await Promise.all(rateLimitChecks);
    if (rateLimitResults.some((ok) => !ok)) {
      await supabaseAdmin.from("audit_logs").insert({
        action: "ORDER_CREATE_RATE_LIMITED",
        table_name: "orders",
        new_data: { phone: customerPhone, ip: clientIp },
      });
      return jsonResponse(req, {
        success: false,
        error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.",
      }, 429);
    }

    // Endereço de entrega: obrigatório (rua + bairro) quando order_type = ENTREGA.
    // Aceita endereço digitado no formulário (delivery_address) ou o id de um
    // endereço salvo do cliente (delivery_address_id) — resolvido mais abaixo,
    // depois de sabermos a filial (o endereço salvo não carrega o bairro/filial
    // sozinho, então revalidamos e recalculamos a taxa nos dois casos do mesmo jeito).
    const deliveryAddrInput = (body.delivery_address && typeof body.delivery_address === "object")
      ? body.delivery_address
      : {};
    const deliveryAddressId = cleanText(body.delivery_address_id, 64);
    let deliveryStreet = isDelivery ? cleanText(deliveryAddrInput.street, 200) : null;
    let deliveryNumber = isDelivery ? cleanText(deliveryAddrInput.number, 20) : null;
    let deliveryComplement = isDelivery ? cleanText(deliveryAddrInput.complement, 120) : null;
    let deliveryNeighborhood = isDelivery ? cleanText(deliveryAddrInput.neighborhood, 120) : null;
    let deliveryCity = isDelivery ? cleanText(deliveryAddrInput.city, 120) : null;
    let deliveryState = isDelivery ? cleanText(deliveryAddrInput.state, 2) : null;
    let deliveryPostalCode = isDelivery ? cleanText(deliveryAddrInput.postal_code, 16) : null;
    let deliveryReference = isDelivery ? cleanText(deliveryAddrInput.reference, 200) : null;

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
      delivery_enabled: boolean;
    } | null = null;

    const BRANCH_SELECT = "id, code, name, active, packing_fee, ordering_enabled, ordering_start_time, ordering_end_time, delivery_enabled";

    if (branchSlug) {
      const { data, error: branchErr } = await supabaseAdmin
        .from("branches")
        .select(BRANCH_SELECT)
        .eq("slug", branchSlug)
        .single();
      if (branchErr || !data) throw new Error("Filial inexistente.");
      branch = data;
    } else {
      const { data: activeBranches } = await supabaseAdmin
        .from("branches")
        .select(BRANCH_SELECT)
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

    // Endereço de entrega: resolve endereço salvo (se veio delivery_address_id)
    // ou usa o digitado no formulário. Em ambos os casos revalida rua+bairro e
    // recalcula a taxa no servidor — nunca confia em taxa vinda do cliente.
    let deliveryFeeValue = 0;
    if (isDelivery) {
      if (!branch.delivery_enabled) {
        throw new Error("Entrega não está disponível para esta unidade no momento.");
      }

      if (deliveryAddressId) {
        const { data: savedAddress, error: savedAddressErr } = await supabaseAdmin
          .from("customer_addresses")
          .select("street, number, complement, neighborhood, city, state, postal_code, reference")
          .eq("id", deliveryAddressId)
          .eq("customer_id", customerPhone)
          .maybeSingle();
        if (savedAddressErr || !savedAddress) {
          throw new Error("Endereço salvo não encontrado.");
        }
        deliveryStreet = savedAddress.street;
        deliveryNumber = savedAddress.number;
        deliveryComplement = savedAddress.complement;
        deliveryNeighborhood = savedAddress.neighborhood;
        deliveryCity = savedAddress.city;
        deliveryState = savedAddress.state;
        deliveryPostalCode = savedAddress.postal_code;
        deliveryReference = savedAddress.reference;
      }

      if (!deliveryStreet || !deliveryNeighborhood) {
        throw new Error("Endereço de entrega incompleto: informe ao menos rua e bairro.");
      }

      // Endereço digitado agora (não veio de um salvo): CEP é obrigatório e o
      // bairro/cidade/UF usados daqui pra frente vêm da consulta ao ViaCEP, não
      // do que o cliente digitou — fecha a brecha de digitar um bairro atendido
      // pra escapar do bloqueio de zona. Endereço salvo já foi validado quando
      // criado, não revalida de novo aqui.
      if (!deliveryAddressId) {
        if (!deliveryPostalCode) {
          throw new Error("Informe o CEP para calcular a entrega.");
        }
        const cepAddress = await fetchCepAddress(deliveryPostalCode);
        if (!cepAddress) {
          throw new Error("CEP não encontrado. Verifique o número informado.");
        }
        deliveryNeighborhood = cepAddress.neighborhood;
        deliveryCity = cepAddress.city || deliveryCity;
        deliveryState = cepAddress.state || deliveryState;
      }

      const feeResult = await resolveDeliveryFee(supabaseAdmin, branch.id, deliveryNeighborhood);
      if (feeResult.blocked) throw new Error(feeResult.reason);
      deliveryFeeValue = feeResult.fee;
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
      .select("id, name, price, cost_price, sector, active, branch_id, category:categories(name), product_ingredients(ingredient_id)")
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

    const totalAmount = Number((productsSubtotal + addonsTotal + packingFeeValue + deliveryFeeValue).toFixed(2));
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

    // Monta o payload já validado/precificado e delega a escrita atômica
    // (pedido + itens + addons + ingredientes removidos + auditoria) pra RPC —
    // ver supabase/migrations/20260817080000_create_public_order_transactional.sql.
    const orderPayload = {
      branch_id: branch.id,
      order_type: orderType,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_id: customerId,
      packing_fee: packingFeeValue,
      delivery_fee: deliveryFeeValue,
      delivery: isDelivery ? {
        street: deliveryStreet,
        number: deliveryNumber,
        complement: deliveryComplement,
        neighborhood: deliveryNeighborhood,
        city: deliveryCity,
        state: deliveryState,
        postal_code: deliveryPostalCode,
        reference: deliveryReference,
      } : null,
      total_amount: totalAmount,
      notes,
      payment_method_code: paymentMethodCode,
      items: items.map((item: any) => {
        const product = products?.find((p: any) => p.id === item.product_id);
        const quantity = Math.trunc(toNumber(item.quantity));
        let itemTotalPrice = toNumber(product.price) * quantity;

        const addonRows = (item.addons || []).map((itemAddon: any) => {
          const addon = addons?.find((candidate: any) => candidate.id === itemAddon.addon_id);
          const addonQuantity = Math.trunc(toNumber(itemAddon.quantity || 1));
          itemTotalPrice += toNumber(addon.price) * addonQuantity * quantity;
          return {
            addon_id: addon.id,
            quantity: addonQuantity,
            addon_name_snapshot: addon.name,
            addon_price_snapshot: addon.price,
          };
        });

        const removedRows = (item.removed_ingredient_ids || []).map((removedId: string) => {
          const ingredient = ingredients?.find((candidate: any) => candidate.id === removedId);
          return { ingredient_id: removedId, ingredient_name_snapshot: ingredient.name };
        });

        return {
          product_id: product.id,
          product_name_snapshot: product.name,
          product_price_snapshot: product.price,
          cost_price_snapshot: product.cost_price ?? 0,
          production_sector: resolveProductionSector(product),
          quantity,
          observation: cleanText(item.notes, 300),
          total_price: Number(itemTotalPrice.toFixed(2)),
          removed_ingredients: removedRows,
          addons: addonRows,
        };
      }),
    };

    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      "create_public_order_transactional",
      { p_payload: orderPayload },
    );
    if (rpcErr) throw new Error("Erro ao criar pedido.");

    // Salva o endereço digitado como novo endereço reutilizável do cliente,
    // só quando ele marcou explicitamente a opção — nunca por padrão. Endereço
    // já selecionado a partir de um salvo (delivery_address_id) não é duplicado.
    // Non-blocking: não afeta o pedido, que já foi criado com sucesso acima.
    if (isDelivery && saveAddress && !deliveryAddressId && customerId) {
      const { error: addressErr } = await supabaseAdmin.from("customer_addresses").insert({
        customer_id: customerId,
        street: deliveryStreet,
        number: deliveryNumber,
        complement: deliveryComplement,
        neighborhood: deliveryNeighborhood,
        city: deliveryCity,
        state: deliveryState,
        postal_code: deliveryPostalCode,
        reference: deliveryReference,
      });
      if (addressErr) {
        logDbError("save customer address failed (non-blocking)", addressErr);
      }
    }

    return jsonResponse(req, {
      success: true,
      order: {
        order_id: rpcResult.order_id,
        daily_number: rpcResult.daily_number,
        public_token: rpcResult.public_token,
        total_amount: Number(rpcResult.total_amount),
        status: rpcResult.status,
        payment_status: rpcResult.payment_status,
        payment_method_code: paymentMethodCode,
        delivery_fee: isDelivery ? deliveryFeeValue : undefined,
      },
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
