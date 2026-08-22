/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: loyalty-expire (cron diário)
//
// Auth: x-cron-secret = LOYALTY_CRON_SECRET, OR Bearer JWT de ADMIN (botão manual).
//
// Passos:
//   1) Recompensas AVAILABLE com expires_at < now() → EXPIRED + tx EXPIRE (delta=0).
//   2) Selos avulsos (EARN órfãos mais velhos que stamp_ttl_days que NÃO contribuíram
//      pra recompensa nem foram revogados) → tx EXPIRE com delta negativo + ajusta cache.
//   3) Recompensas que vencem em <= 5 dias e ainda não receberam aviso → enfileira
//      template `loyalty_reward_expiring`.
//
// Retorna contadores p/ observabilidade.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { enqueueLoyaltyWhatsAppMessage } from "../_shared/whatsapp-enqueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PROGRAM_ID = "default";
const EXPIRING_WINDOW_DAYS = 5;

function jsonError(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function buildPortalUrlForCustomer(supabaseAdmin: any, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data: customer } = await supabaseAdmin.from("customers").select("loyalty_portal_token").eq("id", customerId).maybeSingle();
  if (!customer?.loyalty_portal_token) return null;
  const { data: baseSetting } = await supabaseAdmin.from("settings").select("value").eq("key", "loyalty_public_base_url").maybeSingle();
  const baseUrl = (baseSetting?.value ?? "").replace(/^"|"$/g, "").replace(/\/$/, "");
  if (!baseUrl) return null;
  return `${baseUrl}/fidelidade/${customer.loyalty_portal_token}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Auth
    const cron = req.headers.get("x-cron-secret");
    const expected = Deno.env.get("LOYALTY_CRON_SECRET") ?? "";
    if (!cron || cron !== expected) {
      // tenta Bearer ADMIN
      const auth = req.headers.get("Authorization");
      if (!auth) return jsonError("Não autorizado.", 401);
      const { data: { user } } = await supabaseAdmin.auth.getUser(auth.replace("Bearer ", ""));
      if (!user) return jsonError("Token inválido.", 401);
      const { data: profile } = await supabaseAdmin.from("profiles").select("role, active").eq("id", user.id).single();
      if (!profile?.active || profile.role !== "ADMIN") return jsonError("Apenas ADMIN.", 403);
    }

    const { data: program } = await supabaseAdmin.from("loyalty_programs").select("stamp_ttl_days").eq("id", PROGRAM_ID).maybeSingle();
    const stampTtl = program?.stamp_ttl_days ?? 180;
    const now = new Date();

    let expiredRewards = 0;
    let expiringNotified = 0;
    let expiredStamps = 0;

    // -------------------------------------------------------------------
    // 1) Recompensas vencidas → EXPIRED
    // -------------------------------------------------------------------
    const { data: toExpire } = await supabaseAdmin
      .from("loyalty_rewards")
      .select("id, account_id")
      .eq("status", "AVAILABLE")
      .lt("expires_at", now.toISOString())
      .limit(500);

    for (const r of toExpire ?? []) {
      const { error: updErr } = await supabaseAdmin.from("loyalty_rewards").update({ status: "EXPIRED" }).eq("id", r.id).eq("status", "AVAILABLE");
      if (updErr) continue;
      const { data: acc } = await supabaseAdmin.from("loyalty_accounts").select("current_stamps").eq("id", r.account_id).maybeSingle();
      await supabaseAdmin.from("loyalty_transactions").insert({
        account_id: r.account_id,
        kind: "EXPIRE",
        delta: 0,
        balance_after: acc?.current_stamps ?? 0,
        reward_id: r.id,
        reason: "reward_expired",
      });
      await supabaseAdmin.from("audit_logs").insert({ action: "LOYALTY_REWARD_EXPIRED", table_name: "loyalty_rewards", record_id: r.id });
      expiredRewards++;
    }

    // -------------------------------------------------------------------
    // 2) Selos avulsos vencidos
    // -------------------------------------------------------------------
    // Selos que: (a) são EARN, (b) não foram debitados para uma recompensa
    // (não há ADJUST/REVOKE depois deles que os anule), (c) mais velhos que TTL.
    //
    // Heurística simples e segura: para cada conta, contamos EARN mais velhos
    // que (now - stampTtl) e diminuímos do current_stamps respeitando o piso 0.
    const cutoff = new Date(now.getTime() - stampTtl * 24 * 60 * 60 * 1000).toISOString();
    const { data: accounts } = await supabaseAdmin.from("loyalty_accounts").select("id, current_stamps").gt("current_stamps", 0);

    for (const acc of accounts ?? []) {
      // selos earn antigos sem expire/revoke posterior:
      const { data: earnOld } = await supabaseAdmin.from("loyalty_transactions").select("id").eq("account_id", acc.id).eq("kind", "EARN").lt("created_at", cutoff);
      const earnOldCount = (earnOld ?? []).length;
      if (earnOldCount === 0) continue;

      const { data: alreadyExpired } = await supabaseAdmin.from("loyalty_transactions").select("delta").eq("account_id", acc.id).eq("kind", "EXPIRE").lt("created_at", cutoff).lt("delta", 0);
      const alreadyOff = (alreadyExpired ?? []).reduce((s: number, r: any) => s + Math.abs(r.delta), 0);
      const toLose = Math.min(acc.current_stamps, Math.max(earnOldCount - alreadyOff, 0));
      if (toLose <= 0) continue;

      const balanceAfter = acc.current_stamps - toLose;
      await supabaseAdmin.from("loyalty_transactions").insert({
        account_id: acc.id,
        kind: "EXPIRE",
        delta: -toLose,
        balance_after: balanceAfter,
        reason: "stamps_ttl_expired",
      });
      await supabaseAdmin.from("loyalty_accounts").update({ current_stamps: balanceAfter, last_activity_at: now.toISOString() }).eq("id", acc.id);
      expiredStamps += toLose;
    }

    // -------------------------------------------------------------------
    // 3) Avisos de recompensa vencendo (≤ 5 dias)
    // -------------------------------------------------------------------
    const warnUntil = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: soon } = await supabaseAdmin
      .from("loyalty_rewards")
      .select("id, code, label, expires_at, account_id, loyalty_accounts(customer_id, customers(name, phone_e164))")
      .eq("status", "AVAILABLE")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", warnUntil)
      .limit(500);

    // Pra rate-limitar 1 aviso por reward, checamos se já existe um audit_log
    // LOYALTY_REWARD_EXPIRING_NOTIFIED pra essa reward.
    for (const r of soon ?? []) {
      const customer = r.loyalty_accounts?.customers;
      if (!customer?.phone_e164) continue;

      const { data: priorNotice } = await supabaseAdmin.from("audit_logs").select("id").eq("action", "LOYALTY_REWARD_EXPIRING_NOTIFIED").eq("record_id", r.id).limit(1);
      if ((priorNotice ?? []).length > 0) continue;

      const portalUrl = await buildPortalUrlForCustomer(supabaseAdmin, r.loyalty_accounts?.customer_id ?? null);
      await enqueueLoyaltyWhatsAppMessage(supabaseAdmin, {
        eventType: "loyalty_reward_expiring",
        phone: customer.phone_e164,
        customerName: customer.name,
        payload: { reward_label: r.label, reward_code: r.code, expires_at: r.expires_at, portal_url: portalUrl },
      });
      await supabaseAdmin.from("audit_logs").insert({ action: "LOYALTY_REWARD_EXPIRING_NOTIFIED", table_name: "loyalty_rewards", record_id: r.id });
      expiringNotified++;
    }

    return new Response(
      JSON.stringify({ ok: true, expired_rewards: expiredRewards, expiring_notified: expiringNotified, expired_stamps: expiredStamps }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("[loyalty-expire] failed", err?.message);
    return jsonError(err?.message ?? "Erro desconhecido", 500);
  }
});
