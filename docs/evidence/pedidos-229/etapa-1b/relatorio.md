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

### Rodada de qualidade operacional (2026-10-29)

| Ponto | Resultado |
| --- | --- |
| Contador de progresso | `production-progress.ts`: conta unidades de todos os setores (sem repasse pela quantidade), ignora linhas e unidades canceladas. |
| Unidades entregues | Recolhidas num resumo por item (“Todas as 3 entregues · 10:28”); ao expandir, horário e histórico de repasse por unidade. |
| Ações duplicadas/indisponíveis | Faixa “Entregar prontas” do topo removida (fica o rodapé); lote por item só quando difere da unidade e do rodapé; “Entregar prontos” some quando nada está pronto; `SAIU_PARA_ENTREGA` sem ações de preparo/repasse; preparo bloqueado durante reenvio pendente do repasse. |
| Deadlock e conexão | Lote trava pedido→linhas→unidades, como `pay_order_items` (sem ciclo com pagamento). Com comando legado simultâneo (linha→pedido), `40P01` desfaz tudo e a função repete até 3 vezes; esgotado ou sem código → 503. No cartão, 4xx é definitivo e rede/5xx oferece “Repetir a última ação de preparo” (idempotente). |
| Avisos após commit | Fila `production_notification_outbox` gravada na transação da mudança; a função reivindica (lease 30 s), envia e marca o resultado real. Queda após commit: a repetição envia uma vez. Falha transitória do WhatsApp devolve à fila. “Parte pronta” não sai depois de “pronto” nem para pedido encerrado. |
| Cancelar unidades restantes | Proteção mantida. Proposta documentada para aprovação: [proposta-cancelamento-parcial.md](../../../archive/studies/pedidos-229/proposta-cancelamento-parcial.md). |

Revisão independente proporcional: **approve**, sem bloqueantes. Os 6 pontos não bloqueantes apontados
(ordem parcial/pronto, marcação sem verificar o envio, falha de transporte como erro definitivo, texto do guia,
botão de repetir durante o reenvio e lease) foram corrigidos nesta rodada.

Acompanhamento restante (sem dano de dados): linha editada em preparo mantém o status antigo até a
próxima ação; linha `{DELIVERED, PENDING}` aparece “Em preparo”; se a função cair no meio do envio, o
Push pode sair duplicado após o lease (WhatsApp não); aviso pendente só é reenviado no próximo comando
do mesmo pedido (sem rotina periódica).

## 2. Migration necessária (aprovação humana antes de qualquer ambiente remoto)

- `supabase/migrations/20261028120000_production_unit_lifecycle.sql` — aditiva em `production_handoff_units`
  (`prep_status`, carimbos, `prep_status_before_cancel`, `prep_actor_id`, `prep_version`), funções privadas
  de sincronização/guarda, `public.batch_update_production_status` e redefinição compatível de
  `recompute_order_status_from_items`. Depende da migration da 1A (`20261027161003_production_handoff.sql`).
- A mesma migration cria a fila `production_notification_outbox` e `claim_production_notifications` (só `service_role`).
- Edge Function `update-order-item-status` alterada (modo `batch`), publicada junto com a migration.

## 3. Verificações executadas

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Documentação, tipos, lint, Vitest afetados | `docs:check`, `typecheck`, `eslint` (pedidos, api), `npm test -- src/app/app/pedidos src/lib/api` | PASS — 49 Markdown; 6 arquivos/25 testes (rodada de 2026-10-29; suíte completa da rodada anterior: 310) |
| Build padrão | `npm run build` (Turbopack, ambiente loopback do CI) | PASS — 30 páginas |
| pgTAP descartável | `node scripts/test-database.mjs` | PASS — 10 arquivos/205 testes (inclui fila de avisos e permissões) |
| Dois operadores HTTP + legado + navegador | `--production-qa` (`docs/evidence/pedidos-229/qa-etapa-1b.mjs`) | PASS — 4 blocos (corrida HTTP, legado, queda após commit, navegador com 12 capturas) |
| Regressão COD (#221) | `--cod-e2e` (`scripts/cod-e2e-flow.mjs`) | PASS — 46 verificações |

O QA com dois operadores cobre:
- corrida de lotes sobrepostos (cada unidade muda uma vez, auditoria sem duplicidade);
- comando atrasado sem retrocesso e salto para entregue rejeitado;
- avisos `order_partial_ready` e `order_ready` exatamente uma vez, nenhum aviso na entrega parcial
  (clientes com opt-out: só linhas `SKIPPED`, nenhum envio);
- entrega dupla da mesma unidade vira uma entrega; `payment_status`/`total_amount` inalterados;
- queda da função após o commit: aviso fica na fila e sai uma vez na repetição; operador não lê a fila;
- legado: “pedido pronto” não regride unidade entregue, cancelar linha parcialmente entregue é
  rejeitado, “entregar pedido” conclui as unidades;
- navegador real (`/app/pedidos`): operador 1 marca uma unidade, operador 2 vê sem recarregar e
  conclui o item em lote, operador 1 entrega só as prontas pelo rodapé (o botão some quando nada mais está pronto); itens restantes e sem setor seguem
  visíveis; alvos ≥ 44 px; sem overflow em 320/390/768/1440; offline não deixa ação de preparo habilitada
  e mantém os itens.

## 4. Capturas reais da aplicação

`card-390-inicial.png`, `card-390-parcial.png`, `card-390-entregues.png`, `offline-390.png` e `quadro-{320,390,768,1440}-{light,dark}.png`.

Observações de UX vistas nas capturas (acompanhamento, sem bloqueio):
- resolvidos em 2026-10-29: unidades entregues recolhidas e ação de entrega única (ver `card-390-entregues.png`);
- `card-390-parcial.png` é captura de elemento e sobrepõe o cabeçalho fixo (artefato da captura).

## 5. Diferenças em relação ao protótipo

- Sem seleção livre de várias unidades por checkbox: o lote é por item (“Todas prontas”, “Entregar prontas”)
  ou pelo pedido (“Entregar prontos” no rodapé), com menos toques no fluxo comum.
- Não há “desfazer” por unidade: retrocesso continua pelo comando de pedido (`PRONTO → NA_FILA`).
- Cancelamento por unidade, presente como ideia no estudo, não existe: depende da etapa de pagamentos.

## 6. Não verificado

Operadores reais, teclado virtual, impressão física, Realtime em produção, migração aplicada e entrega
real de WhatsApp/Push.
