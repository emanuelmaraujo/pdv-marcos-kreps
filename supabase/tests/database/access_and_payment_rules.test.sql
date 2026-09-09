BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(33);

SELECT ok(
  has_table_privilege('authenticated', 'public.payment_transactions', 'SELECT'),
  'quadro autenticado pode ler transacoes de pagamento vinculadas aos pedidos'
);

SELECT has_column(
  'public', 'profiles', 'is_global_admin',
  'profiles distingue administrador global de administrador local'
);
SELECT has_function(
  'public', 'is_global_admin', ARRAY['uuid'],
  'helper de administrador global existe'
);
SELECT has_function(
  'public', 'can_access_branch', ARRAY['uuid'],
  'helper de acesso operacional por filial existe'
);
SELECT has_function(
  'public', 'can_manage_branch', ARRAY['uuid'],
  'helper de administracao por filial existe'
);
SELECT has_table(
  'public', 'branch_payment_fee_rules',
  'regras de taxa por filial existem'
);
SELECT has_column(
  'public', 'branch_payment_fee_rules', 'version',
  'regra de taxa tem versao para concorrencia otimista'
);
SELECT has_column(
  'public', 'branch_payment_fee_rules', 'order_type',
  'taxa pode variar pelo tipo do pedido'
);
SELECT has_column(
  'public', 'branch_payment_fee_rules', 'order_source',
  'taxa pode variar pela origem atendente ou online'
);
SELECT has_column(
  'public', 'payments', 'fee_rule_id',
  'pagamento preserva a regra usada no calculo'
);
SELECT has_column(
  'public', 'payments', 'estimated_net_amount',
  'pagamento preserva o valor liquido estimado'
);
SELECT has_index(
  'public', 'audit_logs', 'idx_audit_logs_branch_created',
  'historico tem indice para consulta por filial e data'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Administradores leem auditoria do escopo'
  ),
  'auditoria possui policy segmentada por escopo'
);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'test-global@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'test-local@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'test-attendant@example.invalid');

INSERT INTO public.branches (id, code, slug, name, active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'T1', 'test-rls-a', 'Teste Filial A', TRUE),
  ('20000000-0000-0000-0000-000000000002', 'T2', 'test-rls-b', 'Teste Filial B', TRUE);

INSERT INTO public.profiles (id, name, role, active, home_branch_id, is_global_admin)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Teste Global', 'ADMIN', TRUE, NULL, TRUE),
  ('10000000-0000-0000-0000-000000000002', 'Teste Local', 'ADMIN', TRUE, '20000000-0000-0000-0000-000000000001', FALSE),
  ('10000000-0000-0000-0000-000000000003', 'Teste Atendente', 'ATTENDANT', TRUE, '20000000-0000-0000-0000-000000000001', FALSE);

INSERT INTO public.profile_branches (profile_id, branch_id)
VALUES
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002');

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT ok(
  public.is_global_admin('10000000-0000-0000-0000-000000000001'),
  'administrador global e reconhecido'
);

SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT ok(
  public.can_manage_branch('20000000-0000-0000-0000-000000000002'),
  'administrador global gerencia qualquer filial ativa'
);

SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
SELECT ok(
  public.can_manage_branch('20000000-0000-0000-0000-000000000001'),
  'administrador local gerencia sua filial'
);
SELECT ok(
  NOT public.can_manage_branch('20000000-0000-0000-0000-000000000002'),
  'administrador local nao gerencia outra filial'
);

SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
SELECT ok(
  public.can_access_branch('20000000-0000-0000-0000-000000000001'),
  'atendente acessa a primeira filial vinculada'
);
SELECT ok(
  public.can_access_branch('20000000-0000-0000-0000-000000000002'),
  'atendente acessa a segunda filial vinculada'
);

INSERT INTO public.categories (id, branch_id, name, active, sort_order)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Categoria teste A', TRUE, 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Categoria teste B', TRUE, 1);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
SELECT is(
  (SELECT count(*)::BIGINT FROM public.categories WHERE name LIKE 'Categoria teste %'),
  1::BIGINT,
  'administrador local nao herda a policy publica para ler cardapio de outra filial'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
SELECT is(
  (SELECT count(*)::BIGINT FROM public.categories WHERE name LIKE 'Categoria teste %'),
  2::BIGINT,
  'atendente multi-filial le o cardapio das duas filiais autorizadas'
);
RESET ROLE;

INSERT INTO public.audit_logs (action, table_name, branch_id)
VALUES
  ('TEST_SCOPE_A', 'branches', '20000000-0000-0000-0000-000000000001'),
  ('TEST_SCOPE_B', 'branches', '20000000-0000-0000-0000-000000000002'),
  ('TEST_SCOPE_GLOBAL', 'settings', NULL);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
SELECT is(
  (SELECT count(*)::BIGINT FROM public.audit_logs WHERE action LIKE 'TEST_SCOPE_%'),
  1::BIGINT,
  'administrador local ve apenas auditoria da propria filial'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::BIGINT FROM public.audit_logs WHERE action LIKE 'TEST_SCOPE_%'),
  3::BIGINT,
  'administrador global ve auditoria de filiais e configuracao global'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';

SELECT lives_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      installments_from, installments_to, fee_percent, effective_from,
      change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'TESTPAY', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 1, 1, 1.99, '2030-01-01',
      'Contrato de teste', '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'administrador local cria taxa na propria filial'
);

