// Edge function: mark-payment
//
// Marca pagamento de um pedido (ou de itens específicos dele).
//
// Modos:
//   * Pedido inteiro: payload = { order_id, payment_method, payment_status, amount }
//     -> Marca todos os itens não cancelados com o mesmo status, registra um payment.
//        Se o user pediu PAID, exige amount == total não-cancelado.
//   * Por itens:      payload = { order_id, payment_method, payment_status, amount, order_item_ids: [..] }
//     -> Marca somente os itens listados. Exige amount == soma dos total_price desses itens
//        (quando status é PAID). Útil pra "fulano paga só o crepe dele".
//
// orders.payment_status é DERIVADO dos itens via trigger (PAID/PARTIAL/PENDING/COURTESY/REFUNDED).
// Esta função NÃO escreve mais em orders.payment_status — só nos itens.
//
// A regra financeira (seleção de itens elegíveis, checagem de duplicidade,
// soma de totais, taxa de embalagem/entrega e o insert em payments) roda
// dentro da RPC transacional pay_order_items_transactional, que trava o
// pedido e os itens (SELECT ... FOR UPDATE) para serializar chamadas
// concorrentes. Esta função só autentica, autoriza e delega.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["PENDING", "PAID", "REFUNDED", "CANCELED", "COURTESY"] as const;
const VALID_METHODS  = ["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "IFOOD", "PENDING", "COURTESY"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado.");
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseClientAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user }, error: userErr } = await supabaseClientAuth.auth.getUser(jwt);
    if (userErr || !user) throw new Error("Token inválido.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();
    if (!profile || !profile.active) throw new Error("Usuário sem profile ou inativo.");
    if (profile.role !== "ADMIN" && profile.role !== "ATTENDANT") {
      throw new Error("Role não autorizada.");
    }

    const { order_id, payment_method, payment_status, amount, notes, order_item_ids, ifood_charged_amount } = await req.json();

    if (!order_id) throw new Error("order_id ausente.");
    if (!VALID_STATUSES.includes(payment_status)) throw new Error("payment_status inválido.");
    if (!VALID_METHODS.includes(payment_method))   throw new Error("payment_method inválido.");
    if (payment_method === "IFOOD" && (typeof ifood_charged_amount !== "number" || Number.isNaN(ifood_charged_amount) || ifood_charged_amount < 0)) {
      throw new Error("ifood_charged_amount inválido.");
    }

    if (payment_status === "REFUNDED" && profile.role !== "ADMIN") {
      throw new Error("Apenas ADMIN pode estornar (REFUNDED).");
    }

    // Lê o pedido via JWT (RLS valida que o user opera a filial) — isso é o
    // que garante que ATTENDANT só paga pedidos da própria filial.
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, branch_id, daily_number, status, type, customer_name, customer_phone, notes, discount_amount, total_amount, packing_fee, payment_status, payment_method, paid_at")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido inexistente ou sem permissão.");

    // Toda a regra financeira (seleção de itens, checagem de duplicidade,
    // soma de totais, taxa de embalagem/entrega, bate-confere de amount e o
    // insert em payments/audit_logs) roda dentro da RPC transacional, que
    // trava o pedido e os itens via SELECT ... FOR UPDATE.
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      "pay_order_items_transactional",
      {
        p_order_id: order.id,
        p_actor_id: user.id,
        p_payment_method: payment_method,
        p_payment_status: payment_status,
        p_amount: typeof amount === "number" ? amount : null,
        p_item_ids: Array.isArray(order_item_ids) && order_item_ids.length > 0 ? order_item_ids : null,
        p_notes: notes ?? null,
        p_ifood_charged_amount: payment_method === "IFOOD" ? ifood_charged_amount : null,
      },
    );
    if (rpcErr) throw new Error(rpcErr.message);

    const targetItemIds: string[] = rpcResult?.target_item_ids ?? [];

    // Relê pedido com o relacionamento de branches (a RPC já retorna o
    // pedido, mas sem o join de branches necessário pra montar os tickets).
    const { data: orderAfter } = await supabaseAdmin
      .from("orders")
      .select("id, daily_number, status, type, customer_name, customer_phone, notes, discount_amount, total_amount, packing_fee, payment_status, payment_method, paid_at, branch_id, branches(code, name, printer_config)")
      .eq("id", order.id)
      .single();

    // ── Auto-confirmar pedidos de split-bill quando todos os itens são pagos ──────
    // Quando o pedido foi criado em AGUARDANDO_PAGAMENTO (dividir conta) e agora
    // ficou com payment_status = PAID, movemos para NA_FILA e criamos os printer_jobs.
    if (
      orderAfter?.status === "AGUARDANDO_PAGAMENTO" &&
      (orderAfter?.payment_status === "PAID" || orderAfter?.payment_status === "COURTESY")
    ) {
      const nowIso = new Date().toISOString();
      const branchCode = (orderAfter as any).branches?.code as string | undefined;
      const branchName = (orderAfter as any).branches?.name as string | undefined;

      // Busca itens e settings para montar as vias
      const [{ data: items }, { data: settingsData }] = await Promise.all([
        supabaseAdmin.from("order_items").select(`
          id, quantity, observation, product_name_snapshot, product_price_snapshot, total_price, production_sector, sequence_no,
          order_item_removed_ingredients(ingredient_name_snapshot),
          order_item_addons(addon_name_snapshot, quantity, addon_price_snapshot)
        `).eq("order_id", order.id),
        supabaseAdmin.from("settings").select("key, value").in("key", ["printing_enabled", "print_kitchen_copy", "print_juice_potato_copy", "print_customer_copy"]),
      ]);

      const settingBoolFn = (v: unknown, fb = false) => {
        if (typeof v === "boolean") return v;
        if (typeof v === "string") return v.trim().toLowerCase() === "true";
        return fb;
      };
      const find = (k: string) => settingsData?.find((s: any) => s.key === k)?.value;
      const printingEnabled = settingBoolFn(find("printing_enabled"), true);
      const ts = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const { parseBranchPrinterConfig, shouldPrint } = await import("../_shared/branch-print-cfg.ts");
      const branchCfg = parseBranchPrinterConfig((orderAfter as any).branches?.printer_config);

      const printerJobs: any[] = [];
      if (printingEnabled && items) {
        const kitchen = items.filter((i: any) => i.production_sector === "KITCHEN");
        const juice = items.filter((i: any) => i.production_sector === "JUICE_POTATO");
        if (kitchen.length > 0 && shouldPrint(settingBoolFn(find("print_kitchen_copy"), true), branchCfg, "kitchen")) {
          const { buildProductionReceipt } = await import("../_shared/print-format.ts");
          const orderObj = { ...orderAfter, daily_number: orderAfter.daily_number, type: order.type, customer_name: order.customer_name, customer_phone: order.customer_phone, notes: order.notes };
          printerJobs.push({ order_id: order.id, branch_id: order.branch_id, sector: "KITCHEN", content: { text: buildProductionReceipt(orderObj, items, "KITCHEN", { timestamp: ts, title: "KREPS", branchCode, branchName }) } });
        }
        if (juice.length > 0 && shouldPrint(settingBoolFn(find("print_juice_potato_copy"), true), branchCfg, "juice")) {
          const { buildProductionReceipt } = await import("../_shared/print-format.ts");
          const orderObj = { ...orderAfter, daily_number: orderAfter.daily_number, type: order.type, customer_name: order.customer_name, customer_phone: order.customer_phone, notes: order.notes };
          printerJobs.push({ order_id: order.id, branch_id: order.branch_id, sector: "JUICE_POTATO", content: { text: buildProductionReceipt(orderObj, items, "JUICE_POTATO", { timestamp: ts, title: "COZINHA", branchCode, branchName }) } });
        }
        if (shouldPrint(settingBoolFn(find("print_customer_copy")), branchCfg, "customer")) {
          const { buildCustomerReceipt } = await import("../_shared/print-format.ts");
          const orderObj = { ...orderAfter, daily_number: orderAfter.daily_number, type: order.type, customer_name: order.customer_name, customer_phone: order.customer_phone, notes: order.notes, packing_fee: order.packing_fee, discount_amount: order.discount_amount, total_amount: order.total_amount, payment_status: order.payment_status, payment_method: payment_method };
          printerJobs.push({ order_id: order.id, branch_id: order.branch_id, sector: "CUSTOMER", content: { text: buildCustomerReceipt(orderObj, items, { timestamp: ts, branchCode, branchName }) } });
        }
      }

      // Move para NA_FILA + printer jobs
      await Promise.all([
        supabaseAdmin.from("orders").update({
          status: "NA_FILA",
          confirmed_by: user.id,
          confirmed_at: nowIso,
          queue_entered_at: nowIso,
        }).eq("id", order.id),
        printerJobs.length > 0
          ? supabaseAdmin.from("printer_jobs").insert(printerJobs)
          : Promise.resolve(),
      ]);
    }

    return new Response(
      JSON.stringify({ success: true, order: orderAfter, items_paid: targetItemIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[mark-payment] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
