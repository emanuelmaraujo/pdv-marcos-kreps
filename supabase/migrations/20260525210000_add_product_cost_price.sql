-- Custo do produto + snapshot por item para preservar margem histórica.
--
-- products.cost_price          : custo unitário atual (editável a qualquer momento)
-- order_items.cost_price_snapshot : congelado no momento da venda — garante que
--                                   relatórios passados não distorcem se o custo
--                                   for atualizado depois.
--
-- Defaults em 0 para não quebrar pedidos antigos (margem aparente = 100% até
-- backfill manual de custos passados — comportamento esperado).

alter table products
  add column if not exists cost_price numeric(10, 2) not null default 0;

alter table order_items
  add column if not exists cost_price_snapshot numeric(10, 2) not null default 0;

comment on column products.cost_price is
  'Custo unitário do produto (R$). Usado para calcular margem real nos relatórios.';

comment on column order_items.cost_price_snapshot is
  'Custo unitário do produto no momento da venda. Imutável — preserva margem histórica.';
