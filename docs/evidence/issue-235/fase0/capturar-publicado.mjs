// Fase 0 da #235: captura SOMENTE LEITURA do que o site publicado mostra.
// Lista de permissões: GET no site, GET no Supabase e três funções públicas de
// leitura. Todo o resto é abortado (funil, perfil, CEP, cupom, pedido, pagamento).
// Não clica, não preenche e não envia nada. O desafio de segurança da Vercel NÃO é
// contornado: se aparecer, a captura registra o bloqueio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
const site = 'https://www.marcoskreps.com.br';
const routes = (process.env.ROUTES || '/pedir,/pedir/filiais').split(',');
const widths = (process.env.WIDTHS || '390,1440').split(',').map(Number);
const readFunctions = new Set(['list-public-branches', 'get-public-checkout-config', 'get-public-branch-stats']);

const browser = await chromium.launch({ headless: true });
const log = [];
try {
  for (const route of routes) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 900 : 844 }, serviceWorkers: 'block' });
      const blocked = [];
      await context.route('**/*', async (r) => {
        const req = r.request();
        const url = new URL(req.url());
        const fn = url.pathname.split('/').pop();
        const isSupabase = url.hostname.endsWith('.supabase.co');
        const ok = (url.origin === site && req.method() === 'GET')
          || (isSupabase && req.method() === 'GET')
          || (isSupabase && url.pathname.startsWith('/functions/v1/') && readFunctions.has(fn));
        if (ok) return r.continue();
        blocked.push(`${req.method()} ${url.hostname}${url.pathname}`);
        return r.abort();
      });
      const page = await context.newPage();
      await page.goto(site + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const name = route.replace(/^\/pedir\/?/, '') || 'inicio';
      await page.screenshot({ path: path.join(out, `publicado-${name}-${width}.png`) });
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
      log.push({ route, width, finalUrl: page.url(), capturedAt: new Date().toISOString(), text, blocked: [...new Set(blocked)] });
      console.log(`${route} @${width}: ${text.slice(0, 90)}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'publicado-captura.json'), JSON.stringify(log, null, 2));
