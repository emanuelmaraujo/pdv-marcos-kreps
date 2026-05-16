// Edge function: update-order-status
//
// Atalho que aplica uma transição "do pedido inteiro" delegando aos itens.
// orders.status é DERIVADO pelos triggers do Postgres, então esta função apenas
// move os itens para o estado correspondente e deixa o trigger reconciliar o pedido.
//
// Compatibilidade: o payload e response permanecem os mesmos da versão anterior —
// o frontend antigo continua funcionando sem mudança.
//
// Transições suportadas:
//   * newStatus = PRONTO    -> marca todos os itens não-cancelados/não-entregues como READY
//   * newStatus = ENTREGUE  -> marca todos os itens READY como DELIVERED
//   * newStatus = CANCELADO -> marca todos os itens não-DELIVERED como CANCELLED + cancela o pedido
//
// O WhatsApp "order_ready" é disparado quando o trigger derivar o pedido pra PRONTO
// (não mais nessa função — a verdade do "pronto" passa a ser por item).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { enqueueWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { order_id, status, reason, force_delivery } = await req.json();
    if (!order_id) throw new Error("order_id ausente.");

    const validStatuses = ["PRONTO", "ENTREGUE", "CANCELADO"];
    if (!validStatuses.includes(status)) {
      throw new Error(`status inválido. Permitidos: ${validStatuses.join(", ")}`);
    }

    // Lê o pedido via JWT — RLS valida filial do user.
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select(`
        id, branch_id, daily_number, status, payment_status,
        customer_phone, customer_name,
        branches ( code, name )
      `)
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    const cur = order.status;
    if (cur === "ENTREGUE")  throw new Error("Pedido já ENTREGUE.");
    if (cur === "CANCELADO") throw new Error("Pedido já CANCELADO.");
    if (cur === "EXPIRADO")  throw new Error("Pedido EXPIRADO.");

    // Tabela de transições permitidas a nível de pedido.
    let allowed = false;
    if (status === "PRONTO") {
      // Aceita partir de NA_FILA ou PRONTO_PARCIAL ("força tudo pronto").
      if (cur === "NA_FILA" || cur === "PRONTO_PARCIAL") allowed = true;
    } else if (status === "ENTREGUE") {
      if (cur === "PRONTO" || cur === "PRONTO_PARCIAL") allowed = true;
    } else if (status === "CANCELADO") {
      if (["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "NA_FILA", "PRONTO_PARCIAL", "PRONTO"].includes(cur)) {
        allowed = true;
      }
    }
    if (!allowed) {
      throw new Error(`Transição inválida ${cur} -> ${status}.`);
    }

    // Para ENTREGUE: trava pendência de pagamento (igual ao comportamento atual),
    // checando agora payment_status derivado.
    if (status === "ENTREGUE") {
      if (order.payment_status === "PENDING" || order.payment_status === "PARTIAL") {
        if (!(force_delivery === true && profile.role === "ADMIN")) {
          throw new Error("Pedido com pagamento pendente/parcial. Confirme antes de entregar.");
        }
      }
    }

    if (status === "CANCELADO" && (!reason || !reason.trim())) {
      throw new Error("Motivo (reason) é obrigatório para cancelar o pedido.");
    }

    const now = new Date().toISOString();

    // ── Aplica a mudança nos itens; o trigger derivará orders.status ────────
    if (status === "PRONTO") {
      const { error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .update({ status: "READY", item_ready_at: now })
        .eq("order_id", order.id)
        .in("status", ["PENDING", "IN_PREPARATION"]);
      if (itemsErr) throw new Error(`Erro ao marcar itens como READY: ${itemsErr.message}`);

      // WhatsApp do "pedido_pronto" sai assim que o pedido inteiro está pronto.
      // (O "primeiro item pronto" — order_partial_ready — é disparado por
      // update-order-item-status na primeira transição que cria PRONTO_PARCIAL.)
      await enqueueWhatsAppMessage(supabaseAdmin, {
        orderId:      order.id,
        branchId:     order.branch_id,
        eventType:    "order_ready",
        phone:        order.customer_phone,
        customerName: order.customer_name,
        dailyNumber:  order.daily_number,
        branchCode:   (order as any).branches?.code ?? null,
        branchName:   (order as any).branches?.name ?? null,
      });
    } else if (status === "ENTREGUE") {
      const { error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .update({ status: "DELIVERED", delivered_at: now })
        .eq("order_id", order.id)
        .in("status", ["READY", "PENDING", "IN_PREPARATION"]);
      if (itemsErr) throw new Error(`Erro ao marcar itens como DELIVERED: ${itemsErr.message}`);
    } else if (status === "CANCELADO") {
      // Cancela todos os itens ainda não entregues.
      const { error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .update({ status: "CANCELLED", cancelled_at: now })
        .eq("order_id", order.id)
        .neq("status", "DELIVERED");
      if (itemsErr) throw new Error(`Erro ao cancelar itens: ${itemsErr.message}`);

      // Pedido em estado pré-fila (AGUARDANDO_*) o trigger não toca — força aqui.
      if (["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO"].includes(cur)) {
        await supabaseAdmin
          .from("orders")
          .update({ status: "CANCELADO", cancelled_at: now, cancelled_by: user.id })
          .eq("id", order.id);
      } else {
        // Para os demais, o trigger já move pra CANCELADO; só registra quem cancelou.
        await supabaseAdmin
          .from("orders")
          .update({ cancelled_by: user.id })
          .eq("id", order.id);
      }
    }

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      action:     `ORDER_${status}`,
      table_name: "orders",
      record_id:  order.id,
      user_id:    user.id,
      branch_id:  order.branch_id,
      new_data:   { from: cur, to: status, reason: reason ?? null, force_delivery: !!force_delivery },
    });

    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, payment_status, ready_at, delivered_at, cancelled_at")
      .eq("id", order.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, order: orderAfter }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[update-order-status] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
