// Edge function: lookup-cep
// Proxy público para o ViaCEP — usado pelo checkout (/pedir) e pelo fluxo do
// atendente (novo-pedido) para autofill de endereço a partir do CEP.
//
// Esta é só a camada de UX (autofill). A validação autoritativa acontece de
// novo, no servidor, em create-public-order/create-attendant-order — nunca
// confiamos no endereço que o cliente devolve depois do autofill.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { publicCorsHeaders } from "../_shared/public-cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { fetchCepAddress, isValidCepFormat } from "../_shared/cep.ts";

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req, { cacheControl: "no-store" });
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cep = String(body?.cep ?? "").replace(/\D/g, "");

    if (!isValidCepFormat(cep)) {
      return jsonResponse(req, { success: false, error: "CEP inválido." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Só limita abuso de UX (autofill) — a checagem que importa de verdade é a
    // revalidação no servidor na criação do pedido.
    const clientIp = getClientIp(req);
    const ipOk = await checkRateLimit(supabaseAdmin, `lookup-cep-ip:${clientIp}`, 30, 15 * 60);
    if (!ipOk) {
      return jsonResponse(req, {
        success: false,
        error: "Muitas tentativas. Tente novamente em alguns minutos.",
      }, 429);
    }

    const address = await fetchCepAddress(cep);
    if (!address) {
      return jsonResponse(req, { success: false, error: "CEP não encontrado." }, 404);
    }

    return jsonResponse(req, {
      success: true,
      address: {
        street: address.street,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar CEP.";
    return jsonResponse(req, { success: false, error: message }, 400);
  }
});
