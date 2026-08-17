-- Migration: Endurecimento de RLS multi-filial (Fase P1.1)
-- Date: 2026-08-17
-- Notes:
--   * BUG CRÍTICO ACHADO NESTA AUDITORIA: 20260515230000_multi_branch_schema.sql
--     tentou substituir as policies "Admin gerencia X" / "Attendant le X"
--     (criadas em 20260509020000_fix_orders_rls.sql, que restringiam ATTENDANT
--     a leitura — mutação só via Edge Function com service_role) por uma
--     policy única "Equipe gerencia X" com escopo de filial. Só que o
--     `DROP POLICY IF EXISTS "Equipe gerencia X"` daquela migration citava o
--     nome ANTIGO (pré-020000), que já não existia mais — então o DROP foi
--     um no-op silencioso, e a nova policy "Equipe gerencia X" (FOR ALL,
--     liberando escrita pra ATTENDANT) ficou empilhada JUNTO com as policies
--     restritas antigas. RLS é permissiva por padrão (policies do mesmo tipo
--     se combinam com OR), então isso deu a ATTENDANT escrita direta —
--     bypassando toda validação de negócio, os locks transacionais das RPCs
--     de P0.1-P0.4, e a auditoria — nas tabelas: orders, order_items,
--     order_item_removed_ingredients, order_item_addons, discounts, payments,
--     cash_sessions, printer_jobs e whatsapp_messages. Confirmado consultando
--     pg_policies no banco local antes de escrever esta migration.
--   * Busca no frontend (src/) confirma que nenhum client-side usa essas
--     policies amplas pra escrever — toda escrita de negócio já passa por
--     Edge Functions (service_role, que sempre ignora RLS). A única escrita
--     client-side nas tabelas afetadas é settings-api.ts reprocessFailedWhatsApp
--     (UPDATE em whatsapp_messages), que já é coberta pela policy
--     "Admin gerencia whatsapp_messages" existente — fica intacta.
--   * Também remove `branch_id IS NULL` das policies afetadas: o backfill de
--     20260515230100 já preencheu branch_id em todas as linhas legadas: não
--     há mais linha alguma sem filial pra essas condições protegerem.
--   * Também corrige get_my_role() pra ter SET search_path — só get_my_branches()
--     tinha isso; toda função SECURITY DEFINER deve ter search_path explícito
--     pra não ficar vulnerável a search_path hijacking.

-- ============================================================================
-- 0. get_my_role(): adiciona SET search_path (estava faltando desde a criação).
-- ============================================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================================
-- 1. orders / order_items / order_item_removed_ingredients / order_item_addons
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia pedidos" ON orders;
DROP POLICY IF EXISTS "Attendant le pedidos" ON orders;
CREATE POLICY "Attendant le pedidos"
  ON orders FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    branch_id IN (SELECT branch_id FROM get_my_branches())
  );

DROP POLICY IF EXISTS "Equipe gerencia itens de pedido" ON order_items;
DROP POLICY IF EXISTS "Attendant le itens de pedido" ON order_items;
CREATE POLICY "Attendant le itens de pedido"
  ON order_items FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    EXISTS (
      SELECT 1 FROM orders o
       WHERE o.id = order_items.order_id
         AND o.branch_id IN (SELECT branch_id FROM get_my_branches())
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia removidos" ON order_item_removed_ingredients;
DROP POLICY IF EXISTS "Attendant le removidos" ON order_item_removed_ingredients;
CREATE POLICY "Attendant le removidos"
  ON order_item_removed_ingredients FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    EXISTS (
      SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = order_item_removed_ingredients.order_item_id
         AND o.branch_id IN (SELECT branch_id FROM get_my_branches())
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia addons do item" ON order_item_addons;
DROP POLICY IF EXISTS "Attendant le addons do item" ON order_item_addons;
CREATE POLICY "Attendant le addons do item"
  ON order_item_addons FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    EXISTS (
      SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = order_item_addons.order_item_id
         AND o.branch_id IN (SELECT branch_id FROM get_my_branches())
    )
  );

-- ============================================================================
-- 2. discounts — escrita fica ADMIN-only (regra de negócio do plano).
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia descontos" ON discounts;
DROP POLICY IF EXISTS "Attendant le descontos" ON discounts;
CREATE POLICY "Attendant le descontos"
  ON discounts FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = discounts.order_id
        AND o.branch_id IN (SELECT branch_id FROM get_my_branches())
    )
  );

-- ============================================================================
-- 3. payments — nunca teve split Admin/Attendant; cria agora. Escrita real
--    de pagamento continua só via pay_order_items_transactional (service_role).
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia pagamentos" ON payments;
CREATE POLICY "Admin gerencia pagamentos"
  ON payments FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le pagamentos"
  ON payments FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = payments.order_id
        AND o.branch_id IN (SELECT branch_id FROM get_my_branches())
    )
  );

-- ============================================================================
-- 4. cash_sessions — mesmo padrão.
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia caixas" ON cash_sessions;
CREATE POLICY "Admin gerencia caixas"
  ON cash_sessions FOR ALL TO authenticated
  USING     (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Attendant le caixas"
  ON cash_sessions FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    branch_id IN (SELECT branch_id FROM get_my_branches())
  );

-- ============================================================================
-- 5. printer_jobs — remove também o UPDATE direto de ATTENDANT: hoje o
--    status só é escrito pelo print-worker (service_role, via claim_printer_jobs)
--    e a reimpressão vai por reprint-order (service_role). Nenhum client-side
--    depende de UPDATE direto aqui (confirmado por busca no frontend).
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia printer_jobs" ON printer_jobs;
DROP POLICY IF EXISTS "Attendant atualiza status printer_jobs" ON printer_jobs;
DROP POLICY IF EXISTS "Attendant le e atualiza printer_jobs" ON printer_jobs;
CREATE POLICY "Attendant le printer_jobs"
  ON printer_jobs FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ATTENDANT' AND
    branch_id IN (SELECT branch_id FROM get_my_branches())
  );

-- ============================================================================
-- 6. whatsapp_messages — escrita fica ADMIN-only (já era a intenção original).
-- ============================================================================
DROP POLICY IF EXISTS "Equipe gerencia whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Equipe le whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Equipe le whatsapp_messages"
  ON whatsapp_messages FOR SELECT TO authenticated
  USING (
    get_my_role() = 'ADMIN' OR
    (get_my_role() = 'ATTENDANT' AND branch_id IN (SELECT branch_id FROM get_my_branches()))
  );
