-- Fix de drift: addons.sort_order e products.sort_order são usados por
-- 20260521120000_feira_candangolandia_menu.sql (e pela migration seguinte de
-- Águas Claras) mas nunca foram criados por nenhuma migration anterior. Isso
-- quebra `supabase db reset` a partir do zero. Aditiva, sem impacto em dados
-- existentes — mesma coluna/default que já existe em `categories`.
ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
