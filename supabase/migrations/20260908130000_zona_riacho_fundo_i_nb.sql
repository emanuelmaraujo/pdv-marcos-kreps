-- Migration: zona de entrega "Riacho Fundo I" no Núcleo Bandeirante
-- Date: 2026-09-08
--
-- Problema: o NB já tinha a zona "Riacho Fundo", mas nenhum pedido do Riacho
-- Fundo passava. O match de zona (supabase/functions/_shared/delivery.ts) é
-- feito contra o bairro que o ViaCEP devolve, nunca contra o texto digitado —
-- e nos CEPs do Riacho Fundo I (71805-100 a 71829-001) os Correios/ViaCEP
-- devolvem "Riacho Fundo I", com o numeral. Normalizado, "riacho fundo i" não
-- bate com "riacho fundo", então o checkout caía em "Não realizamos entregas
-- nesse bairro no momento".
--
-- Correção: cadastra a zona "Riacho Fundo I" no NB com a mesma taxa que já
-- estava na zona "Riacho Fundo" (R$ 10,00). A linha antiga é mantida de
-- propósito — não atrapalha (o match é exato) e cobre o caso de algum CEP
-- devolver o nome da região administrativa sem numeral.
--
-- Para desfazer:
--   DELETE FROM delivery_zones
--    WHERE neighborhood_normalized = 'riacho fundo i'
--      AND branch_id = (SELECT id FROM branches WHERE slug = 'nb');

INSERT INTO delivery_zones (branch_id, neighborhood, neighborhood_normalized, fee, active)
SELECT
  b.id,
  'Riacho Fundo I',
  'riacho fundo i',
  COALESCE(
    (SELECT z.fee
       FROM delivery_zones z
      WHERE z.branch_id = b.id
        AND z.neighborhood_normalized = 'riacho fundo'),
    10.00
  ),
  TRUE
FROM branches b
WHERE b.slug = 'nb'
ON CONFLICT (branch_id, neighborhood_normalized) DO NOTHING;