SELECT throws_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      installments_from, installments_to, fee_percent, effective_from,
      change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000002', 'OUTSIDE', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 1, 1, 1.99, '2030-01-01',
      'Fora do escopo', '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  NULL,
  'administrador local nao cria taxa em outra filial'
);

SELECT throws_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      installments_from, installments_to, fee_percent, effective_from,
      change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'TESTPAY', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 1, 1, 2.10, '2030-02-01',
      'Conflito proposital', '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '23P01',
  NULL,
  'duas regras ativas sobrepostas sao rejeitadas'
);

SELECT lives_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      installments_from, installments_to, fee_percent, effective_from, active,
      change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'TESTPAY', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 1, 1, 2.10, '2030-02-01', FALSE,
      'Versao inativa', '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'regra inativa sobreposta pode ser preservada como historico'
);

SELECT lives_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      order_type, order_source, installments_from, installments_to,
      fee_percent, effective_from, change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'TESTPAY', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 'VIAGEM', 'ATTENDANT', 1, 1, 2.35, '2030-01-01',
      'Taxa especifica da maquininha para viagem',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'override especifico de viagem e atendente pode coexistir com fallback ANY'
);

SELECT throws_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      order_type, order_source, installments_from, installments_to,
      fee_percent, effective_from, change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'TESTPAY', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 'VIAGEM', 'ATTENDANT', 1, 1, 2.40, '2030-03-01',
      'Conflito no mesmo contexto',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '23P01',
  NULL,
  'duas taxas ativas do mesmo tipo e origem continuam proibidas'
);

SELECT throws_ok(
  $$
    INSERT INTO public.branch_payment_fee_rules (
      branch_id, provider_code, channel, payment_method, card_brand,
      installments_from, installments_to, fee_percent, effective_from,
      change_reason, created_by, updated_by
    ) VALUES (
      '20000000-0000-0000-0000-000000000001', 'INVALID', 'IN_PERSON',
      'DEBIT_CARD', 'ANY', 2, 3, 1.50, '2031-01-01',
      'Debito parcelado invalido', '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '23514',
  NULL,
  'debito parcelado e rejeitado pelo banco'
);

RESET ROLE;

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000011', 'invalid-attendant@example.invalid'),
  ('10000000-0000-0000-0000-000000000012', 'invalid-admin@example.invalid'),
  ('10000000-0000-0000-0000-000000000013', 'invalid-courier@example.invalid');

SELECT throws_ok(
  $$
    SELECT public.admin_upsert_user_access(
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000011',
      'Atendente sem filial', 'ATTENDANT', TRUE, ARRAY[]::UUID[], NULL, NULL
    )
  $$,
  'P0001',
  NULL,
  'atendente sem filial e rejeitado'
);

SELECT throws_ok(
  $$
    SELECT public.admin_upsert_user_access(
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000012',
      'Admin com duas filiais', 'ADMIN', TRUE,
      ARRAY[
        '20000000-0000-0000-0000-000000000001'::UUID,
        '20000000-0000-0000-0000-000000000002'::UUID
      ],
      '20000000-0000-0000-0000-000000000001', NULL
    )
  $$,
  'P0001',
  NULL,
  'administrador local com mais de uma filial e rejeitado'
);

SELECT throws_ok(
  $$
    SELECT public.admin_upsert_user_access(
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000013',
      'Entregador com duas filiais', 'COURIER', TRUE,
      ARRAY[
        '20000000-0000-0000-0000-000000000001'::UUID,
        '20000000-0000-0000-0000-000000000002'::UUID
      ],
      '20000000-0000-0000-0000-000000000001', '11999999999'
    )
  $$,
  'P0001',
  NULL,
  'entregador com mais de uma filial e rejeitado'
);

SELECT * FROM finish();
ROLLBACK;
