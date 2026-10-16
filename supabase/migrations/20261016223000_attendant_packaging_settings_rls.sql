-- Atendentes precisam visualizar a tarifa de embalagem antes de registrar
-- pedidos para viagem. Não revelar outras settings (integrações, segredos, etc).
-- O grant de SELECT para authenticated já existe; restringir via RLS por chave.
DROP POLICY IF EXISTS "Atendentes leem configuracao de embalagem" ON public.settings;
CREATE POLICY "Atendentes leem configuracao de embalagem"
ON public.settings FOR SELECT TO authenticated
USING (
  key IN ('packaging_fee', 'apply_packaging_fee_for_takeout')
  AND (SELECT public.get_my_role()) = 'ATTENDANT'::public.user_role
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.active = TRUE
      AND p.role = 'ATTENDANT'::public.user_role
  )
);
