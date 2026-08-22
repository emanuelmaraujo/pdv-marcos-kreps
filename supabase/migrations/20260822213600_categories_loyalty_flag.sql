-- Migration: Fidelidade — Fase 0 (governança)
-- Notes:
--   * Troca a ideia original de "lista fixa de category_id no código" por um
--     flag configurável na própria categoria, editável no cardápio (tela
--     /app/cardapio → aba Categorias). Resolve o risco documentado em
--     docs/plano-acao-fidelizacao.md: nomes de categoria não são padronizados
--     entre filiais (mistura "Kreps"/"Crepes"), e uma filial nova pode usar
--     um terceiro nome que um filtro por regex não pegaria. Com o flag, quem
--     abre a filial nova só marca a categoria certa na hora de cadastrar.
--   * Fase 1 (loyalty-accrue) vai ler este flag via
--     products.category_id → categories.counts_for_loyalty ao decidir quantos
--     selos um item paga. Esta migration só adiciona a coluna e faz o
--     backfill das categorias já identificadas em produção — não muda a
--     lógica de acúmulo (isso continua sendo 1 selo fixo por pedido até a
--     Fase 1 ser codada e deployada).

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS counts_for_loyalty BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN categories.counts_for_loyalty IS
  'Itens desta categoria contam como selo de fidelidade quando pagos (Fase 1). Configurável no cardápio.';

-- Backfill das categorias de Krep/Crepe já identificadas em produção em
-- 2026-08-19 (supabase db dump --linked) — idempotente e sem efeito em
-- ambientes onde esses IDs não existem (ex.: banco local recém-resetado).
UPDATE categories
   SET counts_for_loyalty = TRUE
 WHERE id IN (
   '0c5448da-c61e-4a43-9bd4-977adb062915', -- Kreps Salgados
   'c2292bf2-4f18-4386-95e5-4c5f94343088', -- Kreps Doces
   '56305d65-6629-423b-a1b7-5f4c399fcce9', -- Crepes Salgados
   '58cff8b4-5e05-4d48-9a89-bd76f036ef0b', -- Crepes Doces
   'cd07a00f-e845-4db5-86ff-52bb7f574c86', -- Crepes Salgados
   '2305eea7-2e34-4454-aa41-e77dea2d10a1'  -- Crepes Doces
 );
