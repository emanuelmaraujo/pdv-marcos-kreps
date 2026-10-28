BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- Fixtures de Usuários e Filiais
INSERT INTO auth.users(id, email) VALUES
 ('b2290000-0000-4000-8000-000000000001', 'attendant-branch-a@example.invalid'),
 ('b2290000-0000-4000-8000-000000000002', 'attendant-branch-b@example.invalid');

INSERT INTO public.branches(id, code, slug, name, active) VALUES
 ('b2290000-0000-4000-8000-000000000011', 'LCA', 'lifecycle-a', 'Lifecycle A', true),
 ('b2290000-0000-4000-8000-000000000012', 'LCB', 'lifecycle-b', 'Lifecycle B', true);

INSERT INTO public.profiles(id, name, role, active, home_branch_id) VALUES
 ('b2290000-0000-4000-8000-000000000001', 'Atendente A', 'ATTENDANT', true, 'b2290000-0000-4000-8000-000000000011'),
 ('b2290000-0000-4000-8000-000000000002', 'Atendente B', 'ATTENDANT', true, 'b2290000-0000-4000-8000-000000000012');

INSERT INTO public.profile_branches(profile_id, branch_id)
 SELECT id, home_branch_id FROM public.profiles WHERE id::text LIKE 'b229%';

SET CONSTRAINTS ALL IMMEDIATE;

-- Produtos e Pedido Balcão (3 crepes)
INSERT INTO public.categories(id, branch_id, name)
 VALUES ('b2290000-0000-4000-8000-000000000021', 'b2290000-0000-4000-8000-000000000011', 'Crepes');

INSERT INTO public.products(id, branch_id, category_id, name, price, sector)
 VALUES ('b2290000-0000-4000-8000-000000000031', 'b2290000-0000-4000-8000-000000000011', 'b2290000-0000-4000-8000-000000000021', 'Crepe Salgado', 25, 'KITCHEN');

INSERT INTO public.orders(id, branch_id, daily_number, status, total_amount, type)
 VALUES ('b2290000-0000-4000-8000-000000000041', 'b2290000-0000-4000-8000-000000000011', 101, 'NA_FILA', 75, 'BALCAO');

INSERT INTO public.order_items(id, order_id, product_id, product_name_snapshot, product_price_snapshot, production_sector, quantity, total_price)
 VALUES ('b2290000-0000-4000-8000-000000000051', 'b2290000-0000-4000-8000-000000000041', 'b2290000-0000-4000-8000-000000000031', 'Crepe Salgado', 25, 'KITCHEN', 3, 75);

-- 1. Verifica criação inicial das 3 unidades
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id = 'b2290000-0000-4000-8000-000000000041'), 3, 'Cria 3 unidades para quantity=3');
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id = 'b2290000-0000-4000-8000-000000000041' AND prep_status = 'PENDING'), 3, 'Todas as 3 unidades iniciam em PENDING');
SELECT is((SELECT status::text FROM public.orders WHERE id = 'b2290000-0000-4000-8000-000000000041'), 'NA_FILA', 'Pedido inicia em NA_FILA');

-- 2. Permissões e RLS
SELECT ok(NOT has_function_privilege('anon', 'public.batch_update_production_status(uuid, uuid[], uuid[], text, text)', 'EXECUTE'), 'Anon não executa batch_update_production_status');

SET LOCAL "request.jwt.claim.sub" = 'b2290000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'READY')$$,
  '42501', NULL, 'Atendente de outra filial não atualiza produção'
);

-- 3. Transição: Unidade 1 em preparo
SET LOCAL "request.jwt.claim.sub" = 'b2290000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'IN_PREPARATION')$$,
  'Atendente A marca unidade 1 como IN_PREPARATION'
);

SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), 'IN_PREPARATION', 'Unidade 1 está IN_PREPARATION');
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE unit_no=2 AND order_id='b2290000-0000-4000-8000-000000000041'), 'PENDING', 'Unidade 2 permanece PENDING');
SELECT is((SELECT status::text FROM public.order_items WHERE id='b2290000-0000-4000-8000-000000000051'), 'IN_PREPARATION', 'Linha do item reflete IN_PREPARATION');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000041'), 'NA_FILA', 'Pedido permanece NA_FILA');

-- 4. Transição: Unidade 1 fica PRONTA (1 de 3)
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'READY')$$,
  'Atendente A marca unidade 1 como READY'
);

SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), 'READY', 'Unidade 1 está READY');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000041'), 'PRONTO_PARCIAL', 'Pedido vai para PRONTO_PARCIAL com 1 de 3 unidades prontas');

-- 5. Transição em Lote: Unidades 2 e 3 ficam PRONTAS (3 de 3)
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no IN (2, 3) AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'READY')$$,
  'Atendente A marca unidades 2 e 3 como READY em lote'
);

SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000041' AND prep_status='READY'), 3, 'Todas as 3 unidades estão READY');
SELECT is((SELECT status::text FROM public.order_items WHERE id='b2290000-0000-4000-8000-000000000051'), 'READY', 'Linha inteira agora está READY');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000041'), 'PRONTO', 'Pedido se torna PRONTO');

-- 6. Entrega Parcial: Unidade 1 entregue
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'DELIVERED')$$,
  'Entrega parcial da unidade 1'
);

SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE unit_no=1 AND order_id='b2290000-0000-4000-8000-000000000041'), 'DELIVERED', 'Unidade 1 entregue');
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE unit_no=2 AND order_id='b2290000-0000-4000-8000-000000000041'), 'READY', 'Unidade 2 continua READY');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000041'), 'PRONTO_PARCIAL', 'Pedido volta a ser PRONTO_PARCIAL enquanto restam unidades prontas');

-- 7. Entrega Final: Unidades 2 e 3 entregues
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000041', ARRAY(SELECT id FROM public.production_handoff_units WHERE unit_no IN (2, 3) AND order_id='b2290000-0000-4000-8000-000000000041'), NULL, 'DELIVERED')$$,
  'Entrega final das unidades restantes'
);

SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000041' AND prep_status='DELIVERED'), 3, 'Todas as 3 unidades entregues');
SELECT is((SELECT status::text FROM public.order_items WHERE id='b2290000-0000-4000-8000-000000000051'), 'DELIVERED', 'Linha inteira agora está DELIVERED');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000041'), 'ENTREGUE', 'Pedido se torna ENTREGUE');

-- 8. Validações e Regras de Segurança
-- 8.1 Delivery não aceita DELIVERED no balcão
INSERT INTO public.orders(id, branch_id, daily_number, status, total_amount, type)
 VALUES ('b2290000-0000-4000-8000-000000000042', 'b2290000-0000-4000-8000-000000000011', 102, 'NA_FILA', 25, 'ENTREGA');
INSERT INTO public.order_items(id, order_id, product_id, product_name_snapshot, product_price_snapshot, production_sector, quantity, total_price)
 VALUES ('b2290000-0000-4000-8000-000000000052', 'b2290000-0000-4000-8000-000000000042', 'b2290000-0000-4000-8000-000000000031', 'Crepe Salgado', 25, 'KITCHEN', 1, 25);

SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000042', ARRAY(SELECT id FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000042'), NULL, 'DELIVERED')$$,
  NULL, NULL, 'Itens de delivery não podem ser entregues no balcão'
);

-- 8.2 Pedido em pré-fila não aceita alterações
INSERT INTO public.orders(id, branch_id, daily_number, status, total_amount, type)
 VALUES ('b2290000-0000-4000-8000-000000000043', 'b2290000-0000-4000-8000-000000000011', 103, 'AGUARDANDO_PAGAMENTO', 25, 'BALCAO');
INSERT INTO public.order_items(id, order_id, product_id, product_name_snapshot, product_price_snapshot, production_sector, quantity, total_price)
 VALUES ('b2290000-0000-4000-8000-000000000053', 'b2290000-0000-4000-8000-000000000043', 'b2290000-0000-4000-8000-000000000031', 'Crepe Salgado', 25, 'KITCHEN', 1, 25);

SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000043', ARRAY(SELECT id FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000043'), NULL, 'READY')$$,
  NULL, NULL, 'Pedido em AGUARDANDO_PAGAMENTO não permite produção'
);

-- 8.3 Auditoria gerada para as mutações
SELECT ok(
  EXISTS(SELECT 1 FROM public.audit_logs WHERE action = 'UNIT_READY' AND branch_id = 'b2290000-0000-4000-8000-000000000011'),
  'Auditoria gravada para UNIT_READY'
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.audit_logs WHERE action = 'UNIT_DELIVERED' AND branch_id = 'b2290000-0000-4000-8000-000000000011'),
  'Auditoria gravada para UNIT_DELIVERED'
);

SELECT * FROM finish();
ROLLBACK;
