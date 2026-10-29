// QA do redesign aprovado na #235: jornada completa de /pedir com catálogo
// sintético. Intercepta o Supabase fictício (127.0.0.1:9) dentro do navegador —
// inclusive create-public-order e create-mercado-pago-payment, que respondem com
// fixtures — e aborta qualquer outro destino. Nenhum pedido, pagamento,
// impressão ou mensagem real é criado. Ver README.md desta pasta.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
const port = process.env.APP_PORT || '3221';
const widths = (process.env.WIDTHS || '360,390,430,768,1440').split(',').map(Number);
const keep = new Set((process.env.KEEP || '390,1440').split(',').map(Number));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const branch = { id: id(1), code: 'TEST', name: 'Unidade fixture', slug: 'nb', delivery_enabled: true, default_delivery_fee: 5, address: 'Rua Fixture, 10 — Brasília/DF' };
const cats = [
  { id: id(10), name: 'Kreps salgados', active: true, sort_order: 0 },
  { id: id(11), name: 'Kreps doces', active: true, sort_order: 1 },
  { id: id(13), name: 'Batata', active: true, sort_order: 2 },
  { id: id(12), name: 'Bebidas', active: true, sort_order: 3 },
];
const p = (n, cat, name, price, description, image_url = null) => ({ id: id(n), category_id: cat, name, price, description, image_url, sector: 'KITCHEN', active: true, branch_id: branch.id });
const products = [
  p(20, id(10), 'Krep Frango com Catupiry', 24.9, 'Frango desfiado, catupiry e muçarela.'),
  p(21, id(10), 'Krep Calabresa', 22.9, 'Calabresa, cebola e muçarela.'),
  p(22, id(10), 'Krep Quatro Queijos com nome bem comprido para testar quebra de linha', 27.5, 'Muçarela, provolone, parmesão e catupiry.'),
  p(24, id(10), 'Krep Monte o Seu', 19.9, 'Escolha a proteína.'),
  p(23, id(11), 'Krep Nutella com Morango', 26.9, 'Creme de avelã e morangos frescos.'),
  p(25, id(13), 'Porção de Batata', 22, 'Batata frita crocante.'),
  p(30, id(12), 'Suco de Laranja', 9.9, 'Natural, 400 ml.', '/cardapio/bebidas/suco-laranja.svg'),
  p(31, id(12), 'Suco de Maracujá', 9.9, 'Natural, 400 ml.', '/cardapio/bebidas/suco-maracuja.svg'),
  p(32, id(12), 'Refrigerante lata', 6.5, '350 ml.', '/cardapio/bebidas/refri-cola-lata.svg'),
];
const ingredients = [{ id: id(40), name: 'Cebola', active: true }, { id: id(41), name: 'Muçarela', active: true }];
const product_ingredients = [{ id: id(50), product_id: id(21), ingredient_id: id(40) }, { id: id(51), product_id: id(21), ingredient_id: id(41) }];
const addonNames = ['Bacon extra', 'Catupiry extra', 'Cheddar', 'Milho', 'Ovo', 'Azeitona', 'Tomate'];
const addons = addonNames.map((name, i) => ({ id: id(60 + i), name, price: [4, 3.5, 3.5, 2, 2.5, 2, 2][i], active: true }));
const product_addons = [
  ...addons.map((a) => ({ product_id: id(21), addon_id: a.id, is_required: false, max_quantity: 2 })),
  { product_id: id(24), addon_id: addons[0].id, is_required: true, max_quantity: 1 },
];
const tables = { categories: cats, products, ingredients, product_ingredients, addons, product_addons, delivery_zones: [] };
const order = { order_id: id(90), daily_number: 42, public_token: 'fixture-token', total_amount: 0, status: 'PENDING', payment_status: 'PENDING', payment_method_code: 'PIX', payment_timing: 'ONLINE' };

