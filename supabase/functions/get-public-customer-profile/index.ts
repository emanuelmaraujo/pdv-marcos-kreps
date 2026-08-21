/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAllowedOrigin, publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

type JsonRecord = Record<string, unknown>;

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req);
}

function jsonResponse(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizeBrazilPhone(value: unknown) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, found: false, error: "Metodo nao permitido." }, 405);
  }

  try {
    if (!isAllowedOrigin(req)) {
      return jsonResponse(req, { success: false, found: false, error: "Origem nao autorizada." }, 403);
    }

    const { customer_phone } = await req.json();
    const phone = normalizeBrazilPhone(customer_phone);
    if (!phone) {
      return jsonResponse(req, { success: true, found: false }, 200);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Rate limit: sem isso, o autofill do checkout (chamado a cada telefone
    // válido digitado) vira um oráculo de enumeração — dá pra varrer números
    // e colher nome/e-mail/endereços de qualquer cliente cadastrado. Mesmo
    // padrão do lookup-orders-by-phone: por telefone (mais restrito) e por
    // IP (contra varredura de vários telefones). Falha genérica (found:false)
    // pra não revelar que o limite bateu.
    const clientIp = getClientIp(req);
    const [phoneOk, ipOk] = await Promise.all([
      checkRateLimit(supabaseAdmin, `profile-phone:${phone}`, 10, 15 * 60),
      checkRateLimit(supabaseAdmin, `profile-ip:${clientIp}`, 30, 15 * 60),
    ]);
    if (!phoneOk || !ipOk) {
      await supabaseAdmin.from("audit_logs").insert({
        action: "PROFILE_LOOKUP_RATE_LIMITED",
        table_name: "customers",
        new_data: { phone, ip: clientIp, scope: !phoneOk ? "PHONE" : "IP" },
      });
      return jsonResponse(req, { success: true, found: false }, 200);
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("customers")
      .select("id, name, email, last_order_type, marketing_opt_in")
      .eq("phone_e164", phone)
      .eq("remember_checkout_data", true)
      .maybeSingle();

    if (profileErr) {
      console.error("[get-public-customer-profile] profile lookup failed", {
        message: profileErr.message,
        details: profileErr.details,
        hint: profileErr.hint,
        code: profileErr.code,
      });

      const { data: fallbackProfile, error: fallbackErr } = await supabaseAdmin
        .from("customers")
        .select("name, marketing_opt_in")
        .eq("phone_e164", phone)
        .maybeSingle();

      if (fallbackErr || !fallbackProfile) {
        return jsonResponse(req, { success: true, found: false }, 200);
      }

      return jsonResponse(req, {
        success: true,
        found: true,
        profile: {
          name: fallbackProfile.name,
          email: null,
          order_type: null,
          marketing_opt_in: fallbackProfile.marketing_opt_in === true,
        },
      }, 200);
    }

    if (!profile) {
      return jsonResponse(req, { success: true, found: false }, 200);
    }

    const { data: addresses } = await supabaseAdmin
      .from("customer_addresses")
      .select("id, label, street, number, complement, neighborhood, city, state, postal_code, reference, is_default, latitude, longitude")
      .eq("customer_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    return jsonResponse(req, {
      success: true,
      found: true,
      profile: {
        name: profile.name,
        email: profile.email,
        order_type: profile.last_order_type,
        marketing_opt_in: profile.marketing_opt_in === true,
      },
      addresses: addresses ?? [],
    }, 200);
  } catch (error: any) {
    console.error("[get-public-customer-profile]", error);
    return jsonResponse(req, { success: true, found: false }, 200);
  }
});
