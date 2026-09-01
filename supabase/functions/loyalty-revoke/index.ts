/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-revoke
//
// Revoga o selo de um pedido estornado.
//
// Auth: x-internal-secret = LOYALTY_INTERNAL_SECRET (chamada por mark-payment)
//        OU Bearer JWT ADMIN (botão manual no dashboard).
//
// Lógica:
//   1) Acha EARN(order_id). Se não existe → skip.
//   2) Se gerou uma recompensa AVAILABLE → revoga ela (REVOKED) + tx REVOKE.
//   3) Se a recompensa já foi REDEEMED ou EXPIRED → NÃO mexe; apenas registra
//      tx REVOKE simbólico com reason e bloqueia a tentativa, exigindo ADMIN
//      tomar decisão (force=true).
//   4) Senão (selo solto), insere REVOKE (delta=-1), decrementa cache.
//
// Input: { order_id, force?: boolean }
// Retorna: { ok, action: 'revoked'|'skipped'|'blocked' }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

function ok(req: Request, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { ...publicCorsHeaders(req, { extraHeaders: "x-internal-secret" }), "Content-Type": "application/json" },
  });
}

function jsonError(req: Request, msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...publicCorsHeaders(req, { extraHeaders: "x-internal-secret" }), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: publicCorsHeaders(req, { extraHeaders: "x-internal-secret" }) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("LOYALTY_INTERNAL_SECRET") ?? "";
    let actor: { mode: "internal" } | { mode: "admin"; userId: string };

    if (expected && internalSecret === expected) {
      actor = { mode: "internal" };
    } else {
      const auth = req.headers.get("Authorization");
      if (!auth) return jsonError(req, "Não autorizado.", 401);
      const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace("Bearer ", ""));
      if (!user) return jsonError(req, "Token inválido.", 401);
      const { data: profile } = await supabaseAdmin.from("profiles").select("role, active").eq("id", user.id).single();
      if (!profile?.active || profile.role !== "ADMIN") return jsonError(req, "Apenas ADMIN.", 403);
      actor = { mode: "admin", userId: user.id };
    }

    const { order_id, force } = await req.json().catch(() => ({}));
    if (!order_id) return jsonError(req, "order_id ausente.");

    const { data: earn } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id, account_id, balance_after")
      .eq("kind", "EARN")
      .eq("order_id", order_id)
      .maybeSingle();
    if (!earn) return ok(req, { action: "skipped", reason: "no_earn" });

    // Recompensa que possivelmente nasceu desse selo: a ADJUST(unlock_reward) imediatamente
    // após o EARN tem reward_id. Para simplificar, achamos qualquer reward com mesma conta
    // e issued_at perto do paid_at — heurística suficiente porque rewards são raras.
    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("id, current_stamps, lifetime_stamps")
      .eq("id", earn.account_id)
      .maybeSingle();
    if (!account) return ok(req, { action: "skipped", reason: "no_account" });

    // ADJUST(unlock_reward) carrega order_id do pedido que desbloqueou — match exato.
    const { data: unlockTx } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id, reward_id")
      .eq("account_id", account.id)
      .eq("kind", "ADJUST")
      .eq("reason", "unlock_reward")
      .eq("order_id", order_id)
      .not("reward_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const linkedRewardId: string | null = (unlockTx ?? [])[0]?.reward_id ?? null;

    let blockedReason: string | null = null;
    if (linkedRewardId) {
      const { data: reward } = await supabaseAdmin.from("loyalty_rewards").select("id, status").eq("id", linkedRewardId).maybeSingle();
      if (reward?.status === "REDEEMED" && !force) {
        blockedReason = "reward_already_redeemed";
      } else if (reward?.status === "AVAILABLE") {
        await supabaseAdmin.from("loyalty_rewards").update({ status: "REVOKED" }).eq("id", reward.id);
      }
    }

    if (blockedReason) {
      await supabaseAdmin.from("audit_logs").insert({
        action: "LOYALTY_REVOKE_BLOCKED",
        table_name: "loyalty_transactions",
        record_id: earn.id,
        user_id: actor.mode === "admin" ? actor.userId : null,
        new_data: { order_id, reason: blockedReason },
      });
      return ok(req, { action: "blocked", reason: blockedReason });
    }

    const newCurrent = Math.max(0, (account.current_stamps ?? 0) - 1);
    const newLifetime = Math.max(0, (account.lifetime_stamps ?? 0) - 1);

    await supabaseAdmin.from("loyalty_transactions").insert({
      account_id: account.id,
      kind: "REVOKE",
      delta: -1,
      balance_after: newCurrent,
      order_id,
      reward_id: linkedRewardId,
      reason: force ? "admin_force_revoke" : "order_refunded",
      actor_user_id: actor.mode === "admin" ? actor.userId : null,
    });

    await supabaseAdmin.from("loyalty_accounts").update({
      current_stamps: newCurrent,
      lifetime_stamps: newLifetime,
      last_activity_at: new Date().toISOString(),
    }).eq("id", account.id);

    await supabaseAdmin.from("audit_logs").insert({
      action: "LOYALTY_REVOKED",
      table_name: "loyalty_transactions",
      record_id: earn.id,
      user_id: actor.mode === "admin" ? actor.userId : null,
      new_data: { order_id, reward_revoked: !!linkedRewardId, force: !!force },
    });

    return ok(req, { action: "revoked", current_stamps: newCurrent });
  } catch (err: any) {
    console.error("[loyalty-revoke] failed", err?.message);
    return jsonError(req, err?.message ?? "Erro desconhecido", 500);
  }
});
