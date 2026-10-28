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

-- 9. Máquina de estados, IDs e idempotência (revisão 1B)
INSERT INTO public.orders(id, branch_id, daily_number, status, total_amount, type)
 VALUES ('b2290000-0000-4000-8000-000000000044', 'b2290000-0000-4000-8000-000000000011', 104, 'NA_FILA', 75, 'BALCAO');
INSERT INTO public.order_items(id, order_id, product_id, product_name_snapshot, product_price_snapshot, production_sector, quantity, total_price)
 VALUES ('b2290000-0000-4000-8000-000000000054', 'b2290000-0000-4000-8000-000000000044', 'b2290000-0000-4000-8000-000000000031', 'Crepe Salgado', 25, 'KITCHEN', 3, 75);

CREATE TEMP TABLE u44 AS SELECT unit_no, id FROM public.production_handoff_units
 WHERE order_id = 'b2290000-0000-4000-8000-000000000044' AND state <> 'SUPERSEDED';

SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY[]::uuid[], ARRAY[]::uuid[], 'READY')$$,
  '22023', NULL, 'Operação vazia é rejeitada'
);
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'CANCELLED', 'teste')$$,
  '22023', NULL, 'Cancelamento por unidade não existe na RPC (contrato financeiro)'
);
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'PENDING')$$,
  '22023', NULL, 'Retorno para PENDING é rejeitado'
);
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'DELIVERED')$$,
  '22023', NULL, 'PENDING não salta para DELIVERED'
);
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY[(SELECT id FROM u44 WHERE unit_no=1), (SELECT id FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000041' LIMIT 1)], NULL, 'READY')$$,
  '22023', NULL, 'Unidade de outro pedido rejeita o lote inteiro'
);
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY['b2290000-0000-4000-8000-0000000000ff'::uuid], NULL, 'READY')$$,
  '22023', NULL, 'Unidade inexistente é rejeitada'
);
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE order_id='b2290000-0000-4000-8000-000000000044' AND prep_status <> 'PENDING'), 0, 'Lotes rejeitados não gravam nada');

SELECT is(
  (public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'READY')->>'previous_order_status'),
  'NA_FILA', 'Resposta informa o status anterior do pedido'
);
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE id=(SELECT id FROM u44 WHERE unit_no=2)), 'PENDING', 'Sincronização da linha não avança unidades irmãs');
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000044'), 'PRONTO_PARCIAL', 'Uma unidade pronta gera PRONTO_PARCIAL');

CREATE TEMP TABLE audit_before AS SELECT count(*) AS n FROM public.audit_logs WHERE record_id IN (SELECT id FROM u44);
SELECT is(
  (public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'READY')->>'changed_units')::int,
  0, 'Replay do mesmo comando é idempotente'
);
SELECT is(
  (public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'IN_PREPARATION')->>'changed_units')::int,
  0, 'Comando atrasado não retrocede unidade pronta'
);
SELECT is((SELECT count(*) FROM public.audit_logs WHERE record_id IN (SELECT id FROM u44)), (SELECT n FROM audit_before), 'Replays não geram auditoria duplicada');
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE id=(SELECT id FROM u44 WHERE unit_no=1)), 'READY', 'Unidade 1 continua READY');

-- Entrega parcial e comando legado de pedido PRONTO não regride a unidade entregue
SELECT lives_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=1), NULL, 'DELIVERED')$$,
  'Entrega da unidade 1'
);
UPDATE public.order_items SET status='READY', item_ready_at=now()
 WHERE order_id='b2290000-0000-4000-8000-000000000044' AND status IN ('PENDING','IN_PREPARATION');
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE id=(SELECT id FROM u44 WHERE unit_no=1)), 'DELIVERED', 'Legado "pedido pronto" não regride unidade entregue');
SELECT is((SELECT count(*)::int FROM public.production_handoff_units WHERE id IN (SELECT id FROM u44 WHERE unit_no IN (2,3)) AND prep_status='READY'), 2, 'Legado "pedido pronto" avança unidades atrasadas');

-- Cancelamento legado do pedido e restauração preservam o estado de cada unidade
UPDATE public.order_items SET status='CANCELLED', cancelled_at=now() WHERE id='b2290000-0000-4000-8000-000000000054';
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000044'), 'CANCELADO', 'Cancelar todos os itens leva o pedido a CANCELADO');
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u44 WHERE unit_no=2), NULL, 'DELIVERED')$$,
  '22023', NULL, 'Pedido cancelado não aceita produção'
);
UPDATE public.order_items SET status='READY', cancelled_at=NULL WHERE id='b2290000-0000-4000-8000-000000000054';
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000044'), 'PRONTO_PARCIAL', 'Restauração recalcula o pedido a partir de CANCELADO');
SELECT is((SELECT prep_status FROM public.production_handoff_units WHERE id=(SELECT id FROM u44 WHERE unit_no=1)), 'DELIVERED', 'Restauração devolve a unidade entregue');

-- Expansão por item: entrega somente o que está pronto
SELECT is(
  (public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', NULL, ARRAY['b2290000-0000-4000-8000-000000000054'::uuid], 'DELIVERED')->>'changed_units')::int,
  2, 'Entregar pela linha muda só as unidades prontas'
);
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000044'), 'ENTREGUE', 'Pedido fica ENTREGUE');
SELECT is((SELECT item_ready_at IS NOT NULL AND delivered_at IS NOT NULL FROM public.order_items WHERE id='b2290000-0000-4000-8000-000000000054'), true, 'Timestamps legados da linha são preenchidos');

-- Acréscimo após entrega reabre o pedido (contrato de add-items-to-order)
INSERT INTO public.order_items(id, order_id, product_id, product_name_snapshot, product_price_snapshot, production_sector, quantity, total_price)
 VALUES ('b2290000-0000-4000-8000-000000000055', 'b2290000-0000-4000-8000-000000000044', 'b2290000-0000-4000-8000-000000000031', 'Crepe Salgado', 25, 'KITCHEN', 1, 25);
SELECT is((SELECT status::text FROM public.orders WHERE id='b2290000-0000-4000-8000-000000000044'), 'PRONTO_PARCIAL', 'Acréscimo em pedido ENTREGUE volta à operação');

-- Unidade obsoleta (item editado) gera conflito explícito
CREATE TEMP TABLE u55 AS SELECT id FROM public.production_handoff_units WHERE order_item_id='b2290000-0000-4000-8000-000000000055' AND state<>'SUPERSEDED';
UPDATE public.order_items SET observation='sem cebola' WHERE id='b2290000-0000-4000-8000-000000000055';
SELECT throws_ok(
  $$SELECT public.batch_update_production_status('b2290000-0000-4000-8000-000000000044', ARRAY(SELECT id FROM u55), NULL, 'READY')$$,
  '40001', NULL, 'Unidade de revisão anterior é rejeitada com conflito'
);

-- Segurança: recálculo legado segue SECURITY INVOKER
SELECT is((SELECT prosecdef FROM pg_proc WHERE oid='public.recompute_order_status_from_items(uuid)'::regprocedure), false, 'recompute_order_status_from_items permanece SECURITY INVOKER');

SELECT * FROM finish();
ROLLBACK;
