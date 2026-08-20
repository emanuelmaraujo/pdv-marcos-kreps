// Teste de ponta a ponta da Fase 4 (motoboy com login próprio).
//
// Requer supabase local rodando (`npx supabase start`), migrations aplicadas
// (`npx supabase db reset`) e as Edge Functions servindo localmente
// (`npx supabase functions serve --no-verify-jwt`). Roda com Node:
//
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_ANON_KEY=<anon do `supabase status`> \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role do `supabase status`> \
//   node scripts/test-fase4-motoboy.js
//
// Cobre o fluxo real (via Edge Functions, não inserção direta) descrito no
// FEATURE_DELIVERY.md, seção "Fase 4":
//   1. manage-users cria um usuário COURIER -> gera couriers.profile_id.
//   2. manage-users rejeita COURIER sem exatamente 1 filial.
//   3. dispatch-delivery atribui o motoboy cadastrado a um pedido PRONTO.
//   4. RLS: motoboy só lê o próprio pedido via client direto (não vê o de outro).
//   5. confirm-delivery: motoboy confirma a própria entrega.
//   6. confirm-delivery: motoboy é rejeitado ao tentar confirmar entrega alheia.
//   7. confirm-delivery: ADMIN/ATTENDANT continuam funcionando sem regressão.
//   8. courier-delivery-report: ADMIN vê as métricas agregadas; COURIER é negado (403).
//
// Cria e limpa seus próprios dados de teste (usuários, couriers, pedidos)
// no fim da execução, mesmo em caso de falha.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Faltam variáveis de ambiente! Configure SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (ver `npx supabase status`).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const RUN_ID = Date.now();

const log = (step, expected, result) => {
  console.log(`\n✅ TESTE: ${step}\n   Esperado: ${expected}\n   Resultado: ${result}`);
};

const fail = (message) => {
  console.error(`\n🚨 FALHA: ${message}`);
  throw new Error(message);
};

async function callFunction(name, payload, token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function loginAs(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) fail(`Login falhou para ${email}: ${error?.message}`);
  return { client, jwt: data.session.access_token };
}

// Rastreia tudo que este teste cria, para limpar no final.
const cleanup = { authUserIds: [], orderIds: [] };

