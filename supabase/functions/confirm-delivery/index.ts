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
import { publicCorsHeaders } from "../_shared/public-cors.ts";

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
    if (profile.role !== "COURIER") {
      throw new Error("Somente o motoboy responsável pode confirmar a entrega.");
    }

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id ausente.");

    // Lê o pedido via JWT — RLS valida filial (ADMIN/ATTENDANT) ou posse (COURIER).
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, type, status, courier_id")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("id")
      .eq("profile_id", user.id)
      .eq("active", true)
      .single();
    if (!courier || order.courier_id !== courier.id) {
      throw new Error("Pedido não pertence a este entregador.");
    }

    if (order.type !== "ENTREGA") throw new Error("Só é possível confirmar entrega de pedidos do tipo ENTREGA.");
    if (order.status !== "SAIU_PARA_ENTREGA") {
      throw new Error(`Transição inválida ${order.status} -> ENTREGUE. O pedido precisa estar SAIU_PARA_ENTREGA.`);
    }

    const { data: orderAfter, error: confirmationErr } = await supabaseAdmin.rpc(
      "confirm_courier_delivery_transactional",
      { p_order_id: order.id, p_actor_id: user.id },
    );
    if (confirmationErr) throw new Error(confirmationErr.message);

    return new Response(
      JSON.stringify({ success: true, order: orderAfter }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[confirm-delivery] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 },
    );
  }
});
