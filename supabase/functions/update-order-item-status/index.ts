// Edge function: update-order-item-status
//
// Move o status de UM item de pedido pelo seu próprio ciclo de vida:
// PENDING -> IN_PREPARATION -> READY -> DELIVERED  (CANCELLED em qualquer ponto não-final)
//
// O status do PEDIDO (orders.status / orders.payment_status) é derivado pelos
// triggers do Postgres a partir dos itens — esta função só mexe no item.
//
// Autorização:
//   * Usa o JWT do usuário pra LER o item via supabaseClientAuth — RLS bloqueia
//     se o atendente não opera a filial do pedido. Se a leitura passa, sabemos
//     que ele tem permissão. A escrita usa supabaseAdmin pra contornar pequenas
//     RLS de payment/whatsapp e centralizar o audit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { enqueueWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ItemStatus = "PENDING" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";

const ALLOWED_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  PENDING:        ["IN_PREPARATION", "READY", "CANCELLED"],
  IN_PREPARATION: ["READY", "CANCELLED"],
  READY:          ["DELIVERED", "CANCELLED"],
  DELIVERED:      [],
  CANCELLED:      [],
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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();
    if (profileErr || !profile) throw new Error("Usuário sem profile.");
    if (!profile.active) throw new Error("Usuário inativo.");
    if (profile.role !== "ADMIN" && profile.role !== "ATTENDANT") {
      throw new Error("Role não autorizada.");
    }

    const { order_item_id, new_status, reason } = await req.json();
    if (!order_item_id) throw new Error("order_item_id ausente.");
    if (!new_status || !(new_status in ALLOWED_TRANSITIONS)) {
      throw new Error(`new_status inválido. Permitidos: ${Object.keys(ALLOWED_TRANSITIONS).join(", ")}`);
    }
    if (new_status === "CANCELLED" && (!reason || !reason.trim())) {
      throw new Error("Motivo (reason) é obrigatório para cancelar um item.");
    }

    // Lê o item via JWT do user — RLS valida que ele opera a filial.
    const { data: item, error: itemErr } = await supabaseClientAuth
      .from("order_items")
      .select(`
        id, order_id, sequence_no, status, product_name_snapshot, total_price,
        orders!inner ( id, branch_id, status, daily_number,
                       customer_phone, customer_name )
      `)
      .eq("id", order_item_id)
      .single();
    if (itemErr || !item) throw new Error("Item não encontrado ou sem permissão.");

    const order = (item as any).orders;
    const currentItemStatus = item.status as ItemStatus;
    const orderStatus = order.status as string;

    // Pedido em estados pré-fila ou finais não aceita mudanças por item.
    if (["AGUARDANDO_CONFIRMACAO", "AGUARDANDO_PAGAMENTO", "EXPIRADO"].includes(orderStatus)) {
      throw new Error(`Pedido em ${orderStatus} ainda não pode ter itens manipulados.`);
    }
    if (orderStatus === "CANCELADO" && new_status !== "CANCELLED") {
      throw new Error("Pedido cancelado: itens só aceitam CANCELLED.");
    }

    // Valida transição.
    const allowed = ALLOWED_TRANSITIONS[currentItemStatus];
    if (!allowed.includes(new_status as ItemStatus)) {
      throw new Error(`Transição inválida: ${currentItemStatus} -> ${new_status}.`);
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status: new_status };
    if (new_status === "IN_PREPARATION") update.prep_started_at = now;
    if (new_status === "READY")          update.item_ready_at   = now;
    if (new_status === "DELIVERED") {
      update.delivered_at = now;
      // Bloqueia entrega de item ainda não pago, exceto ADMIN forçando.
      // (O caller pode passar { force: true } se for o caso. Por ora, simplificamos:
      // se o pedido está com payment_status PENDING e o item PENDING, deixa entregar
      // mesmo assim — o atendente sabe o que está fazendo no balcão. A política
      // anti-pendência fica no botão do app, como já é hoje.)
    }
    if (new_status === "CANCELLED") {
      update.cancelled_at = now;
    }

    const { error: updErr } = await supabaseAdmin
      .from("order_items")
      .update(update)
      .eq("id", order_item_id);
    if (updErr) throw new Error(`Erro ao atualizar item: ${updErr.message}`);

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      action: `ITEM_${new_status}`,
      table_name: "order_items",
      record_id: order_item_id,
      user_id: user.id,
      branch_id: order.branch_id,
      new_data: { from: currentItemStatus, to: new_status, reason: reason ?? null },
    });

    // Relê o pedido pós-trigger pra devolver o status derivado atual.
    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select(`
        id, status, payment_status, ready_at, delivered_at, daily_number,
        customer_phone, customer_name, branch_id,
        branches ( code, name )
      `)
      .eq("id", order.id)
      .single();

    // WhatsApp transacional. O índice unique partial em (order_id, event_type)
    // garante 1 envio só por evento, então é seguro chamar idempotentemente
    // a cada transição de item.
    if (orderAfter?.status === "PRONTO_PARCIAL") {
      await enqueueWhatsAppMessage(supabaseAdmin, {
        orderId:      orderAfter.id,
        branchId:     orderAfter.branch_id,
        eventType:    "order_partial_ready",
        phone:        orderAfter.customer_phone,
        customerName: orderAfter.customer_name,
        dailyNumber:  orderAfter.daily_number,
        branchCode:   (orderAfter as any).branches?.code ?? null,
        branchName:   (orderAfter as any).branches?.name ?? null,
      });
    } else if (orderAfter?.status === "PRONTO") {
      await enqueueWhatsAppMessage(supabaseAdmin, {
        orderId:      orderAfter.id,
        branchId:     orderAfter.branch_id,
        eventType:    "order_ready",
        phone:        orderAfter.customer_phone,
        customerName: orderAfter.customer_name,
        dailyNumber:  orderAfter.daily_number,
        branchCode:   (orderAfter as any).branches?.code ?? null,
        branchName:   (orderAfter as any).branches?.name ?? null,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        item: {
          id: order_item_id,
          sequence_no: item.sequence_no,
          status: new_status,
        },
        order: {
          id: orderAfter?.id,
          status: orderAfter?.status,
          payment_status: orderAfter?.payment_status,
          ready_at: orderAfter?.ready_at,
          delivered_at: orderAfter?.delivered_at,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[update-order-item-status] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
