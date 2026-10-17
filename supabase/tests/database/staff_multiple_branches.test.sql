-- Regression tests for multi-branch staff memberships. ROLLBACK guarantees no persistent fixtures.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

INSERT INTO auth.users (id, email) VALUES
 ('a7100000-0000-0000-0000-000000000001', 'multi-global@example.invalid'),
 ('a7100000-0000-0000-0000-000000000002', 'multi-admin@example.invalid'),
 ('a7100000-0000-0000-0000-000000000003', 'multi-attendant@example.invalid'),
 ('a7100000-0000-0000-0000-000000000004', 'multi-courier@example.invalid');

INSERT INTO public.branches (id, code, slug, name, active) VALUES
 ('b7100000-0000-0000-0000-000000000001','MA','test-multi-a','Multi branch A',true),
 ('b7100000-0000-0000-0000-000000000002','MB','test-multi-b','Multi branch B',true),
 ('b7100000-0000-0000-0000-000000000003','MC','test-multi-c','Multi branch C',true);

INSERT INTO public.profiles (id, name, role, active, is_global_admin, home_branch_id) VALUES
 ('a7100000-0000-0000-0000-000000000001','Global Test','ADMIN',true,true,'b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000002','Local Test','ADMIN',true,false,'b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000003','Attendant Test','ATTENDANT',true,false,'b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000004','Courier Test','COURIER',true,false,'b7100000-0000-0000-0000-000000000001');

INSERT INTO public.profile_branches (profile_id, branch_id) VALUES
 ('a7100000-0000-0000-0000-000000000001','b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000002','b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000002','b7100000-0000-0000-0000-000000000002'),
 ('a7100000-0000-0000-0000-000000000003','b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000003','b7100000-0000-0000-0000-000000000002'),
 ('a7100000-0000-0000-0000-000000000004','b7100000-0000-0000-0000-000000000001'),
 ('a7100000-0000-0000-0000-000000000004','b7100000-0000-0000-0000-000000000002');

INSERT INTO public.couriers (id, branch_id, name, active, profile_id) VALUES
 ('c7100000-0000-0000-0000-000000000001','b7100000-0000-0000-0000-000000000001','Courier Test',true,'a7100000-0000-0000-0000-000000000004');

-- Evaluate deferred cardinality constraints with both memberships present.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT is((SELECT count(*)::integer FROM public.profile_branches WHERE profile_id='a7100000-0000-0000-0000-000000000002'), 2, 'local admin can belong to two units');
SELECT is((SELECT count(*)::integer FROM public.profile_branches WHERE profile_id='a7100000-0000-0000-0000-000000000003'), 2, 'attendant can belong to two units');
SELECT is((SELECT count(*)::integer FROM public.profile_branches WHERE profile_id='a7100000-0000-0000-0000-000000000004'), 2, 'courier can belong to two units');

SET LOCAL "request.jwt.claim.sub" = 'a7100000-0000-0000-0000-000000000002';
SELECT ok(public.can_access_branch('b7100000-0000-0000-0000-000000000001'), 'local admin allowed branch A');
SELECT ok(public.can_manage_branch('b7100000-0000-0000-0000-000000000002'), 'local admin can manage branch B');
SELECT ok(NOT public.can_access_branch('b7100000-0000-0000-0000-000000000003'), 'local admin cannot access branch C');
SELECT ok(EXISTS(SELECT 1 FROM public.list_branch_couriers('b7100000-0000-0000-0000-000000000002') WHERE profile_id='a7100000-0000-0000-0000-000000000004'), 'multi-branch courier appears in the second unit');
SELECT throws_ok(
 $$SELECT id FROM public.list_branch_couriers('b7100000-0000-0000-0000-000000000003')$$,
 '42501', 'Filial nao autorizada.', 'staff listing rejects non-authorized branch'
);

SET LOCAL "request.jwt.claim.sub" = 'a7100000-0000-0000-0000-000000000004';
SELECT throws_ok(
 $$SELECT id FROM public.list_branch_couriers('b7100000-0000-0000-0000-000000000001')$$,
 '42501', 'Filial nao autorizada.', 'courier cannot list staff'
);

-- Backend authorization accepts multi-branch admins and preserves a valid home.
SELECT lives_ok(
 $$SELECT public.admin_upsert_user_access(
   'a7100000-0000-0000-0000-000000000001',
   'a7100000-0000-0000-0000-000000000002',
   'Local Test', 'ADMIN'::public.user_role, true,
   ARRAY['b7100000-0000-0000-0000-000000000001'::uuid, 'b7100000-0000-0000-0000-000000000002'::uuid],
   'b7100000-0000-0000-0000-000000000002'::uuid
 )$$,
 'global admin can persist two-branch local admin'
);
SELECT is(
 (SELECT home_branch_id::text FROM public.profiles WHERE id='a7100000-0000-0000-0000-000000000002'),
 'b7100000-0000-0000-0000-000000000002',
 'home branch choice persists'
);
SELECT throws_ok(
 $$SELECT public.admin_upsert_user_access(
   'a7100000-0000-0000-0000-000000000001',
   'a7100000-0000-0000-0000-000000000002',
   'Local Test', 'ADMIN'::public.user_role, true,
   ARRAY[]::uuid[],
   'b7100000-0000-0000-0000-000000000001'::uuid
 )$$,
 'P0001', 'Todos os funcionarios devem pertencer a pelo menos uma filial.',
 'no staff role can have zero branches'
);
SELECT * FROM finish();
ROLLBACK;
