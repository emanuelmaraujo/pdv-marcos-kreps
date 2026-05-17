// Edge function: lookup-orders-by-phone
// Permite cliente recuperar acesso ao acompanhamento dos pedidos dele
// pelo número do WhatsApp — útil quando perdeu o link/token original.
//
// Privacidade: SÓ retorna pedidos ATIVOS (não entregue/cancelado/expirado)
// criados nas últimas 4 horas. Janela curta limita exposição se alguém
// enumerar telefones aleatórios.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const LOOKUP_WINDOW_HOURS = 4;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((v) => v.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Normaliza phone BR para E.164 (+55...). Retorna null se inválido. */
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Método não permitido." }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const phone = normalizeBrazilPhone(body?.phone);

    if (!phone) {
      return jsonResponse(req, {
        success: false,
        error: "Informe um WhatsApp válido com DDD.",
        orders: [],
      }, 400);
    }

    // Janela: últimas 4 horas, apenas pedidos ativos
    const windowStart = new Date(Date.now() - LOOKUP_WINDOW_HOURS * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(`
        public_token,
        daily_number,
        status,
        payment_status,
        total_amount,
        created_at,
        branch:branches(name, code, slug)
      `)
      .eq("customer_phone", phone)
      .gte("created_at", windowStart.toISOString())
      .not("status", "in", "(ENTREGUE,CANCELADO,EXPIRADO)")
      .not("public_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw new Error(error.message);

    // Achata branch (vem como array no select)
    const orders = (data ?? []).map((row: any) => {
      const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
      return {
        public_token: row.public_token,
        daily_number: row.daily_number,
        status: row.status,
        payment_status: row.payment_status,
        total_amount: row.total_amount,
        created_at: row.created_at,
        branch_name: branch?.name ?? null,
        branch_code: branch?.code ?? null,
        branch_slug: branch?.slug ?? null,
      };
    });

    return jsonResponse(req, {
      success: true,
      orders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar pedidos.";
    return jsonResponse(req, { success: false, error: message, orders: [] }, 400);
  }
});
