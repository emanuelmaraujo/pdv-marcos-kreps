// Edge function: list-public-branches
// Retorna a lista pública de filiais ativas com pedidos online habilitados.
// Usado pelo /pedir (landing) para mostrar um picker quando o cliente acessa
// a URL raiz e precisa escolher onde pedir.
//
// Não exige auth — são dados públicos (nome, slug, code, endereço, horário).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((v) => v.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "public, max-age=60",
  };
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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("id, code, name, slug, type, address, ordering_start_time, ordering_end_time")
      .eq("active", true)
      .eq("ordering_enabled", true)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return jsonResponse(req, {
      success: true,
      branches: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar filiais.";
    return jsonResponse(req, { success: false, error: message, branches: [] }, 400);
  }
});
