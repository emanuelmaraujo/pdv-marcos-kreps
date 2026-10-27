// QA do painel: configura COD com login real na instância Supabase descartável do E2E.
// Iniciado por `npm run test:cod-e2e -- --admin-qa`; nunca aponta para serviços reais.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../..');
const { API_URL: api, ANON_KEY: anon, SERVICE_ROLE_KEY: service } = process.env;
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api ?? ''), 'QA aceita apenas API local.');
const port = 3222;
const app = `http://127.0.0.1:${port}`;
const fonts = path.join(mkdtempSync(path.join(tmpdir(), 'pdv221-')), 'fonts.cjs');
writeFileSync(fonts, "module.exports = new Proxy({}, { get: (_t, url) => `@font-face {font-family: '${String(url).includes('Plus') ? 'Plus Jakarta Sans' : 'Inter'}';src: local('Arial');font-weight: 100 900;}` });\n");
const rest = (pathname) => fetch(`${api}/rest/v1/${pathname}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).then((r) => r.json());
const policy = async (branchId) => (await rest(`branch_cod_policies?branch_id=eq.${branchId}&select=enabled,methods,max_amount,operational_approved_at`))[0];

const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fonts },
});
let browser;
try {
  for (let i = 0; i < 180; i++) {
    if (await fetch(`${app}/login`).then((r) => r.ok, () => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const [branch] = await rest('branches?slug=eq.e2e-cod&select=id');
  assert(branch?.id, 'filial sintética do E2E');
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    const diagnostics = [];
    page.on('console', (msg) => { if (msg.type() === 'error') diagnostics.push(`console: ${msg.text().slice(0, 200)}`); });
    page.on('response', (res) => { if (res.status() >= 400) diagnostics.push(`HTTP ${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`); });
    page.on('requestfailed', (req) => diagnostics.push(`falhou: ${req.url().slice(0, 120)} ${req.failure()?.errorText}`));
    // Em modo dev, clicar antes da hidratação faria submit nativo do formulário.
    await page.goto(`${app}/login`, { waitUntil: 'networkidle', timeout: 240000 });
    await page.locator('#login-email').fill('e2e-admin@example.invalid');
    await page.locator('#login-password').fill('local-e2e-only-221');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    // Em dev, a primeira interação pode chegar antes da hidratação; repete uma vez.
    if (!(await page.waitForURL(/\/app/, { timeout: 20000 }).then(() => true, () => false))) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('#login-email').fill('e2e-admin@example.invalid');
      await page.locator('#login-password').fill('local-e2e-only-221');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    }
    await page.waitForURL(/\/app/, { timeout: 120000 }).catch(async (error) => {
      console.error((await page.locator('body').innerText()).slice(0, 600), diagnostics.slice(-10).join('\n'));
      throw error;
    });
    await page.goto(`${app}/app/configuracoes/filiais/${branch.id}?tab=entrega`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    const card = page.locator('div', { has: page.getByText('Pagamento na entrega', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Salvar pagamento na entrega' }) }).last();
    await card.getByRole('button', { name: 'Salvar pagamento na entrega' }).waitFor({ timeout: 240000 });
    // Listagem de bairros da aba Entrega (antes: 403 em banco recriado por migrations).
    await page.getByText('Centro', { exact: true }).first().waitFor({ timeout: 30000 });
    await card.getByText(/Última aprovação/).waitFor();
    await card.getByPlaceholder('Ex.: 150,00').fill('');
    await card.getByRole('button', { name: 'Salvar pagamento na entrega' }).click();
    await card.getByRole('alert').filter({ hasText: 'valor máximo' }).waitFor();
    await card.getByPlaceholder('Ex.: 150,00').fill(width === 390 ? '180,00' : '220,50');
    await card.getByLabel('Débito na maquininha').check();
    await card.getByRole('button', { name: 'Salvar pagamento na entrega' }).click();
    await card.getByRole('status').filter({ hasText: 'ativo nesta filial' }).waitFor();
    const saved = await policy(branch.id);
    assert.equal(Number(saved.max_amount), width === 390 ? 180 : 220.5, 'valor máximo salvo pelo painel');
    assert.deepEqual(saved.methods, ['CASH', 'DEBIT_CARD', 'PIX'], 'formas salvas pelo painel');
    assert(saved.operational_approved_at, 'aprovação carimbada pelo servidor');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= width, `painel sem overflow em ${width}`);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `qa-admin-cod-${width}.png`), fullPage: false });
    if (width === 1440) {
      await card.getByRole('switch').first().click();
      await card.getByRole('button', { name: 'Salvar pagamento na entrega' }).click();
      await card.getByRole('status').filter({ hasText: 'desligado nesta filial' }).waitFor();
      const off = await policy(branch.id);
      assert(off.enabled === false && off.operational_approved_at === null, 'desligar remove aprovação');
      const config = await fetch(`${api}/functions/v1/get-public-checkout-config`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_slug: 'e2e-cod' }) }).then((r) => r.json());
      assert.equal(config.branch?.cod_enabled, false, 'checkout para de oferecer COD após desligar no painel');
    }
    assert(!diagnostics.some((line) => /HTTP 403/.test(line)), `sem 403 no painel: ${diagnostics.join(' | ')}`);
    if (diagnostics.length) console.log(`Diagnóstico ${width}px:\n${diagnostics.join('\n')}`);
    console.log(`PASS: painel COD em ${width}px (validação, salvar, aprovação carimbada${width === 1440 ? ', desligar' : ''}).`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
