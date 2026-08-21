// Edge function: subscribe-order-push
//
// Inscreve o navegador do cliente pra receber Web Push quando o pedido dele
// ficar pronto. Sem login público — a autorização é o próprio public_token
// (mesmo padrão de get-public-order-status): quem tem o token do pedido pode
// inscrever notificações pra ele, nada além disso.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isAllowedOrigin, publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req);
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

const TERMINAL_STATUSES = ["ENTREGUE", "CANCELADO", "EXPIRADO"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Método não permitido." }, 405);
  }

  try {
    if (!isAllowedOrigin(req)) {
      return jsonResponse(req, { success: false, error: "Origem não autorizada." }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const publicToken = typeof body.public_token === "string" ? body.public_token : null;
    const subscription = body.subscription;
    const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : null;
    const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : null;
    const auth = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : null;

    if (!publicToken || !endpoint || !p256dh || !auth) {
      return jsonResponse(req, { success: false, error: "Inscrição inválida." }, 400);
    }

    // Rate limit por IP — evita flood de linhas em push_subscriptions.
    const clientIp = getClientIp(req);
    const ipOk = await checkRateLimit(supabaseAdmin, `push-subscribe-ip:${clientIp}`, 20, 15 * 60);
    if (!ipOk) {
      return jsonResponse(req, { success: false, error: "Muitas tentativas. Tente novamente em alguns minutos." }, 429);
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("public_token", publicToken)
      .single();

    if (orderErr || !order) {
      return jsonResponse(req, { success: false, error: "Pedido não encontrado." }, 404);
    }
    if (TERMINAL_STATUSES.includes(order.status)) {
      return jsonResponse(req, { success: false, error: "Este pedido já foi concluído." }, 400);
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert({
        order_id: order.id,
        endpoint,
        p256dh,
        auth,
      }, { onConflict: "order_id,endpoint" });

    if (upsertErr) {
      console.error("[subscribe-order-push] upsert failed", upsertErr.message);
      throw new Error("Erro ao salvar inscrição.");
    }

    return jsonResponse(req, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao inscrever notificações.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
