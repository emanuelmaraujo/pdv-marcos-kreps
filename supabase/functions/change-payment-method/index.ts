import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_METHODS = ["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "COURTESY"] as const;

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

    const { order_id, payment_method } = await req.json();
    if (!order_id) throw new Error("order_id obrigatório.");
    if (!VALID_METHODS.includes(payment_method)) throw new Error("payment_method inválido.");

    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, payment_status, status")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido não encontrado ou sem permissão.");

    if (!["PAID", "COURTESY", "PARTIAL"].includes(order.payment_status)) {
      throw new Error("Só é possível alterar o método de pedidos pagos.");
    }
    if (order.status === "CANCELADO" || order.status === "EXPIRADO") {
      throw new Error("Não é possível alterar pagamento de pedido cancelado/expirado.");
    }

    // Atualiza payment_method em todos os itens pagos/cortesia
    const { error: itemErr } = await supabaseAdmin
      .from("order_items")
      .update({ payment_method })
      .eq("order_id", order_id)
      .in("payment_status", ["PAID", "COURTESY"]);
    if (itemErr) throw new Error("Erro ao atualizar itens: " + itemErr.message);

    // Atualiza o registro de pagamento mais recente do pedido
    const { data: lastPayment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (lastPayment && lastPayment.length > 0) {
      await supabaseAdmin
        .from("payments")
        .update({ payment_method })
        .eq("id", lastPayment[0].id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      action: "PAYMENT_METHOD_CHANGED",
      table_name: "orders",
      record_id: order_id,
      user_id: user.id,
      branch_id: order.branch_id,
      new_data: { payment_method },
    });

    return new Response(
      JSON.stringify({ success: true, payment_method }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[change-payment-method] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
