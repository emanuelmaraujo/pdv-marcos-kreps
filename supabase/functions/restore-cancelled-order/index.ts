// Edge function: restore-cancelled-order
//
// Restaura um pedido cancelado dentro de uma janela máxima de 30 minutos.
// O estado anterior do pedido vem do último audit ORDER_CANCELADO; os estados
// dos itens são reconstruídos pelos timestamps preservados no cancelamento.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

const RESTORE_WINDOW_MS = 30 * 60 * 1000;
const RESTORABLE_ORDER_STATUSES = new Set([
  "AGUARDANDO_CONFIRMACAO",
  "AGUARDANDO_PAGAMENTO",
  "NA_FILA",
  "PRONTO_PARCIAL",
  "PRONTO",
]);

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado.");
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseClientAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) throw new Error("Token inválido.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();
    if (!profile || !profile.active) throw new Error("Usuário sem profile ou inativo.");
    if (profile.role !== "ADMIN" && profile.role !== "ATTENDANT") {
      throw new Error("Role não autorizada.");
    }

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id ausente.");

    // Leitura via JWT mantém a validação de acesso à filial pelo RLS.
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, daily_number, status, cancelled_at, payment_status")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");
    if (order.status !== "CANCELADO") throw new Error("Somente pedidos CANCELADOS podem ser restaurados.");
    if (!order.cancelled_at) throw new Error("Pedido cancelado sem data de cancelamento.");

    const cancelledAtMs = new Date(order.cancelled_at).getTime();
    const elapsedMs = Date.now() - cancelledAtMs;
    if (!Number.isFinite(cancelledAtMs) || elapsedMs < 0 || elapsedMs > RESTORE_WINDOW_MS) {
      throw new Error("O prazo de 30 minutos para desfazer o cancelamento expirou.");
    }

    const { data: audit, error: auditErr } = await supabaseAdmin
      .from("audit_logs")
      .select("id, old_data, new_data, created_at")
      .eq("table_name", "orders")
      .eq("record_id", order.id)
      .eq("action", "ORDER_CANCELADO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (auditErr) throw new Error(`Erro ao consultar histórico: ${auditErr.message}`);

    const previousStatus = String((audit?.new_data as Record<string, unknown> | null)?.from ?? "");
    if (!RESTORABLE_ORDER_STATUSES.has(previousStatus)) {
      throw new Error("Não foi possível identificar um estado anterior restaurável para este pedido.");
    }

    const oldData = (audit?.old_data as Record<string, unknown> | null) ?? null;
    const itemSnapshot = Array.isArray(oldData?.items)
      ? oldData!.items as Array<Record<string, unknown>>
      : null;

    if (itemSnapshot?.length) {
      // Caminho novo: restaura exatamente o snapshot salvo antes do cancelamento.
      for (const item of itemSnapshot) {
        const itemId = String(item.id ?? "");
        const previousItemStatus = String(item.status ?? "");
        if (!itemId || !["PENDING", "IN_PREPARATION", "READY", "DELIVERED", "CANCELLED"].includes(previousItemStatus)) {
          throw new Error("Snapshot de item inválido no histórico de cancelamento.");
        }

        const { error: itemErr } = await supabaseAdmin
          .from("order_items")
          .update({
            status: previousItemStatus,
            prep_started_at: item.prep_started_at ?? null,
            item_ready_at: item.item_ready_at ?? null,
            delivered_at: item.delivered_at ?? null,
            cancelled_at: item.cancelled_at ?? null,
          })
          .eq("id", itemId)
          .eq("order_id", order.id);
        if (itemErr) throw new Error(`Erro ao restaurar item: ${itemErr.message}`);
      }
    } else {
      // Compatibilidade com cancelamentos antigos, anteriores ao snapshot.
      const { data: cancelledItems, error: itemsReadErr } = await supabaseAdmin
        .from("order_items")
        .select("id, prep_started_at, item_ready_at, delivered_at, status")
        .eq("order_id", order.id)
        .eq("status", "CANCELLED");
      if (itemsReadErr) throw new Error(`Erro ao ler itens cancelados: ${itemsReadErr.message}`);

      for (const item of cancelledItems ?? []) {
        const restoredStatus = item.item_ready_at
          ? "READY"
          : item.prep_started_at
            ? "IN_PREPARATION"
            : "PENDING";

        const { error: itemErr } = await supabaseAdmin
          .from("order_items")
          .update({ status: restoredStatus, cancelled_at: null })
          .eq("id", item.id);
        if (itemErr) throw new Error(`Erro ao restaurar item: ${itemErr.message}`);
      }
    }

    // Os triggers dos itens recalculam o status operacional. Estados pré-fila
    // precisam ser recolocados explicitamente depois disso.
    const orderPatch: Record<string, unknown> = {
      cancelled_at: null,
      cancelled_by: null,
      updated_at: new Date().toISOString(),
    };
    if (previousStatus === "AGUARDANDO_CONFIRMACAO" || previousStatus === "AGUARDANDO_PAGAMENTO") {
      orderPatch.status = previousStatus;
    }

    const { error: orderUpdateErr } = await supabaseAdmin
      .from("orders")
      .update(orderPatch)
      .eq("id", order.id);
    if (orderUpdateErr) throw new Error(`Erro ao restaurar pedido: ${orderUpdateErr.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      action: "ORDER_CANCEL_RESTORED",
      table_name: "orders",
      record_id: order.id,
      user_id: user.id,
      branch_id: order.branch_id,
      old_data: { from: "CANCELADO", cancelled_at: order.cancelled_at },
      new_data: { to: previousStatus, restored_within_minutes: Math.floor(elapsedMs / 60000) },
    });

    const { data: orderAfter, error: afterErr } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, payment_status, cancelled_at, cancelled_by, updated_at")
      .eq("id", order.id)
      .single();
    if (afterErr) throw new Error(`Erro ao validar restauração: ${afterErr.message}`);

    return new Response(
      JSON.stringify({ success: true, order: orderAfter, restored_from: "CANCELADO", restored_to: previousStatus }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[restore-cancelled-order] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 },
    );
  }
});
