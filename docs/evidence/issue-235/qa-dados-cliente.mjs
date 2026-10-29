// QA local da etapa "Seus dados" de /pedir (#235). Fixtures sintéticas;
// intercepta o Supabase fictício e aborta qualquer outro destino. Não cria
// pedido, pagamento, impressão nem mensagem. Ver README.md desta pasta.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.dirname(fileURLToPath(import.meta.url));
const phase = process.env.AUDIT_PHASE === 'after' ? 'depois' : 'antes';
const port = process.env.APP_PORT || '3221';
const widths = (process.env.WIDTHS || '360,390,430,768,1440').split(',').map(Number);
const keep = new Set((process.env.KEEP || '390,1440').split(',').map(Number));
const branch = { id:'11111111-1111-4111-8111-111111111111',code:'TEST',name:'Unidade de teste (fixture)',slug:'nb',delivery_enabled:true,default_delivery_fee:5 };
const product = { id:'22222222-2222-4222-8222-222222222222',category_id:'33333333-3333-4333-8333-333333333333',name:'Krep de teste',description:'Produto sintético; sem foto.',price:20,sector:'KITCHEN',active:true,branch_id:branch.id,image_url:null };
const tables = { categories:[{id:product.category_id,name:'Kreps salgados',active:true,sort_order:0}],products:[product],ingredients:[],product_ingredients:[],product_addons:[],addons:[],delivery_zones:[] };
const fixtureName = 'Cliente Salvo Fixture';
const typedName = 'Nome Digitado Fixture';

