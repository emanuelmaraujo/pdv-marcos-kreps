/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-revoke
//
// Estorna o(s) selo(s) de itens de um pedido que foram reembolsados.
//
// Fase 1: como o crédito agora é por item pago (loyalty-accrue), o estorno
// também é por item — reverte só os itens indicados (ou, sem indicação,
// todos os itens do pedido ainda com selo creditado e não revogado).
//
// Auth: x-internal-secret = LOYALTY_INTERNAL_SECRET (chamada por mark-payment)
//        OU Bearer JWT ADMIN (botão manual no dashboard).
//
// Lógica:
//   1) Acha em loyalty_stamp_credits os itens do pedido com crédito ainda não
//      revogado (filtrando por order_item_ids se informado). Se nenhum → skip.
//   2) delta = soma de quantity desses itens.
//   3) Se esse crédito tiver desbloqueado uma recompensa ainda AVAILABLE →
//      revoga ela (REVOKED) + segue. Se já foi REDEEMED/EXPIRED → bloqueia
//      (exige ADMIN com force=true).
//   4) Marca os itens como revoked_at em loyalty_stamp_credits, insere REVOKE(-delta),
//      decrementa cache (current_stamps clamped em 0, lifetime_stamps ajustado).
//
// Input: { order_id, order_item_ids?: string[], force?: boolean }
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

    const { order_id, order_item_ids, force } = await req.json().catch(() => ({}));
    if (!order_id) return jsonError(req, "order_id ausente.");
    const scopedItemIds: string[] | null = Array.isArray(order_item_ids) && order_item_ids.length > 0 ? order_item_ids : null;

    // Itens do pedido com crédito ainda não revogado.
    let itemsQuery = supabaseAdmin
      .from("order_items")
      .select("id, quantity, loyalty_stamp_credits!inner(account_id, revoked_at)")
      .eq("order_id", order_id)
      .is("loyalty_stamp_credits.revoked_at", null);
    if (scopedItemIds) itemsQuery = itemsQuery.in("id", scopedItemIds);
    const { data: creditedItems, error: itemsErr } = await itemsQuery;
    if (itemsErr) return jsonError(req, `Erro ao ler créditos: ${itemsErr.message}`);
    if (!creditedItems || creditedItems.length === 0) return ok(req, { action: "skipped", reason: "no_credit" });

    const accountId: string = (creditedItems[0] as any).loyalty_stamp_credits.account_id;
    const targetItemIds = creditedItems.map((it: any) => it.id);
    const delta = creditedItems.reduce((sum: number, it: any) => sum + (it.quantity ?? 1), 0);

    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("id, current_stamps, lifetime_stamps")
      .eq("id", accountId)
      .maybeSingle();
    if (!account) return ok(req, { action: "skipped", reason: "no_account" });

    // Recompensa que possivelmente nasceu desse crédito: a ADJUST(unlock_reward) do
    // pedido tem reward_id. Heurística suficiente porque rewards são raras.
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
        record_id: account.id,
        user_id: actor.mode === "admin" ? actor.userId : null,
        new_data: { order_id, item_ids: targetItemIds, reason: blockedReason },
      });
      return ok(req, { action: "blocked", reason: blockedReason });
    }

    const newCurrent = Math.max(0, (account.current_stamps ?? 0) - delta);
    const newLifetime = Math.max(0, (account.lifetime_stamps ?? 0) - delta);

    await supabaseAdmin.from("loyalty_transactions").insert({
      account_id: account.id,
      kind: "REVOKE",
      delta: -delta,
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

    await supabaseAdmin
      .from("loyalty_stamp_credits")
      .update({ revoked_at: new Date().toISOString() })
      .in("order_item_id", targetItemIds);

    await supabaseAdmin.from("audit_logs").insert({
      action: "LOYALTY_REVOKED",
      table_name: "loyalty_transactions",
      record_id: account.id,
      user_id: actor.mode === "admin" ? actor.userId : null,
      new_data: { order_id, item_ids: targetItemIds, delta, reward_revoked: !!linkedRewardId, force: !!force },
    });

    return ok(req, { action: "revoked", current_stamps: newCurrent });
  } catch (err: any) {
    console.error("[loyalty-revoke] failed", err?.message);
    return jsonError(req, err?.message ?? "Erro desconhecido", 500);
  }
});
