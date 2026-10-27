-- Bairros de entrega no painel: equipe lê a própria filial, admin gerencia só a sua.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);
INSERT INTO auth.users (id, email) VALUES
 ('d2210000-0000-4000-8000-000000000001','zones-admin@example.invalid'),
 ('d2210000-0000-4000-8000-000000000002','zones-attendant@example.invalid');
INSERT INTO public.branches (id, code, slug, name, active, delivery_enabled) VALUES
 ('d2210000-0000-4000-8000-000000000011','DZA','test-zones-a','Zones A',true,true),
 ('d2210000-0000-4000-8000-000000000012','DZB','test-zones-b','Zones B',true,true);
INSERT INTO public.profiles (id, name, role, active, is_global_admin, home_branch_id) VALUES
 ('d2210000-0000-4000-8000-000000000001','Admin zonas','ADMIN',true,false,'d2210000-0000-4000-8000-000000000011'),
 ('d2210000-0000-4000-8000-000000000002','Atendente zonas','ATTENDANT',true,false,'d2210000-0000-4000-8000-000000000011');
INSERT INTO public.profile_branches (profile_id, branch_id) VALUES
 ('d2210000-0000-4000-8000-000000000001','d2210000-0000-4000-8000-000000000011'),
 ('d2210000-0000-4000-8000-000000000002','d2210000-0000-4000-8000-000000000011');
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO public.delivery_zones (branch_id, neighborhood, neighborhood_normalized, fee) VALUES
 ('d2210000-0000-4000-8000-000000000011','Centro','centro',5),
 ('d2210000-0000-4000-8000-000000000012','Outro','outro',7);

-- Papel real da API (RLS e grants valem; superusuário não mascara o teste).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"d2210000-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT lives_ok($$SELECT * FROM public.delivery_zones$$, 'admin lê bairros pela API sem erro de permissão');
SELECT is((SELECT count(*)::int FROM public.delivery_zones), 1, 'admin vê só os bairros da própria filial');
SELECT lives_ok($$INSERT INTO public.delivery_zones (branch_id, neighborhood, neighborhood_normalized, fee)
  VALUES ('d2210000-0000-4000-8000-000000000011','Norte','norte',6)$$, 'admin cadastra bairro na própria filial');
SELECT throws_ok($$INSERT INTO public.delivery_zones (branch_id, neighborhood, neighborhood_normalized, fee)
  VALUES ('d2210000-0000-4000-8000-000000000012','Sul','sul',6)$$, '42501', NULL, 'admin não cadastra bairro em outra filial');
SET LOCAL "request.jwt.claims" = '{"sub":"d2210000-0000-4000-8000-000000000002","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.delivery_zones), 2, 'atendente lê os bairros da filial');
SELECT throws_ok($$INSERT INTO public.delivery_zones (branch_id, neighborhood, neighborhood_normalized, fee)
  VALUES ('d2210000-0000-4000-8000-000000000011','Leste','leste',6)$$, '42501', NULL, 'atendente não cadastra bairro');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.delivery_zones WHERE branch_id='d2210000-0000-4000-8000-000000000012'), 1, 'checkout público continua lendo bairros ativos');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
