-- Migration: Delivery — Fase 4 (motoboy com login próprio), parte 2/2
-- Notes:
--   * couriers.profile_id: motoboy loga e vê só os próprios pedidos.
--   * RLS aqui só protege leitura direta do client (padrão já documentado em
--     20260817110000_rls_hardening.sql) — a escrita real (confirmar entrega)
--     é feita via confirm-delivery (service_role), que precisa da MESMA
--     checagem de posse em código, não só RLS.

ALTER TABLE couriers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_couriers_profile_id_unique
  ON couriers(profile_id) WHERE profile_id IS NOT NULL;

-- Motoboy lê o próprio registro em couriers (nome/telefone/filial).
DROP POLICY IF EXISTS "Courier le proprio cadastro" ON couriers;
CREATE POLICY "Courier le proprio cadastro"
  ON couriers FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Motoboy lê só os pedidos despachados para ele (soma-se às policies
-- ADMIN/ATTENDANT existentes — RLS combina policies do mesmo tipo com OR).
DROP POLICY IF EXISTS "Courier le proprios pedidos" ON orders;
CREATE POLICY "Courier le proprios pedidos"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couriers c
       WHERE c.id = orders.courier_id
         AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Courier le itens dos proprios pedidos" ON order_items;
CREATE POLICY "Courier le itens dos proprios pedidos"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o JOIN couriers c ON c.id = o.courier_id
       WHERE o.id = order_items.order_id
         AND c.profile_id = auth.uid()
    )
  );
