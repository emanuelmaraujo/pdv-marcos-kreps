// #221: fluxo COD ponta a ponta contra a instância descartável de test-database.mjs.
// Chama as Edge Functions servidas localmente; nenhum serviço real (CEP, gateway,
// WhatsApp) é usado: o endereço vem de cadastro salvo e o pagamento é presencial.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const { API_URL: api, ANON_KEY: anon, SERVICE_ROLE_KEY: service, DB_CONTAINER: container } = process.env;
if (!api || !anon || !service || !container) throw new Error('Ambiente local incompleto para o E2E.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) throw new Error('E2E aceita apenas API local.');

const ids = { branch: randomUUID(), other: randomUUID(), category: randomUUID(), product: randomUUID(), courier: randomUUID() };
// Um telefone por cenário: o limite por telefone de create-public-order continua ativo.
const phones = ['+5561988887771', '+5561988887772', '+5561988887773', '+5561988887774', '+5561988887775'];
const addresses = Object.fromEntries(phones.map((value) => [value, randomUUID()]));
const phone = phones[0];
const sql = (query) => execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atqc', query], { encoding: 'utf8' }).trim();
const results = [];
const check = (ok, label) => { assert(ok, label); results.push(label); console.log(`PASS: ${label}`); };

async function call(fn, body, token = anon, headers = {}) {
  const response = await fetch(`${api}/functions/v1/${fn}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
async function rpc(name, args, token) {
  const response = await fetch(`${api}/rest/v1/rpc/${name}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function user(email, name, role, branches, extra = '') {
  const created = await fetch(`${api}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'local-e2e-only-221', email_confirm: true }),
  }).then((r) => r.json());
  assert(created.id, `usuário local ${email}`);
  sql(`BEGIN; SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO public.profiles(id,name,role,active,home_branch_id) VALUES('${created.id}','${name}','${role}',true,'${branches[0]}')
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,active=true,home_branch_id=EXCLUDED.home_branch_id;
    INSERT INTO public.profile_branches(profile_id,branch_id) VALUES ${branches.map((b) => `('${created.id}','${b}')`).join(',')} ON CONFLICT DO NOTHING;
    ${extra.replaceAll(':id', created.id)} COMMIT;`);
  const session = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'local-e2e-only-221' }),
  }).then((r) => r.json());
  assert(session.access_token, `login local ${email}`);
  return { id: created.id, token: session.access_token };
}
const orderBody = (extra = {}) => ({
  order_type: 'ENTREGA', branch_slug: 'e2e-cod', customer_name: 'Cliente sintético', customer_phone: phone,
  payment_timing: 'ON_DELIVERY', expected_payment_method: 'CASH', cash_change_for: 50,
  delivery_address_id: addresses[extra.customer_phone ?? phone], items: [{ product_id: ids.product, quantity: 2, addons: [], removed_ingredient_ids: [] }], ...extra,
});
const order = (id) => JSON.parse(sql(`SELECT row_to_json(o) FROM (SELECT status,payment_status,payment_timing,cod_received_amount,total_amount,confirmed_at FROM public.orders WHERE id='${id}') o`));

sql(`INSERT INTO public.branches(id,code,slug,name,active,delivery_enabled,default_delivery_fee,ordering_enabled,ordering_start_time,ordering_end_time)
  VALUES('${ids.branch}','E2E','e2e-cod','Filial E2E COD',true,true,5,true,'00:00','23:59'),
        ('${ids.other}','E2X','e2e-cod-x','Filial E2E outra',true,true,5,true,'00:00','23:59');
  INSERT INTO public.categories(id,branch_id,name) VALUES('${ids.category}','${ids.branch}','Categoria E2E');
  INSERT INTO public.products(id,branch_id,category_id,name,price,sector,active) VALUES('${ids.product}','${ids.branch}','${ids.category}','Krep E2E',20,'KITCHEN',true);
  INSERT INTO public.delivery_zones(branch_id,neighborhood,neighborhood_normalized,fee) VALUES('${ids.branch}','Centro','centro',5);
  INSERT INTO public.customers(id,phone_e164,name) VALUES ${phones.map((p) => `('${p}','${p}','Cliente sintético')`).join(',')} ON CONFLICT DO NOTHING;
  INSERT INTO public.customer_addresses(id,customer_id,street,number,neighborhood,city,state,postal_code)
    VALUES ${phones.map((p) => `('${addresses[p]}','${p}','Rua Fictícia','10','Centro','Cidade Teste','DF','70000000')`).join(',')};
  INSERT INTO public.settings(key,value) VALUES('print_customer_copy','true'),('print_kitchen_copy','true'),('printing_enabled','true'),('whatsapp_enabled','true')
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;`);

const admin = await user('e2e-admin@example.invalid', 'Admin E2E', 'ADMIN', [ids.branch]);
const attendant = await user('e2e-attendant@example.invalid', 'Atendente E2E', 'ATTENDANT', [ids.branch]);
const outsider = await user('e2e-outsider@example.invalid', 'Atendente outra filial', 'ATTENDANT', [ids.other]);
const courier = await user('e2e-courier@example.invalid', 'Motoboy E2E', 'COURIER', [ids.branch],
  `INSERT INTO public.couriers(id,branch_id,name,active,profile_id) VALUES('${ids.courier}','${ids.branch}','Motoboy E2E',true,':id');`);

// 1. Configuração pelo painel (RPC autenticada, sem acesso direto à tabela).
let r = await call('get-public-checkout-config', { branch_slug: 'e2e-cod' });
check(r.data.branch?.cod_enabled === false, 'sem política, checkout público não oferece COD');
r = await call('create-public-order', orderBody(), anon, { 'x-idempotency-key': randomUUID() });
check(r.status >= 400 && !sql(`SELECT count(*) FROM public.orders WHERE branch_id='${ids.branch}'`).startsWith('1'), 'servidor recusa COD com política desligada');
r = await rpc('set_branch_cod_policy', { p_branch_id: ids.branch, p_enabled: true, p_methods: ['CASH', 'PIX'], p_max_amount: 200, p_max_pending: 10, p_confirmation_minutes: 30 }, anon);
check(r.status >= 400, 'anon não altera política');
r = await rpc('set_branch_cod_policy', { p_branch_id: ids.branch, p_enabled: true, p_methods: ['CASH', 'PIX'], p_max_amount: 200, p_max_pending: 10, p_confirmation_minutes: 30 }, attendant.token);
check(r.status >= 400, 'atendente não altera política');
r = await rpc('set_branch_cod_policy', { p_branch_id: ids.branch, p_enabled: true, p_methods: ['CASH', 'PIX'], p_max_amount: 200, p_max_pending: 10, p_confirmation_minutes: 30 }, admin.token);
check(r.status === 200 && r.data.enabled === true, 'admin da filial ativa COD pelo painel');
r = await fetch(`${api}/rest/v1/branch_cod_policies?select=*`, { headers: { apikey: anon, Authorization: `Bearer ${admin.token}` } });
check(r.status >= 400 || (await r.json()).length === 0, 'tabela de política continua fora do PostgREST');
r = await call('get-public-checkout-config', { branch_slug: 'e2e-cod' });
check(r.data.branch?.cod_enabled === true && r.data.branch.cod_methods.join() === 'CASH,PIX' && r.data.branch.max_amount === undefined,
  'checkout recebe formas, sem limites antifraude');

// 2. Criação idempotente, inclusive concorrente.
const key = randomUUID();
const parallel = await Promise.all([1, 2, 3].map(() => call('create-public-order', orderBody(), anon, { 'x-idempotency-key': key })));
const created = parallel.find((x) => x.data.order)?.data.order;
check(!!created && parallel.every((x) => !x.data.order || x.data.order.order_id === created.order_id), 'três envios simultâneos devolvem o mesmo pedido');
check(sql(`SELECT count(*) FROM public.orders WHERE public_idempotency_key='${key}'`) === '1', 'uma única linha para a chave');
check(created.status === 'AGUARDANDO_CONFIRMACAO' && created.payment_status === 'PENDING' && Number(created.total_amount) === 45, 'pedido COD aguarda confirmação, pendente, total com frete');
r = await call('create-public-order', orderBody({ cash_change_for: 100 }), anon, { 'x-idempotency-key': key });
check(r.status >= 400, 'mesma chave com compromisso diferente é recusada');
check(sql(`SELECT count(*) FROM public.printer_jobs WHERE order_id='${created.order_id}'`) === '0', 'nada imprime antes da confirmação');
r = await call('get-public-order-status', { public_token: created.public_token });
check(r.data.order?.payment_timing === 'ON_DELIVERY' && r.data.order.payment_status === 'PENDING', 'acompanhamento público mostra pagamento pendente');

// 3. Confirmação: escopo de filial, verificação de contato e impressão única.
r = await call('confirm-order', { order_id: created.order_id, contact_confirmed: true }, outsider.token);
check(r.status >= 400 && order(created.order_id).status === 'AGUARDANDO_CONFIRMACAO', 'atendente de outra filial não confirma');
r = await call('confirm-order', { order_id: created.order_id }, attendant.token);
check(r.status >= 400, 'confirmação exige verificação de contato');
r = await call('confirm-order', { order_id: created.order_id, contact_confirmed: true }, attendant.token);
const retry = await call('confirm-order', { order_id: created.order_id, contact_confirmed: true }, attendant.token);
const jobs = sql(`SELECT string_agg(sector::text,',' ORDER BY sector) FROM public.printer_jobs WHERE order_id='${created.order_id}'`);
check(r.status === 200 && retry.status === 200 && order(created.order_id).status === 'NA_FILA', 'confirmação libera produção e retry é idempotente');
check(jobs === 'CUSTOMER,KITCHEN', `impressão gerada uma vez por setor (${jobs})`);
const receipt = sql(`SELECT content->>'text' FROM public.printer_jobs WHERE order_id='${created.order_id}' AND sector='CUSTOMER'`);
check(/COBRAR NA ENTREGA: R\$ ?45,00/.test(receipt) && /Dinheiro/.test(receipt) && /Troco para: R\$ ?50,00/.test(receipt), 'via do cliente orienta cobrança em pt-BR');
check(!/Forma: PIX|PENDING/.test(receipt), 'via não sugere pagamento online nem código cru');
check(order(created.order_id).payment_status === 'PENDING', 'confirmar não registra pagamento');
// Só grava a fila local; nenhum envio real acontece no E2E.
check(sql(`SELECT count(*) FROM public.whatsapp_messages WHERE order_id='${created.order_id}' AND event_type='order_received'`) === '1', 'cliente COD recebe aviso de confirmação uma única vez');
const firstItem = sql(`SELECT id FROM public.order_items WHERE order_id='${created.order_id}' ORDER BY id LIMIT 1`);
r = await call('update-order-item-status', { order_item_id: firstItem, new_status: 'CANCELLED', reason: 'Sem estoque' }, attendant.token);
check(r.status >= 400 && sql(`SELECT count(*) FROM public.order_items WHERE order_id='${created.order_id}' AND status='CANCELLED'`) === '0', 'item isolado de pedido COD não é cancelado');
r = await fetch(`${api}/rest/v1/order_items?id=eq.${firstItem}`, { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }),
  headers: { apikey: anon, Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
check(r.status >= 400 && sql(`SELECT status FROM public.order_items WHERE id='${firstItem}'`) !== 'CANCELLED', 'admin não cancela item COD direto pela API (grant local; guard provado no pgTAP)');

// 4. Produção, despacho, entrega: continua pendente até a baixa.
for (const item of sql(`SELECT id FROM public.order_items WHERE order_id='${created.order_id}'`).split('\n')) {
  for (const status of ['IN_PREPARATION', 'READY']) {
    const step = await call('update-order-item-status', { order_item_id: item, new_status: status }, attendant.token);
    assert(step.status === 200, `item ${status}: ${JSON.stringify(step.data)}`);
  }
}
check(order(created.order_id).status === 'PRONTO', 'itens prontos levam o pedido a PRONTO');
r = await call('dispatch-delivery', { order_id: created.order_id, courier_id: ids.courier }, attendant.token);
check(r.status === 200, `despacho para o motoboy ${r.status === 200 ? '' : JSON.stringify(r.data)}`.trim());
r = await call('confirm-delivery', { order_id: created.order_id }, courier.token);
check(r.status === 200 && order(created.order_id).status === 'ENTREGUE' && order(created.order_id).payment_status === 'PENDING', 'entregue continua pendente');

// 5. Recebimento: confirmação explícita, valor exato, sem duplicidade.
const pay = (extra) => call('mark-payment', { order_id: created.order_id, payment_method: 'CASH', payment_status: 'PAID', amount: 45, ...extra }, attendant.token);
r = await pay({});
check(r.status >= 400 && order(created.order_id).payment_status === 'PENDING', 'baixa exige confirmação de recebimento');
r = await pay({ received_confirmed: true, amount: 40 });
check(r.status >= 400, 'valor diferente do saldo é recusado');
r = await pay({ received_confirmed: true });
const second = await pay({ received_confirmed: true });
check(r.status === 200 && second.status >= 400 && order(created.order_id).payment_status === 'PAID', 'recebimento quita uma única vez');
check(sql(`SELECT count(*)||':'||sum(amount) FROM public.payments WHERE order_id='${created.order_id}'`) === '1:45.00', 'um pagamento de R$ 45,00 em dinheiro');

// 6. Caixa: o recebimento aparece no relatório pelo meio efetivo.
const window = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
r = await call('cash-report', { start_date: window(-60), end_date: window(60), branch_id: ids.branch }, admin.token);
const cash = (r.data.payment_breakdown ?? r.data.paymentBreakdown ?? []).find((p) => p.method === 'CASH');
check(r.status === 200 && Number(cash?.total) === 45, `caixa concilia R$ 45,00 em dinheiro (${cash ? JSON.stringify(cash) : JSON.stringify(r.data).slice(0, 300)})`);

// 7. Rejeição e expiração não produzem nem cobram.
const rejectKey = randomUUID();
const rejected = (await call('create-public-order', orderBody({ customer_phone: phones[1], cash_change_for: null, expected_payment_method: 'PIX' }), anon, { 'x-idempotency-key': rejectKey })).data.order;
r = await call('confirm-order', { order_id: rejected.order_id, cod_action: 'REJECT', cod_reason: 'x' }, attendant.token);
check(r.status >= 400, 'rejeição exige motivo');
r = await call('confirm-order', { order_id: rejected.order_id, cod_action: 'REJECT', cod_reason: 'Endereço não confirmado' }, attendant.token);
check(r.status === 200 && order(rejected.order_id).status === 'CANCELADO' && sql(`SELECT count(*) FROM public.printer_jobs WHERE order_id='${rejected.order_id}'`) === '0', 'rejeição cancela sem imprimir');
r = await call('mark-payment', { order_id: rejected.order_id, payment_method: 'PIX', payment_status: 'PAID', amount: 45, received_confirmed: true }, attendant.token);
check(r.status >= 400, 'pedido rejeitado não recebe baixa');
const expiring = (await call('create-public-order', orderBody({ customer_phone: phones[2], cash_change_for: null }), anon, { 'x-idempotency-key': randomUUID() })).data;
check(!!expiring.order, `pedido para expirar criado ${expiring.order ? '' : JSON.stringify(expiring)}`.trim());
sql(`UPDATE public.orders SET cod_expires_at=now()-interval '1 minute' WHERE id='${expiring.order.order_id}'`);
r = await call('expire-pending-public-orders', {}, anon, { 'x-expiration-secret': process.env.EXPIRATION_SECRET });
check(r.status === 200 && order(expiring.order.order_id).status === 'EXPIRADO', `prazo de confirmação expira o pedido ${r.status === 200 ? '' : JSON.stringify(r.data)}`.trim());

// 7b. Cancelamento com valor recebido: corrida, API direta e estorno antes de cancelar.
const confirmedOrder = async (customerPhone) => {
  // Duas linhas de R$ 20: permite recebimento parcial de uma delas.
  const twoLines = [1, 2].map(() => ({ product_id: ids.product, quantity: 1, addons: [], removed_ingredient_ids: [] }));
  const placed = (await call('create-public-order', orderBody({ customer_phone: customerPhone, cash_change_for: null, items: twoLines }), anon, { 'x-idempotency-key': randomUUID() })).data.order;
  assert(placed, 'pedido para cenário de cancelamento');
  assert((await call('confirm-order', { order_id: placed.order_id, contact_confirmed: true }, attendant.token)).status === 200, 'confirmação do cenário');
  return { id: placed.order_id, item: sql(`SELECT id FROM public.order_items WHERE order_id='${placed.order_id}' ORDER BY id LIMIT 1`) };
};
const race = await confirmedOrder(phones[3]);
const [paidRace, cancelRace] = await Promise.all([
  call('mark-payment', { order_id: race.id, payment_method: 'CASH', payment_status: 'PAID', amount: 20, order_item_ids: [race.item], received_confirmed: true }, attendant.token),
  call('update-order-status', { order_id: race.id, status: 'CANCELADO', reason: 'Cliente desistiu' }, attendant.token),
]);
const raceState = order(race.id);
// Recusa por valor não vale como corrida: um dos lados precisa ter sido aceito.
assert(paidRace.status === 200 || cancelRace.status === 200, `corrida sem vencedor ${JSON.stringify([paidRace.data, cancelRace.data])}`);
const racePayments = Number(sql(`SELECT count(*) FROM public.payments WHERE order_id='${race.id}'`));
check((raceState.status === 'CANCELADO' && racePayments === 0 && paidRace.status >= 400)
  || (raceState.status !== 'CANCELADO' && racePayments === 1 && Number(raceState.cod_received_amount) === 20 && cancelRace.status >= 400),
  `corrida cancelar × receber termina consistente (status ${raceState.status}, pagamentos ${racePayments})`);

const kept = racePayments === 1 ? race : await confirmedOrder(phones[4]);
if (kept !== race) {
  r = await call('mark-payment', { order_id: kept.id, payment_method: 'CASH', payment_status: 'PAID', amount: 20, order_item_ids: [kept.item], received_confirmed: true }, attendant.token);
  assert(r.status === 200, `recebimento parcial do cenário ${JSON.stringify(r.data)}`);
}
const auditBefore = sql(`SELECT count(*) FROM public.audit_logs WHERE record_id='${kept.id}'`);
r = await call('update-order-status', { order_id: kept.id, status: 'CANCELADO', reason: 'Cliente desistiu' }, admin.token);
check(r.status >= 400 && order(kept.id).status !== 'CANCELADO', 'backend recusa cancelar COD com valor recebido');
r = await fetch(`${api}/rest/v1/orders?id=eq.${kept.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'CANCELADO' }),
  headers: { apikey: anon, Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
check(r.status >= 400 && order(kept.id).status !== 'CANCELADO', 'API direta não cancela COD com valor recebido (grant local; guard provado no pgTAP)');
check(sql(`SELECT count(*)||':'||sum(amount) FROM public.payments WHERE order_id='${kept.id}'`) === '1:20.00'
  && sql(`SELECT count(*) FROM public.audit_logs WHERE record_id='${kept.id}'`) === auditBefore, 'histórico financeiro e auditoria preservados');
r = await call('mark-payment', { order_id: kept.id, payment_method: 'CASH', payment_status: 'REFUNDED', amount: 20, order_item_ids: [kept.item] }, admin.token);
check(r.status === 200 && Number(order(kept.id).cod_received_amount) === 0, `estorno registrado zera o saldo recebido ${r.status === 200 ? '' : JSON.stringify(r.data)}`.trim());
r = await call('update-order-status', { order_id: kept.id, status: 'CANCELADO', reason: 'Cliente desistiu após estorno' }, admin.token);
check(r.status === 200 && order(kept.id).status === 'CANCELADO' && sql(`SELECT count(*) FROM public.payments WHERE order_id='${kept.id}'`) === '2',
  'após estorno o cancelamento é aceito e o histórico fica com recebimento e estorno');

// 8. Funil: schema fechado, sem dados pessoais.
r = await call('record-public-funnel-event', { consent: true, event_id: randomUUID(), event_name: 'menu_view', branch_slug: 'e2e-cod', order_type: 'ENTREGA', device: 'MOBILE', source: 'DIRECT' });
check(r.status === 200, 'evento de funil consentido é aceito');
r = await call('record-public-funnel-event', { consent: true, event_id: randomUUID(), event_name: 'menu_view', branch_slug: 'e2e-cod', order_type: 'ENTREGA', device: 'MOBILE', source: 'DIRECT', customer_phone: phone });
check(r.status >= 400, 'evento com campo pessoal é recusado');
r = await call('record-public-funnel-event', { consent: false, event_id: randomUUID(), event_name: 'menu_view', branch_slug: 'e2e-cod', order_type: 'ENTREGA', device: 'MOBILE', source: 'DIRECT' });
check(r.status >= 400 || sql(`SELECT count(*) FROM public.public_funnel_events WHERE origin='CLIENT'`) === '1', 'sem consentimento nada é gravado');
r = await call('record-public-funnel-event', { consent: true, event_id: randomUUID(), event_name: 'payment_approved', branch_slug: 'e2e-cod', order_type: 'ENTREGA', device: 'MOBILE', source: 'DIRECT' });
check(r.status >= 400, 'navegador não forja evento financeiro');

console.log(`PASS: E2E COD — ${results.length} verificações.`);
