/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function: get-public-loyalty
//
// Snapshot público da carteira de fidelidade do cliente.
// Auth: token opaco em `loyalty_portal_token` (gerado pelo loyalty-accrue ao montar a URL do portal).
//
// Input (POST):
//   { token: string, marketing_opt_in?: boolean }
//
// Quando marketing_opt_in é enviado, atualiza customers.marketing_opt_in
// (toggle do portal — LGPD).
//
// Retorna snapshot: programa, conta, recompensas ativas, últimas 10 tx.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((v) => v.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ****-${digits.slice(-4)}`;
}

const PROGRAM_ID = "default";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { success: false, error: "Método não permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 16) {
      return jsonResponse(req, { success: false, error: "Token inválido." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone_e164, marketing_opt_in, loyalty_portal_token_issued_at")
      .eq("loyalty_portal_token", token)
      .maybeSingle();
    if (!customer) return jsonResponse(req, { success: false, error: "Token não encontrado." }, 404);

    // Toggle de marketing opcional (chega quando o usuário clica no botão)
    if (typeof body.marketing_opt_in === "boolean") {
      await supabaseAdmin
        .from("customers")
        .update({ marketing_opt_in: body.marketing_opt_in, marketing_opt_in_at: new Date().toISOString() })
        .eq("id", customer.id);
      customer.marketing_opt_in = body.marketing_opt_in;
    }

    const { data: program } = await supabaseAdmin
      .from("loyalty_programs")
      .select("id, name, stamps_required, reward_label, reward_ttl_days, stamp_ttl_days, active")
      .eq("id", PROGRAM_ID)
      .maybeSingle();
    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("id, current_stamps, lifetime_stamps, enrolled_at, last_activity_at")
      .eq("customer_id", customer.id)
      .eq("program_id", PROGRAM_ID)
      .maybeSingle();

    const rewards = account
      ? (await supabaseAdmin.from("loyalty_rewards").select("id, code, label, status, issued_at, expires_at, redeemed_at").eq("account_id", account.id).order("issued_at", { ascending: false }).limit(20)).data ?? []
      : [];
    const transactions = account
      ? (await supabaseAdmin.from("loyalty_transactions").select("id, kind, delta, balance_after, order_id, reason, created_at").eq("account_id", account.id).order("created_at", { ascending: false }).limit(10)).data ?? []
      : [];

    const stampsRequired = program?.stamps_required ?? 10;
    const currentStamps = account?.current_stamps ?? 0;

    return jsonResponse(req, {
      success: true,
      customer: { name: customer.name, phone_masked: maskPhone(customer.phone_e164), marketing_opt_in: customer.marketing_opt_in },
      program: program ? { id: program.id, name: program.name, stamps_required: stampsRequired, reward_label: program.reward_label, active: program.active } : null,
      account: {
        enrolled: !!account,
        current_stamps: currentStamps,
        lifetime_stamps: account?.lifetime_stamps ?? 0,
        missing: Math.max(stampsRequired - currentStamps, 0),
        last_activity_at: account?.last_activity_at ?? null,
      },
      rewards,
      transactions,
    });
  } catch (err: any) {
    console.error("[get-public-loyalty] failed", err?.message);
    return jsonResponse(req, { success: false, error: err?.message ?? "Erro desconhecido" }, 500);
  }
});
