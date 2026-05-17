import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { settingBool, settingNumber } from "../_shared/print-format.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado.");

    const supabaseClientAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const jwt = authHeader.replace("Bearer ", "");
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

    const { order_item_id, addons, is_takeout } = await req.json();

    if (!order_item_id) throw new Error("order_item_id é obrigatório.");
    if (!Array.isArray(addons)) throw new Error("addons deve ser um array.");
    if (typeof is_takeout !== "boolean") throw new Error("is_takeout deve ser boolean.");

    // Busca o item com dados do pedido
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, product_id, product_price_snapshot, quantity, observation, status, payment_status")
      .eq("id", order_item_id)
      .single();
    if (itemErr || !item) throw new Error("Item não encontrado.");

    // Valida pedido via JWT (RLS garante que o atendente opera a filial correta)
    const { data: order, error: orderErr } = await supabaseClientAuth
      .from("orders")
      .select("id, status, discount_amount, branch_id")
      .eq("id", item.order_id)
      .single();
    if (orderErr || !order) throw new Error("Pedido não encontrado ou sem permissão.");

    if (order.status !== "NA_FILA") {
      throw new Error("Só é possível editar itens de pedidos com status NA_FILA.");
    }
    if (item.status === "CANCELLED") throw new Error("Item cancelado não pode ser editado.");
    if (item.status === "DELIVERED") throw new Error("Item já entregue não pode ser editado.");
    if (item.payment_status !== "PENDING") throw new Error("Item já pago não pode ser editado.");

    // Configurações para cálculo de embalagem
    const { data: settingsData } = await supabaseAdmin.from("settings").select("key, value");
    const settings = (settingsData ?? []).reduce(
      (acc: Record<string, unknown>, s: { key: string; value: unknown }) => ({ ...acc, [s.key]: s.value }),
      {},
    );

    // Valida e calcula adicionais novos
    let addonsTotalPrice = 0;
    const addonsSnapshots: Record<string, unknown>[] = [];

    for (const add of addons) {
      if (!add.addon_id || !(add.quantity > 0)) throw new Error("Dados de adicional inválidos.");

      const { data: addonDB, error: addErr } = await supabaseAdmin
        .from("addons")
        .select("id, name, price, active")
        .eq("id", add.addon_id)
        .single();
      if (addErr || !addonDB) throw new Error(`Adicional inexistente (${add.addon_id}).`);
      if (!addonDB.active) throw new Error(`Adicional "${addonDB.name}" não está ativo.`);

      const { data: prodAddon, error: paErr } = await supabaseAdmin
        .from("product_addons")
        .select("product_id")
        .eq("product_id", item.product_id)
        .eq("addon_id", add.addon_id)
        .single();
      if (paErr || !prodAddon) {
        throw new Error(`Adicional "${addonDB.name}" não é permitido para este produto.`);
      }

      addonsTotalPrice += Number(addonDB.price) * add.quantity * item.quantity;
      addonsSnapshots.push({
        order_item_id: item.id,
        addon_id: addonDB.id,
        quantity: add.quantity,
        addon_name_snapshot: addonDB.name,
        addon_price_snapshot: addonDB.price,
      });
    }

    const newItemTotal = Number(item.product_price_snapshot) * item.quantity + addonsTotalPrice;

    // Atualiza observation para refletir o destino do item
    let currentObs: string = (item.observation as string) ?? "";
    const VIAGEM_PREFIX = "[VIAGEM]";
    const hasPrefix = currentObs.startsWith(VIAGEM_PREFIX);
    if (is_takeout && !hasPrefix) {
      currentObs = `${VIAGEM_PREFIX} ${currentObs}`.trim();
    } else if (!is_takeout && hasPrefix) {
      currentObs = currentObs.replace(/^\[VIAGEM\]\s*/, "").trim();
    }
    const newObservation = currentObs || null;

    // Substitui adicionais (delete all + insert new)
    await supabaseAdmin
      .from("order_item_addons")
      .delete()
      .eq("order_item_id", item.id);

    if (addonsSnapshots.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("order_item_addons")
        .insert(addonsSnapshots);
      if (insertErr) throw new Error("Erro ao inserir adicionais: " + insertErr.message);
    }

    // Atualiza o item
    const { error: updateItemErr } = await supabaseAdmin
      .from("order_items")
      .update({
        total_price: newItemTotal,
        is_takeout: is_takeout,
        observation: newObservation,
      })
      .eq("id", item.id);
    if (updateItemErr) throw new Error("Erro ao atualizar item: " + updateItemErr.message);

    // Recalcula totais do pedido a partir de todos os itens ativos
    const { data: allItems, error: allItemsErr } = await supabaseAdmin
      .from("order_items")
      .select("total_price, is_takeout, quantity, status")
      .eq("order_id", item.order_id);
    if (allItemsErr) throw new Error("Erro ao ler itens do pedido.");

    const activeItems = (allItems ?? []).filter((i: any) => i.status !== "CANCELLED");
    const newSubtotal = activeItems.reduce((sum: number, i: any) => sum + Number(i.total_price), 0);

    let newPackingFee = 0;
    if (settingBool(settings.apply_packaging_fee_for_takeout)) {
      const feePerItem = settingNumber(settings.packaging_fee);
      if (feePerItem > 0) {
        const takeoutQty = activeItems.reduce(
          (sum: number, i: any) => sum + (i.is_takeout ? Number(i.quantity) : 0),
          0,
        );
        newPackingFee = takeoutQty * feePerItem;
      }
    }

    const discountAmount = Number(order.discount_amount ?? 0);
    const newTotal = Math.max(0, newSubtotal + newPackingFee - discountAmount);
    const newOrderType = activeItems.some((i: any) => i.is_takeout) ? "VIAGEM" : "BALCAO";

    const { error: updateOrderErr } = await supabaseAdmin
      .from("orders")
      .update({
        packing_fee: newPackingFee,
        total_amount: newTotal,
        type: newOrderType,
      })
      .eq("id", item.order_id);
    if (updateOrderErr) throw new Error("Erro ao atualizar pedido: " + updateOrderErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      action: "ORDER_ITEM_EDITED",
      table_name: "order_items",
      record_id: item.id,
      user_id: user.id,
      branch_id: order.branch_id,
      new_data: { is_takeout, addons_count: addonsSnapshots.length, new_item_total: newItemTotal },
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: { id: order.id, total_amount: newTotal, packing_fee: newPackingFee, type: newOrderType },
        item: { id: item.id, total_price: newItemTotal, is_takeout },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[edit-order-item] failed", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
