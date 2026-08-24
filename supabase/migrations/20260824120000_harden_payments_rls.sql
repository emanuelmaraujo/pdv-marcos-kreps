-- Migration: Restringe escrita direta na tabela payments
-- Date: 2026-08-24
-- Notes:
--   * A policy "Equipe gerencia pagamentos" (20260515230000) era FOR ALL para
--     qualquer atendente da filial, sem WITH CHECK próprio e sem checagem de
--     role — permitia INSERT/UPDATE/DELETE direto via PostgREST (client do
--     atendente), contornando por completo a reconciliação de valor, a regra
--     de que REFUNDED exige ADMIN e o log de auditoria da Edge Function
--     mark-payment (que já opera com a service-role key e por isso não é
--     afetada por esta mudança).
--   * A partir de agora: leitura continua liberada pra equipe da filial
--     (necessária pra tela de caixa/pedidos); escrita direta (INSERT/UPDATE/
--     DELETE) fica restrita a ADMIN. Atendentes registram pagamento apenas
--     via mark-payment, que já valida role/valor/status.

DROP POLICY IF EXISTS "Equipe gerencia pagamentos" ON payments;

CREATE POLICY "Equipe le pagamentos" ON payments FOR SELECT TO authenticated
USING (
  get_my_role() = 'ADMIN' OR
  EXISTS (
    SELECT 1 FROM orders o WHERE o.id = payments.order_id
      AND (o.branch_id IS NULL OR o.branch_id IN (SELECT branch_id FROM get_my_branches()))
  )
);

CREATE POLICY "Admin escreve pagamentos" ON payments FOR INSERT TO authenticated
WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Admin atualiza pagamentos" ON payments FOR UPDATE TO authenticated
USING (get_my_role() = 'ADMIN')
WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Admin apaga pagamentos" ON payments FOR DELETE TO authenticated
USING (get_my_role() = 'ADMIN');
