BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

INSERT INTO auth.users (id, email) VALUES
  ('aa000000-0000-0000-0000-000000000001','packing-attendant@example.invalid'),
  ('aa000000-0000-0000-0000-000000000002','packing-admin@example.invalid');
INSERT INTO public.branches (id, code, slug, name, active)
VALUES ('ab000000-0000-0000-0000-000000000001','TP','test-packaging-rls','Teste embalagem',TRUE);
INSERT INTO public.profiles (id, name, role, active, home_branch_id)
VALUES
  ('aa000000-0000-0000-0000-000000000001','Atendente', 'ATTENDANT', TRUE,'ab000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000002','Administrador','ADMIN',TRUE,'ab000000-0000-0000-0000-000000000001');
INSERT INTO public.profile_branches (profile_id, branch_id)
VALUES
  ('aa000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000002','ab000000-0000-0000-0000-000000000001');
INSERT INTO public.settings (key, value) VALUES
  ('packaging_fee','1'::jsonb),
  ('apply_packaging_fee_for_takeout','true'::jsonb),
  ('packing_test_secret','"restricted"'::jsonb)
ON CONFLICT (key) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aa000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*) FROM public.settings
  WHERE key IN ('packaging_fee','apply_packaging_fee_for_takeout')), 2::bigint,
  'atendente autorizado le apenas duas configuracoes de embalagem');
SELECT is((SELECT count(*) FROM public.settings WHERE key='packing_test_secret'),0::bigint,
  'atendente nao le outras configuracoes do sistema');
RESET ROLE;

UPDATE public.profiles SET active=FALSE WHERE id='aa000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aa000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*) FROM public.settings WHERE key='packaging_fee'),0::bigint,
  'atendente inativo nao le configuracoes de embalagem');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aa000000-0000-0000-0000-000000000002';
SELECT is((SELECT count(*) FROM public.settings WHERE key='packing_test_secret'),1::bigint,
  'administrador continua com seu acesso anterior');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
