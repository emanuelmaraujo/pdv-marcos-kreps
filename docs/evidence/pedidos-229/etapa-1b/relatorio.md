# Etapa 1B — evidências locais (preparo e entrega por unidade)

Data: 2026-10-28. Branch `cez/74b5ea0d-etapa-1b`, empilhada sobre a 1A (`cez/74b5ea0d`, PR #236).
Tudo foi executado em instância Supabase descartável (Docker, portas 554xx) com catálogo sintético
e no Next.js local. Não há migration remota, deploy, mensagem real de WhatsApp/Push nem impressão física.

A primeira versão deste relatório afirmava concorrência entre operadores sem QA executado. A revisão
dirigida abaixo substitui aquela versão; os resultados da seção 3 são das execuções atuais.

## 1. Revisão dirigida: problemas comprovados e correções

| # | Problema comprovado | Correção |
| --- | --- | --- |
| 1 | WhatsApp/Push de “parte pronta”/“pronto” não saíam pelo quadro: a RPC era chamada direto do navegador e os avisos só existem nas Edge Functions. | Quadro chama `update-order-item-status` em `mode: 'batch'`; a função executa a RPC com o JWT do operador e avisa uma vez, só na transição real `NA_FILA→PRONTO_PARCIAL` ou `→PRONTO`. |
| 2 | RPC aceitava retrocesso (`READY→PENDING/IN_PREPARATION`), salto `PENDING→DELIVERED` e `CANCELLED` por unidade sem ajuste de valor. | Máquina de estados só de avanço; `DELIVERED` exige `READY`; `PENDING`/`CANCELLED` rejeitados (cancelamento segue pela linha/pedido). |
| 3 | Lote vazio, IDs inexistentes, de outro pedido ou de revisão anterior eram ignorados em silêncio com `success`. | Rejeição do lote inteiro (`22023`; unidade obsoleta `40001`). Alvo já atingido é ignorado sem auditoria (idempotência). |
| 4 | `recompute_order_status_from_items` passou a congelar `ENTREGUE`/`CANCELADO` e virou `SECURITY DEFINER` executável por `PUBLIC`. Quebrava `restore-cancelled-order` e acréscimo após entrega (`add-items-to-order`). | Semântica, `SECURITY INVOKER` e `search_path` legados restaurados; só a contagem passou a considerar unidades. |
| 5 | Comando legado “pedido pronto” regredia unidade já entregue para `READY`; cancelamento perdia o estado das unidades. | Espelho legado só avança unidades atrasadas, nunca toca unidade entregue em reversões e guarda/restaura o estado no cancelamento. |
| 6 | Sincronização unidade→linha (fora de trigger) reativava o espelho legado e avançava unidades irmãs. | Flag de transação `pdv.units_to_item_sync`; recálculo único no fim do lote (`pdv.production_batch`). |
| 7 | (revisão independente, B1) Linha com unidade entregue podia ser cancelada — inclusive pelo cancelamento do pedido —, deixando de cobrar o que foi consumido. | Gatilho `BEFORE UPDATE` rejeita `→CANCELLED` com unidade `DELIVERED` ativa; cartão de detalhe mostra “Parte entregue · sem cancelamento”. |

Itens da revisão independente mantidos como acompanhamento (não bloqueantes, sem dano de dados):
deadlock possível (`40P01`, rollback atômico) entre lote e comando legado simultâneos no mesmo item;
linha editada em preparo mantém status antigo até a próxima ação; linha `{DELIVERED, PENDING}` aparece
“Em preparo”; progresso do `OrderCard` conta unidades de linhas canceladas e ignora itens sem setor;
aviso pode se perder se a função cair entre o commit e o envio; botões visíveis em `SAIU_PARA_ENTREGA`
(a RPC rejeita).

## 2. Migration necessária (aprovação humana antes de qualquer ambiente remoto)

- `supabase/migrations/20261028120000_production_unit_lifecycle.sql` — aditiva em `production_handoff_units`
  (`prep_status`, carimbos, `prep_status_before_cancel`, `prep_actor_id`, `prep_version`), funções privadas
  de sincronização/guarda, `public.batch_update_production_status` e redefinição compatível de
  `recompute_order_status_from_items`. Depende da migration da 1A (`20261027161003_production_handoff.sql`).
- Edge Function `update-order-item-status` alterada (modo `batch`), publicada junto com a migration.

## 3. Verificações executadas

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Documentação, backend, tipos, lint, Vitest | `npm run docs:check && npm run supabase:check && npm run typecheck && npm run lint && npm test` | PASS — 48 Markdown; 40 funções/84 migrations; 40 arquivos/310 testes |
| Build padrão | `npm run build` (Turbopack, ambiente loopback do CI) | PASS — 30 páginas |
| pgTAP descartável | `node scripts/test-database.mjs` | PASS — 10 arquivos/197 testes (27 novos da revisão + guarda B1) |
| Dois operadores HTTP + legado + navegador | `--production-qa` (`docs/evidence/pedidos-229/qa-etapa-1b.mjs`) | PASS — 3 blocos (corrida HTTP, legado, navegador com 11 capturas) |
| Regressão COD (#221) | `--cod-e2e` (`scripts/cod-e2e-flow.mjs`) | PASS — 46 verificações |

O QA com dois operadores cobre:
- corrida de lotes sobrepostos (cada unidade muda uma vez, auditoria sem duplicidade);
- comando atrasado sem retrocesso e salto para entregue rejeitado;
- avisos `order_partial_ready` e `order_ready` exatamente uma vez, nenhum aviso na entrega parcial
  (clientes com opt-out: só linhas `SKIPPED`, nenhum envio);
- entrega dupla da mesma unidade vira uma entrega; `payment_status`/`total_amount` inalterados;
- legado: “pedido pronto” não regride unidade entregue, cancelar linha parcialmente entregue é
  rejeitado, “entregar pedido” conclui as unidades;
- navegador real (`/app/pedidos`): operador 1 marca uma unidade, operador 2 vê sem recarregar e
  conclui o item em lote, operador 1 entrega só as prontas; itens restantes e sem setor seguem
  visíveis; alvos ≥ 44 px; sem overflow em 320/390/768/1440; offline bloqueia o preparo e mantém o
  cartão.

## 4. Capturas reais da aplicação

`card-390-inicial.png`, `card-390-parcial.png`, `offline-390.png` e `quadro-{320,390,768,1440}-{light,dark}.png`.

Observações de UX vistas nas capturas (acompanhamento, sem bloqueio):
- unidades entregues continuam como cartões grandes; recolher como o repasse confirmado da 1A;
- “Entregar prontas” aparece no topo do cartão e “Entregar prontos” no rodapé (ação repetida);
- `card-390-parcial.png` é captura de elemento e sobrepõe o cabeçalho fixo (artefato da captura).

## 5. Diferenças em relação ao protótipo

- Sem seleção livre de várias unidades por checkbox: o lote é por item (“Todas prontas”, “Entregar prontas”)
  ou pelo pedido (“Entregar prontas” no topo), com menos toques no fluxo comum.
- Não há “desfazer” por unidade: retrocesso continua pelo comando de pedido (`PRONTO → NA_FILA`).
- Cancelamento por unidade, presente como ideia no estudo, não existe: depende da etapa de pagamentos.

## 6. Não verificado

Operadores reais, teclado virtual, impressão física, Realtime em produção, migração aplicada e entrega
real de WhatsApp/Push.
