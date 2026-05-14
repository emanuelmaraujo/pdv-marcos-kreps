/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    const secret = Deno.env.get("PENDING_ORDER_EXPIRATION_SECRET");
    if (!secret) {
      return jsonResponse({ success: false, error: "missing_expiration_secret" }, 503);
    }

    const receivedSecret = req.headers.get("x-expiration-secret");
    if (receivedSecret !== secret) {
      return jsonResponse({ success: false, error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const minutes = Math.max(10, Math.min(240, Math.trunc(toNumber(body.minutes, 20))));
    const cutoffIso = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: candidates, error: candidatesErr } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        daily_number,
        created_at,
        payment_status,
        status,
        payment_transactions (
          provider_status,
          expires_at,
          created_at
        )
      `)
      .eq("source", "APP")
      .eq("status", "AGUARDANDO_PAGAMENTO")
      .eq("payment_status", "PENDING")
      .lt("created_at", cutoffIso)
      .limit(100);

    if (candidatesErr) throw new Error("Erro ao buscar pedidos pendentes.");

    const expiredOrders = (candidates ?? []).filter((order: any) => {
      const transactions = Array.isArray(order.payment_transactions) ? order.payment_transactions : [];
      const hasValidPendingTransaction = transactions.some((tx: any) => {
        const providerStatus = String(tx.provider_status ?? "").toLowerCase();
        if (!["pending", "in_process"].includes(providerStatus)) return false;
        return tx.expires_at && new Date(tx.expires_at).getTime() > Date.now();
      });
      return !hasValidPendingTransaction;
    });

    if (expiredOrders.length === 0) {
      return jsonResponse({ success: true, expired_count: 0 });
    }

    const expiredIds = expiredOrders.map((order: any) => order.id);
    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "EXPIRADO",
        updated_at: nowIso,
        cancelled_at: nowIso,
      })
      .in("id", expiredIds)
      .eq("status", "AGUARDANDO_PAGAMENTO")
      .eq("payment_status", "PENDING");

    if (updateErr) throw new Error("Erro ao expirar pedidos pendentes.");

    await supabaseAdmin.from("audit_logs").insert(expiredOrders.map((order: any) => ({
      action: "PUBLIC_ORDER_EXPIRED",
      table_name: "orders",
      record_id: order.id,
      new_data: {
        reason: "pending_payment_expired",
        age_minutes_threshold: minutes,
        daily_number: order.daily_number,
      },
    })));

    return jsonResponse({ success: true, expired_count: expiredOrders.length });
  } catch (error) {
    console.error("[expire-pending-public-orders] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ success: false, error: "Erro ao expirar pedidos pendentes." }, 500);
  }
});
