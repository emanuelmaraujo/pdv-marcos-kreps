-- Migration: foto padrão nas bebidas
-- Date: 2026-09-05
--
-- Preenche products.image_url das bebidas com as ilustrações que vão junto com
-- o app (public/cardapio/bebidas/*.svg). Como são arquivos servidos pelo
-- próprio site, não dependem de host externo, não expiram e não quebram por
-- bloqueio de hotlink — ao contrário de link colado de fora.
--
-- Regras de segurança da migration:
--   * só mexe em produto que está SEM foto (image_url IS NULL) — nunca
--     sobrescreve o que o admin já cadastrou;
--   * só mexe em produto de categoria de bebida, em qualquer filial;
--   * casa por nome, sem acento e sem caixa, então pega "Coca Zero 600ml",
--     "COCA ZERO 600ML" e "coca zero 600 ml" do mesmo jeito.
--
-- Trocar por foto de verdade depois é só colar o link no cadastro do produto.
-- Para desfazer tudo:
--   UPDATE products SET image_url = NULL WHERE image_url LIKE '/cardapio/%';

WITH sem_acento AS (
  SELECT
    p.id,
    translate(lower(p.name),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc') AS n
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.image_url IS NULL
    AND translate(lower(c.name),
                  'áàâãäéèêëíìîïóòôõöúùûüç',
                  'aaaaaeeeeiiiiooooouuuuc') LIKE '%bebida%'
),
arte AS (
  SELECT
    id,
    CASE
      -- ── Refrigerante de cola ──────────────────────────────────────────
      -- "cola" solto só vale como palavra inteira, senão "chocolate" entrava.
      WHEN (n LIKE '%coca%' OR n LIKE '%pepsi%' OR n ~ '(^|[^a-z])cola([^a-z]|$)')
           AND (n LIKE '%zero%' OR n LIKE '%light%' OR n LIKE '%diet%' OR n LIKE '%sem acucar%')
        THEN CASE WHEN n LIKE '%lata%' OR n LIKE '%350%'
                  THEN '/cardapio/bebidas/refri-cola-lata-zero.svg'
                  ELSE '/cardapio/bebidas/refri-cola-600-zero.svg' END
      WHEN (n LIKE '%coca%' OR n LIKE '%pepsi%' OR n ~ '(^|[^a-z])cola([^a-z]|$)')
        THEN CASE WHEN n LIKE '%lata%' OR n LIKE '%350%'
                  THEN '/cardapio/bebidas/refri-cola-lata.svg'
                  ELSE '/cardapio/bebidas/refri-cola-600.svg' END

      -- ── Guaraná ───────────────────────────────────────────────────────
      WHEN n LIKE '%guarana%'
           AND (n LIKE '%zero%' OR n LIKE '%light%' OR n LIKE '%diet%' OR n LIKE '%sem acucar%')
        THEN CASE WHEN n LIKE '%lata%' OR n LIKE '%350%'
                  THEN '/cardapio/bebidas/refri-guarana-lata-zero.svg'
                  ELSE '/cardapio/bebidas/refri-guarana-600-zero.svg' END
      WHEN n LIKE '%guarana%'
        THEN CASE WHEN n LIKE '%lata%' OR n LIKE '%350%'
                  THEN '/cardapio/bebidas/refri-guarana-lata.svg'
                  ELSE '/cardapio/bebidas/refri-guarana-600.svg' END

      -- ── Água / água saborizada ────────────────────────────────────────
      -- "Polpa + Água" é suco batido, não garrafa de água.
      WHEN (n LIKE '%h2o%' OR n LIKE '%agua%')
           AND n NOT LIKE '%polpa%' AND n NOT LIKE '%suco%'
        THEN '/cardapio/bebidas/agua-saborizada.svg'

      -- ── Soda italiana ─────────────────────────────────────────────────
      WHEN n LIKE '%soda%' THEN '/cardapio/bebidas/soda-italiana.svg'

      -- ── Sucos: combinações primeiro, depois sabor único ───────────────
      WHEN n LIKE '%acai%' THEN '/cardapio/bebidas/suco-acai.svg'
      WHEN n LIKE '%laranja%' AND n LIKE '%morango%' THEN '/cardapio/bebidas/suco-laranja-morango.svg'
      WHEN n LIKE '%laranja%' AND n LIKE '%acerola%' THEN '/cardapio/bebidas/suco-laranja-acerola.svg'
      WHEN n LIKE '%abacaxi%' THEN '/cardapio/bebidas/suco-abacaxi-hortela.svg'
      WHEN n LIKE '%acerola%' THEN '/cardapio/bebidas/suco-acerola.svg'
      WHEN n LIKE '%maracuja%' THEN '/cardapio/bebidas/suco-maracuja.svg'
      WHEN n LIKE '%morango%' THEN '/cardapio/bebidas/suco-morango.svg'
      WHEN n LIKE '%limao%' THEN '/cardapio/bebidas/suco-limao.svg'
      WHEN n LIKE '%laranja%' THEN '/cardapio/bebidas/suco-laranja.svg'
      WHEN n LIKE '%manga%' THEN '/cardapio/bebidas/suco-manga.svg'
      WHEN n LIKE '%caju%' THEN '/cardapio/bebidas/suco-caju.svg'
      WHEN n LIKE '%caja%' THEN '/cardapio/bebidas/suco-caja.svg'
      WHEN n LIKE '%cupuacu%' THEN '/cardapio/bebidas/suco-cupuacu.svg'
      WHEN n LIKE '%uva%' THEN '/cardapio/bebidas/suco-uva.svg'
      WHEN n LIKE '%goiaba%' THEN '/cardapio/bebidas/suco-goiaba.svg'

      -- ── Genéricos (outras filiais usam nome curto) ────────────────────
      WHEN n LIKE '%refrigerante%'
        THEN CASE WHEN n LIKE '%lata%' OR n LIKE '%350%'
                  THEN '/cardapio/bebidas/refri-cola-lata.svg'
                  ELSE '/cardapio/bebidas/refri-cola-600.svg' END
      WHEN n LIKE '%suco%' OR n LIKE '%polpa%' THEN '/cardapio/bebidas/suco-natural.svg'

      ELSE NULL
    END AS url
  FROM sem_acento
)
UPDATE products p
   SET image_url = arte.url
  FROM arte
 WHERE arte.id = p.id
   AND arte.url IS NOT NULL;
