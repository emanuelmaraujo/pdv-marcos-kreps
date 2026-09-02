/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-accrue
//
// Concede selos ao cliente por itens de crepe/krep pagos (Fase 1: selo por
// unidade, não por pedido — decisão de negócio 2026-08-20).
//
// Trust-no-client: chamada interna por mark-payment (fire-and-forget) e pelo
// cron loyalty-reconcile (rede de segurança).
// Autenticação: header `x-internal-secret` deve bater com env LOYALTY_INTERNAL_SECRET.
//
// Idempotência: tabela loyalty_stamp_credits (PK order_item_id) — cada item
// pago só gera 1 crédito, não importa quantas vezes esta function seja
// chamada para o pedido (retries, reconcile revisitando, etc).
// Resiliência: nunca lança HTTP 500 — sempre retorna 200 com `{ ok, reason? }` para que o caller
//              (mark-payment) não precise lidar com erros (loyalty é melhoria, não bloqueia caixa).
//
// Input: { order_id, order_item_ids?: string[] }
//   - order_item_ids presente (mark-payment): considera só esses itens (os que
//     acabaram de virar PAID/COURTESY nesta chamada).
//   - order_item_ids ausente (loyalty-reconcile): considera todos os itens já
//     PAID/COURTESY do pedido ainda não creditados — rede de segurança.
//
// Lógica:
//   1) valida pedido PAID/COURTESY nos itens-alvo + customer_id + total >= min_order_brl
//   2) filtra itens de categoria counts_for_loyalty=true dentre os itens-alvo
//   3) upsert loyalty_accounts
//   4) credita 1 linha em loyalty_stamp_credits por order_item_id (idempotente)
//      — delta = soma de quantity dos itens efetivamente creditados agora
//   5) INSERT EARN(delta) + UPDATE conta (current_stamps, lifetime_stamps)
//   6) enquanto current_stamps >= stamps_required → emite recompensa + ADJUST(-N)
//      (pode disparar mais de uma recompensa numa única chamada, ex.: pagou 12
//      crepes de uma vez com stamps_required=10)
//   7) enfileira WhatsApp (stamp_earned com rate-limit 48h, ou reward_ready por recompensa)
//   8) registra audit_log

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { enqueueLoyaltyWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

const PROGRAM_ID = "default";
const STAMP_RATE_LIMIT_HOURS = 48;

// Gera um code curto e falável (sem caracteres ambíguos): KRP-XXXX-XXXX
function generateRewardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
  const block = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `KRP-${block(4)}-${block(4)}`;
}

function jsonOk(req: Request, payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status,
    headers: { ...publicCorsHeaders(req, { extraHeaders: "x-internal-secret" }), "Content-Type": "application/json" },
  });
}

