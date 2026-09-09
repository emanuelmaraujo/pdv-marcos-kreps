BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

SELECT has_function(
  'public',
  'confirm_courier_delivery_transactional',
  ARRAY['uuid', 'uuid'],
  'comando atomico de confirmacao existe'
);

INSERT INTO auth.users (id, email)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'courier-one@example.invalid'),
  ('71000000-0000-0000-0000-000000000002', 'courier-two@example.invalid'),
  ('71000000-0000-0000-0000-000000000003', 'attendant@example.invalid');

INSERT INTO public.branches (id, code, slug, name, active)
VALUES ('72000000-0000-0000-0000-000000000001', 'CD', 'courier-delivery-test', 'Filial Teste Entrega', TRUE);

INSERT INTO public.profiles (id, name, role, active, home_branch_id)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'Motoboy Um', 'COURIER', TRUE, '72000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'Motoboy Dois', 'COURIER', TRUE, '72000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'Atendente', 'ATTENDANT', TRUE, '72000000-0000-0000-0000-000000000001');

INSERT INTO public.profile_branches (profile_id, branch_id)
VALUES
  ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001');

INSERT INTO public.couriers (id, branch_id, profile_id, name, active)
VALUES
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Motoboy Um', TRUE),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'Motoboy Dois', TRUE);

INSERT INTO public.orders (
  id, branch_id, daily_number, type, source, status, payment_status,
  total_amount, courier_id, courier_name, dispatched_at
)
VALUES
  ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 901, 'ENTREGA', 'ATTENDANT', 'SAIU_PARA_ENTREGA', 'PAID', 50, '73000000-0000-0000-0000-000000000001', 'Motoboy Um', now()),
  ('74000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 902, 'ENTREGA', 'ATTENDANT', 'SAIU_PARA_ENTREGA', 'PAID', 60, '73000000-0000-0000-0000-000000000002', 'Motoboy Dois', now());

INSERT INTO public.categories (id, branch_id, name, active)
VALUES ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Categoria Entrega', TRUE);

INSERT INTO public.products (id, branch_id, category_id, name, price, sector, active)
VALUES ('76000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Produto Entrega', 50, 'KITCHEN', TRUE);

INSERT INTO public.order_items (
  id, order_id, product_id, product_name_snapshot, product_price_snapshot,
  production_sector, quantity, total_price, status, payment_status, payment_method,
  sequence_no
)
VALUES (
  '77000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  'Produto Entrega', 50, 'KITCHEN', 1, 50, 'READY', 'PAID', 'PIX', 1
);

SELECT throws_ok(
  $$ SELECT public.confirm_courier_delivery_transactional('74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003') $$,
  '42501',
  'Somente um entregador ativo pode confirmar a entrega.',
  'atendente nao confirma a entrega do motoboy'
);

SELECT throws_ok(
  $$ SELECT public.confirm_courier_delivery_transactional('74000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001') $$,
  '42501',
  'Pedido não pertence a este entregador.',
  'motoboy nao confirma pedido atribuido a outro'
);

SELECT lives_ok(
  $$ SELECT public.confirm_courier_delivery_transactional('74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$,
  'motoboy confirma a propria entrega'
);

SELECT results_eq(
  $$ SELECT status::text FROM public.orders WHERE id = '74000000-0000-0000-0000-000000000001' $$,
  ARRAY['ENTREGUE'],
  'pedido confirmado termina como entregue'
);

SELECT results_eq(
  $$ SELECT new_data->>'confirmation_source' FROM public.audit_logs WHERE record_id = '74000000-0000-0000-0000-000000000001' AND action = 'ORDER_DELIVERY_CONFIRMED' ORDER BY created_at DESC LIMIT 1 $$,
  ARRAY['COURIER_HOLD'],
  'auditoria registra confirmacao deliberada do motoboy'
);

SELECT * FROM finish();
ROLLBACK;
