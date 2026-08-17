// Testes de concorrência para a RPC pay_order_items_transactional (Fase P0.1).
//
// Requer supabase local rodando (`npx supabase start`) e as migrations aplicadas
// (`npx supabase db reset`). Roda com Deno:
//
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role do `supabase status`> \
//   deno run --allow-net --allow-env scripts/test-payment-concurrency.ts
//
// Cobre os cenários exigidos pelo plano de ação (Fase P0.1):
//   1. Duas chamadas paralelas pagando o mesmo item -> só uma efetiva.
//   2. Duas chamadas paralelas pagando o pedido inteiro -> só uma efetiva.
//   3. Pagamento parcial de item A e item B em paralelo -> ambas efetivas, sem conflito.
//   4. Tentativa de amount divergente -> rejeitada.
//   5. Tentativa de estorno (REFUNDED) por ATTENDANT -> rejeitada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam variáveis de ambiente! Configure SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let failures = 0;
const ok = (label: string) => console.log(`✅ ${label}`);
const bad = (label: string, detail: unknown) => {
  failures++;
  console.error(`❌ ${label}\n   ${JSON.stringify(detail)}`);
};

async function createTestOrder(branchId: string, productId: string, attendantId: string, itemCount = 2) {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      daily_number: Math.floor(Math.random() * 100000),
      branch_id: branchId,
      type: "BALCAO",
      source: "ATTENDANT",
      status: "NA_FILA",
      created_by: attendantId,
      packing_fee: 2,
      total_amount: 0,
    })
    .select("id")
    .single();
  if (orderErr || !order) throw new Error(`Falha ao criar pedido de teste: ${orderErr?.message}`);

  const items = Array.from({ length: itemCount }).map(() => ({
    order_id: order.id,
    product_id: productId,
    product_name_snapshot: "Item de teste",
    product_price_snapshot: 10,
    total_price: 10,
  }));
  const { data: insertedItems, error: itemsErr } = await supabase
    .from("order_items")
    .insert(items)
    .select("id, total_price");
  if (itemsErr || !insertedItems) throw new Error(`Falha ao criar itens de teste: ${itemsErr?.message}`);

  return { orderId: order.id as string, items: insertedItems as { id: string; total_price: number }[] };
}

async function payRpc(params: Record<string, unknown>) {
  return supabase.rpc("pay_order_items_transactional", params);
}

async function setup() {
  const { data: branch } = await supabase.from("branches").select("id").eq("active", true).limit(1).single();
  const { data: product } = await supabase.from("products").select("id").limit(1).single();
  const { data: admin } = await supabase.from("profiles").select("id").eq("role", "ADMIN").eq("active", true).limit(1).single();
  const { data: attendant } = await supabase.from("profiles").select("id").eq("role", "ATTENDANT").eq("active", true).limit(1).single();

  if (!branch || !product || !admin || !attendant) {
    throw new Error(
      "Setup incompleto: é preciso ao menos 1 branch ativa, 1 product, 1 profile ADMIN ativo e 1 profile ATTENDANT ativo no banco local.",
    );
  }
  return { branchId: branch.id as string, productId: product.id as string, adminId: admin.id as string, attendantId: attendant.id as string };
}

async function testSameItemRace(ctx: Awaited<ReturnType<typeof setup>>) {
  const { orderId, items } = await createTestOrder(ctx.branchId, ctx.productId, ctx.attendantId, 1);
  const item = items[0];

  const [r1, r2] = await Promise.all([
    payRpc({
      p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH",
      p_payment_status: "PAID", p_amount: item.total_price, p_item_ids: [item.id],
    }),
    payRpc({
      p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH",
      p_payment_status: "PAID", p_amount: item.total_price, p_item_ids: [item.id],
    }),
  ]);

  const successCount = [r1, r2].filter((r) => !r.error).length;
  const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("order_id", orderId);

  if (successCount === 1 && count === 1) {
    ok("Mesmo item pago em paralelo -> exatamente 1 pagamento efetivo");
  } else {
    bad("Mesmo item pago em paralelo", { successCount, paymentsInserted: count, r1: r1.error?.message, r2: r2.error?.message });
  }
}

async function testWholeOrderRace(ctx: Awaited<ReturnType<typeof setup>>) {
  const { orderId, items } = await createTestOrder(ctx.branchId, ctx.productId, ctx.attendantId, 2);
  const total = items.reduce((s, i) => s + Number(i.total_price), 0) + 2; // + packing_fee

  const [r1, r2] = await Promise.all([
    payRpc({ p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH", p_payment_status: "PAID", p_amount: total }),
    payRpc({ p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH", p_payment_status: "PAID", p_amount: total }),
  ]);

  const successCount = [r1, r2].filter((r) => !r.error).length;
  const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("order_id", orderId);

  if (successCount === 1 && count === 1) {
    ok("Pedido inteiro pago em paralelo -> exatamente 1 pagamento efetivo");
  } else {
    bad("Pedido inteiro pago em paralelo", { successCount, paymentsInserted: count });
  }
}

async function testDisjointItemsParallel(ctx: Awaited<ReturnType<typeof setup>>) {
  const { orderId, items } = await createTestOrder(ctx.branchId, ctx.productId, ctx.attendantId, 2);
  const [a, b] = items;

  const [r1, r2] = await Promise.all([
    payRpc({ p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH", p_payment_status: "PAID", p_amount: a.total_price, p_item_ids: [a.id] }),
    payRpc({ p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "PIX", p_payment_status: "PAID", p_amount: b.total_price, p_item_ids: [b.id] }),
  ]);

  const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("order_id", orderId);

  if (!r1.error && !r2.error && count === 2) {
    ok("Item A e item B pagos em paralelo -> ambos efetivos, sem conflito");
  } else {
    bad("Item A e item B pagos em paralelo", { r1: r1.error?.message, r2: r2.error?.message, paymentsInserted: count });
  }
}

async function testAmountMismatch(ctx: Awaited<ReturnType<typeof setup>>) {
  const { orderId, items } = await createTestOrder(ctx.branchId, ctx.productId, ctx.attendantId, 1);
  const { error } = await payRpc({
    p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH",
    p_payment_status: "PAID", p_amount: 999, p_item_ids: [items[0].id],
  });
  if (error) ok("Amount divergente -> rejeitado");
  else bad("Amount divergente deveria ter sido rejeitado", { orderId });
}

async function testAttendantCannotRefund(ctx: Awaited<ReturnType<typeof setup>>) {
  const { orderId, items } = await createTestOrder(ctx.branchId, ctx.productId, ctx.attendantId, 1);
  await payRpc({
    p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH",
    p_payment_status: "PAID", p_amount: items[0].total_price, p_item_ids: [items[0].id],
  });
  const { error } = await payRpc({
    p_order_id: orderId, p_actor_id: ctx.attendantId, p_payment_method: "CASH",
    p_payment_status: "REFUNDED", p_amount: items[0].total_price, p_item_ids: [items[0].id],
  });
  if (error) ok("ATTENDANT tentando REFUNDED -> rejeitado");
  else bad("ATTENDANT conseguiu estornar (REFUNDED) — deveria ser só ADMIN", { orderId });
}

async function main() {
  const ctx = await setup();
  await testSameItemRace(ctx);
  await testWholeOrderRace(ctx);
  await testDisjointItemsParallel(ctx);
  await testAmountMismatch(ctx);
  await testAttendantCannotRefund(ctx);

  if (failures > 0) {
    console.error(`\n${failures} teste(s) falharam.`);
    Deno.exit(1);
  }
  console.log("\nTodos os testes de concorrência de pagamento passaram.");
}

main();
