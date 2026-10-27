BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email) VALUES
 ('a2290000-0000-4000-8000-000000000001','handoff-admin@example.invalid'),
 ('a2290000-0000-4000-8000-000000000002','handoff-staff@example.invalid'),
 ('a2290000-0000-4000-8000-000000000003','handoff-other@example.invalid');
INSERT INTO public.branches(id,code,slug,name,active) VALUES
 ('a2290000-0000-4000-8000-000000000011','HFA','fixture-handoff-a','Handoff A',true),
 ('a2290000-0000-4000-8000-000000000012','HFB','fixture-handoff-b','Handoff B',true);
INSERT INTO public.profiles(id,name,role,active,home_branch_id) VALUES
 ('a2290000-0000-4000-8000-000000000001','Admin fixture','ADMIN',true,'a2290000-0000-4000-8000-000000000011'),
 ('a2290000-0000-4000-8000-000000000002','Maria fixture','ATTENDANT',true,'a2290000-0000-4000-8000-000000000011'),
 ('a2290000-0000-4000-8000-000000000003','Outra filial','ADMIN',true,'a2290000-0000-4000-8000-000000000012');
INSERT INTO public.profile_branches(profile_id,branch_id) SELECT id,home_branch_id FROM public.profiles WHERE id::text LIKE 'a229%';
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO public.categories(id,branch_id,name) VALUES('a2290000-0000-4000-8000-000000000021','a2290000-0000-4000-8000-000000000011','Fixture');
INSERT INTO public.products(id,branch_id,category_id,name,price,sector) VALUES('a2290000-0000-4000-8000-000000000031','a2290000-0000-4000-8000-000000000011','a2290000-0000-4000-8000-000000000021','Crepe fixture',30,'KITCHEN');
INSERT INTO public.orders(id,branch_id,daily_number,status,total_amount) VALUES('a2290000-0000-4000-8000-000000000041','a2290000-0000-4000-8000-000000000011',229,'NA_FILA',90);
INSERT INTO public.order_items(id,order_id,product_id,product_name_snapshot,product_price_snapshot,production_sector,quantity,total_price)
 VALUES('a2290000-0000-4000-8000-000000000051','a2290000-0000-4000-8000-000000000041','a2290000-0000-4000-8000-000000000031','Crepe fixture',30,'KITCHEN',3,90);
CREATE FUNCTION pg_temp.targets_229(p_unit integer DEFAULT 1) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_agg(jsonb_build_object('id',id,'version',version,'revision',revision)) FROM public.production_handoff_units
 WHERE order_item_id='a2290000-0000-4000-8000-000000000051' AND state<>'SUPERSEDED' AND unit_no=p_unit
