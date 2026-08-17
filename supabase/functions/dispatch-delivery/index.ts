// Edge function: dispatch-delivery
//
// Marca um pedido de ENTREGA como despachado para o entregador.
// Diferente de update-order-status, esta função NÃO mexe em order_items —
// os itens continuam READY (foram produzidos e entregues ao entregador, não
// ao cliente final). orders.status vira SAIU_PARA_ENTREGA diretamente, estado
// que a trigger recompute_order_status_from_items() está configurada para não
// sobrescrever automaticamente (ver migration 20260729120200).
//
// Fase 1 (MVP): sem tabela `couriers` ainda — courier_name/courier_phone são
// texto livre preenchido pelo atendente, opcionalmente atualizado aqui.

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

    const { order_id, courier_name, courier_phone } = await req.json();
    if (!order_id) throw new Error("order_id ausente.");

    // Lê o pedido via JWT — RLS valida filial do user.
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, daily_number, type, status, customer_name, customer_phone, branches ( code, name )")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    if (order.type !== "ENTREGA") throw new Error("Só é possível despachar pedidos do tipo ENTREGA.");
    if (order.status !== "PRONTO") {
      throw new Error(`Transição inválida ${order.status} -> SAIU_PARA_ENTREGA. O pedido precisa estar PRONTO.`);
    }

    const courierName = typeof courier_name === "string" && courier_name.trim() ? courier_name.trim() : null;
    const courierPhone = typeof courier_phone === "string" && courier_phone.trim() ? courier_phone.trim() : null;

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "SAIU_PARA_ENTREGA",
      dispatched_at: now,
    };
    if (courierName) updatePayload.courier_name = courierName;
    if (courierPhone) updatePayload.courier_phone = courierPhone;

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);
    if (updateErr) throw new Error(`Erro ao despachar pedido: ${updateErr.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      action: "ORDER_DISPATCHED_FOR_DELIVERY",
      table_name: "orders",
      record_id: order.id,
      user_id: user.id,
      branch_id: order.branch_id,
      new_data: { from: order.status, to: "SAIU_PARA_ENTREGA", courier_name: courierName, courier_phone: courierPhone },
    });

    // WhatsApp "saiu para entrega" — non-blocking, nunca falha o despacho.
    const branchInfo = Array.isArray((order as any).branches) ? (order as any).branches[0] : (order as any).branches;
    await enqueueWhatsAppMessage(supabaseAdmin, {
      orderId: order.id,
      branchId: order.branch_id,
      eventType: "order_out_for_delivery",
      phone: (order as any).customer_phone,
      customerName: (order as any).customer_name,
      dailyNumber: order.daily_number,
      branchCode: branchInfo?.code,
      branchName: branchInfo?.name,
    });

    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, dispatched_at, courier_name, courier_phone")
      .eq("id", order.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, order: orderAfter }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[dispatch-delivery] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
