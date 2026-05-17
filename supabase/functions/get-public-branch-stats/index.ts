// Edge function: get-public-branch-stats
// Retorna métricas públicas de social proof para o /pedir:
// - orders_today: número de pedidos completados hoje (não cancelados/expirados)
// - top_product_by_category: id do produto mais vendido por categoria (últimos 30 dias)
//
// Não exige auth — é dado agregado, não exposto granular.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((v) => v.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    // Cache de 60s — métricas não precisam ser instantâneas
    "Cache-Control": "public, max-age=60",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Resolve branch (opcional)
    let branchSlug: string | null = null;
    if (req.method === "GET") {
      branchSlug = new URL(req.url).searchParams.get("branch");
    } else {
      try {
        const body = await req.json();
        branchSlug = typeof body?.branch_slug === "string" ? body.branch_slug : null;
      } catch { /* sem body, ok */ }
    }

    let branchId: string | null = null;
    if (branchSlug) {
      const { data } = await supabaseAdmin
        .from("branches")
        .select("id")
        .eq("slug", branchSlug)
        .maybeSingle();
      branchId = data?.id ?? null;
    }

    // ── orders_today: pedidos não cancelados criados hoje (BR timezone)
    // Usamos um corte simples: created_at >= início do dia (UTC) → cobre o dia
    // operacional para a maior parte dos negócios. Negócios que abrem após a meia-
    // noite verão o counter zerar à meia-noite UTC — aceitável para social proof.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let ordersQuery = supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString())
      .not("status", "in", "(CANCELADO,EXPIRADO)");
    if (branchId) ordersQuery = ordersQuery.eq("branch_id", branchId);

    const { count: ordersToday } = await ordersQuery;

    // ── top_product_by_category: para cada categoria, o produto mais pedido
    // nos últimos 30 dias. Usado para o badge "Mais pedido" no card.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let itemsQuery = supabaseAdmin
      .from("order_items")
      .select("product_id, quantity, product:products(category_id)")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .neq("status", "CANCELLED");
    if (branchId) {
      // Filtra por filial via join — pega só itens cujo pedido é da filial
      const { data: branchOrderIds } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("branch_id", branchId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .limit(5000);
      const ids = (branchOrderIds ?? []).map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        itemsQuery = itemsQuery.in("order_id", ids);
      } else {
        // Nenhum pedido recente nessa filial — pula o top
        return jsonResponse(req, {
          success: true,
          orders_today: ordersToday ?? 0,
          top_product_by_category: {},
        });
      }
    }

    const { data: items } = await itemsQuery;

    // Agrupa: { [category_id]: { [product_id]: total_qty } }
    const byCategory: Record<string, Record<string, number>> = {};
    for (const item of (items ?? []) as Array<{
      product_id: string;
      quantity: number;
      product: { category_id: string } | { category_id: string }[] | null;
    }>) {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      const categoryId = product?.category_id;
      if (!categoryId || !item.product_id) continue;
      if (!byCategory[categoryId]) byCategory[categoryId] = {};
      byCategory[categoryId][item.product_id] = (byCategory[categoryId][item.product_id] ?? 0) + (item.quantity ?? 1);
    }

    const topProductByCategory: Record<string, string> = {};
    for (const [catId, products] of Object.entries(byCategory)) {
      let topId = "";
      let topQty = -1;
      for (const [pid, qty] of Object.entries(products)) {
        if (qty > topQty) {
          topQty = qty;
          topId = pid;
        }
      }
      if (topId) topProductByCategory[catId] = topId;
    }

    return jsonResponse(req, {
      success: true,
      orders_today: ordersToday ?? 0,
      top_product_by_category: topProductByCategory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar estatísticas.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
