import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAllowedOrigin, publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { evaluateCoupon, normalizeCouponCode, type CouponRecord } from "../_shared/coupons.ts";

function getHeaders(req: Request) {
  return publicCorsHeaders(req);
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getHeaders(req) });
  if (req.method !== "POST") return json(req, { success: false, error: "Método não permitido." }, 405);

  try {
    if (!isAllowedOrigin(req)) return json(req, { success: false, error: "Origem não autorizada." }, 403);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const allowed = await checkRateLimit(
      supabaseAdmin,
      `coupon-ip:${getClientIp(req)}`,
      30,
      15 * 60,
    );
    if (!allowed) {
      return json(req, { success: false, valid: false, error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    }

    const body = await req.json();
    const code = normalizeCouponCode(body.coupon_code);
    const branchSlug = typeof body.branch_slug === "string" ? body.branch_slug.trim().slice(0, 32) : "";
    const subtotal = Number(body.subtotal);

    if (!code || !branchSlug || !Number.isFinite(subtotal) || subtotal < 0) {
      return json(req, { success: true, valid: false, error: "Cupom inválido." });
    }

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .eq("active", true)
      .maybeSingle();

    if (!branch) return json(req, { success: true, valid: false, error: "Cupom inválido." });

    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("id, code, description, discount_type, discount_value, min_subtotal, active, valid_from, valid_until")
      .eq("branch_id", branch.id)
      .eq("code", code)
      .maybeSingle();

    if (error) throw error;

    const evaluation = evaluateCoupon(coupon as CouponRecord | null, subtotal);
    if (!evaluation.valid) {
      return json(req, { success: true, valid: false, error: evaluation.error });
    }

    return json(req, {
      success: true,
      valid: true,
      coupon: {
        code: coupon!.code,
        description: coupon!.description,
        discount_type: coupon!.discount_type,
        discount_value: Number(coupon!.discount_value),
        min_subtotal: Number(coupon!.min_subtotal),
        discount_amount: evaluation.discountAmount,
      },
    });
  } catch (error) {
    console.error("[validate-coupon]", error);
    return json(req, { success: false, valid: false, error: "Não foi possível validar o cupom." }, 500);
  }
});
