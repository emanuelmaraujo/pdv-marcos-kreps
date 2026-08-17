// Edge function: confirm-delivery
//
// Confirma que um pedido de ENTREGA chegou ao cliente final. Diferente do
// fluxo padrão (onde a trigger recompute_order_status_from_items() deriva
// orders.status a partir de order_items.status), aqui o status ENTREGUE é
// setado explicitamente: SAIU_PARA_ENTREGA é um estado protegido contra
// sobrescrita automática da trigger (ver migration 20260729120200), então
// essa transição final precisa ser feita direto pela função.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id ausente.");

    // Lê o pedido via JWT — RLS valida filial do user.
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, type, status")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    if (order.type !== "ENTREGA") throw new Error("Só é possível confirmar entrega de pedidos do tipo ENTREGA.");
    if (order.status !== "SAIU_PARA_ENTREGA") {
      throw new Error(`Transição inválida ${order.status} -> ENTREGUE. O pedido precisa estar SAIU_PARA_ENTREGA.`);
    }

    const now = new Date().toISOString();

    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .update({ status: "DELIVERED", delivered_at: now })
      .eq("order_id", order.id)
      .in("status", ["READY", "PENDING", "IN_PREPARATION"]);
    if (itemsErr) throw new Error(`Erro ao marcar itens como DELIVERED: ${itemsErr.message}`);

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "ENTREGUE", delivered_at: now, delivery_delivered_at: now })
      .eq("id", order.id);
    if (updateErr) throw new Error(`Erro ao confirmar entrega: ${updateErr.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      action: "ORDER_DELIVERY_CONFIRMED",
      table_name: "orders",
      record_id: order.id,
      user_id: user.id,
      branch_id: order.branch_id,
      new_data: { from: "SAIU_PARA_ENTREGA", to: "ENTREGUE" },
    });

    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, delivered_at, delivery_delivered_at")
      .eq("id", order.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, order: orderAfter }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[confirm-delivery] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
