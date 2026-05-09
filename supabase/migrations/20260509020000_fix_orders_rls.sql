-- Fix RLS on orders and related tables
-- Principle: ATTENDANT can read everything but must mutate orders via service-role Edge Functions.
-- ADMIN retains full access for management operations.
-- 2026-05-09

-- ── orders ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Equipe gerencia pedidos" ON orders;

CREATE POLICY "Admin gerencia pedidos"
  ON orders FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le pedidos"
  ON orders FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

-- ── order_items ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Equipe gerencia itens de pedido" ON order_items;

CREATE POLICY "Admin gerencia itens de pedido"
  ON order_items FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le itens de pedido"
  ON order_items FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

-- ── order_item_removed_ingredients ────────────────────────────────────────────
DROP POLICY IF EXISTS "Equipe gerencia removidos" ON order_item_removed_ingredients;

CREATE POLICY "Admin gerencia removidos"
  ON order_item_removed_ingredients FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le removidos"
  ON order_item_removed_ingredients FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

-- ── order_item_addons ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Equipe gerencia addons do item" ON order_item_addons;

CREATE POLICY "Admin gerencia addons do item"
  ON order_item_addons FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le addons do item"
  ON order_item_addons FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

-- ── payments & discounts ──────────────────────────────────────────────────────
-- Attendants handle payment at the counter — keep full access here.
-- Discount granting stays ADMIN-only via app UI, but reads are shared.
DROP POLICY IF EXISTS "Equipe gerencia pagamentos" ON payments;
DROP POLICY IF EXISTS "Equipe gerencia descontos"  ON discounts;

CREATE POLICY "Equipe gerencia pagamentos"
  ON payments FOR ALL TO authenticated
  USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

CREATE POLICY "Admin gerencia descontos"
  ON discounts FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le descontos"
  ON discounts FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

-- ── printer_jobs ──────────────────────────────────────────────────────────────
-- Attendants need to UPDATE printer_jobs status (mark as PRINTED).
-- No direct INSERT — jobs are created by Edge Functions via service role.
DROP POLICY IF EXISTS "Equipe gerencia printer_jobs" ON printer_jobs;

CREATE POLICY "Admin gerencia printer_jobs"
  ON printer_jobs FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le e atualiza printer_jobs"
  ON printer_jobs FOR SELECT TO authenticated
  USING (get_my_role() = 'ATTENDANT');

CREATE POLICY "Attendant atualiza status printer_jobs"
  ON printer_jobs FOR UPDATE TO authenticated
  USING     (get_my_role() = 'ATTENDANT')
  WITH CHECK (get_my_role() = 'ATTENDANT');
