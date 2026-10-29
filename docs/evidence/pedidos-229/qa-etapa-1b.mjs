// Somente instância descartável criada por scripts/test-database.mjs --production-qa.
// Dois operadores reais (HTTP + navegador) sobre a Edge Function local update-order-item-status
// em modo lote; nenhum serviço externo: clientes com opt-out fazem o WhatsApp gravar só
// SKIPPED (mesma deduplicação de PENDING) e o push fica sem VAPID.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PDV_QA_PLAYWRIGHT ? pathToFileURL(path.join(process.env.PDV_QA_PLAYWRIGHT, 'index.mjs')).href : 'playwright-core');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'etapa-1b');
const root = path.resolve(out, '../../../..');
const { API_URL: api, ANON_KEY: anon, SERVICE_ROLE_KEY: service, DB_CONTAINER: container } = process.env;
assert(/^http:\/\/127\.0\.0\.1:55431$/.test(api ?? ''), 'Somente API descartável 55431');
assert(/^supabase_db_pdv-db-/.test(container ?? ''), 'Somente container descartável');

async function request(url, body, token = service) {
  const r = await fetch(api + url, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}
function sql(text) {
  const r = spawnSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', text], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
const accounts = [];
for (const [name, role] of [['Maria', 'ADMIN'], ['João', 'ATTENDANT']]) {
  const email = `${role.toLowerCase()}-229b@example.invalid`, password = 'local-fixture-only-229b';
  const r = await request('/auth/v1/admin/users', { email, password, email_confirm: true }); assert(r.ok, 'cria usuário somente local');
  const auth = await request('/auth/v1/token?grant_type=password', { email, password }, anon); assert(auth.ok);
  accounts.push({ id: r.data.id, name, role, email, password, token: auth.data.access_token });
}
const b = 'b229b000-0000-4000-8000-000000000011';
const orderA = 'b229b000-0000-4000-8000-000000000041'; // HTTP: corrida e notificações
const orderB = 'b229b000-0000-4000-8000-000000000042'; // legado
const orderC = 'b229b000-0000-4000-8000-000000000043'; // navegador
const prod = 'b229b000-0000-4000-8000-000000000031';
const item = (id, order, name, sector, qty, status = 'PENDING') =>
  `('${id}','${order}','${prod}','${name}',20,'${sector}',${qty},${20 * qty},'${status}')`;
sql(`BEGIN;
INSERT INTO branches(id,code,slug,name,active,whatsapp_enabled) VALUES('${b}','HQB','qa-producao','Centro · fixture #229 1B',true,true);
INSERT INTO settings(key,value) VALUES('whatsapp_enabled','true'::jsonb) ON CONFLICT(key) DO UPDATE SET value='true'::jsonb;
INSERT INTO customers(id,phone_e164,name,whatsapp_opt_in) SELECT 'qa-229b-'||n,'+556199999000'||n,'Fixture',false FROM generate_series(1,3) n;
${accounts.map((a) => `INSERT INTO profiles(id,name,role,active,home_branch_id) VALUES('${a.id}','${a.name}','${a.role}',true,'${b}'); INSERT INTO profile_branches(profile_id,branch_id) VALUES('${a.id}','${b}');`).join('\n')}
INSERT INTO categories(id,branch_id,name) VALUES('b229b000-0000-4000-8000-000000000021','${b}','Crepes');
INSERT INTO products(id,branch_id,category_id,name,price,sector) VALUES('${prod}','${b}','b229b000-0000-4000-8000-000000000021','Crepe',20,'KITCHEN');
INSERT INTO orders(id,branch_id,daily_number,status,total_amount,type,customer_name,customer_phone,confirmed_at) VALUES
 ('${orderA}','${b}',31,'NA_FILA',80,'BALCAO','Bia · corrida','61999990001',now()),
 ('${orderB}','${b}',32,'NA_FILA',40,'BALCAO','Caio · legado','61999990002',now()),
 ('${orderC}','${b}',33,'NA_FILA',100,'VIAGEM','Ana · quadro 1B','61999990003',now());
INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,product_price_snapshot,production_sector,quantity,total_price,status) VALUES
 ${item('b229b000-0000-4000-8000-000000000051', orderA, 'Crepe de frango', 'KITCHEN', 3)},
 ${item('b229b000-0000-4000-8000-000000000052', orderA, 'Suco de laranja', 'JUICE_POTATO', 1)},
 ${item('b229b000-0000-4000-8000-000000000053', orderB, 'Crepe de queijo', 'KITCHEN', 2)},
 ${item('b229b000-0000-4000-8000-000000000054', orderC, 'Crepe de banana', 'KITCHEN', 3)},
 ${item('b229b000-0000-4000-8000-000000000055', orderC, 'Crepe de carne', 'KITCHEN', 1)},
 ${item('b229b000-0000-4000-8000-000000000056', orderC, 'Água sem gás', 'NONE', 1)};
COMMIT;`);
const unitsOf = (itemId) => sql(`SELECT string_agg(id::text, ',' ORDER BY unit_no) FROM production_handoff_units WHERE order_item_id='${itemId}' AND state<>'SUPERSEDED'`).split(',');
const batch = (account, order_id, unit_ids, new_status, item_ids = []) =>
  request('/functions/v1/update-order-item-status', { mode: 'batch', order_id, unit_ids, item_ids, new_status }, account.token);
const events = (order) => sql(`SELECT coalesce(string_agg(event_type || ':' || n, ',' ORDER BY event_type), '') FROM (SELECT event_type, count(*) n FROM whatsapp_messages WHERE order_id='${order}' GROUP BY 1) x`);
const audits = (action, order) => Number(sql(`SELECT count(*) FROM audit_logs a JOIN production_handoff_units u ON u.id=a.record_id WHERE a.action='${action}' AND u.order_id='${order}'`));
const [maria, joao] = accounts;

// 1. Dois operadores marcam unidades sobrepostas ao mesmo tempo
const [crepeA, sucoA] = [unitsOf('b229b000-0000-4000-8000-000000000051'), unitsOf('b229b000-0000-4000-8000-000000000052')];
const race = await Promise.all([batch(maria, orderA, [crepeA[0], crepeA[1]], 'READY'), batch(joao, orderA, [crepeA[1], crepeA[2]], 'READY')]);
assert(race.every((r) => r.ok), `lotes concorrentes aceitos: ${JSON.stringify(race.map((r) => r.data))}`);
assert.equal(race.reduce((s, r) => s + r.data.changed_units, 0), 3, 'cada unidade muda uma única vez');
assert.equal(audits('UNIT_READY', orderA), 3, 'auditoria sem duplicidade na corrida');
assert.equal(sql(`SELECT status FROM orders WHERE id='${orderA}'`), 'PRONTO_PARCIAL');
assert.equal(events(orderA), 'order_partial_ready:1', 'um único aviso de parcial');
// 2. Comando atrasado não regride; replay não reenvia aviso
const stale = await batch(joao, orderA, [crepeA[0]], 'IN_PREPARATION');
assert(stale.ok && stale.data.changed_units === 0, 'comando atrasado ignorado');
const bad = await batch(joao, orderA, [sucoA[0]], 'DELIVERED');
assert(!bad.ok && /prontas/.test(bad.data?.error ?? ''), 'PENDING não salta para entregue');
// 3. Último pronto -> PRONTO notifica uma vez; corrida de entrega da mesma unidade
const done = await batch(maria, orderA, sucoA, 'READY');
assert.equal(done.data.order_status, 'PRONTO');
assert.equal(events(orderA), 'order_partial_ready:1,order_ready:1', 'um único aviso de pronto');
const deliver = await Promise.all([batch(maria, orderA, [crepeA[0]], 'DELIVERED'), batch(joao, orderA, [crepeA[0]], 'DELIVERED')]);
assert(deliver.every((r) => r.ok) && deliver.reduce((s, r) => s + r.data.changed_units, 0) === 1, 'entrega dupla vira uma entrega');
assert.equal(audits('UNIT_DELIVERED', orderA), 1);
assert.equal(sql(`SELECT status FROM orders WHERE id='${orderA}'`), 'PRONTO_PARCIAL');
assert.equal(events(orderA), 'order_partial_ready:1,order_ready:1', 'entrega parcial não gera aviso novo');
assert.equal(sql(`SELECT payment_status||'/'||total_amount FROM orders WHERE id='${orderA}'`), 'PENDING/80.00', 'financeiro intacto');
console.log('PASS: corrida HTTP de dois operadores, idempotência, avisos únicos e financeiro intacto.');

// 4. Comandos legados convivem com o ciclo por unidade
const crepeB = unitsOf('b229b000-0000-4000-8000-000000000053');
assert((await batch(maria, orderB, [crepeB[0]], 'READY')).ok);
assert((await batch(maria, orderB, [crepeB[0]], 'DELIVERED')).ok);
const legacy = await request('/functions/v1/update-order-status', { order_id: orderB, status: 'PRONTO' }, joao.token);
assert(legacy.ok, `legado "pedido pronto": ${JSON.stringify(legacy.data)}`);
assert.equal(sql(`SELECT string_agg(prep_status, ',' ORDER BY unit_no) FROM production_handoff_units WHERE order_item_id='b229b000-0000-4000-8000-000000000053' AND state<>'SUPERSEDED'`), 'DELIVERED,READY', 'legado não regride unidade entregue');
const cancelPartial = await request('/functions/v1/update-order-item-status', { order_item_id: 'b229b000-0000-4000-8000-000000000053', new_status: 'CANCELLED', reason: 'QA' }, joao.token);
assert(!cancelPartial.ok && /entregue/.test(cancelPartial.data?.error ?? ''), 'linha com unidade entregue não é cancelada');
const legacyDone = await request('/functions/v1/update-order-status', { order_id: orderB, status: 'ENTREGUE' }, joao.token);
assert(legacyDone.ok && legacyDone.data.order.status === 'ENTREGUE', 'legado: entregar pedido conclui unidades');
console.log('PASS: update-order-status/update-order-item-status compatíveis com o ciclo por unidade.');

// 4b. Função cai depois do commit: o aviso fica na fila e sai na repetição do comando
const orderD = 'b229b000-0000-4000-8000-000000000044';
sql(`INSERT INTO orders(id,branch_id,daily_number,status,total_amount,type,customer_name,customer_phone,confirmed_at) VALUES('${orderD}','${b}',34,'NA_FILA',40,'BALCAO','Duda · queda','61999990001',now());
INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,product_price_snapshot,production_sector,quantity,total_price,status) VALUES ${item('b229b000-0000-4000-8000-000000000057', orderD, 'Crepe misto', 'KITCHEN', 2)};`);
const crepeD = unitsOf('b229b000-0000-4000-8000-000000000057');
const direct = await request('/rest/v1/rpc/batch_update_production_status', { p_order_id: orderD, p_unit_ids: [crepeD[0]], p_item_ids: [], p_new_status: 'READY' }, maria.token);
assert(direct.ok && direct.data.order_status === 'PRONTO_PARCIAL', 'commit sem passar pela função');
assert.equal(events(orderD), '', 'sem aviso enquanto a função não roda');
assert.equal(sql(`SELECT count(*) FROM production_notification_outbox WHERE order_id='${orderD}' AND processed_at IS NULL`), '1', 'aviso pendente na fila');
const replay = await Promise.all([batch(maria, orderD, [crepeD[0]], 'READY'), batch(joao, orderD, [crepeD[0]], 'READY')]);
assert(replay.every((r) => r.ok && r.data.changed_units === 0), 'repetição não altera unidades');
assert.equal(events(orderD), 'order_partial_ready:1', 'repetição envia o aviso pendente uma vez');
assert.equal(sql(`SELECT outcome FROM production_notification_outbox WHERE order_id='${orderD}'`), 'sent_push_whatsapp_opt_out', 'resultado real registrado (fixture com opt-out)');
const blocked = await fetch(`${api}/rest/v1/production_notification_outbox?select=*`, { headers: { apikey: anon, Authorization: `Bearer ${maria.token}` } });
assert(!blocked.ok, 'operador não lê a fila de avisos');
console.log('PASS: aviso sobrevive a queda após commit e sai uma vez na repetição; fila fora do alcance do operador.');

// 5. Navegador: dois operadores, ações parciais e em lote, offline
const fonts = path.join(mkdtempSync(path.join(tmpdir(), 'production-qa-')), 'fonts.cjs');
writeFileSync(fonts, "module.exports = new Proxy({}, { get: () => `@font-face {font-family: 'Inter';src: local('Arial');}` });\n");
const app = 'http://127.0.0.1:3229';
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3229'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fonts } });
let output = ''; server.stdout.on('data', (d) => { output = (output + d).slice(-6000); }); server.stderr.on('data', (d) => { output = (output + d).slice(-6000); });
let browser; let lastPage; const errors = [];
try {
  for (let n = 0; n < 150; n++) { if (await fetch(app + '/login').then((r) => r.ok, () => false)) break; await new Promise((r) => setTimeout(r, 1000)); }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PDV_QA_CHROMIUM, args: ['--no-sandbox'] });
  const contexts = [], pages = [];
  for (const account of accounts) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.push(context);
    await context.addInitScript(() => { sessionStorage.setItem('pdv_biometric_prompt_dismissed', '1'); });
    await context.route('**/*', (route) => { const u = new URL(route.request().url()); return ['127.0.0.1', 'localhost'].includes(u.hostname) ? route.continue() : route.abort(); });
    const page = await context.newPage(); lastPage ??= page; pages.push(page); page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(app + '/login', { waitUntil: 'networkidle', timeout: 240000 });
    await page.locator('#login-email').fill(account.email); await page.locator('#login-password').fill(account.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(/\/app/, { timeout: 120000 });
    await page.goto(app + '/app/pedidos', { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.getByRole('button', { name: /Abrir detalhes do pedido 33/ }).filter({ visible: true }).waitFor({ timeout: 120000 });
  }
  const card = (page) => page.locator('article:visible').filter({ hasText: 'Ana · quadro 1B' });
  const [p1, p2] = pages;
  await card(p1).screenshot({ path: path.join(out, 'card-390-inicial.png') });
  // Operador 1 marca uma unidade pronta: as irmãs continuam com seus controles.
  const banana = card(p1).locator('div.rounded-xl.border.p-3').filter({ hasText: 'Crepe de banana' });
  await banana.getByRole('button', { name: /Marcar pronto/ }).first().click();
  await banana.getByText('Todas prontas (2)').waitFor({ timeout: 15000 });
  await card(p2).getByText('1/5 unidades prontas').waitFor({ timeout: 30000 });
  // Operador 2, sem recarregar, conclui o restante do item em lote.
  await card(p2).getByRole('button', { name: 'Todas prontas (2)' }).click();
  await card(p1).getByText('3/5 unidades prontas').waitFor({ timeout: 30000 });
  assert.equal(await card(p1).getByText(/Entregar prontas/).count(), 0, 'sem lote repetido do rodapé');
  await card(p1).screenshot({ path: path.join(out, 'card-390-parcial.png') });
  // Operador 1 entrega apenas as prontas: a unidade de carne e a água seguem visíveis.
  await card(p1).getByRole('button', { name: 'Entregar prontos' }).click();
  await card(p1).getByText('Todas as 3 entregues').waitFor({ timeout: 15000 });
  await card(p1).getByRole('button', { name: 'Entregar prontos' }).waitFor({ state: 'detached', timeout: 15000 });
  assert.equal(await card(p1).getByText('Crepe de carne').count() > 0, true, 'item restante continua visível');
  assert.equal(await card(p1).getByText('Água sem gás').count() > 0, true, 'item sem repasse continua visível');
  await card(p2).getByText('Todas as 3 entregues').waitFor({ timeout: 30000 });
  await card(p1).screenshot({ path: path.join(out, 'card-390-entregues.png') });
  assert.equal(sql(`SELECT string_agg(prep_status, ',' ORDER BY unit_no) FROM production_handoff_units WHERE order_item_id='b229b000-0000-4000-8000-000000000054' AND state<>'SUPERSEDED'`), 'DELIVERED,DELIVERED,DELIVERED');
  assert.equal(sql(`SELECT status FROM orders WHERE id='${orderC}'`), 'PRONTO_PARCIAL');
  const smallTargets = await card(p1).locator('section[aria-label="Repasse e preparo dos itens"] button').evaluateAll((bs) => bs.filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).length);
  assert.equal(smallTargets, 0, 'alvos >= 44px');
  for (const width of [320, 390, 768, 1440]) {
    await p1.setViewportSize({ width, height: 1000 });
    for (const dark of [false, true]) {
      await p1.evaluate((d) => { document.documentElement.classList.toggle('dark', d); document.documentElement.dataset.theme = d ? 'dark' : 'light'; }, dark);
      const scroll = await p1.evaluate(() => document.documentElement.scrollWidth);
      assert(scroll <= width, `sem overflow ${width}`);
      await card(p1).evaluate((e) => e.scrollIntoView({ block: 'start' }));
      await p1.screenshot({ path: path.join(out, `quadro-${width}-${dark ? 'dark' : 'light'}.png`) });
    }
  }
  await p1.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.dataset.theme = 'light'; });
  await p1.setViewportSize({ width: 390, height: 844 });
  await contexts[0].setOffline(true);
  await card(p1).getByText(/Sem conexão. Dados da última atualização/).waitFor({ timeout: 10000 });
  // Sem rede, nenhuma ação de preparo fica disponível (desabilitada, ou oculta se o repasse não pôde ser relido).
  const enabledPrep = await card(p1).locator('section[aria-label="Repasse e preparo dos itens"] button')
    .filter({ hasText: /Marcar pronto|Preparar|Entregar|Todas prontas/ })
    .evaluateAll((bs) => bs.filter((b) => !b.disabled).length);
  assert.equal(enabledPrep, 0, 'sem rede o preparo fica bloqueado');
  assert.equal(await card(p1).getByText('Crepe de carne').count() > 0, true, 'itens continuam visíveis sem rede');
  await card(p1).screenshot({ path: path.join(out, 'offline-390.png') });
  await contexts[0].setOffline(false);
  await card(p1).getByText(/Sem conexão. Dados da última atualização/).waitFor({ state: 'hidden', timeout: 15000 });
  assert.equal(sql(`SELECT count(*) FROM whatsapp_messages WHERE order_id='${orderC}' AND event_type='order_partial_ready'`), '1', 'quadro: um aviso parcial');
  assert.deepEqual(errors, [], 'sem exceções JavaScript');
  console.log('PASS: /app/pedidos com dois operadores, unidade isolada, lote por item, entrega só das prontas, offline e 11 capturas.');
} catch (e) { console.error(output); if (lastPage) await lastPage.screenshot({ path: path.join(out, 'falha-qa.png') }).catch(() => {}); throw e; } finally { await browser?.close(); server.kill('SIGTERM'); }
