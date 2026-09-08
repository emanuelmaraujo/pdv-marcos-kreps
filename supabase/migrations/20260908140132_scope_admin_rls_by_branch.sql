-- Remove o atalho historico `ADMIN = acesso global` das policies operacionais.
-- O alcance agora vem exclusivamente de get_my_branches(); o administrador
-- global recebe todas as filiais por essa funcao e o local recebe uma.

-- --------------------------------------------------------------------------
-- Cardapio: escrita por filial e custo nunca concedido ao papel anon.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin control categories" ON public.categories;
DROP POLICY IF EXISTS "Admin control products" ON public.products;
DROP POLICY IF EXISTS "Admin control ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Admin control addons" ON public.addons;
DROP POLICY IF EXISTS "Admin control product_ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "Admin control product_addons" ON public.product_addons;
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
DROP POLICY IF EXISTS "Public read active products" ON public.products;
DROP POLICY IF EXISTS "Public read active ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Public read active addons" ON public.addons;
DROP POLICY IF EXISTS "Public read product_ingredients" ON public.product_ingredients;
DROP POLICY IF EXISTS "Public read product_addons" ON public.product_addons;

CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT TO anon
  USING (active = TRUE AND (branch_id IS NULL OR public.is_public_branch(branch_id)));

CREATE POLICY "Public read active products"
  ON public.products FOR SELECT TO anon
  USING (active = TRUE AND (branch_id IS NULL OR public.is_public_branch(branch_id)));

CREATE POLICY "Public read active ingredients"
  ON public.ingredients FOR SELECT TO anon
  USING (active = TRUE AND (branch_id IS NULL OR public.is_public_branch(branch_id)));

CREATE POLICY "Public read active addons"
  ON public.addons FOR SELECT TO anon
  USING (active = TRUE AND (branch_id IS NULL OR public.is_public_branch(branch_id)));

CREATE POLICY "Public read product_ingredients"
  ON public.product_ingredients FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      JOIN public.ingredients AS i ON i.id = product_ingredients.ingredient_id
      WHERE p.id = product_ingredients.product_id
        AND p.branch_id = i.branch_id
        AND p.active = TRUE
        AND i.active = TRUE
        AND (p.branch_id IS NULL OR public.is_public_branch(p.branch_id))
    )
  );

CREATE POLICY "Public read product_addons"
  ON public.product_addons FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      JOIN public.addons AS a ON a.id = product_addons.addon_id
      WHERE p.id = product_addons.product_id
        AND p.branch_id = a.branch_id
        AND p.active = TRUE
        AND a.active = TRUE
        AND (p.branch_id IS NULL OR public.is_public_branch(p.branch_id))
    )
  );

CREATE POLICY "Equipe le categorias da filial"
  ON public.categories FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "Equipe le produtos da filial"
  ON public.products FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "Equipe le ingredientes da filial"
  ON public.ingredients FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "Equipe le adicionais da filial"
  ON public.addons FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "Equipe le ingredientes de produtos da filial"
  ON public.product_ingredients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_ingredients.product_id
        AND public.can_access_branch(p.branch_id)
    )
  );

