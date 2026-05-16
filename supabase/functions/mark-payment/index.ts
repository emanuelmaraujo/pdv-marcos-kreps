// Edge function: mark-payment
//
// Marca pagamento de um pedido (ou de itens específicos dele).
//
// Modos:
//   * Pedido inteiro: payload = { order_id, payment_method, payment_status, amount }
//     -> Marca todos os itens não cancelados com o mesmo status, registra um payment.
//        Se o user pediu PAID, exige amount == total não-cancelado.
//   * Por itens:      payload = { order_id, payment_method, payment_status, amount, order_item_ids: [..] }
//     -> Marca somente os itens listados. Exige amount == soma dos total_price desses itens
//        (quando status é PAID). Útil pra "fulano paga só o crepe dele".
//
// orders.payment_status é DERIVADO dos itens via trigger (PAID/PARTIAL/PENDING/COURTESY/REFUNDED).
// Esta função NÃO escreve mais em orders.payment_status — só nos itens.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["PENDING", "PAID", "REFUNDED", "CANCELED", "COURTESY"] as const;
const VALID_METHODS  = ["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "PENDING", "COURTESY"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const { order_id, payment_method, payment_status, amount, notes, order_item_ids } = await req.json();

    if (!order_id) throw new Error("order_id ausente.");
    if (!VALID_STATUSES.includes(payment_status)) throw new Error("payment_status inválido.");
    if (!VALID_METHODS.includes(payment_method))   throw new Error("payment_method inválido.");

    if (payment_status === "REFUNDED" && profile.role !== "ADMIN") {
      throw new Error("Apenas ADMIN pode estornar (REFUNDED).");
    }

    // Lê o pedido via JWT (RLS valida que o user opera a filial).
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, daily_number, status, total_amount")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      throw new Error("Não é possível alterar pagamento de pedido cancelado/expirado.");
    }

    // Calcula o total relevante (pedido inteiro vs subset de itens) e popula o set de items alvo.
    let targetItemIds: string[];
    let targetTotal: number;

    if (Array.isArray(order_item_ids) && order_item_ids.length > 0) {
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .select("id, order_id, total_price, status")
        .in("id", order_item_ids);
      if (itemsErr) throw new Error(`Erro ao ler itens: ${itemsErr.message}`);
      if (!items || items.length !== order_item_ids.length) {
        throw new Error("Algum order_item_id é inválido.");
      }
      const wrong = items.find((i) => i.order_id !== order.id);
      if (wrong) throw new Error("Itens devem pertencer ao mesmo pedido.");
      const cancelled = items.find((i) => i.status === "CANCELLED");
      if (cancelled) throw new Error("Item cancelado não pode receber pagamento.");

      targetItemIds = items.map((i) => i.id);
      targetTotal   = items.reduce((sum, i) => sum + Number(i.total_price ?? 0), 0);
    } else {
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .select("id, total_price")
        .eq("order_id", order.id)
        .neq("status", "CANCELLED");
      if (itemsErr) throw new Error(`Erro ao ler itens do pedido: ${itemsErr.message}`);

      targetItemIds = (items ?? []).map((i) => i.id);
      targetTotal   = (items ?? []).reduce((sum, i) => sum + Number(i.total_price ?? 0), 0);
    }

    // Para PAID, exige bate-confere financeiro com o subset.
    let paymentRecordAmount = 0;
    if (payment_status === "PAID") {
      if (Number(amount) !== Number(targetTotal)) {
        throw new Error(`Valor (R$ ${amount}) difere do total (R$ ${targetTotal.toFixed(2)}).`);
      }
      paymentRecordAmount = targetTotal;
    } else if (payment_status === "COURTESY") {
      paymentRecordAmount = targetTotal;
    } else if (payment_status === "REFUNDED") {
      paymentRecordAmount = -Math.abs(Number(amount) || targetTotal);
    }
    // Para PENDING/CANCELED, nada de payment record.

    const now = new Date().toISOString();

    // Atualiza os itens — o trigger no DB recalcula orders.payment_status.
    const itemUpdate: Record<string, unknown> = {
      payment_status,
      payment_method,
    };
    if (payment_status === "PAID" || payment_status === "COURTESY") {
      itemUpdate.paid_at = now;
    } else if (payment_status === "PENDING") {
      itemUpdate.paid_at = null;
    }

    if (targetItemIds.length === 0) {
      throw new Error("Pedido sem itens elegíveis pra pagamento.");
    }

    const { error: itemErr } = await supabaseAdmin
      .from("order_items")
      .update(itemUpdate)
      .in("id", targetItemIds);
    if (itemErr) throw new Error(`Erro ao atualizar itens: ${itemErr.message}`);

    // Registro de pagamento (histórico do caixa).
    if (["PAID", "COURTESY", "REFUNDED"].includes(payment_status)) {
      const { error: payErr } = await supabaseAdmin
        .from("payments")
        .insert({
          order_id:       order.id,
          amount:         paymentRecordAmount,
          payment_method,
          payment_status,
          received_by:    user.id,
          notes:          notes ?? null,
          order_item_ids: targetItemIds,
        });
      if (payErr) throw new Error(`Erro ao registrar pagamento: ${payErr.message}`);
    }

    await supabaseAdmin.from("audit_logs").insert({
      action:     `PAYMENT_${payment_status}`,
      table_name: "orders",
      record_id:  order.id,
      user_id:    user.id,
      branch_id:  order.branch_id,
      new_data:   {
        payment_method,
        amount: paymentRecordAmount,
        item_ids_count: targetItemIds.length,
        scope: order_item_ids ? "ITEMS" : "ORDER",
      },
    });

    // Relê pedido pra devolver o status derivado.
    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, payment_status, payment_method, paid_at")
      .eq("id", order.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, order: orderAfter, items_paid: targetItemIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[mark-payment] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
