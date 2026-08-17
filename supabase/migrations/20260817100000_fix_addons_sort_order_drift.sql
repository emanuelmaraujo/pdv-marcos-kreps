-- Fix de drift: addons.sort_order e products.sort_order são usados por
-- 20260521120000_feira_candangolandia_menu.sql (e pela migration seguinte de
-- Águas Claras) mas nunca foram criados por nenhuma migration. Em produção
-- essas colunas provavelmente já existem (drift manual fora de migration —
-- é por isso que o seed original rodou sem erro lá), então este ALTER é
-- idempotente/no-op remotamente.
--
-- Nomeada com timestamp de hoje (não da data do bug) de propósito: uma
-- migration com timestamp anterior ao último já aplicado no banco remoto
-- faz `supabase db push` recusar rodar (exige --include-all, que o CI de
-- deploy não usa) — isso já derrubou um deploy real. Rodar depois dos seeds
-- é seguro aqui porque é idempotente; só significa que um `supabase db
-- reset` do zero num ambiente local ainda quebra nos seeds de Feira
-- Candangolandia/Aguas Claras ate esta migration rodar depois deles — use
-- `supabase db push --include-all` uma unica vez nesse caso especifico, ou
-- rode este ALTER manualmente antes do reset local.
ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