CREATE POLICY "Equipe le adicionais de produtos da filial"
  ON public.product_addons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_addons.product_id
        AND public.can_access_branch(p.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia categorias da filial"
  ON public.categories FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador gerencia produtos da filial"
  ON public.products FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador gerencia ingredientes da filial"
  ON public.ingredients FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador gerencia adicionais da filial"
  ON public.addons FOR ALL TO authenticated
  USING (public.can_manage_branch(branch_id))
  WITH CHECK (public.can_manage_branch(branch_id));

CREATE POLICY "Administrador gerencia ingredientes de produtos da filial"
  ON public.product_ingredients FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_ingredients.product_id
        AND public.can_manage_branch(p.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      JOIN public.ingredients AS i ON i.id = product_ingredients.ingredient_id
      WHERE p.id = product_ingredients.product_id
        AND p.branch_id = i.branch_id
        AND public.can_manage_branch(p.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia adicionais de produtos da filial"
  ON public.product_addons FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_addons.product_id
        AND public.can_manage_branch(p.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products AS p
      JOIN public.addons AS a ON a.id = product_addons.addon_id
      WHERE p.id = product_addons.product_id
        AND p.branch_id = a.branch_id
        AND public.can_manage_branch(p.branch_id)
    )
  );

REVOKE ALL ON TABLE public.categories FROM anon;
REVOKE ALL ON TABLE public.products FROM anon;
REVOKE ALL ON TABLE public.ingredients FROM anon;
REVOKE ALL ON TABLE public.addons FROM anon;
REVOKE ALL ON TABLE public.product_ingredients FROM anon;
REVOKE ALL ON TABLE public.product_addons FROM anon;

GRANT SELECT (id, name, active, sort_order, created_at, branch_id, counts_for_loyalty)
  ON public.categories TO anon;
GRANT SELECT (id, category_id, name, description, price, sector, active, created_at, branch_id, image_url)
  ON public.products TO anon;
GRANT SELECT (id, name, active, created_at, branch_id)
  ON public.ingredients TO anon;
GRANT SELECT (id, name, price, active, created_at, branch_id)
  ON public.addons TO anon;
GRANT SELECT ON public.product_ingredients TO anon;
GRANT SELECT ON public.product_addons TO anon;

-- Zonas sao publicas para calcular o frete no checkout, mas a policy publica
-- nao pode ser herdada por uma sessao autenticada e reabrir outra filial.
DROP POLICY IF EXISTS "Public read active delivery_zones" ON public.delivery_zones;
CREATE POLICY "Public read active delivery_zones"
  ON public.delivery_zones FOR SELECT TO anon
  USING (active = TRUE AND public.is_public_branch(branch_id));

CREATE POLICY "Equipe le zonas da filial"
  ON public.delivery_zones FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

REVOKE ALL ON TABLE public.delivery_zones FROM anon;
GRANT SELECT (id, branch_id, neighborhood, neighborhood_normalized, fee, active, created_at, updated_at)
  ON public.delivery_zones TO anon;

-- --------------------------------------------------------------------------
-- Pedidos e filhos
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Equipe gerencia pedidos" ON public.orders;
DROP POLICY IF EXISTS "Admin gerencia pedidos" ON public.orders;
DROP POLICY IF EXISTS "Attendant le pedidos" ON public.orders;

CREATE POLICY "Equipe le pedidos da filial"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND public.can_access_branch(branch_id)
  );

CREATE POLICY "Administrador gerencia pedidos da filial"
  ON public.orders FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id))
  WITH CHECK (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id));

