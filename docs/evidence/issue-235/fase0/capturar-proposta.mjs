// Captura as telas do protótipo estático (proposta.html). Só abre o arquivo local.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT_DIR || dir;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
await page.goto(pathToFileURL(path.join(dir, 'proposta.html')).href);
const shots = { 'm-menu': 'vitrine-390', 'm-produto': 'produto-390', 'm-sacola': 'sacola-390', 'm-dados': 'dados-entrega-390', 'm-pagamento': 'pagamento-390', 'm-confirmacao': 'confirmacao-390', 'd-menu': 'vitrine-1440', 'd-checkout': 'dados-1440' };
for (const [id, name] of Object.entries(shots)) {
  await page.locator(`#${id} .phone, #${id} .desk`).screenshot({ path: path.join(out, `proposta-${name}.png`) });
}
await browser.close();
console.log(`${Object.keys(shots).length} telas do protótipo capturadas.`);
