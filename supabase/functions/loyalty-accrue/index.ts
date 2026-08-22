/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-accrue
//
// Concede +1 selo ao cliente após um pedido pago.
//
// Trust-no-client: chamada interna por mark-payment / confirm-order.
// Autenticação: header `x-internal-secret` deve bater com env LOYALTY_INTERNAL_SECRET.
//
// Idempotência: UNIQUE INDEX (account_id, order_id) WHERE kind='EARN' garante 1 selo/pedido.
// Resiliência: nunca lança HTTP 500 — sempre retorna 200 com `{ ok, reason? }` para que o caller
//              (mark-payment) não precise lidar com erros (loyalty é melhoria, não bloqueia caixa).
//
// Lógica:
//   1) valida pedido PAID + customer_id + total >= min_order_brl
//   2) upsert loyalty_accounts
//   3) INSERT EARN +1 (idempotente via UNIQUE)
//   4) UPDATE accounts (current_stamps, lifetime_stamps, last_activity_at)
//   5) se current_stamps >= stamps_required → emite recompensa + ADJUST(-N) + zera cache
//   6) enfileira WhatsApp (stamp_earned com rate-limit 48h, ou reward_ready imediato)
//   7) registra audit_log

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { enqueueLoyaltyWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const PROGRAM_ID = "default";
const STAMP_RATE_LIMIT_HOURS = 48;

// Gera um code curto e falável (sem caracteres ambíguos): KRP-XXXX-XXXX
function generateRewardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
  const block = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `KRP-${block(4)}-${block(4)}`;
}

