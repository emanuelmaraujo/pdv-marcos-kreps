/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  const allowOrigin = configured === "*" || allowed.includes(origin) ? origin || "*" : allowed[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  if (configured === "*" || !origin) return true;
  return configured.split(",").map((value) => value.trim()).filter(Boolean).includes(origin);
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { success: false, error: 'Metodo nao permitido.' }, 405);
  }

  try {
    if (!isAllowedOrigin(req)) {
      return jsonResponse(req, { success: false, error: 'Origem nao autorizada.' }, 403);
    }

    // Usamos Service Role para ignorar RLS nas policies de read
    // Já que o público é estritamente travado, buscamos com token de admin
    // mas garantimos segurança validando o public_token exato que é um segredo longo.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { daily_number, public_token } = await req.json();

    if (!daily_number || !public_token) {
      throw new Error('Faltam parâmetros de busca (daily_number e public_token).');
    }

    // Busca exata e única pelo número E token
    const { data: order, error } = await supabaseClient
      .from('orders')
      .select('id, daily_number, status, payment_status, payment_method, total_amount, customer_name, created_at, confirmed_at, ready_at, delivered_at')
      .eq('daily_number', daily_number)
      .eq('public_token', public_token)
      .single();

    // Se error for Not Found, ou order for null, a mensagem é genérica para não vazar info.
    if (error || !order) {
      throw new Error('Pedido não encontrado ou credenciais inválidas.');
    }

    const { data: transaction } = await supabaseClient
      .from('payment_transactions')
      .select('provider_status, provider_status_detail, internal_payment_method, qr_code, qr_code_base64, ticket_url, expires_at, provider_payment_id, updated_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return jsonResponse(req, { 
      success: true, 
      order: {
        daily_number: order.daily_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total: order.total_amount,
        customer_name: order.customer_name,
        created_at: order.created_at,
        confirmed_at: order.confirmed_at,
        ready_at: order.ready_at,
        delivered_at: order.delivered_at
      },
      transaction
    }, 200);

  } catch (error: any) {
    return jsonResponse(req, { success: false, error: error.message }, 400);
  }
});
