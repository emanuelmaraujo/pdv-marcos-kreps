// QA local do pagamento na entrega: serviços simulados em 127.0.0.1:54321, sem rede externa.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.dirname(fileURLToPath(import.meta.url));
const APP = 'http://127.0.0.1:3221';
const TOKEN = 'a'.repeat(32);
const branch = { id:'11111111-1111-4111-8111-111111111111',code:'TEST',name:'Unidade de teste (fixture)',slug:'nb',delivery_enabled:true,default_delivery_fee:5,address:'Endereço fictício' };
const product = {id:'22222222-2222-4222-8222-222222222222',category_id:'33333333-3333-4333-8333-333333333333',name:'Krep de teste',description:'Produto sintético.',price:20,sector:'KITCHEN',active:true,branch_id:branch.id,image_url:null};
const tables = { categories:[{id:product.category_id,name:'Kreps salgados',active:true,sort_order:0}],products:[product],ingredients:[],product_ingredients:[],product_addons:[],addons:[],delivery_zones:[] };
const settings = {public_ordering_start_time:'00:00',public_ordering_end_time:'23:59',packaging_fee:'2',apply_packaging_fee_for_takeout:'true'};

async function scenario(browser, { width, cod, failFirstCreate = false, consent = false }) {
  const calls = { create: [], funnel: [], blocked: [] };
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  if (consent) await context.addInitScript(() => localStorage.setItem('pdv-public-funnel-consent', 'granted'));
  let createAttempts = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '3221') return route.continue();
    if (url.hostname === '127.0.0.1' && url.port === '54321') {
      const fn = url.pathname.split('/').pop();
      const body = route.request().postDataJSON?.() ?? null;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
      let data;
      if (fn === 'get-public-checkout-config') data = { success:true, branch:{ ...branch, cod_enabled:cod, cod_methods: cod ? ['CASH','PIX','DEBIT_CARD'] : [] }, settings, online_ordering_enabled:true, ordering_closed_reason:'' };
      else if (fn === 'get-public-branch-stats') data = { success:true, orders_today:0, top_product_by_category:{} };
      else if (fn === 'lookup-cep') data = { success:true, address:{ street:'Rua Fictícia', neighborhood:'Centro', city:'Cidade Teste', state:'DF' } };
      else if (fn === 'record-public-funnel-event') { calls.funnel.push(body); data = { success:true }; }
      else if (fn === 'create-public-order') {
        calls.create.push({ body, key: route.request().headers()['x-idempotency-key'] });
        createAttempts++;
        if (failFirstCreate && createAttempts === 1) return route.abort('connectionreset');
        data = { success:true, order:{ order_id:'44444444-4444-4444-8444-444444444444', daily_number:7, public_token:TOKEN, total_amount:25, status: body.payment_timing === 'ON_DELIVERY' ? 'AGUARDANDO_CONFIRMACAO' : 'AGUARDANDO_PAGAMENTO', payment_status:'PENDING', payment_method_code:'PIX', payment_timing: body.payment_timing, expected_payment_method: body.expected_payment_method ?? null, cash_change_for: body.cash_change_for ?? null } };
      } else if (fn === 'get-public-order-status') data = { success:true, order:{ daily_number:7, status:'AGUARDANDO_CONFIRMACAO', payment_status:'PENDING', payment_method:'CASH', payment_timing:'ON_DELIVERY', expected_payment_method:'CASH', cash_change_for:50, total:25, created_at:new Date().toISOString() }, items:[{ product_name:'Krep de teste', product_price:20, quantity:1, total_price:20, status:'PENDING', addons:[], removed_ingredients:[] }] };
      else if (url.pathname.includes('/rest/v1/')) data = tables[fn] ?? [];
      else data = { success:false, error:'Serviço simulado indisponível' };
      return route.fulfill({ json: data, headers });
    }
    calls.blocked.push(url.origin + url.pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', err => console.error('pageerror:', err.message, (err.stack||'').split('\n').slice(0,4).join(' | ')));
  await page.goto(`${APP}/pedir`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.getByRole('heading', { name: 'Krep de teste', exact: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Krep de teste', exact: true }) }).click();
  await page.getByRole('button', { name: /Adicionar.*R\$/ }).click();
  const cart = page.getByRole('button', { name: /Ver (pedido|carrinho)|Revisar|Fechar pedido/ }).first();
  if (await cart.count()) await cart.click(); else await page.getByRole('button', { name: /Seu pedido/ }).first().click();
  await page.getByRole('heading', { name: 'Confira seu pedido' }).waitFor();
  await page.getByRole('button', { name: /Continuar|Meus dados|Ir para.*dados/ }).first().click();
  await page.getByRole('heading', { name: 'Seus dados', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Entrega', exact: true }).click();
  await page.getByLabel(/WhatsApp com DDD/).fill('61999990000');
  await page.getByPlaceholder('CEP *').fill('70000000');
  await page.getByText(/Rua Fictícia, Centro/).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Número').fill('10');
  const timing = page.getByRole('region', { name: 'Quando pagar' });
  const result = { width, cod, timingVisible: await timing.count() > 0 };
  if (!cod) {
    result.cta = await page.getByRole('button', { name: /Continuar para pagamento|Solicitar pedido/ }).innerText();
  } else {
    await timing.getByLabel('Pagar na entrega').check();
    const submit = page.getByRole('button', { name: 'Solicitar pedido para entrega' });
    await submit.click();
    result.missingMethodError = await page.getByText('Selecione como pretende pagar na entrega.').waitFor({ timeout: 10000 }).then(() => true, () => false);
    await timing.locator('select').selectOption('CASH');
    await page.getByLabel(/Troco para quanto/).fill('10');
    await submit.click();
    result.lowChangeError = await page.getByText('Informe um valor para troco igual ou maior que o total.').waitFor({ timeout: 10000 }).then(() => true, () => false);
    await page.getByLabel(/Troco para quanto/).fill('50');
    result.staleErrorCleared = await page.getByText('Informe um valor para troco igual ou maior que o total.').count() === 0;
    await page.screenshot({ path: path.join(out, `qa-cod-dados-${width}.png`), fullPage: true });
    result.bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `qa-cod-rodape-${width}.png`) });
    // Resumo inteiro precisa ficar acima da barra fixa quando a página chega ao fim.
    result.summaryClear = await page.evaluate(() => {
      const summary = document.querySelector('[aria-label="Resumo de custos do pedido"]')?.getBoundingClientRect();
      const bar = [...document.querySelectorAll('div.fixed')].find(el => el.textContent?.includes('Solicitar pedido'))?.getBoundingClientRect();
      return !!summary && (!bar || getComputedStyle(document.querySelector('div.fixed')).position !== 'fixed' || summary.bottom <= bar.top + 1);
    });
    await submit.click();
    if (failFirstCreate) {
      await page.getByText(/Não conseguimos criar o pedido|conex|rede/i).first().waitFor({ timeout: 15000 });
      result.networkErrorShown = true;
      await submit.click();
    }
    await page.waitForURL(/\/pedido\//, { timeout: 30000 });
    await page.getByText('Pagamento na entrega pendente').waitFor({ timeout: 60000 }).catch(async e => { await page.screenshot({ path: '/tmp/issue221-qa-fail.png', fullPage: true }); console.error(page.url(), JSON.stringify(calls.blocked), (await page.locator('body').innerText()).slice(0, 800)); throw e; });
    result.trackingPill = await page.getByText('Aguardando confirmação da unidade').first().isVisible();
    result.trackingShowsPaid = await page.getByText(/^Pago$/).count() > 0;
    await page.screenshot({ path: path.join(out, `qa-cod-acompanhamento-${width}.png`), fullPage: true });
  }
  result.createCalls = calls.create.map(c => ({ key: c.key, payment_timing: c.body.payment_timing, expected_payment_method: c.body.expected_payment_method, cash_change_for: c.body.cash_change_for, analytics_consent: c.body.analytics_consent }));
  result.funnelEvents = calls.funnel.map(e => e.event_name);
  result.funnelLeak = calls.funnel.some(e => /61999990000|Fictícia|aaaaaaaa/.test(JSON.stringify(e)));
  result.blocked = [...new Set(calls.blocked)];
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  results.push(await scenario(browser, { width: 390, cod: false }));
  results.push(await scenario(browser, { width: 390, cod: true, failFirstCreate: true }));
  results.push(await scenario(browser, { width: 1440, cod: true, consent: true }));
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'qa-cod.json'), JSON.stringify(results, null, 2));
const [off, mobile, desktop] = results;
assert.equal(off.timingVisible, false, 'COD desativado não pode exibir escolha');
assert.match(off.cta, /Continuar para pagamento/);
for (const r of [mobile, desktop]) {
  assert(r.timingVisible && r.missingMethodError && r.lowChangeError, 'validações COD');
  assert(r.bodyWidth <= r.width, `overflow em ${r.width}`);
  assert(r.staleErrorCleared, `erro de troco permanece após correção em ${r.width}`);
  assert(r.summaryClear, `resumo coberto pela barra fixa em ${r.width}`);
  assert(r.trackingPill && !r.trackingShowsPaid, 'acompanhamento não pode exibir pago');
  assert(r.createCalls.every(c => c.payment_timing === 'ON_DELIVERY' && c.expected_payment_method === 'CASH' && c.cash_change_for === 50));
}
assert(mobile.networkErrorShown && mobile.createCalls.length === 2 && mobile.createCalls[0].key === mobile.createCalls[1].key, 'retry deve reutilizar a mesma chave');
assert.equal(mobile.funnelEvents.length, 0, 'sem consentimento não há métricas');
assert(desktop.funnelEvents.length > 0 && !desktop.funnelLeak, 'métricas com consentimento e sem dados pessoais');
console.log('PASS: COD desligado oculto; validações; retry com mesma chave; acompanhamento pendente; métricas só com consentimento e sem PII; sem overflow em 390/1440.');