DROP POLICY IF EXISTS "Courier le proprios pedidos" ON public.orders;
CREATE POLICY "Courier le proprios pedidos"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COURIER'
    AND EXISTS (
      SELECT 1 FROM public.couriers AS c
      WHERE c.id = orders.courier_id
        AND c.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia itens de pedido" ON public.order_items;
DROP POLICY IF EXISTS "Admin gerencia itens de pedido" ON public.order_items;
DROP POLICY IF EXISTS "Attendant le itens de pedido" ON public.order_items;

CREATE POLICY "Equipe le itens de pedidos da filial"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = order_items.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia itens de pedidos da filial"
  ON public.order_items FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = order_items.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = order_items.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Courier le itens proprios" ON public.order_items;
CREATE POLICY "Courier le itens proprios"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'COURIER'
    AND EXISTS (
      SELECT 1
      FROM public.orders AS o
      JOIN public.couriers AS c ON c.id = o.courier_id
      WHERE o.id = order_items.order_id
        AND c.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia removidos" ON public.order_item_removed_ingredients;
DROP POLICY IF EXISTS "Admin gerencia removidos" ON public.order_item_removed_ingredients;
DROP POLICY IF EXISTS "Attendant le removidos" ON public.order_item_removed_ingredients;

CREATE POLICY "Equipe le removidos da filial"
  ON public.order_item_removed_ingredients FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_removed_ingredients.order_item_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia removidos da filial"
  ON public.order_item_removed_ingredients FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_removed_ingredients.order_item_id
        AND public.can_manage_branch(o.branch_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_removed_ingredients.order_item_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia addons do item" ON public.order_item_addons;
DROP POLICY IF EXISTS "Admin gerencia addons do item" ON public.order_item_addons;
DROP POLICY IF EXISTS "Attendant le addons do item" ON public.order_item_addons;

CREATE POLICY "Equipe le adicionais de item da filial"
  ON public.order_item_addons FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_addons.order_item_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia adicionais de item da filial"
  ON public.order_item_addons FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_addons.order_item_id
        AND public.can_manage_branch(o.branch_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS oi
      JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.id = order_item_addons.order_item_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

-- --------------------------------------------------------------------------
-- Caixa, pagamentos, descontos, impressao e mensagens
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Equipe gerencia caixas" ON public.cash_sessions;
DROP POLICY IF EXISTS "Admin gerencia caixas" ON public.cash_sessions;
DROP POLICY IF EXISTS "Attendant le caixas" ON public.cash_sessions;

CREATE POLICY "Equipe le caixas da filial"
  ON public.cash_sessions FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND public.can_access_branch(branch_id)
  );

CREATE POLICY "Administrador gerencia caixas da filial"
  ON public.cash_sessions FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id))
  WITH CHECK (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id));

DROP POLICY IF EXISTS "Equipe gerencia pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Equipe le pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Admin gerencia pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Admin escreve pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Admin atualiza pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Admin apaga pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Attendant le pagamentos" ON public.payments;

CREATE POLICY "Equipe le pagamentos da filial"
  ON public.payments FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador cria pagamentos da filial"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador atualiza pagamentos da filial"
  ON public.payments FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador remove pagamentos da filial"
  ON public.payments FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia descontos" ON public.discounts;
DROP POLICY IF EXISTS "Admin gerencia descontos" ON public.discounts;
DROP POLICY IF EXISTS "Attendant le descontos" ON public.discounts;

CREATE POLICY "Equipe le descontos da filial"
  ON public.discounts FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = discounts.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "Administrador gerencia descontos da filial"
  ON public.discounts FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = discounts.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  )
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = discounts.order_id
        AND public.can_manage_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia printer_jobs" ON public.printer_jobs;
DROP POLICY IF EXISTS "Admin gerencia printer_jobs" ON public.printer_jobs;
DROP POLICY IF EXISTS "Attendant le e atualiza printer_jobs" ON public.printer_jobs;
DROP POLICY IF EXISTS "Attendant atualiza status printer_jobs" ON public.printer_jobs;
DROP POLICY IF EXISTS "Attendant le printer_jobs" ON public.printer_jobs;

CREATE POLICY "Equipe le impressoes da filial"
  ON public.printer_jobs FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND public.can_access_branch(branch_id)
  );

CREATE POLICY "Administrador gerencia impressoes da filial"
  ON public.printer_jobs FOR ALL TO authenticated
  USING (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id))
  WITH CHECK (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id));

DROP POLICY IF EXISTS "Equipe gerencia whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Equipe le whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin gerencia whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "Equipe le mensagens da filial"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND public.can_access_branch(branch_id)
  );

CREATE POLICY "Administrador atualiza mensagens da filial"
  ON public.whatsapp_messages FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id))
  WITH CHECK (public.get_my_role() = 'ADMIN' AND public.can_manage_branch(branch_id));

-- Transacoes do provedor sao lidas somente no escopo do pedido. Escrita segue
-- exclusiva das Edge Functions com service_role.
DROP POLICY IF EXISTS "Equipe le payment transactions" ON public.payment_transactions;
CREATE POLICY "Equipe le transacoes de pagamento da filial"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payment_transactions.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Admin gerencia payment method configs" ON public.payment_method_configs;
CREATE POLICY "Administrador global gerencia metodos de pagamento"
  ON public.payment_method_configs FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

