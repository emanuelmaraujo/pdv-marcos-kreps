// Fallback direcionado: usa somente imagem já disponível, sem rede ou host ports.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const image = 'postgres:16-alpine';
const name = `pdv221-${randomUUID().slice(0,8)}`;
const gitdir = execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'}).trim();
const validationDir=path.join(gitdir,'local-validation');mkdirSync(validationDir,{recursive:true});
const tmp=mkdtempSync(path.join(validationDir,'cod-contract-'));
const execAsync=promisify(execFile);
let started=false;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:16*1024*1024});
const sql=(query)=>docker('exec',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atqc',query);
function sqlFile(label,contents){const file=path.join(tmp,`${label}.sql`);writeFileSync(file,contents);docker('cp',file,`${name}:/tmp/${label}.sql`);return docker('exec',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qf',`/tmp/${label}.sql`);}
try {
 docker('image','inspect',image,'--format','{{.Id}}');
 docker('run','--detach','--pull','never','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust',image);started=true;
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){try{docker('exec',name,'pg_isready','-U','postgres');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,200));}}
 assert(ready,'Postgres descartável não ficou pronto.');
 const migrations=readdirSync(path.join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')&&!x.includes('print_jobs_retention')).sort();
 const bootstrap=readFileSync(path.join(root,'supabase/fixtures/postgres-contract-bootstrap.sql'),'utf8');
 sqlFile('schema',bootstrap+'\n'+migrations.map(x=>readFileSync(path.join(root,'supabase/migrations',x),'utf8')).join('\n'));
 console.log(`PASS: ${migrations.length} migrations em PostgreSQL sem rede (cron de retenção excluído).`);
 const fixture=readFileSync(path.join(root,'supabase/tests/isolated/public-delivery-contract.psql'),'utf8');
 sqlFile('rules','BEGIN;\n'+fixture+'\nROLLBACK;');
 console.log('PASS: contrato SQL, replay, troco, limites, filial, confirmação, parcial, baixa e expiração.');
 sqlFile('concurrency-setup','BEGIN;\n'+fixture.split('\nDO $$')[0]+'\nCOMMIT;');
 const concurrent=(query)=>execAsync('docker',['exec',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atqc',query],{timeout:10000});
 const create="BEGIN; SELECT (public.create_public_order_transactional(public.test_221_payload('race-create'))->>'order_id') IS NOT NULL; SELECT pg_sleep(0.25); COMMIT;";
 await Promise.all([concurrent(create),concurrent(create)]);
 assert.equal(sql("SELECT count(*) FROM public.orders WHERE public_idempotency_key='race-create'").trim(),'1');
 sql("INSERT INTO public.branch_cod_policies(branch_id,enabled,methods,max_amount,operational_approved_at) VALUES('f2210000-0000-4000-8000-000000000011',true,ARRAY['CASH','PIX'],100,now()); SELECT (public.create_public_order_transactional(public.test_221_payload('race-cod','ON_DELIVERY'))->>'order_id') IS NOT NULL;");
 const id="(SELECT id FROM public.orders WHERE public_idempotency_key='race-cod')";
 const confirm=`BEGIN; SELECT public.review_delivery_order_transactional(${id},'f2210000-0000-4000-8000-000000000001','CONFIRM',true,NULL,'[{"sector":"KITCHEN","content":{"text":"fixture"}}]')->>'success'; SELECT pg_sleep(0.25); COMMIT;`;
 await Promise.all([concurrent(confirm),concurrent(confirm)]);
 assert.equal(sql(`SELECT count(*) FROM public.printer_jobs WHERE order_id=${id}`).trim(),'1');
 const pay=`SELECT public.pay_order_items_transactional(${id},'f2210000-0000-4000-8000-000000000001','CASH','PAID',45)->>'success'`;
 const receipts=await Promise.allSettled([concurrent(pay),concurrent(pay)]);
 assert.equal(receipts.filter(x=>x.status==='fulfilled').length,1,'apenas uma baixa concorrente deve ter sucesso');
 assert.equal(sql(`SELECT count(*)||':'||sum(amount)::integer FROM public.payments WHERE order_id=${id}`).trim(),'1:45');
 console.log('PASS: concorrência em duas conexões — um pedido, um job, um recebimento.');
} catch(error){
 const detail=String(error.stderr??error.message).split('\n').find(x=>x.includes('ERROR:')||x.includes('FAIL'))??error.message;
 console.error(`FAIL: ${detail}`);console.error(`SQL de reprodução local: ${tmp}`);process.exitCode=1;
} finally {if(started)docker('rm','--force','--volumes',name);}
