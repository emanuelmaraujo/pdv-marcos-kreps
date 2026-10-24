-- Executar com npm run test:database: depende do catálogo sintético isolado.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

SELECT is((SELECT count(*) FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name LIKE '__ - Fixture'),
  36::bigint, 'atualizar preços preserva os 36 crepes');
SELECT is((SELECT price FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name='03 - Fixture'),
  26::numeric, 'crepe 03 recebe o preço revisado');
SELECT is((SELECT price FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name='Porção de Batata'),
  25::numeric, 'batata recebe o preço revisado');
SELECT is((SELECT count(*) FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name='Água com gás'),
  1::bigint, 'reaplicar migration da água não duplica o produto');
SELECT is((SELECT price FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name='Água com gás'),
  (SELECT price FROM public.products WHERE branch_id='ff000000-0000-0000-0000-000000000001' AND name='Água'),
  'água com gás mantém o mesmo preço da água sem gás');
SELECT is((SELECT packing_fee FROM public.branches WHERE id='ff000000-0000-0000-0000-000000000001'),
  1::numeric, 'embalagem da NB fica em um real');
SELECT is((SELECT count(*) FROM public.products p JOIN public.branches b ON b.id=p.branch_id WHERE b.slug='condo-guara'),
  24::bigint, 'atualização da NB preserva catálogo com 24 produtos da outra filial');
SELECT is((SELECT p.price FROM public.products p JOIN public.branches b ON b.id=p.branch_id WHERE b.slug='condo-guara' AND p.name='01 - Presunto e queijo'),
  22::numeric, 'atualização da NB não altera preços da outra filial');

SELECT * FROM finish();
ROLLBACK;