-- Programa de fidelidade e uma regra da rede. Administradores locais leem a
-- configuracao efetiva, mas somente o global altera o programa.
DROP POLICY IF EXISTS "Admin escreve loyalty_programs" ON public.loyalty_programs;
CREATE POLICY "Administrador global escreve loyalty_programs"
  ON public.loyalty_programs FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

-- --------------------------------------------------------------------------
-- Clientes: remove a leitura global implícita de PII por qualquer operador.
-- O cadastro continua compartilhado para deduplicacao, mas uma sessao interna
-- so enxerga cliente/endereco quando existe pedido em filial autorizada.
-- Escritas permanecem exclusivamente nas Edge Functions com service_role.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Equipe le customers" ON public.customers;
DROP POLICY IF EXISTS "Admin gerencia customers" ON public.customers;
REVOKE ALL ON TABLE public.customers FROM authenticated;
GRANT SELECT ON TABLE public.customers TO authenticated;

CREATE POLICY "Equipe le clientes do escopo"
  ON public.customers FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.customer_id = customers.id
        AND public.can_access_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe le customer_addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Admin gerencia customer_addresses" ON public.customer_addresses;
REVOKE ALL ON TABLE public.customer_addresses FROM authenticated;
GRANT SELECT ON TABLE public.customer_addresses TO authenticated;

CREATE POLICY "Equipe le enderecos de clientes do escopo"
  ON public.customer_addresses FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.customer_id = customer_addresses.customer_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_customer_branch
  ON public.orders (customer_id, branch_id)
  WHERE customer_id IS NOT NULL;

DROP POLICY IF EXISTS "Equipe le loyalty_accounts" ON public.loyalty_accounts;
REVOKE ALL ON TABLE public.loyalty_accounts FROM authenticated;
GRANT SELECT ON TABLE public.loyalty_accounts TO authenticated;
CREATE POLICY "Equipe le fidelidade de clientes do escopo"
  ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.customer_id = loyalty_accounts.customer_id
        AND public.can_access_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe le loyalty_rewards" ON public.loyalty_rewards;
REVOKE ALL ON TABLE public.loyalty_rewards FROM authenticated;
GRANT SELECT ON TABLE public.loyalty_rewards TO authenticated;
CREATE POLICY "Equipe le recompensas de clientes do escopo"
  ON public.loyalty_rewards FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1
      FROM public.loyalty_accounts AS account
      JOIN public.orders AS o ON o.customer_id = account.customer_id
      WHERE account.id = loyalty_rewards.account_id
        AND public.can_access_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe le loyalty_transactions" ON public.loyalty_transactions;
REVOKE ALL ON TABLE public.loyalty_transactions FROM authenticated;
GRANT SELECT ON TABLE public.loyalty_transactions TO authenticated;
CREATE POLICY "Equipe le movimentos de fidelidade do escopo"
  ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1
      FROM public.loyalty_accounts AS account
      JOIN public.orders AS o ON o.customer_id = account.customer_id
      WHERE account.id = loyalty_transactions.account_id
        AND public.can_access_branch(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Equipe le loyalty_stamp_credits" ON public.loyalty_stamp_credits;
REVOKE ALL ON TABLE public.loyalty_stamp_credits FROM authenticated;
GRANT SELECT ON TABLE public.loyalty_stamp_credits TO authenticated;
CREATE POLICY "Equipe le creditos de selo do escopo"
  ON public.loyalty_stamp_credits FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('ADMIN', 'ATTENDANT')
    AND EXISTS (
      SELECT 1
      FROM public.order_items AS item
      JOIN public.orders AS o ON o.id = item.order_id
      WHERE item.id = loyalty_stamp_credits.order_item_id
        AND public.can_access_branch(o.branch_id)
    )
  );
