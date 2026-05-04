-- Migration: Init PDV Schema (Revisado)
-- Description: Criação da fundação do banco de dados para o PDV Marcos Krep's
-- Author: Antigravity

-- ==========================================
-- 1. ENUMS (Tipos Estruturados)
-- ==========================================

-- Papéis de usuário
CREATE TYPE user_role AS ENUM ('ADMIN', 'ATTENDANT');

-- Setor de produção
CREATE TYPE production_sector AS ENUM ('KITCHEN', 'JUICE_POTATO', 'NONE');

-- Tipo de pedido
CREATE TYPE order_type AS ENUM ('BALCAO', 'VIAGEM');

-- Origem do pedido
CREATE TYPE order_source AS ENUM ('ATTENDANT', 'QR_CODE', 'WHATSAPP');

-- Status do pedido no fluxo de trabalho
CREATE TYPE order_status AS ENUM (
  'AGUARDANDO_CONFIRMACAO',
  'AGUARDANDO_PAGAMENTO',
  'NA_FILA',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
  'EXPIRADO'
);

-- Status do pagamento
CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'PAID',
  'REFUNDED',
  'CANCELED',
  'COURTESY'
);

-- Métodos de pagamento
CREATE TYPE payment_method AS ENUM (
  'PIX',
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'PENDING',
  'COURTESY'
);

-- ==========================================
-- 2. TABELAS
-- ==========================================

-- Perfil de Usuários (Integrado com auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'ATTENDANT',
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurações Globais (Settings)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias do Cardápio
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produtos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  sector production_sector NOT NULL DEFAULT 'NONE',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingredientes (Cadastro global de ingredientes)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingredientes Padrão do Produto (Tabela Associativa)
CREATE TABLE product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

-- Addons (Adicionais pagos globais)
CREATE TABLE addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessões de Caixa
CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opened_by UUID NOT NULL REFERENCES profiles(id),
  closed_by UUID REFERENCES profiles(id),
  initial_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(10, 2),
  notes TEXT
);

-- Pedidos (Orders)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_number INTEGER NOT NULL,
  -- Token hexadecimal seguro gerado automaticamente para o cliente
  public_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  type order_type NOT NULL DEFAULT 'BALCAO',
  source order_source NOT NULL DEFAULT 'ATTENDANT',
  status order_status NOT NULL DEFAULT 'AGUARDANDO_CONFIRMACAO',
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  payment_method payment_method NOT NULL DEFAULT 'PENDING',
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  discount_applied_by UUID REFERENCES profiles(id),
  packing_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id), -- Null se criado via QR Code (Edge Function)
  confirmed_by UUID REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Itens do Pedido
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  product_price_snapshot NUMERIC(10, 2) NOT NULL,
  production_sector production_sector NOT NULL DEFAULT 'NONE',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  observation TEXT,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingredientes Removidos do Item
CREATE TABLE order_item_removed_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Addons Incluídos no Item
CREATE TABLE order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  addon_name_snapshot TEXT NOT NULL,
  addon_price_snapshot NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de Pagamentos do Pedido
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL,
  received_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de Descontos do Pedido
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('AMOUNT', 'PERCENT')),
  value NUMERIC(10, 2) NOT NULL,
  amount_applied NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  granted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila de Impressão
CREATE TABLE printer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sector TEXT NOT NULL, -- 'KITCHEN', 'JUICE_POTATO', 'CUSTOMER'
  status TEXT NOT NULL DEFAULT 'PENDING',
  content JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila de Mensagens do WhatsApp
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trilha de Auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- Ex: ORDER_CREATED, ORDER_CONFIRMED, PAYMENT_MARKED_PAID, etc.
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. ÍNDICES DE PERFORMANCE E BUSCA
-- ==========================================
CREATE INDEX idx_orders_public_token ON orders(public_token);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_printer_jobs_status ON printer_jobs(status) WHERE status = 'PENDING';
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status) WHERE status = 'PENDING';

-- ==========================================
-- 4. FUNÇÕES (RPC) E TRIGGERS
-- ==========================================

-- Utilitário seguro para ler o cargo (role) do usuário logado
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Gera número sequencial diário do pedido com Advisory Lock para evitar concorrência
CREATE OR REPLACE FUNCTION get_next_daily_order_number()
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Cria um bloqueio exclusivo transacional com chave arbitrária (ex: 1001)
  -- Isso enfileira chamadas simultâneas, prevenindo que dois pedidos peguem o mesmo número.
  PERFORM pg_advisory_xact_lock(1001);
  
  -- Busca o maior daily_number de hoje (considerando o fuso horário de Brasília)
  SELECT COALESCE(MAX(daily_number), 0) + 1 INTO next_num
  FROM orders
  WHERE date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo');
  
  RETURN next_num;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger para preencher daily_number no INSERT se for nulo
CREATE OR REPLACE FUNCTION set_daily_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.daily_number IS NULL THEN
    NEW.daily_number := get_next_daily_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_daily_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION set_daily_order_number();

-- Trigger padrão para atualizar timestamp (updated_at)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_printer_jobs_updated_at BEFORE UPDATE ON printer_jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) E POLICIES
-- ==========================================

-- Habilitação Geral
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_removed_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 Cardápio: Público/Anon apenas lê itens ativos. Gestão apenas ADMIN.
-- (Importante para que as Edge Functions possam expor os dados para o app público, ou o app possa ler direto com chave anon).
CREATE POLICY "Public read active categories" ON categories FOR SELECT USING (active = true);
CREATE POLICY "Admin control categories" ON categories FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

CREATE POLICY "Public read active products" ON products FOR SELECT USING (active = true);
CREATE POLICY "Admin control products" ON products FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

CREATE POLICY "Public read active ingredients" ON ingredients FOR SELECT USING (active = true);
CREATE POLICY "Admin control ingredients" ON ingredients FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

CREATE POLICY "Public read product_ingredients" ON product_ingredients FOR SELECT USING (true);
CREATE POLICY "Admin control product_ingredients" ON product_ingredients FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

CREATE POLICY "Public read active addons" ON addons FOR SELECT USING (active = true);
CREATE POLICY "Admin control addons" ON addons FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

-- 5.2 Settings & Profiles
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin control settings" ON settings FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

CREATE POLICY "Equipe le profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin controla profiles" ON profiles FOR ALL TO authenticated USING (get_my_role() = 'ADMIN');

-- 5.3 Pedidos (Estritamente Protegidos)
-- Regra de Ouro: Usuários anon/public NÃO têm permissão de INSERT em orders e order_items.
-- Toda a criação e modificação para o público (ex: QR Code) DEVE ser feita por uma Edge Function autenticada com Service Role.
CREATE POLICY "Equipe gerencia pedidos" ON orders FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia itens de pedido" ON order_items FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia removidos" ON order_item_removed_ingredients FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia addons do item" ON order_item_addons FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

-- 5.4 Filas, Caixa e Auditoria
CREATE POLICY "Equipe gerencia caixas" ON cash_sessions FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia pagamentos" ON payments FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia descontos" ON discounts FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia printer_jobs" ON printer_jobs FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));
CREATE POLICY "Equipe gerencia whatsapp_messages" ON whatsapp_messages FOR ALL TO authenticated USING (get_my_role() IN ('ADMIN', 'ATTENDANT'));

CREATE POLICY "Apenas Admin ve logs de auditoria" ON audit_logs FOR SELECT TO authenticated USING (get_my_role() = 'ADMIN');
-- Obs: Inserções em audit_logs serão feitas via Edge Functions com o Service Role (bypass RLS).