function jsonSkip(req: Request, reason: string): Response {
  return new Response(JSON.stringify({ ok: true, skipped: true, reason }), {
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
    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("LOYALTY_INTERNAL_SECRET") ?? "";
    if (!expected || internalSecret !== expected) {
      return jsonError(req, "Acesso negado.", 401);
    }

    const { order_id, order_item_ids } = await req.json().catch(() => ({}));
    if (!order_id) return jsonError(req, "order_id ausente.");
    const scopedItemIds: string[] | null = Array.isArray(order_item_ids) && order_item_ids.length > 0 ? order_item_ids : null;

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
    if (!loyaltyEnabled) return jsonSkip(req, "feature_disabled");

    // Programa
    const { data: program } = await supabaseAdmin.from("loyalty_programs").select("*").eq("id", PROGRAM_ID).maybeSingle();
    if (!program || !program.active) return jsonSkip(req, "program_inactive");

    // Pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, branch_id, customer_id, customer_name, customer_phone, total_amount, branches(name)")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) return jsonError(req, `Pedido inexistente: ${orderErr?.message ?? "not found"}`);
    if (!order.customer_id) return jsonSkip(req, "order_without_customer");

    // Escopo de filial (vazio = todas)
    const scope: string[] = Array.isArray(program.branch_scope) ? program.branch_scope : [];
    if (scope.length > 0 && order.branch_id && !scope.includes(order.branch_id)) {
      return jsonSkip(req, "branch_not_in_scope");
    }

    // Valor mínimo do pedido
    if (Number(order.total_amount ?? 0) < Number(program.min_order_brl ?? 0)) {
      return jsonSkip(req, "below_min_order");
    }

    // Itens elegíveis: pagos/cortesia, de categoria que conta selo, dentro do escopo pedido.
    let itemsQuery = supabaseAdmin
      .from("order_items")
      .select("id, quantity, payment_status, products(category_id, categories(counts_for_loyalty))")
      .eq("order_id", order_id)
      .in("payment_status", ["PAID", "COURTESY"]);
    if (scopedItemIds) itemsQuery = itemsQuery.in("id", scopedItemIds);
    const { data: paidItems, error: itemsErr } = await itemsQuery;
    if (itemsErr) return jsonError(req, `Erro ao ler itens: ${itemsErr.message}`);

    const eligibleItems = (paidItems ?? []).filter((it: any) => it.products?.categories?.counts_for_loyalty === true);
    if (eligibleItems.length === 0) return jsonSkip(req, "no_eligible_items");

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
        if (!reread) return jsonError(req, `Erro ao criar conta: ${insErr.message}`);
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

    // Trava por item: tenta inserir 1 linha por order_item_id elegível — só os
    // que não existiam antes contam pra este crédito (idempotência real).
    const { data: insertedCredits, error: creditsErr } = await supabaseAdmin
      .from("loyalty_stamp_credits")
      .upsert(
        eligibleItems.map((it: any) => ({ order_item_id: it.id, account_id: account.id })),
        { onConflict: "order_item_id", ignoreDuplicates: true },
      )
      .select("order_item_id");
    if (creditsErr) return jsonError(req, `Erro ao travar itens: ${creditsErr.message}`);

    const creditedIds = new Set((insertedCredits ?? []).map((r: any) => r.order_item_id));
    const newlyCreditedItems = eligibleItems.filter((it: any) => creditedIds.has(it.id));
    const delta = newlyCreditedItems.reduce((sum: number, it: any) => sum + (it.quantity ?? 1), 0);
    if (delta <= 0) return jsonSkip(req, "already_credited");

    const newBalance = (account.current_stamps ?? 0) + delta;
    const { data: earnTx, error: txErr } = await supabaseAdmin
      .from("loyalty_transactions")
      .insert({
        account_id: account.id,
        kind: "EARN",
        delta,
        balance_after: newBalance,
        order_id: order.id,
        reason: "order_items_paid",
      })
      .select("id")
      .single();
    if (txErr || !earnTx) return jsonError(req, `Erro ao registrar selo: ${txErr?.message}`);

    // Vincula a transação criada às linhas de trava (auditoria — não afeta idempotência).
    await supabaseAdmin.from("loyalty_stamp_credits").update({ transaction_id: earnTx.id }).in("order_item_id", Array.from(creditedIds));

    // Atualiza cache
    const { data: updatedAccount, error: updErr } = await supabaseAdmin
      .from("loyalty_accounts")
      .update({
        current_stamps: newBalance,
        lifetime_stamps: (account.lifetime_stamps ?? 0) + delta,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select("*")
      .single();
    if (updErr || !updatedAccount) return jsonError(req, `Erro ao atualizar conta: ${updErr?.message}`);

    await supabaseAdmin.from("audit_logs").insert({
      action: "LOYALTY_STAMP_EARNED",
      table_name: "loyalty_accounts",
      record_id: account.id,
      branch_id: order.branch_id,
      new_data: { order_id: order.id, delta, balance_after: newBalance, item_count: newlyCreditedItems.length },
    });

    // Atingiu (ou passou de) limiar? Emite recompensas em série (pode ser mais de 1).
    const stampsRequired = program.stamps_required ?? 10;
    let runningBalance = newBalance;
    const rewardsIssued: { id: string; code: string; label: string; expires_at: string }[] = [];
    while (runningBalance >= stampsRequired) {
      const code = generateRewardCode();
      const expiresAt = new Date(Date.now() + (program.reward_ttl_days ?? 30) * 24 * 60 * 60 * 1000).toISOString();
      const { data: reward, error: rewardErr } = await supabaseAdmin
        .from("loyalty_rewards")
        .insert({ account_id: account.id, program_id: PROGRAM_ID, code, label: program.reward_label, expires_at: expiresAt })
        .select("id, code, label, expires_at")
        .single();
      if (rewardErr || !reward) break;

      const balanceAfterUnlock = runningBalance - stampsRequired;
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
      rewardsIssued.push(reward);
      runningBalance = balanceAfterUnlock;
    }

    // WhatsApp: recompensa(s) liberada(s) tem prioridade sobre aviso de selo.
    const portalUrl = await buildPortalUrl(supabaseAdmin, order.customer_id);
    const branchName = (order as any).branches?.name ?? null;

    if (rewardsIssued.length > 0) {
      for (const reward of rewardsIssued) {
        await enqueueLoyaltyWhatsAppMessage(supabaseAdmin, {
          eventType: "loyalty_reward_ready",
          phone: order.customer_phone,
          customerName: order.customer_name,
          orderId: order.id,
          branchId: order.branch_id,
          branchName,
          payload: {
            stamps_required: stampsRequired,
            reward_label: reward.label,
            reward_code: reward.code,
            expires_at: reward.expires_at,
            portal_url: portalUrl,
          },
        });
      }
    } else if (await shouldSendStampEarned(supabaseAdmin, order.customer_id)) {
      const missing = Math.max(stampsRequired - runningBalance, 0);
      await enqueueLoyaltyWhatsAppMessage(supabaseAdmin, {
        eventType: "loyalty_stamp_earned",
        phone: order.customer_phone,
        customerName: order.customer_name,
        orderId: order.id,
        branchId: order.branch_id,
        branchName,
        payload: {
          current_stamps: runningBalance,
          stamps_required: stampsRequired,
          missing,
          reward_label: program.reward_label,
          portal_url: portalUrl,
        },
      });
    }

    return jsonOk(req, {
      account_id: account.id,
      stamps_credited: delta,
      current_stamps: runningBalance,
      rewards_issued: rewardsIssued.map((r) => r.code),
    });
  } catch (err: any) {
    console.error("[loyalty-accrue] EXCEPTION:", err?.message ?? err);
    return jsonError(req, err?.message ?? "Erro desconhecido", 500);
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
