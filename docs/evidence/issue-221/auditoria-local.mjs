import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.dirname(fileURLToPath(import.meta.url));
const phase = process.env.AUDIT_PHASE === "after" ? "depois" : "antes";
const branch = { id:'11111111-1111-4111-8111-111111111111',code:'TEST',name:'Unidade de teste (fixture)',slug:'nb',delivery_enabled:true,default_delivery_fee:5 };
const product = {id:'22222222-2222-4222-8222-222222222222',category_id:'33333333-3333-4333-8333-333333333333',name:'Krep de teste',description:'Produto sintético para auditoria local; sem foto.',price:20,sector:'KITCHEN',active:true,branch_id:branch.id,image_url:null};
const tables = { categories:[{id:product.category_id,name:'Kreps salgados',active:true,sort_order:0}],products:[product],ingredients:[],product_ingredients:[],product_addons:[],addons:[],delivery_zones:[] };
(async()=>{
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const log=[];
for(const width of [360,390,430,768,1280,1440]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1' && url.port==='3221') return route.continue();
  if(url.hostname==='127.0.0.1' && ['9','54321'].includes(url.port)){
   let data;
   if(url.pathname.endsWith('get-public-checkout-config')) data={success:true,branch,settings:{public_ordering_start_time:'00:00',public_ordering_end_time:'23:59',packaging_fee:'2',apply_packaging_fee_for_takeout:'true'},online_ordering_enabled:true,ordering_closed_reason:''};
   else if(url.pathname.endsWith('get-public-branch-stats')) data={success:true,orders_today:0,top_product_by_category:{}};
   else if(url.pathname.includes('/rest/v1/')) data=tables[url.pathname.split('/').pop()]??[];
   else data={success:false,error:'Serviço simulado indisponível'};
   return route.fulfill({json:data,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  }
  log.push({width,blocked:url.origin+url.pathname});return route.abort();
 });
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:3221/pedir',{waitUntil:'domcontentloaded',timeout:180000});
 await page.getByRole('heading',{name:'Krep de teste',exact:true}).waitFor({timeout:120000});
 await page.screenshot({path:path.join(out,`${phase}-menu-${width}.png`),fullPage:true});
 await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Krep de teste',exact:true})}).click();
 await page.screenshot({path:path.join(out,`${phase}-produto-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:/Adicionar.*R\$/}).click();
 const cart=page.getByRole('button',{name:/Ver (pedido|carrinho)|Revisar|Fechar pedido/}).first();
 if(await cart.count()) await cart.click(); else await page.getByRole('button',{name:/Seu pedido/}).first().click();
 await page.getByRole('heading',{name:'Confira seu pedido'}).waitFor();
 await page.screenshot({path:path.join(out,`${phase}-revisao-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:/Continuar|Meus dados|Ir para.*dados/}).first().click();
 await page.getByRole('heading',{name:'Seus dados',exact:true}).waitFor();
 await page.getByRole('button',{name:'Para levar',exact:true}).click();
 await page.screenshot({path:path.join(out,`${phase}-dados-viagem-${width}.png`),fullPage:true});
 if (phase === "depois") {
  await page.getByRole('region', {name:'Resumo de custos do pedido'}).evaluate(el => el.scrollIntoView({block:'center', behavior:'instant'}));
  await page.screenshot({path:path.join(out,`depois-resumo-final-${width}.png`)});
 }
 log.push({width,bodyWidth:await page.evaluate(()=>document.documentElement.scrollWidth),summary:await page.locator('main').innerText()});
 console.log(`Viewport ${width}: menu, produto, revisão e dados capturados.`);
 await context.close();
}
await browser.close();fs.writeFileSync(path.join(out,`${phase}-auditoria-local.json`),JSON.stringify(log,null,2));
if (phase === "depois") {
 const cases = log.filter(entry => entry.bodyWidth);
 assert(cases.every(entry => entry.bodyWidth <= entry.width), "Checkout ultrapassa largura do viewport");
 assert(cases.every(entry => entry.summary.includes("Embalagem para viagem")), "Último resumo não discrimina embalagem");
 console.log("PASS: seis viewports sem overflow e com embalagem discriminada antes de enviar.");
}
})().catch(e=>{console.error(e);process.exit(1)});