$$;
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='a2290000-0000-4000-8000-000000000041'),3,'quantity 3 cria três unidades');
SELECT ok(NOT has_function_privilege('anon','public.confirm_production_handoff(uuid,uuid,jsonb,text,text)','EXECUTE'),'anon não confirma');
SELECT ok(NOT has_table_privilege('authenticated','public.production_handoff_units','UPDATE'),'cliente não escreve projeção');
SELECT ok(NOT has_table_privilege('service_role','public.production_handoff_events','DELETE'),'serviço não apaga auditoria');
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','MANUAL',true)$$,'42501',NULL,'atendente não configura');
SELECT throws_ok($$SELECT public.confirm_production_handoff('a2290000-0000-4000-8000-000000000061','a2290000-0000-4000-8000-000000000041',pg_temp.targets_229())$$,NULL,NULL,'sem configuração não confirma');
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000003';
SELECT throws_ok($$SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','MANUAL',true)$$,'42501',NULL,'admin de outra filial não configura');
SELECT is(jsonb_array_length(public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])),0,'outra filial não lê unidades');
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','MANUAL',true)$$,'admin configura');
SELECT throws_ok($$SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','PRINTER',true,99)$$,'40001',NULL,'versão de configuração conflita');
CREATE TEMP TABLE initial_target AS SELECT pg_temp.targets_229() AS payload;
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000002';
SELECT is((public.confirm_production_handoff('a2290000-0000-4000-8000-000000000061','a2290000-0000-4000-8000-000000000041',(SELECT payload FROM initial_target))->>'changed')::int,1,'confirma somente uma unidade');
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE state='CONFIRMED' AND order_id='a2290000-0000-4000-8000-000000000041'),1,'1/3 repassados');
SELECT is((SELECT status::text FROM public.order_items WHERE id='a2290000-0000-4000-8000-000000000051'),'PENDING','repasse não muda preparo');
SELECT is((SELECT total_amount FROM public.orders WHERE id='a2290000-0000-4000-8000-000000000041'),90::numeric,'repasse não altera caixa/total');
SELECT is((public.confirm_production_handoff('a2290000-0000-4000-8000-000000000061','a2290000-0000-4000-8000-000000000041',(SELECT payload FROM initial_target))->>'changed')::int,1,'replay devolve resultado original');
SELECT is((SELECT count(*)::int FROM public.production_handoff_events WHERE order_id='a2290000-0000-4000-8000-000000000041'),1,'replay não duplica evento');
SELECT throws_ok($$SELECT public.confirm_production_handoff('a2290000-0000-4000-8000-000000000062','a2290000-0000-4000-8000-000000000041',(SELECT payload FROM initial_target))$$,'40001',NULL,'segunda sessão com versão antiga conflita');
SELECT throws_ok($$SELECT public.confirm_production_handoff('a2290000-0000-4000-8000-000000000061','a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(2))$$,NULL,NULL,'chave reutilizada com outra unidade falha');
SELECT throws_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(),'REVOKE','corrigir')$$,'42501',NULL,'atendente não revoga');
-- RLS testada com papel real, não somente postgres.
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='a2290000-0000-4000-8000-000000000041'),3,'atendente da filial lê com RLS');
RESET ROLE;
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='a2290000-0000-4000-8000-000000000041'),0,'RLS nega outra filial');
RESET ROLE;
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(),'REVOKE','Comanda não foi entregue')$$,'admin corrige com auditoria');
SELECT is((SELECT count(*)::int FROM public.production_handoff_events WHERE origin='REVOKE' AND order_id='a2290000-0000-4000-8000-000000000041'),1,'reversão preserva histórico');
SELECT lives_ok($$SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','PRINTER',true,1)$$,'altera modo explicitamente');
INSERT INTO public.printer_jobs(id,order_id,branch_id,sector,content) VALUES('a2290000-0000-4000-8000-000000000071','a2290000-0000-4000-8000-000000000041','a2290000-0000-4000-8000-000000000011','KITCHEN',jsonb_build_object('text','fixture','handoff_items',jsonb_build_array(jsonb_build_object('id','a2290000-0000-4000-8000-000000000051','revision',1))));
SELECT is((SELECT count(*)::int FROM public.production_print_coverage WHERE printer_job_id='a2290000-0000-4000-8000-000000000071'),3,'job cobre unidades exatas');
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])) u WHERE (u->>'confirmed')::boolean),0,'PENDING não parece impresso');
UPDATE public.printer_jobs SET status='PROCESSING' WHERE id='a2290000-0000-4000-8000-000000000071';
SELECT is((SELECT count(*)::int FROM public.production_handoff_events WHERE origin='PRINT' AND order_id='a2290000-0000-4000-8000-000000000041'),0,'PROCESSING não confirma');
SELECT throws_ok($$UPDATE public.printer_jobs SET content='{"text":"outro texto"}' WHERE id='a2290000-0000-4000-8000-000000000071'$$,NULL,NULL,'cobertura não pode ser usada para outro texto');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.printer_jobs SET status='PRINTED' WHERE id='a2290000-0000-4000-8000-000000000071'$$,'42501',NULL,'navegador não pode forjar confirmação do worker');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.production_handoff_events WHERE origin='PRINT' AND order_id='a2290000-0000-4000-8000-000000000041'),0,'status escrito pelo navegador não comprova impressão de worker');
UPDATE public.printer_jobs SET status='PROCESSING' WHERE id='a2290000-0000-4000-8000-000000000071';
UPDATE public.printer_jobs SET status='PRINTED',printed_at=now() WHERE id='a2290000-0000-4000-8000-000000000071';
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])) u WHERE (u->>'confirmed')::boolean),3,'PRINTED confirma cobertura real');
SELECT is((SELECT count(*)::int FROM public.production_handoff_events WHERE origin='PRINT' AND order_id='a2290000-0000-4000-8000-000000000041'),3,'impressão tem evento por unidade');
UPDATE public.order_items SET observation='Sem queijo' WHERE id='a2290000-0000-4000-8000-000000000051';
SELECT is((SELECT handoff_revision::int FROM public.order_items WHERE id='a2290000-0000-4000-8000-000000000051'),2,'edição aumenta revisão');
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])) u WHERE (u->>'confirmed')::boolean),0,'job antigo não confirma conteúdo novo');
INSERT INTO public.printer_jobs(order_id,branch_id,sector,content) VALUES('a2290000-0000-4000-8000-000000000041','a2290000-0000-4000-8000-000000000011','KITCHEN',jsonb_build_object('text','snapshot antigo','handoff_items',jsonb_build_array(jsonb_build_object('id','a2290000-0000-4000-8000-000000000051','revision',1))));
SELECT is((SELECT count(*)::int FROM public.production_print_coverage),3,'snapshot obsoleto não cria cobertura nova');
SELECT throws_ok($$UPDATE public.production_handoff_events SET reason='apagar erro' WHERE order_id='a2290000-0000-4000-8000-000000000041'$$,NULL,NULL,'auditoria imutável');
-- Recuperação é vinculada ao job; correção não apaga falha nem impede reconfirmação.
INSERT INTO public.printer_jobs(id,order_id,branch_id,sector,status,content) VALUES('a2290000-0000-4000-8000-000000000072','a2290000-0000-4000-8000-000000000041','a2290000-0000-4000-8000-000000000011','KITCHEN','FAILED',jsonb_build_object('text','rev2','handoff_items',jsonb_build_array(jsonb_build_object('id','a2290000-0000-4000-8000-000000000051','revision',2))));
SELECT lives_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(),'MANUAL_RECOVERY','Anotação após falha')$$,'recupera manualmente');
SELECT is((SELECT printer_job_id::text FROM public.production_handoff_events WHERE origin='MANUAL_RECOVERY' AND order_id='a2290000-0000-4000-8000-000000000041'),'a2290000-0000-4000-8000-000000000072','recuperação referencia job correspondente');
SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','PRINTER',false,2);
SELECT lives_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(),'REVOKE','Correção com fluxo desativado')$$,'admin corrige mesmo com modo desativado');
SELECT public.configure_production_handoff('a2290000-0000-4000-8000-000000000011','KITCHEN','PRINTER',true,3);
SELECT lives_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(),'MANUAL_RECOVERY','Repasse agora realizado')$$,'reconfirmação após correção conserva auditoria');
-- Revogação de acesso vale também para replay de um comando já concluído.
UPDATE public.profiles SET active=false WHERE id='a2290000-0000-4000-8000-000000000002';
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.confirm_production_handoff('a2290000-0000-4000-8000-000000000061','a2290000-0000-4000-8000-000000000041',(SELECT payload FROM initial_target))$$,'42501',NULL,'inativo não obtém replay');
UPDATE public.profiles SET active=true,role='COURIER' WHERE id='a2290000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])$$,'42501',NULL,'motoboy não confirma nem consulta repasse da equipe');
UPDATE public.profiles SET role='ATTENDANT' WHERE id='a2290000-0000-4000-8000-000000000002';
SET LOCAL "request.jwt.claim.sub"='a2290000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(2)||jsonb_build_array(jsonb_build_object('id','ffffffff-ffff-ffff-ffff-ffffffffffff','version',1,'revision',2)),'MANUAL_RECOVERY','Teste de atomicidade')$$,NULL,NULL,'seleção inválida reverte todas as unidades');
SELECT is((SELECT state FROM public.production_handoff_units WHERE order_item_id='a2290000-0000-4000-8000-000000000051' AND revision=2 AND unit_no=2),'PENDING','sem êxito parcial na seleção');
CREATE FUNCTION pg_temp.fail_handoff_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture: falha de auditoria'; END $$;
CREATE TRIGGER test_fail_handoff_event AFTER INSERT ON public.production_handoff_events FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_handoff_event();
SELECT throws_ok($$SELECT public.confirm_production_handoff(gen_random_uuid(),'a2290000-0000-4000-8000-000000000041',pg_temp.targets_229(2),'MANUAL_RECOVERY','Teste de rollback')$$,NULL,NULL,'falha de auditoria cancela comando');
SELECT is((SELECT state FROM public.production_handoff_units WHERE order_item_id='a2290000-0000-4000-8000-000000000051' AND revision=2 AND unit_no=2),'PENDING','projeção preservada após falha de auditoria');
DROP TRIGGER test_fail_handoff_event ON public.production_handoff_events;
INSERT INTO public.order_item_removed_ingredients(order_item_id,ingredient_name_snapshot) VALUES('a2290000-0000-4000-8000-000000000051','Cebola');
SELECT is((SELECT handoff_revision::int FROM public.order_items WHERE id='a2290000-0000-4000-8000-000000000051'),3,'ingrediente removido invalida repasse anterior');
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.get_production_handoffs(ARRAY['a2290000-0000-4000-8000-000000000041'::uuid])) u WHERE (u->>'confirmed')::boolean),0,'revisão de removidos não herda confirmação');
UPDATE public.order_item_removed_ingredients SET ingredient_name_snapshot=ingredient_name_snapshot WHERE order_item_id='a2290000-0000-4000-8000-000000000051';
SELECT is((SELECT handoff_revision::int FROM public.order_items WHERE id='a2290000-0000-4000-8000-000000000051'),3,'update sem mudança não reinicia repasse');
DELETE FROM public.order_item_removed_ingredients WHERE order_item_id='a2290000-0000-4000-8000-000000000051';
SELECT is((SELECT handoff_revision::int FROM public.order_items WHERE id='a2290000-0000-4000-8000-000000000051'),4,'remoção de modificador também muda revisão');
SELECT * FROM finish();
ROLLBACK;