function jsonOk(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonSkip(reason: string): Response {
  return new Response(JSON.stringify({ ok: true, skipped: true, reason }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("LOYALTY_INTERNAL_SECRET") ?? "";
    if (!expected || internalSecret !== expected) {
      return jsonError("Acesso negado.", 401);
    }

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return jsonError("order_id ausente.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Feature flag global
    const { data: enabledSetting } = await supabaseAdmin.from("settings").select("value").eq("key", "loyalty_enabled").maybeSingle();
    const loyaltyEnabled = (() => {
      const v = enabledSetting?.value;
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return v.replace(/^"|"$/g, "").toLowerCase() === "true";
      return false;
    })();
    if (!loyaltyEnabled) return jsonSkip("feature_disabled");

    // Programa
    const { data: program } = await supabaseAdmin.from("loyalty_programs").select("*").eq("id", PROGRAM_ID).maybeSingle();
    if (!program || !program.active) return jsonSkip("program_inactive");

    // Pedido — só conta quando totalmente pago
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, branch_id, customer_id, customer_name, customer_phone, total_amount, payment_status, branches(name)")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) return jsonError(`Pedido inexistente: ${orderErr?.message ?? "not found"}`);
    if (order.payment_status !== "PAID") return jsonSkip("order_not_paid");
    if (!order.customer_id) return jsonSkip("order_without_customer");

    // Escopo de filial (vazio = todas)
    const scope: string[] = Array.isArray(program.branch_scope) ? program.branch_scope : [];
    if (scope.length > 0 && order.branch_id && !scope.includes(order.branch_id)) {
      return jsonSkip("branch_not_in_scope");
    }

    // Valor mínimo
    if (Number(order.total_amount ?? 0) < Number(program.min_order_brl ?? 0)) {
      return jsonSkip("below_min_order");
    }

    // Upsert da conta
    const { data: existingAcc } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", order.customer_id)
      .eq("program_id", PROGRAM_ID)
      .maybeSingle();

    let account = existingAcc;
    if (!account) {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("loyalty_accounts")
        .insert({ customer_id: order.customer_id, program_id: PROGRAM_ID })
        .select("*")
        .single();
      if (insErr) {
        // race: tenta reler
        const { data: reread } = await supabaseAdmin
          .from("loyalty_accounts")
          .select("*")
          .eq("customer_id", order.customer_id)
          .eq("program_id", PROGRAM_ID)
          .maybeSingle();
        if (!reread) return jsonError(`Erro ao criar conta: ${insErr.message}`);
        account = reread;
      } else {
        account = inserted;
        await supabaseAdmin.from("audit_logs").insert({
          action: "LOYALTY_ENROLLED",
          table_name: "loyalty_accounts",
          record_id: account.id,
          branch_id: order.branch_id,
          new_data: { customer_id: order.customer_id, program_id: PROGRAM_ID },
        });
      }
    }

    // INSERT EARN — idempotente (UNIQUE account_id, order_id WHERE kind='EARN')
    const newBalance = (account.current_stamps ?? 0) + 1;
    const { error: txErr } = await supabaseAdmin.from("loyalty_transactions").insert({
      account_id: account.id,
      kind: "EARN",
      delta: 1,
      balance_after: newBalance,
      order_id: order.id,
      reason: "order_paid",
    });
    if (txErr) {
      if (txErr.code === "23505") return jsonSkip("already_credited");
      return jsonError(`Erro ao registrar selo: ${txErr.message}`);
    }

    // Atualiza cache
    const { data: updatedAccount, error: updErr } = await supabaseAdmin
      .from("loyalty_accounts")
      .update({
        current_stamps: newBalance,
        lifetime_stamps: (account.lifetime_stamps ?? 0) + 1,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select("*")
      .single();
    if (updErr || !updatedAccount) return jsonError(`Erro ao atualizar conta: ${updErr?.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      action: "LOYALTY_STAMP_EARNED",
      table_name: "loyalty_accounts",
      record_id: account.id,
      branch_id: order.branch_id,
      new_data: { order_id: order.id, balance_after: newBalance },
    });

    // Atingiu limiar? Emite recompensa e debita os selos.
    let rewardJustIssued: { id: string; code: string; label: string; expires_at: string } | null = null;
    const stampsRequired = program.stamps_required ?? 10;
    if (newBalance >= stampsRequired) {
      const code = generateRewardCode();
      const expiresAt = new Date(Date.now() + (program.reward_ttl_days ?? 30) * 24 * 60 * 60 * 1000).toISOString();
      const { data: reward, error: rewardErr } = await supabaseAdmin
        .from("loyalty_rewards")
        .insert({ account_id: account.id, program_id: PROGRAM_ID, code, label: program.reward_label, expires_at: expiresAt })
        .select("id, code, label, expires_at")
        .single();

      if (!rewardErr && reward) {
        // Debita os selos via ADJUST -N (preserva auditoria; current_stamps zera, lifetime mantém).
        const balanceAfterUnlock = newBalance - stampsRequired;
        await supabaseAdmin.from("loyalty_transactions").insert({
          account_id: account.id,
          kind: "ADJUST",
          delta: -stampsRequired,
          balance_after: balanceAfterUnlock,
          order_id: order.id,
          reward_id: reward.id,
          reason: "unlock_reward",
        });
        await supabaseAdmin.from("loyalty_accounts").update({ current_stamps: balanceAfterUnlock }).eq("id", account.id);
        await supabaseAdmin.from("audit_logs").insert({
          action: "LOYALTY_REWARD_ISSUED",
          table_name: "loyalty_rewards",
          record_id: reward.id,
          branch_id: order.branch_id,
          new_data: { code: reward.code, expires_at: reward.expires_at },
        });
        rewardJustIssued = reward;
      }
    }

    // WhatsApp: recompensa liberada tem prioridade sobre selo
    const portalUrl = await buildPortalUrl(supabaseAdmin, order.customer_id);
    const branchName = order.branches?.name ?? null;

    if (rewardJustIssued) {
      await enqueueLoyaltyWhatsAppMessage(supabaseAdmin, {
        eventType: "loyalty_reward_ready",
        phone: order.customer_phone,
        customerName: order.customer_name,
        orderId: order.id,
        branchId: order.branch_id,
        branchName,
        payload: {
          stamps_required: stampsRequired,
          reward_label: rewardJustIssued.label,
          reward_code: rewardJustIssued.code,
          expires_at: rewardJustIssued.expires_at,
          portal_url: portalUrl,
        },
      });
    } else if (await shouldSendStampEarned(supabaseAdmin, order.customer_id)) {
      const missing = Math.max(stampsRequired - newBalance, 0);
      await enqueueLoyaltyWhatsAppMessage(supabaseAdmin, {
        eventType: "loyalty_stamp_earned",
        phone: order.customer_phone,
        customerName: order.customer_name,
        orderId: order.id,
        branchId: order.branch_id,
        branchName,
        payload: {
          current_stamps: newBalance,
          stamps_required: stampsRequired,
          missing,
          reward_label: program.reward_label,
          portal_url: portalUrl,
        },
      });
    }

    return jsonOk({
      account_id: account.id,
      current_stamps: newBalance,
      reward_issued: !!rewardJustIssued,
      reward_code: rewardJustIssued?.code ?? null,
    });
  } catch (err: any) {
    console.error("[loyalty-accrue] EXCEPTION:", err?.message ?? err);
    return jsonError(err?.message ?? "Erro desconhecido", 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Rate-limit: envia "selo ganho" no máximo 1× a cada STAMP_RATE_LIMIT_HOURS por cliente.
async function shouldSendStampEarned(supabaseAdmin: any, customerId: string): Promise<boolean> {
  const since = new Date(Date.now() - STAMP_RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, orders!inner(customer_id)")
    .eq("event_type", "loyalty_stamp_earned")
    .eq("orders.customer_id", customerId)
    .gte("created_at", since)
    .in("status", ["PENDING", "SENT"])
    .limit(1);
  return !data || data.length === 0;
}

// Constrói URL do portal para o cliente. Cria/refresca loyalty_portal_token se ausente.
async function buildPortalUrl(supabaseAdmin: any, customerId: string): Promise<string | null> {
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("loyalty_portal_token, loyalty_portal_token_issued_at")
    .eq("id", customerId)
    .maybeSingle();

  let token = customer?.loyalty_portal_token;
  const issuedAt = customer?.loyalty_portal_token_issued_at;
  const expired = issuedAt && Date.now() - new Date(issuedAt).getTime() > 25 * 24 * 60 * 60 * 1000;

  if (!token || expired) {
    token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await supabaseAdmin
      .from("customers")
      .update({ loyalty_portal_token: token, loyalty_portal_token_issued_at: new Date().toISOString() })
      .eq("id", customerId);
  }

  const { data: baseSetting } = await supabaseAdmin.from("settings").select("value").eq("key", "loyalty_public_base_url").maybeSingle();
  const baseUrl = (baseSetting?.value ?? "").replace(/^"|"$/g, "").replace(/\/$/, "");
  if (!baseUrl) return null;
  return `${baseUrl}/fidelidade/${token}`;
}
