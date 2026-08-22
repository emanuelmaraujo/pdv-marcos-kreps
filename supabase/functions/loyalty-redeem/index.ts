/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-redeem
//
// Marca uma recompensa de fidelidade como REDEEMED.
//
// Auth: Bearer JWT (ATTENDANT ou ADMIN).
// Input: { reward_code: string, order_id?: string }
//   - reward_code é normalizado (UPPERCASE, trim, sem espaços).
//   - order_id é opcional — pode resgatar como cortesia avulsa (lançada à parte).
//
// Lógica:
//   1) valida JWT + role
//   2) SELECT recompensa por code, verifica AVAILABLE + não vencida
//   3) UPDATE → REDEEMED, redeemed_at, redeemed_by, redeemed_order_id, redeemed_branch_id
//   4) tx REDEEM (delta=0, reward_id)
//   5) audit_log LOYALTY_REWARD_REDEEMED
//
// Retorna info do cliente + recompensa pra o PDV exibir confirmação.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

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

    const { data: profile } = await supabaseAdmin.from("profiles").select("role, active").eq("id", user.id).single();
    if (!profile || !profile.active) throw new Error("Usuário sem profile ou inativo.");
    if (profile.role !== "ADMIN" && profile.role !== "ATTENDANT") {
      throw new Error("Role não autorizada.");
    }

    const body = await req.json().catch(() => ({}));
    const reward_code = typeof body.reward_code === "string" ? normalizeCode(body.reward_code) : "";
    const order_id = typeof body.order_id === "string" && body.order_id ? body.order_id : null;
    if (!reward_code) throw new Error("reward_code ausente.");

    // Busca a recompensa
    const { data: reward, error: rewardErr } = await supabaseAdmin
      .from("loyalty_rewards")
      .select("id, account_id, program_id, code, label, status, expires_at, loyalty_accounts(customer_id, customers(name, phone_e164))")
      .eq("code", reward_code)
      .maybeSingle();
    if (rewardErr) throw new Error(`Erro ao buscar recompensa: ${rewardErr.message}`);
    if (!reward) throw new Error("Recompensa não encontrada.");
    if (reward.status !== "AVAILABLE") {
      const label = reward.status === "REDEEMED" ? "já resgatada" : reward.status === "EXPIRED" ? "vencida" : "revogada";
      throw new Error(`Recompensa ${label}.`);
    }
    if (new Date(reward.expires_at).getTime() <= Date.now()) {
      // marca como EXPIRED preguiçosamente
      await supabaseAdmin.from("loyalty_rewards").update({ status: "EXPIRED" }).eq("id", reward.id).eq("status", "AVAILABLE");
      throw new Error("Recompensa vencida.");
    }

    // Se order_id foi passado, valida que existe e pega branch_id
    let branchId: string | null = null;
    if (order_id) {
      const { data: order } = await supabaseAdmin.from("orders").select("id, branch_id").eq("id", order_id).maybeSingle();
      if (!order) throw new Error("Pedido informado não existe.");
      branchId = order.branch_id ?? null;
    }

    const now = new Date().toISOString();
    // UPDATE com guarda de status (evita race em duplo-clique).
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("loyalty_rewards")
      .update({
        status: "REDEEMED",
        redeemed_at: now,
        redeemed_by: user.id,
        redeemed_order_id: order_id,
        redeemed_branch_id: branchId,
      })
      .eq("id", reward.id)
      .eq("status", "AVAILABLE")
      .select("id, code, label, redeemed_at")
      .maybeSingle();
    if (updErr) throw new Error(`Erro ao registrar resgate: ${updErr.message}`);
    if (!updated) throw new Error("Recompensa já resgatada por outra operação.");

    // tx REDEEM (delta=0, vincula reward)
    const { data: acc } = await supabaseAdmin.from("loyalty_accounts").select("current_stamps").eq("id", reward.account_id).maybeSingle();
    await supabaseAdmin.from("loyalty_transactions").insert({
      account_id: reward.account_id,
      kind: "REDEEM",
      delta: 0,
      balance_after: acc?.current_stamps ?? 0,
      order_id,
      reward_id: reward.id,
      reason: "reward_redeemed",
      actor_user_id: user.id,
    });

    await supabaseAdmin.from("audit_logs").insert({
      action: "LOYALTY_REWARD_REDEEMED",
      table_name: "loyalty_rewards",
      record_id: reward.id,
      user_id: user.id,
      branch_id: branchId,
      new_data: { code: reward.code, order_id, customer_id: reward.loyalty_accounts?.customer_id ?? null },
    });

    const customer = reward.loyalty_accounts?.customers ?? null;
    return new Response(
      JSON.stringify({
        success: true,
        reward: { id: updated.id, code: updated.code, label: updated.label, redeemed_at: updated.redeemed_at },
        customer: customer ? { name: customer.name, phone_e164: customer.phone_e164 } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("[loyalty-redeem] failed", err?.message);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? "Erro desconhecido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
