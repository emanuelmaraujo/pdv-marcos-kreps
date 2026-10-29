// Fase 0 da #235: jornada atual do código (cardápio → produto → revisão → dados)
// com catálogo sintético. Intercepta o Supabase fictício (127.0.0.1:9) e aborta
// qualquer outro destino; nenhum pedido, pagamento ou mensagem é criado.
// Kreps sem foto (fallback); bebidas usam as artes do próprio app em /cardapio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
const port = process.env.APP_PORT || '3221';
const widths = (process.env.WIDTHS || '360,390,430,768,1440').split(',').map(Number);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const branch = { id: id(1), code: 'TEST', name: 'Unidade de teste (fixture)', slug: 'nb', delivery_enabled: true, default_delivery_fee: 5 };
const cats = [{ id: id(10), name: 'Kreps salgados', active: true, sort_order: 0 }, { id: id(11), name: 'Kreps doces', active: true, sort_order: 1 }, { id: id(12), name: 'Bebidas', active: true, sort_order: 2 }];
const p = (n, cat, name, price, description, image_url = null, sector = 'KITCHEN') => ({ id: id(n), category_id: cat, name, price, description, image_url, sector, active: true, branch_id: branch.id });
const products = [
  p(20, id(10), 'Krep Frango com Catupiry', 24.9, 'Frango desfiado, catupiry e muçarela.'),
  p(21, id(10), 'Krep Calabresa', 22.9, 'Calabresa, cebola e muçarela.'),
  p(22, id(10), 'Krep Quatro Queijos com nome bem comprido para testar quebra', 27.5, 'Muçarela, provolone, parmesão e catupiry.'),
  p(23, id(11), 'Krep Nutella com Morango', 26.9, 'Creme de avelã e morangos frescos.'),
  p(30, id(12), 'Suco de Laranja', 9.9, 'Natural, 400 ml.', '/cardapio/bebidas/suco-laranja.svg', 'JUICE'),
  p(31, id(12), 'Refrigerante lata', 6.5, '350 ml.', '/cardapio/bebidas/refri-cola-lata.svg', 'BAR'),
];
const ingredients = [{ id: id(40), name: 'Cebola', active: true }, { id: id(41), name: 'Muçarela', active: true }];
const product_ingredients = [{ id: id(50), product_id: id(21), ingredient_id: id(40) }, { id: id(51), product_id: id(21), ingredient_id: id(41) }];
const addons = [{ id: id(60), name: 'Bacon extra', price: 4, active: true }, { id: id(61), name: 'Catupiry extra', price: 3.5, active: true }];
const product_addons = [{ product_id: id(21), addon_id: id(60), is_required: false, max_quantity: 2 }, { product_id: id(21), addon_id: id(61), is_required: false, max_quantity: 2 }];
const tables = { categories: cats, products, ingredients, product_ingredients, addons, product_addons, delivery_zones: [] };

const browser = await chromium.launch({ headless: true });
const log = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 844 }, serviceWorkers: 'block' });
    const blocked = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' && url.port === port) return route.continue();
      if (url.hostname === '127.0.0.1' && url.port === '9') {
        const fn = url.pathname.split('/').pop();
        let data;
        if (fn === 'get-public-checkout-config') data = { success: true, branch, settings: { public_ordering_start_time: '00:00', public_ordering_end_time: '23:59', packaging_fee: '2', apply_packaging_fee_for_takeout: 'true' }, online_ordering_enabled: true, ordering_closed_reason: '' };
        else if (fn === 'get-public-branch-stats') data = { success: true, orders_today: 0, top_product_by_category: {} };
        else if (url.pathname.includes('/rest/v1/')) data = tables[fn] ?? [];
        else data = { success: false, error: 'Serviço simulado indisponível' };
        return route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      }
      blocked.push(url.origin + url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    const shot = (name, full = true) => page.screenshot({ path: path.join(out, `atual-${name}-${width}.png`), fullPage: full });
    await page.goto(`http://127.0.0.1:${port}/pedir`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.getByRole('heading', { name: 'Krep Calabresa', exact: true }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(800);
    await shot('menu-dobra', false);
    // Primeira dobra: quanto da altura é consumido antes do primeiro produto.
    const firstProductTop = await page.getByRole('heading', { name: 'Krep Frango com Catupiry', exact: true }).evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await shot('menu');
    await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Krep Calabresa', exact: true }) }).click();
    await page.waitForTimeout(600);
    await shot('produto', false);
    await page.getByRole('button', { name: /Adicionar.*R\$/ }).click();
    const cart = page.getByRole('button', { name: /Ver (pedido|carrinho)|Revisar|Fechar pedido/ }).first();
    if (await cart.count()) await cart.click(); else await page.getByRole('button', { name: /Seu pedido/ }).first().click();
    await page.getByRole('heading', { name: 'Confira seu pedido' }).waitFor();
    await shot('revisao');
    await page.getByRole('button', { name: /^Continuar/ }).first().click();
    await page.getByRole('heading', { name: 'Seus dados', exact: true }).waitFor();
    await shot('dados');
    log.push({ width, firstProductTop, viewportHeight: width >= 1024 ? 900 : 844, bodyWidth: await page.evaluate(() => document.documentElement.scrollWidth), errors, blocked: [...new Set(blocked)] });
    console.log(`Viewport ${width}: primeiro produto a ${firstProductTop}px do topo`);
    await context.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'atual-captura.json'), JSON.stringify(log, null, 2));
