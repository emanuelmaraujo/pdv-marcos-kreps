-- #221: política de pagamento na entrega pelo painel. ROLLBACK descarta os fixtures.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

INSERT INTO auth.users (id, email) VALUES
 ('c2210000-0000-4000-8000-000000000001','cod-admin@example.invalid'),
 ('c2210000-0000-4000-8000-000000000002','cod-attendant@example.invalid'),
 ('c2210000-0000-4000-8000-000000000003','cod-other-admin@example.invalid');
INSERT INTO public.branches (id, code, slug, name, active, delivery_enabled) VALUES
 ('c2210000-0000-4000-8000-000000000011','PCA','test-cod-policy-a','COD policy A',true,true),
 ('c2210000-0000-4000-8000-000000000012','PCB','test-cod-policy-b','COD policy B',true,false);
INSERT INTO public.profiles (id, name, role, active, is_global_admin, home_branch_id) VALUES
 ('c2210000-0000-4000-8000-000000000001','Admin A','ADMIN',true,false,'c2210000-0000-4000-8000-000000000011'),
 ('c2210000-0000-4000-8000-000000000002','Atendente A','ATTENDANT',true,false,'c2210000-0000-4000-8000-000000000011'),
 ('c2210000-0000-4000-8000-000000000003','Admin B','ADMIN',true,false,'c2210000-0000-4000-8000-000000000012');
INSERT INTO public.profile_branches (profile_id, branch_id) VALUES
 ('c2210000-0000-4000-8000-000000000001','c2210000-0000-4000-8000-000000000011'),
 ('c2210000-0000-4000-8000-000000000001','c2210000-0000-4000-8000-000000000012'),
 ('c2210000-0000-4000-8000-000000000002','c2210000-0000-4000-8000-000000000011'),
 ('c2210000-0000-4000-8000-000000000003','c2210000-0000-4000-8000-000000000012');
SET CONSTRAINTS ALL IMMEDIATE;

SELECT ok(NOT has_function_privilege('anon','public.set_branch_cod_policy(uuid,boolean,text[],numeric,integer,integer)','EXECUTE'), 'anon não configura COD');
SELECT ok(NOT has_table_privilege('authenticated','public.branch_cod_policies','SELECT'), 'tabela continua privada para a equipe');

SET LOCAL "request.jwt.claim.sub" = 'c2210000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['CASH'],100,10,30)$$,
 '42501', NULL, 'atendente não habilita COD');
SELECT throws_ok($$SELECT public.get_branch_cod_policy('c2210000-0000-4000-8000-000000000011')$$,
 '42501', NULL, 'atendente não lê limites antifraude');

SET LOCAL "request.jwt.claim.sub" = 'c2210000-0000-4000-8000-000000000003';
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['CASH'],100,10,30)$$,
 '42501', NULL, 'admin de outra filial não configura');

SET LOCAL "request.jwt.claim.sub" = 'c2210000-0000-4000-8000-000000000001';
SELECT is((public.get_branch_cod_policy('c2210000-0000-4000-8000-000000000011')->>'enabled')::boolean, false, 'sem registro, COD desligado');
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000012',true,ARRAY['CASH'],100,10,30)$$,
 '22023', NULL, 'não ativa sem entrega ligada na filial');
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY[]::text[],100,10,30)$$,
 '22023', NULL, 'não ativa sem forma de pagamento');
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['CASH'],NULL,10,30)$$,
 '22023', NULL, 'não ativa sem valor máximo');
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['BOLETO'],100,10,30)$$,
 '22023', NULL, 'rejeita forma desconhecida');
SELECT throws_ok($$SELECT public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['CASH'],100,10,300)$$,
 '22023', NULL, 'rejeita prazo fora de 5–120 min');

SELECT is((public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',true,ARRAY['PIX','CASH','CASH'],150,10,20)->'methods'),
 '["CASH","PIX"]'::jsonb, 'ativa com formas normalizadas');
SELECT ok((SELECT operational_approved_at IS NOT NULL AND operational_approved_by='c2210000-0000-4000-8000-000000000001'
  FROM public.branch_cod_policies WHERE branch_id='c2210000-0000-4000-8000-000000000011'), 'servidor carimba aprovação e responsável');
SELECT is((SELECT count(*)::integer FROM public.audit_logs WHERE action='COD_POLICY_UPDATED'
  AND record_id='c2210000-0000-4000-8000-000000000011' AND user_id='c2210000-0000-4000-8000-000000000001'), 1, 'alteração auditada');

SELECT is((public.set_branch_cod_policy('c2210000-0000-4000-8000-000000000011',false,ARRAY['CASH'],150,10,20)->>'enabled')::boolean,
 false, 'desliga sem exigir limites');
SELECT ok((SELECT operational_approved_at IS NULL FROM public.branch_cod_policies
  WHERE branch_id='c2210000-0000-4000-8000-000000000011'), 'desligar remove a aprovação operacional');

SELECT * FROM finish();
ROLLBACK;
