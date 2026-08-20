// Edge function: courier-delivery-report
//
// Painel agregado de métricas de entrega por entregador/filial/dia (Fase 4).
// ADMIN-only, mesmo padrão de auth do cash-report. Agrega em JS (não em SQL)
// pelo mesmo motivo do cash-report: volume baixo o bastante pra não precisar
// de RPC dedicada, e mantém a lógica de agregação testável/legível em TS.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPORT_TZ = "America/Sao_Paulo";

function spDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return diffMs / 60000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();
    if (profileError || !profile || profile.role !== "ADMIN" || !profile.active) {
      return new Response(JSON.stringify({ error: "Acesso negado: Apenas administradores ativos." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { start_date, end_date, branch_id } = await req.json();

    let query = supabaseAdmin
      .from("orders")
      .select("id, branch_id, courier_id, courier_name, ready_at, dispatched_at, delivery_delivered_at")
      .eq("type", "ENTREGA")
      .not("delivery_delivered_at", "is", null);

    if (start_date) query = query.gte("delivery_delivered_at", start_date);
    if (end_date) query = query.lte("delivery_delivered_at", end_date);
    if (branch_id) query = query.eq("branch_id", branch_id);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw ordersError;

    const branchIds = Array.from(new Set((orders ?? []).map((o: any) => o.branch_id).filter(Boolean)));
    const courierIds = Array.from(new Set((orders ?? []).map((o: any) => o.courier_id).filter(Boolean)));

    const [{ data: branches }, { data: couriers }] = await Promise.all([
      branchIds.length > 0
        ? supabaseAdmin.from("branches").select("id, name").in("id", branchIds)
        : Promise.resolve({ data: [] as any[] }),
      courierIds.length > 0
        ? supabaseAdmin.from("couriers").select("id, name").in("id", courierIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const branchNameById = new Map((branches ?? []).map((b: any) => [b.id, b.name]));
    const courierNameById = new Map((couriers ?? []).map((c: any) => [c.id, c.name]));

    type GroupKey = string;
    const groups = new Map<GroupKey, {
      courier_id: string | null;
      courier_name: string;
      branch_id: string;
      branch_name: string;
      day: string;
      deliveries: number;
      dispatchToDeliveredMinutes: number[];
      readyToDispatchMinutes: number[];
    }>();

    for (const order of orders ?? []) {
      const day = spDateKey(order.delivery_delivered_at);
      const key = `${order.courier_id ?? "avulso"}::${order.branch_id}::${day}`;
      if (!groups.has(key)) {
        groups.set(key, {
          courier_id: order.courier_id,
          courier_name: order.courier_id
            ? (courierNameById.get(order.courier_id) ?? order.courier_name ?? "Entregador removido")
            : (order.courier_name || "Entregador avulso"),
          branch_id: order.branch_id,
          branch_name: branchNameById.get(order.branch_id) ?? "Filial removida",
          day,
          deliveries: 0,
          dispatchToDeliveredMinutes: [],
          readyToDispatchMinutes: [],
        });
      }
      const group = groups.get(key)!;
      group.deliveries += 1;
      const dispatchToDelivered = minutesBetween(order.dispatched_at, order.delivery_delivered_at);
      if (dispatchToDelivered !== null) group.dispatchToDeliveredMinutes.push(dispatchToDelivered);
      const readyToDispatch = minutesBetween(order.ready_at, order.dispatched_at);
      if (readyToDispatch !== null) group.readyToDispatchMinutes.push(readyToDispatch);
    }

    const avg = (values: number[]) =>
      values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

    const rows = Array.from(groups.values())
      .map((g) => ({
        courier_id: g.courier_id,
        courier_name: g.courier_name,
        branch_id: g.branch_id,
        branch_name: g.branch_name,
        day: g.day,
        deliveries: g.deliveries,
        avg_dispatch_to_delivered_minutes: avg(g.dispatchToDeliveredMinutes),
        avg_ready_to_dispatch_minutes: avg(g.readyToDispatchMinutes),
      }))
      .sort((a, b) => (a.day === b.day ? a.courier_name.localeCompare(b.courier_name) : b.day.localeCompare(a.day)));

    return new Response(JSON.stringify({ success: true, rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[courier-delivery-report] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