const browser = await chromium.launch({ headless: true });
const log = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 844 }, serviceWorkers: 'block' });
    const blocked = [];
    let paid = false;
    let createdOrder = null;
    await context.route('**/*', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname === '127.0.0.1' && url.port === port) return route.continue();
      if (url.hostname === '127.0.0.1' && url.port === '9') {
        const fn = url.pathname.split('/').pop();
        let data;
        if (fn === 'get-public-checkout-config') data = { success: true, branch, settings: { public_ordering_start_time: '00:00', public_ordering_end_time: '23:59', packaging_fee: '2', apply_packaging_fee_for_takeout: 'true' }, online_ordering_enabled: true, ordering_closed_reason: '' };
        else if (fn === 'get-public-branch-stats') data = { success: true, orders_today: 0, top_product_by_category: { [id(10)]: id(21) } };
        else if (fn === 'get-public-customer-profile') data = { success: true, found: false };
        else if (fn === 'lookup-cep') data = { success: true, address: { street: 'Rua Fixture', neighborhood: 'Bairro Fixture', city: 'Brasília', state: 'DF' } };
        else if (fn === 'create-public-order') {
          const body = req.postDataJSON() ?? {};
          createdOrder = body;
          data = { success: true, order: { ...order, total_amount: 61.7 } };
        } else if (fn === 'create-mercado-pago-payment') { paid = true; data = { success: true, payment: { id: 1, status: 'approved' } }; }
        else if (fn === 'get-public-order-status') data = { success: true, order: { daily_number: 42, status: 'PENDING', payment_status: paid ? 'PAID' : 'PENDING', payment_method: 'PIX', total: 61.7, created_at: new Date().toISOString() } };
        else if (url.pathname.includes('/rest/v1/')) data = tables[fn] ?? [];
        else data = { success: false, error: 'Serviço simulado indisponível' };
        return route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      }
      blocked.push(url.origin + url.pathname);
      return route.abort();
    });
    if (process.env.TRACE_HISTORY) await context.addInitScript(() => {
      window.__hist = [];
      const push = history.pushState.bind(history);
      history.pushState = (st, ...rest) => { window.__hist.push('push ' + JSON.stringify(st)); return push(st, ...rest); };
      const back = history.back.bind(history);
      history.back = () => { window.__hist.push('back'); return back(); };
      window.addEventListener('popstate', (e) => window.__hist.push('pop ' + JSON.stringify(e.state)));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    const shot = async (name, full = true) => { if (keep.has(width)) await page.screenshot({ path: path.join(out, `depois-${name}-${width}.png`), fullPage: full }); };
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const entry = { width, overflow: {}, checks: {}, errors, blocked };
    try {

    await page.goto(`http://127.0.0.1:${port}/pedir`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.getByRole('heading', { name: 'Krep Calabresa', exact: true }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(600);
    entry.checks.firstProductTop = await page.getByRole('heading', { name: 'Krep Frango com Catupiry', exact: true }).evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await shot('menu-dobra', false);
    await shot('menu');
    entry.overflow.menu = await overflow();

    // "+" adiciona direto; segundo toque soma no mesmo item.
    await page.getByRole('button', { name: 'Adicionar Krep Frango com Catupiry', exact: true }).click();
    await page.getByRole('button', { name: /Adicionar mais um Krep Frango com Catupiry \(1 na sacola\)/ }).waitFor();
    entry.checks.quickAdd = true;

    // Adicional obrigatório: "+" abre a personalização em vez de adicionar.
    await page.getByRole('button', { name: 'Adicionar Krep Monte o Seu', exact: true }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('heading', { name: 'Krep Monte o Seu' }).waitFor();
    entry.checks.requiredOpensSheet = true;
    await sheet.getByRole('button', { name: /Fechar/ }).first().click();
    await sheet.waitFor({ state: 'hidden' });

    // Personalização: 7 adicionais visíveis, sem limite (Bacon ×3).
    await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Krep Calabresa', exact: true }) }).click();
    await page.getByRole('heading', { name: 'Adicionais' }).waitFor();
    const more = page.getByRole('button', { name: 'Aumentar Bacon extra' });
    for (let i = 0; i < 3; i++) await more.click();
    entry.checks.addonCount = await page.getByRole('button', { name: /^Aumentar / }).count();
    entry.checks.baconQty = await page.locator('li').filter({ hasText: 'Bacon extra' }).locator('[aria-live]').innerText();
    await page.getByRole('checkbox', { name: 'Cebola' }).uncheck();
    await shot('produto', false);
    await page.getByRole('button', { name: /^Adicionar · / }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    // Sacola com edição explícita.
    const toBag = page.getByRole('button', { name: /Ver sacola/ });
    if (await toBag.isVisible().catch(() => false)) await toBag.click();
    else await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('heading', { name: 'Sua sacola', level: 2 }).waitFor();
    await page.waitForTimeout(600);
    await shot('sacola');
    entry.overflow.sacola = await overflow();
    entry.checks.bagText = (await page.locator('main').innerText()).slice(0, 600);
    await page.getByRole('button', { name: /^Editar Krep Calabresa/ }).click();
    await page.getByRole('button', { name: /^Salvar · / }).waitFor();
    await shot('editar-item', false);
    await page.getByRole('button', { name: 'Diminuir Bacon extra' }).click();
    await page.getByRole('button', { name: /^Salvar · / }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Aumentar Krep Frango com Catupiry' }).click();
    entry.checks.bagAfterEdit = (await page.locator('ul').first().innerText()).replace(/\s+/g, ' ').slice(0, 300);

    // Dados: nome → WhatsApp; modalidade como resumo com "Alterar" → Entrega.
    await page.getByRole('button', { name: /Continuar para seus dados/ }).click();
    await page.getByRole('heading', { name: 'Seus dados', exact: true }).waitFor();
    await page.getByLabel('Nome (opcional)').fill('Ana Fixture');
    await page.getByLabel('WhatsApp com DDD').fill('61999990000');
    await page.getByRole('button', { name: 'Alterar' }).click();
    await page.getByRole('radio', { name: 'Entrega' }).click();
    await page.getByPlaceholder('CEP *').fill('70000000');
    await page.getByText(/Rua Fixture, Bairro Fixture/).waitFor({ timeout: 15000 });
    await page.getByLabel('Número do imóvel (casa, prédio ou lote)').fill('120');
    await shot('dados-entrega');
    entry.overflow.dados = await overflow();

    // Pagamento (pedido criado pelo fixture): sem selos genéricos.
    await page.getByRole('button', { name: /Continuar para pagamento/ }).click();
    await page.getByRole('heading', { name: 'Como quer pagar?' }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    entry.checks.paymentHasSeal = (await page.locator('main').innerText()).includes('Cancelamento fácil');
    entry.checks.createdOrder = createdOrder && { customer_name: createdOrder.customer_name, order_type: createdOrder.order_type, items: createdOrder.items?.length };
    await shot('pagamento');
    entry.overflow.pagamento = await overflow();

    // Pix aprovado pelo fixture → confirmação com o nome.
    await page.getByLabel('E-mail para o Pix').fill('ana@exemplo.com');
    await page.getByRole('button', { name: 'Gerar Pix copia e cola' }).click();
    await page.getByRole('heading', { name: /Obrigado/ }).waitFor({ timeout: 20000 });
    entry.checks.thanks = await page.getByRole('heading', { name: /Obrigado/ }).innerText();
    await shot('confirmacao');
    entry.overflow.confirmacao = await overflow();

    } catch (error) {
      await page.screenshot({ path: path.join(out, `falha-${width}.png`) });
      if (process.env.TRACE_HISTORY) console.log((await page.evaluate(() => window.__hist)).join('\n'));
      throw error;
    }
    log.push(entry);
    console.log(`Viewport ${width}: 1º produto a ${entry.checks.firstProductTop}px; ${entry.checks.thanks}`);
    await context.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'depois-qa-redesign.json'), JSON.stringify(log, null, 2));
for (const e of log) {
  for (const [screen, over] of Object.entries(e.overflow)) assert(!over, `overflow horizontal em ${screen} @${e.width}`);
  assert.deepEqual(e.errors, [], `erros de página @${e.width}`);
  assert.equal(e.checks.addonCount >= 7, true, `adicionais visíveis @${e.width}`);
  assert.equal(e.checks.baconQty, '3', `adicional sem limite @${e.width}`);
  assert.equal(e.checks.paymentHasSeal, false, `selo sem respaldo @${e.width}`);
  assert.match(e.checks.thanks, /Obrigado, Ana!/, `nome na confirmação @${e.width}`);
}
console.log(`PASS: ${log.length} larguras — jornada completa, + direto, adicionais sem limite, edição, sem selo, nome na confirmação, sem overflow.`);
