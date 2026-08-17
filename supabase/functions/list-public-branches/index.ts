// Edge function: list-public-branches
// Retorna a lista pública de filiais ativas com pedidos online habilitados.
// Usado pelo /pedir (landing) para mostrar um picker quando o cliente acessa
// a URL raiz e precisa escolher onde pedir.
//
// Não exige auth — são dados públicos (nome, slug, code, endereço, horário).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { publicCorsHeaders } from "../_shared/public-cors.ts";

function getCorsHeaders(req: Request) {
  return publicCorsHeaders(req, { methods: "GET, POST, OPTIONS", cacheControl: "public, max-age=60" });
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
