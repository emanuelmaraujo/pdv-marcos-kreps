// Somente instância descartável criada por scripts/test-database.mjs --handoff-qa.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const { chromium } = await import(process.env.PDV_QA_PLAYWRIGHT ? pathToFileURL(path.join(process.env.PDV_QA_PLAYWRIGHT,'index.mjs')).href : 'playwright-core');
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'etapa-1a');
const root=path.resolve(out,'../../../..');
const {API_URL:api, ANON_KEY:anon, SERVICE_ROLE_KEY:service, DB_CONTAINER:container}=process.env;
assert(/^http:\/\/127\.0\.0\.1:55431$/.test(api??''),'Somente API descartável 55431');
assert(/^supabase_db_pdv-db-/.test(container??''),'Somente container descartável');
async function request(url,body,token=service,method='POST'){
 const r=await fetch(api+url,{method,headers:{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();return {ok:r.ok,data,status:r.status};
}
const accounts=[];
for(const [name,role] of [['Maria','ADMIN'],['João','ATTENDANT']]){
 const email=`${role.toLowerCase()}-229@example.invalid`,password='local-fixture-only-229';
 const r=await request('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'cria usuário somente local');
 const id=r.data.id;assert(/^[a-f0-9-]{36}$/.test(id));
 const auth=await request('/auth/v1/token?grant_type=password',{email,password},anon);assert(auth.ok);
 accounts.push({id,name,role,email,password,token:auth.data.access_token});
}
const b='b2290000-0000-4000-8000-000000000011',order='b2290000-0000-4000-8000-000000000041';
function sql(text){const r=spawnSync('docker',['exec',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q','-c',text],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
sql(`BEGIN;
INSERT INTO branches(id,code,slug,name,active) VALUES('${b}','HQ','qa-handoff','Centro · fixture #229',true);
${accounts.map(a=>`INSERT INTO profiles(id,name,role,active,home_branch_id) VALUES('${a.id}','${a.name}','${a.role}',true,'${b}'); INSERT INTO profile_branches(profile_id,branch_id) VALUES('${a.id}','${b}');`).join('\n')}
INSERT INTO categories(id,branch_id,name) VALUES('b2290000-0000-4000-8000-000000000021','${b}','Crepes');
INSERT INTO products(id,branch_id,category_id,name,price,sector) VALUES('b2290000-0000-4000-8000-000000000031','${b}','b2290000-0000-4000-8000-000000000021','Crepe de queijo',30,'KITCHEN');
INSERT INTO orders(id,branch_id,daily_number,status,total_amount,customer_name,confirmed_at) VALUES('${order}','${b}',24,'NA_FILA',150,'Ana · pedido de teste',now());
INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,product_price_snapshot,production_sector,quantity,total_price,status,observation) VALUES
('b2290000-0000-4000-8000-000000000051','${order}','b2290000-0000-4000-8000-000000000031','Crepe A · queijo',30,'KITCHEN',3,90,'PENDING','Sem cebola · cortar ao meio'),
('b2290000-0000-4000-8000-000000000052','${order}','b2290000-0000-4000-8000-000000000031','Suco de maracujá',30,'JUICE_POTATO',1,30,'IN_PREPARATION',null),
('b2290000-0000-4000-8000-000000000053','${order}','b2290000-0000-4000-8000-000000000031','Crepe C · frango',30,'KITCHEN',1,30,'READY',null);
SET LOCAL "request.jwt.claim.sub"='${accounts[0].id}';
SELECT configure_production_handoff('${b}','KITCHEN','MANUAL',true);
SELECT configure_production_handoff('${b}','JUICE_POTATO','PRINTER',true);
INSERT INTO printer_jobs(order_id,branch_id,sector,status,content) VALUES('${order}','${b}','JUICE_POTATO','FAILED','{"text":"Fixture sem impressão física","handoff_items":[{"id":"b2290000-0000-4000-8000-000000000052","revision":1}]}');
COMMIT;`);
async function units(token=accounts[0].token){const r=await request('/rest/v1/rpc/get_production_handoffs',{p_orders:[order]},token);assert(r.ok);return r.data;}
const initial=(await units()).find(u=>u.order_item_id.endsWith('0051')&&u.unit_no===1);
const command=(key,unit)=>({p_command:key,p_order:order,p_targets:[{id:unit.id,version:unit.version,revision:unit.revision}],p_action:'MANUAL',p_reason:null});
const race=await Promise.all(accounts.map(a=>request('/rest/v1/rpc/confirm_production_handoff',command(randomUUID(),initial),a.token)));
assert.equal(race.filter(r=>r.ok).length,1,'duas sessões: exatamente um commit');
assert.equal(race.find(r=>!r.ok).data.code,'40001','sessão perdedora recebe conflito');
const next=(await units()).find(u=>u.order_item_id.endsWith('0051')&&u.unit_no===2),replay=command(randomUUID(),next);
const first=await request('/rest/v1/rpc/confirm_production_handoff',replay,accounts[0].token);
const second=await request('/rest/v1/rpc/confirm_production_handoff',replay,accounts[0].token);assert(first.ok&&second.ok);assert.deepEqual(first.data,second.data);
console.log('PASS: concorrência real via duas sessões HTTP + replay idempotente no banco descartável.');
const fonts=path.join(mkdtempSync(path.join(tmpdir(),'handoff-qa-')),'fonts.cjs');
writeFileSync(fonts,"module.exports = new Proxy({}, { get: () => `@font-face {font-family: 'Inter';src: local('Arial');}` });\n");
const app='http://127.0.0.1:3229';
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3229'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,NEXT_FONT_GOOGLE_MOCKED_RESPONSES:fonts}});
let output='';server.stdout.on('data',d=>{output=(output+d).slice(-6000);});server.stderr.on('data',d=>{output=(output+d).slice(-6000);});
let browser; const diagnostics=[]; let lastPage;
try{
 for(let n=0;n<150;n++){if(await fetch(app+'/login').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({headless:true,executablePath:process.env.PDV_QA_CHROMIUM,args:['--no-sandbox']});
 const contexts=[],pages=[],errors=[];
 for(const account of accounts){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(context);
  await context.addInitScript(()=>{sessionStorage.setItem('pdv_biometric_prompt_dismissed','1');});
  await context.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();});
  const page=await context.newPage();lastPage=page;pages.push(page);page.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text().slice(0,200));});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app+'/login',{waitUntil:'networkidle',timeout:240000});
  await page.locator('#login-email').fill(account.email);await page.locator('#login-password').fill(account.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL(/\/app/,{timeout:120000});
  await page.goto(app+'/app/pedidos',{waitUntil:'domcontentloaded',timeout:240000});
  await page.getByRole('button',{name:/Abrir detalhes do pedido 24/}).filter({visible:true}).waitFor({timeout:120000});
 }
 const visibleCard=page=>page.locator('article:visible').filter({hasText:'Ana · pedido de teste'});
 const [p1,p2]=pages;
 const card=visibleCard(p1);const confirmButton=card.getByRole('button',{name:'Anotado e repassado',exact:true}).first();await confirmButton.focus();await confirmButton.press('Enter');
 await card.getByText(/3\/5 unidades repassadas/).waitFor({timeout:15000});await card.getByText(/Último: Maria/).waitFor();
 await visibleCard(p2).getByText(/3\/5 unidades repassadas/).waitFor({timeout:30000});
 assert.equal((await units()).filter(u=>u.confirmed).length,3,'persistência real após ação no navegador');
 assert.equal(await card.getByText('Sem cebola · cortar ao meio').count(),1,'observação não truncada');
 await card.getByLabel('Motivo para recuperação ou correção').fill('Papel entregue manualmente após falha');
 await card.getByRole('button',{name:'Confirmar recuperação manual',exact:true}).click();
 await card.getByText('Recuperação manual confirmada',{exact:false}).waitFor({timeout:15000});
 await card.getByText('Falha no job mais recente · confira a impressão').waitFor();
 await visibleCard(p2).getByText(/4\/5 unidades repassadas/).waitFor({timeout:30000});
 for(const width of [320,360,390,768,1440]){
  await p1.setViewportSize({width,height:1000});
  for(const dark of [false,true]){
   await p1.evaluate(d=>{document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';},dark);
   const layout = await p1.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,culprits:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,70),right:Math.round(e.getBoundingClientRect().right),width:Math.round(e.getBoundingClientRect().width)})).filter(e=>e.right>innerWidth+1&&e.width>0).slice(0,16)}));
   if(layout.scroll>width){await p1.screenshot({path:path.join(out,`overflow-${width}.png`),fullPage:false});console.log('Layout:',JSON.stringify(layout));}
   assert(layout.scroll<=width,`sem overflow ${width}`);
   await visibleCard(p1).evaluate(e=>e.scrollIntoView({block:'start',inline:'nearest'}));
   const smallTargets=await visibleCard(p1).locator('section[aria-label="Repasse e preparo dos itens"] button').evaluateAll(bs=>bs.filter(b=>{const r=b.getBoundingClientRect();return r.height>0&&r.height<44;}).length);assert.equal(smallTargets,0,'alvos de repasse >=44px');
   await p1.screenshot({path:path.join(out,`quadro-${width}-${dark?'dark':'light'}.png`),fullPage:false});
   if(width===390)await visibleCard(p1).screenshot({path:path.join(out,`card-390-${dark?'dark':'light'}.png`)});
  }
 }
 await p1.setViewportSize({width:390,height:844});
 await contexts[0].setOffline(true);
 await visibleCard(p1).getByText(/Sem conexão. Dados da última atualização/).waitFor({timeout:10000});
 assert(await visibleCard(p1).getByRole('button',{name:'Anotado e repassado',exact:true}).first().isDisabled(),'sem rede o repasse fica bloqueado');
 assert.equal(await visibleCard(p1).count(),1,'mantém o pedido carregado durante falha de rede');
 await p1.screenshot({path:path.join(out,'offline-390.png'),fullPage:false});
 await contexts[0].setOffline(false);
 await visibleCard(p1).getByText(/Sem conexão. Dados da última atualização/).waitFor({state:'hidden',timeout:15000});
 assert.deepEqual(errors,[],'sem exceções JavaScript na aplicação');
 console.log('PASS: /app/pedidos real, dois operadores, atualização sem reload, recuperação com falha preservada, offline, 10 capturas em 320/360/390/768/1440 claro/escuro.');
} catch(e){console.error(output,diagnostics);if(lastPage){console.error('Última URL:',lastPage.url());await lastPage.screenshot({path:path.join(out,'falha-qa.png')}).catch(()=>{});}throw e;} finally{await browser?.close();server.kill('SIGTERM');}