async function createAdmin() {
  const email = `admin.f4.${RUN_ID}@pdv.local`;
  const password = 'senha123456';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Falha ao criar ADMIN de teste: ${error.message}`);
  cleanup.authUserIds.push(data.user.id);
  const { error: profErr } = await admin.from('profiles').insert({ id: data.user.id, name: 'Admin Teste F4', role: 'ADMIN', active: true });
  if (profErr) fail(`Falha ao criar profile do ADMIN: ${profErr.message}`);
  return loginAs(email, password);
}

async function main() {
  console.log('Iniciando teste ponta a ponta da Fase 4 (motoboy)...\n');

  const { jwt: adminJwt } = await createAdmin();

  const { data: branch, error: branchErr } = await admin
    .from('branches')
    .select('id, name')
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (branchErr || !branch) fail('Nenhuma filial ativa encontrada — rode `npx supabase db reset` para popular o seed.');

  // --- Negativo: COURIER sem exatamente 1 filial é rejeitado ---
  const negBranches = await callFunction('manage-users', {
    action: 'create_user',
    data: { email: `motoboy.semfilial.${RUN_ID}@pdv.local`, password: 'senha123456', name: 'Sem Filial', role: 'COURIER', branch_ids: [] },
  }, adminJwt);
  if (negBranches.data.success) fail('manage-users criou COURIER sem filial selecionada!');
  log('Negativo (COURIER sem filial)', 'Rejeitado com erro', `Rejeitado: "${negBranches.data.error}"`);

  // --- 1. Cria dois motoboys via manage-users (fluxo real, não insert direto) ---
  const courier1Email = `motoboy1.f4.${RUN_ID}@pdv.local`;
  const courier2Email = `motoboy2.f4.${RUN_ID}@pdv.local`;
  const password = 'senha123456';

  const c1Res = await callFunction('manage-users', {
    action: 'create_user',
    data: { email: courier1Email, password, name: 'Motoboy Um Teste', role: 'COURIER', branch_ids: [branch.id], phone: '61999990001' },
  }, adminJwt);
  if (!c1Res.data.success) fail(`Falha ao criar motoboy 1: ${c1Res.data.error}`);
  cleanup.authUserIds.push(c1Res.data.data.id);

  const c2Res = await callFunction('manage-users', {
    action: 'create_user',
    data: { email: courier2Email, password, name: 'Motoboy Dois Teste', role: 'COURIER', branch_ids: [branch.id], phone: '61999990002' },
  }, adminJwt);
  if (!c2Res.data.success) fail(`Falha ao criar motoboy 2: ${c2Res.data.error}`);
  cleanup.authUserIds.push(c2Res.data.data.id);

  const { data: courier1Row, error: c1QErr } = await admin.from('couriers').select('id, profile_id').eq('profile_id', c1Res.data.data.id).single();
  if (c1QErr || !courier1Row) fail('couriers não ganhou linha nova com profile_id para o motoboy 1.');
  const { data: courier2Row, error: c2QErr } = await admin.from('couriers').select('id, profile_id').eq('profile_id', c2Res.data.data.id).single();
  if (c2QErr || !courier2Row) fail('couriers não ganhou linha nova com profile_id para o motoboy 2.');
  log('Fluxo 1 (manage-users cria COURIER)', 'couriers ganha linha com profile_id vinculado', `courier1=${courier1Row.id}, courier2=${courier2Row.id}`);

  // --- 2. Cria dois pedidos ENTREGA prontos e despacha via dispatch-delivery ---
  const baseOrder = {
    branch_id: branch.id,
    type: 'ENTREGA',
    source: 'ATTENDANT',
    status: 'PRONTO',
    payment_status: 'PENDING',
    payment_method: 'CASH',
    delivery_street: 'Rua Teste F4',
    delivery_neighborhood: 'Teste',
    total_amount: 50,
    ready_at: new Date().toISOString(),
  };
  const { data: order1, error: o1Err } = await admin.from('orders').insert({ ...baseOrder, customer_name: 'Cliente Um' }).select('id').single();
  if (o1Err) fail(`Falha ao criar pedido de teste 1: ${o1Err.message}`);
  cleanup.orderIds.push(order1.id);
  const { data: order2, error: o2Err } = await admin.from('orders').insert({ ...baseOrder, customer_name: 'Cliente Dois' }).select('id').single();
  if (o2Err) fail(`Falha ao criar pedido de teste 2: ${o2Err.message}`);
  cleanup.orderIds.push(order2.id);

  const disp1 = await callFunction('dispatch-delivery', { order_id: order1.id, courier_id: courier1Row.id }, adminJwt);
  if (!disp1.data.success) fail(`Falha ao despachar pedido 1 pro motoboy 1: ${disp1.data.error}`);
  const disp2 = await callFunction('dispatch-delivery', { order_id: order2.id, courier_id: courier2Row.id }, adminJwt);
  if (!disp2.data.success) fail(`Falha ao despachar pedido 2 pro motoboy 2: ${disp2.data.error}`);
  log('Fluxo 2 (dispatch-delivery)', 'Ambos pedidos SAIU_PARA_ENTREGA com courier_id certo', 'Despachados com sucesso');

  // --- 3. RLS: motoboy 1 só enxerga o próprio pedido ---
  const { client: courier1Client, jwt: courier1Jwt } = await loginAs(courier1Email, password);
  const { data: visibleOrders, error: visErr } = await courier1Client.from('orders').select('id');
  if (visErr) fail(`Motoboy 1 não conseguiu ler os próprios pedidos: ${visErr.message}`);
  const ids = visibleOrders.map((o) => o.id);
  if (!ids.includes(order1.id)) fail('Motoboy 1 não enxerga o próprio pedido via RLS.');
  if (ids.includes(order2.id)) fail('Motoboy 1 enxerga o pedido de outro motoboy — vazamento de RLS!');
  log('Fluxo 3 (isolamento RLS)', 'Motoboy vê só o próprio pedido', `Visível: ${ids.length === 1}`);

  // --- 4. confirm-delivery: motoboy 1 tentando confirmar pedido do motoboy 2 é rejeitado ---
  const negConfirm = await callFunction('confirm-delivery', { order_id: order2.id }, courier1Jwt);
  if (negConfirm.data.success) fail('Motoboy 1 conseguiu confirmar entrega de um pedido que não é dele!');
  log('Negativo (confirmar pedido alheio)', 'Rejeitado', `Rejeitado: "${negConfirm.data.error}"`);

  // --- 5. confirm-delivery: motoboy 1 confirma o próprio pedido ---
  const okConfirm = await callFunction('confirm-delivery', { order_id: order1.id }, courier1Jwt);
  if (!okConfirm.data.success) fail(`Motoboy 1 não conseguiu confirmar a própria entrega: ${okConfirm.data.error}`);
  if (okConfirm.data.order.status !== 'ENTREGUE') fail(`Status após confirmar não é ENTREGUE: ${okConfirm.data.order.status}`);
  log('Fluxo 5 (confirm-delivery pelo motoboy)', 'Pedido vira ENTREGUE', 'Confirmado com sucesso');

  // --- 6. Regressão: ADMIN ainda confirma entrega normalmente ---
  const adminConfirm = await callFunction('confirm-delivery', { order_id: order2.id }, adminJwt);
  if (!adminConfirm.data.success) fail(`Regressão: ADMIN não conseguiu mais confirmar entrega: ${adminConfirm.data.error}`);
  log('Fluxo 6 (regressão ADMIN)', 'ADMIN confirma entrega sem regressão', 'Confirmado com sucesso');

  // --- 7. courier-delivery-report: ADMIN vê métricas, COURIER é negado ---
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const reportAdmin = await callFunction('courier-delivery-report', { start_date: start, end_date: end, branch_id: branch.id }, adminJwt);
  if (!reportAdmin.data.success) fail(`ADMIN não conseguiu carregar o relatório: ${reportAdmin.data.error}`);
  const reportCourierIds = reportAdmin.data.rows.map((r) => r.courier_id);
  if (!reportCourierIds.includes(courier1Row.id) || !reportCourierIds.includes(courier2Row.id)) {
    fail(`Relatório não trouxe as entregas dos dois motoboys de teste: ${JSON.stringify(reportAdmin.data.rows)}`);
  }
  log('Fluxo 7a (courier-delivery-report ADMIN)', 'Retorna as entregas confirmadas agrupadas por motoboy', `${reportAdmin.data.rows.length} linha(s)`);

  const reportCourier = await callFunction('courier-delivery-report', {}, courier1Jwt);
  if (reportCourier.status !== 403) fail(`COURIER conseguiu acessar o relatório ADMIN-only (status ${reportCourier.status})!`);
  log('Negativo (relatório ADMIN-only)', 'Status 403 para COURIER', `Status ${reportCourier.status}`);

  console.log('\n✅ FASE 4 (MOTOBOY) OK — todos os cenários passaram.\n');
}

async function cleanupAll() {
  console.log('\nLimpando dados de teste...');
  for (const orderId of cleanup.orderIds) {
    await admin.from('orders').delete().eq('id', orderId);
  }
  await admin.from('couriers').delete().in('profile_id', cleanup.authUserIds);
  for (const userId of cleanup.authUserIds) {
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log('Limpeza concluída.');
}

main()
  .then(() => cleanupAll())
  .then(() => process.exit(0))
  .catch(async (err) => {
    await cleanupAll();
    console.error('\n🚨 TESTE FALHOU:', err.message);
    process.exit(1);
  });
