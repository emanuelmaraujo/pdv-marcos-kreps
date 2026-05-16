/* eslint-disable @typescript-eslint/no-explicit-any */
// Authenticated customer profile lookup for ADMIN / ATTENDANT use.
//
// Unlike the public sibling `get-public-customer-profile`, this endpoint does
// NOT require `remember_checkout_data = true` — the business has a legitimate
// interest in looking up any customer who already placed an order with them,
// regardless of whether that customer opted into being "remembered" by the
// public /pedir flow.
//
// Returns the same shape as the public endpoint plus a couple of fields useful
// to the attendant (orders_count, last_order_at).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeBrazilPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return `+55${digits}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, found: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    // ---- Auth: ADMIN or ATTENDANT only -----------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, found: false, error: "Nao autenticado." }, 401);
    }
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseClientAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) {
      return jsonResponse({ success: false, found: false, error: "Sessao invalida." }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (!profile?.active || (profile.role !== "ADMIN" && profile.role !== "ATTENDANT")) {
      return jsonResponse({ success: false, found: false, error: "Sem permissao." }, 403);
    }

    // ---- Lookup ----------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const phone = normalizeBrazilPhone(body.customer_phone);
    if (!phone) {
      return jsonResponse({ success: true, found: false });
    }

    const { data: customer, error: customerErr } = await supabaseAdmin
      .from("customers")
      .select("name, email, last_order_type, marketing_opt_in, remember_checkout_data, orders_count, last_order_at")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (customerErr) {
      // Pode indicar coluna ausente (migracao pendente). Nao bloqueia: retorna not_found.
      console.error("[get-customer-profile] lookup failed — possivel migracao pendente:", customerErr.message, customerErr.code);
      return jsonResponse({ success: true, found: false });
    }

    if (!customer) {
      return jsonResponse({ success: true, found: false });
    }

    return jsonResponse({
      success: true,
      found: true,
      profile: {
        name: customer.name ?? null,
        email: customer.email ?? null,
        order_type: customer.last_order_type ?? null,
        marketing_opt_in: customer.marketing_opt_in === true,
        remember_checkout_data: customer.remember_checkout_data === true,
        orders_count: Number(customer.orders_count ?? 0),
        last_order_at: customer.last_order_at ?? null,
      },
    });
  } catch (e: any) {
    console.error("[get-customer-profile] exception", e?.message ?? "unknown");
    return jsonResponse({ success: false, found: false, error: "Erro interno." }, 500);
  }
});
