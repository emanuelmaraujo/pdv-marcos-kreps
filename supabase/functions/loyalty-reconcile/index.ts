/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-reconcile (cron horário)
//
// Varre pedidos PAID das últimas 48h cujo customer_id não tem EARN registrado
// e re-tenta o accrual. Cobre falhas transitórias do fire-and-forget em
// mark-payment/confirm-order.
//
// Auth: x-cron-secret = LOYALTY_CRON_SECRET ou Bearer JWT de ADMIN.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { fireLoyaltyAccrue } from "../_shared/loyalty-accrue-fire.ts";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

const LOOKBACK_HOURS = 48;
const BATCH_LIMIT = 200;

function jsonError(req: Request, msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...publicCorsHeaders(req, { extraHeaders: "x-cron-secret" }), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: publicCorsHeaders(req, { extraHeaders: "x-cron-secret" }) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const cron = req.headers.get("x-cron-secret");
    const expected = Deno.env.get("LOYALTY_CRON_SECRET") ?? "";
    if (!cron || cron !== expected) {
      const auth = req.headers.get("Authorization");
      if (!auth) return jsonError(req, "Não autorizado.", 401);
      const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace("Bearer ", ""));
      if (!user) return jsonError(req, "Token inválido.", 401);
      const { data: profile } = await supabaseAdmin.from("profiles").select("role, active").eq("id", user.id).single();
      if (!profile?.active || profile.role !== "ADMIN") return jsonError(req, "Apenas ADMIN.", 403);
    }

    const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    // Pedidos PAID com customer_id dentro da janela
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, paid_at, created_at")
      .eq("payment_status", "PAID")
      .not("customer_id", "is", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(BATCH_LIMIT);

    if (!orders?.length) {
      return new Response(JSON.stringify({ ok: true, scanned: 0, fired: 0 }), {
        headers: { ...publicCorsHeaders(req, { extraHeaders: "x-cron-secret" }), "Content-Type": "application/json" },
      });
    }

    // EARN existentes para esses pedidos
    const orderIds = orders.map((o: any) => o.id);
    const { data: earns } = await supabaseAdmin.from("loyalty_transactions").select("order_id").eq("kind", "EARN").in("order_id", orderIds);
    const haveEarn = new Set((earns ?? []).map((e: any) => e.order_id));
    const missing = orders.filter((o: any) => !haveEarn.has(o.id));

    let fired = 0;
    for (const o of missing) {
      // sequencial — fire-and-forget é leve, mas mantemos previsível
      await fireLoyaltyAccrue(o.id);
      fired++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: orders.length, missing: missing.length, fired }), {
      headers: { ...publicCorsHeaders(req, { extraHeaders: "x-cron-secret" }), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[loyalty-reconcile] failed", err?.message);
    return jsonError(req, err?.message ?? "Erro desconhecido", 500);
  }
});
