-- Migration: liga o Realtime na tabela `orders`.
--
-- Contexto: o frontend já assina `postgres_changes` em `orders` há tempos
-- (quadro de pedidos e tela do motoboy), mas a publicação `supabase_realtime`
-- estava VAZIA no banco — nenhuma tabela publicada, nenhum evento entregue.
-- Na prática o canal conectava, reportava SUBSCRIBED e nunca disparava nada:
-- toda atualização dependia só do polling. É exatamente por isso que um pedido
-- despachado demorava a aparecer para o motoboy.
--
-- Escopo deliberado: só `orders`. É a tabela que carrega despacho
-- (SAIU_PARA_ENTREGA/dispatched_at/courier_id) e confirmação de entrega
-- (ENTREGUE), que é o que as telas precisam saber na hora. `order_items`
-- ficou de fora de propósito — um pedido com muitos itens gera uma rajada de
-- eventos por pedido e o polling curto já cobre esse caso.
--
-- Segurança: Realtime aplica RLS por assinante. O motoboy continua recebendo
-- evento apenas dos pedidos em que `couriers.profile_id = auth.uid()`
-- (policy "Courier le proprios pedidos", migration 20260820000100).
--
-- REPLICA IDENTITY fica no padrão (primary key): as telas usam o evento apenas
-- como gatilho para refazer a busca, não consomem o registro antigo — e FULL
-- multiplicaria o volume de WAL sem ganho nenhum aqui.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;