const browser = await chromium.launch({ headless:true });
const log = [];
try {
 for (const width of widths) {
  const context = await browser.newContext({ viewport:{width,height:width >= 1024 ? 900 : 844}, serviceWorkers:'block' });
  const problems = [];
  await context.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (url.hostname === '127.0.0.1' && url.port === port) return route.continue();
   if (url.hostname === '127.0.0.1' && url.port === '9') {
    let data;
    const fn = url.pathname.split('/').pop();
    if (fn === 'get-public-checkout-config') data = { success:true,branch,settings:{public_ordering_start_time:'00:00',public_ordering_end_time:'23:59',packaging_fee:'2',apply_packaging_fee_for_takeout:'true'},online_ordering_enabled:true,ordering_closed_reason:'' };
    else if (fn === 'get-public-branch-stats') data = { success:true,orders_today:0,top_product_by_category:{} };
    else if (fn === 'get-public-customer-profile') data = { success:true,found:true,profile:{name:fixtureName,email:null,order_type:null,marketing_opt_in:false},addresses:[] };
    else if (fn === 'lookup-cep') data = { success:true,address:{street:'Rua Fixture',neighborhood:'Bairro Fixture',city:'Brasília',state:'DF'} };
    else if (url.pathname.includes('/rest/v1/')) data = tables[fn] ?? [];
    else data = { success:false,error:'Serviço simulado indisponível' };
    return route.fulfill({ json:data,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'} });
   }
   problems.push(`bloqueado: ${url.origin}${url.pathname}`);
   return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) problems.push(`console: ${m.text().slice(0,160)}`); });
  await page.goto(`http://127.0.0.1:${port}/pedir`, { waitUntil:'domcontentloaded',timeout:180000 });
  await page.getByRole('heading',{name:'Krep de teste',exact:true}).waitFor({timeout:120000});
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Krep de teste',exact:true})}).click();
  await page.getByRole('button',{name:/Adicionar.*R\$/}).click();
  const cart = page.getByRole('button',{name:/Ver (pedido|carrinho)|Revisar|Fechar pedido/}).first();
  if (await cart.count()) await cart.click(); else await page.getByRole('button',{name:/Seu pedido/}).first().click();
  await page.getByRole('heading',{name:'Confira seu pedido'}).waitFor();
  await page.getByRole('button',{name:/Continuar|Meus dados|Ir para.*dados/}).first().click();
  await page.getByRole('heading',{name:'Seus dados',exact:true}).waitFor();
  await page.getByRole('button',{name:'Para levar',exact:true}).click();

  const section = page.locator('section').filter({has:page.getByRole('heading',{name:'Seus dados',exact:true})});
  const fieldOrder = await section.locator('input:not([type=checkbox]):not([type=radio]), textarea').evaluateAll(els => els.map(el => {
   const label = el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || el.closest('label')?.textContent?.trim() || el.getAttribute('placeholder') || '';
   return { label, autocomplete: el.getAttribute('autocomplete') };
  }));
  const shot = name => keep.has(width) ? page.screenshot({ path:path.join(out,`${phase}-${name}-${width}.png`),fullPage:true }) : null;
  await shot('dados-viagem');

  // Nome digitado à mão antes do WhatsApp; o perfil salvo não pode sobrescrevê-lo.
  const fields = section.locator('input:not([type=checkbox]):not([type=radio]), textarea');
  const nameField = fields.nth(fieldOrder.findIndex(f => /^Nome/.test(f.label)));
  const phoneField = fields.nth(fieldOrder.findIndex(f => /^WhatsApp/.test(f.label)));
  await nameField.fill(typedName);
  await phoneField.fill('61999990000');
  await page.getByText(/dados salvos pelo WhatsApp/).waitFor({ timeout:15000 });
  const nameAfterLookup = await nameField.inputValue();
  const suggestionVisible = await page.getByText(fixtureName).count() > 0;

  // ENTREGA: CEP resolve pelo fixture e libera número do imóvel.
  await section.getByRole('button',{name:'Entrega',exact:true}).click();
  const cep = page.getByPlaceholder('CEP *');
  await cep.fill('70000000');
  await page.getByText(/Rua Fixture/).waitFor({ timeout:15000 });
  const entregaOrder = await section.locator('input:not([type=checkbox]):not([type=radio]), textarea').evaluateAll(els => els.map(el => el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''));
  await shot('dados-entrega');
  // A captura de página inteira sobrepõe a barra fixa ao endereço; esta usa o viewport.
  if (keep.has(width)) {
   await cep.evaluate(el => el.scrollIntoView({ block:'start', behavior:'instant' }));
   await page.evaluate(() => window.scrollBy(0, -120));
   await page.screenshot({ path:path.join(out,`${phase}-endereco-${width}.png`) });
  }

  // Foco visível por teclado a partir do topo do formulário.
  await nameField.focus();
  const focusRing = await nameField.evaluate(el => { const s = getComputedStyle(el); return `${s.borderColor} / ${s.boxShadow}`; });

  const entry = { width, fieldOrder, entregaOrder, nameAfterLookup, suggestionVisible, focusRing,
   bodyWidth: await page.evaluate(() => document.documentElement.scrollWidth), problems };
  log.push(entry);
  console.log(`Viewport ${width}: ${fieldOrder.map(f => f.label.split(' (')[0]).join(' → ')}`);
  await context.close();
 }
} finally {
 await browser.close();
}
fs.writeFileSync(path.join(out,`${phase}-qa-dados.json`), JSON.stringify(log,null,2));
for (const e of log) assert(e.bodyWidth <= e.width, `overflow horizontal em ${e.width}px`);
for (const e of log) assert.equal(e.nameAfterLookup, typedName, `lookup sobrescreveu o nome em ${e.width}px`);
if (phase === 'depois') {
 for (const e of log) {
  const idx = re => e.fieldOrder.findIndex(f => re.test(f.label));
  assert(idx(/^Nome/) >= 0 && idx(/^Nome/) < idx(/^WhatsApp/), `Nome não vem antes do WhatsApp em ${e.width}px`);
  assert.equal(e.fieldOrder[idx(/^Nome/)].autocomplete, 'name');
  assert.equal(e.fieldOrder[idx(/^WhatsApp/)].autocomplete, 'tel');
  assert(e.suggestionVisible, `sugestão do nome salvo ausente em ${e.width}px`);
  assert(e.entregaOrder.some(l => /Número do imóvel/.test(l)), `número do imóvel sem rótulo em ${e.width}px`);
 }
 console.log(`PASS: ${log.length} larguras; nome antes do WhatsApp, lookup preserva nome digitado, sem overflow.`);
}
