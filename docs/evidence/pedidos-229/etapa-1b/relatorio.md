# Etapa 1B — Evidências Locais da Implementação

Data: 2026-10-28. Implementação 1B validada localmente na branch `cez/74b5ea0d-etapa-1b`.
Aplicação Next.js 16.3 e Supabase exclusivamente em banco local descartável, sem serviços reais ou dados de produção.
Estudos da arquitetura preservados em `docs/archive/studies/pedidos-229/proposta-etapa-1b.md`.

Resultados abaixo correspondem à implementação e testes automatizados locais.
Não há alegação de deploy, migração remota aplicada ou impressão física.

---

## 1. Escopo do Diff

- **Modelagem Transacional & Migration:**
  - Arquivo: `supabase/migrations/20261028120000_production_unit_lifecycle.sql`.
  - Adição de campos de ciclo de vida em `public.production_handoff_units`:
    `prep_status`, `prep_started_at`, `ready_at`, `delivered_at`, `cancelled_at`, `prep_actor_id`, `prep_version`.
  - RPC Atômica `public.batch_update_production_status(p_order_id, p_unit_ids, p_item_ids, p_new_status, p_reason)` com locks ordenados por ID (`FOR UPDATE`) para pedidos, itens e unidades.
  - Gatilho reativo `sync_item_status_from_units` derivando o status de cada `order_items` a partir de suas unidades, com trava contra ciclos recursivos (`pg_trigger_depth() > 1`).
  - Atualização do cálculo agregado em `recompute_order_status_from_items` para suporte a `PRONTO_PARCIAL` e preservação dos estados finais (`SAIU_PARA_ENTREGA`, `ENTREGUE`, `CANCELADO`).
- **Frontend & UX:**
  - `src/types/pdv.ts`: Contratos estendidos de `HandoffUnit`.
  - `src/lib/api/handoff-api.ts` e `src/lib/api/pdv-api.ts`: Métodos `batchUpdateProductionStatus`.
  - `src/app/app/pedidos/components/ProductionHandoff.tsx`: Interface completa de ciclo por unidade, substituição de "preparo por linha inteira", ações de lote por item e por pedido, touch targets ≥ 44px (`min-h-11`), e permanência visual de itens/unidades entregues (com estilo atenuado, check verde e horário de entrega).
  - `src/app/app/pedidos/components/OrderCard.tsx`: Ação rápida no rodapé para pedidos em `PRONTO_PARCIAL` (entrega imediata no balcão sem abrir modal), e indicador de progresso por unidades prontas.
  - `src/app/app/pedidos/components/OrderItemsControl.tsx`: Decomposição e avanço por unidade para itens multi-quantidade (`quantity > 1`) na visão de detalhe.
  - `src/app/app/pedidos/page.tsx`: Conversão do avanço em `PRONTO_PARCIAL` de loop em cliente para chamada única à RPC atômica.
- **Suíte de Testes:**
  - `supabase/tests/database/production_unit_lifecycle.test.sql`: 14 asserções pgTAP para concorrência, transições válidas, isolamento de unidades e integridade contra loops de trigger.
  - `src/app/app/pedidos/components/OrderCard.test.tsx`: 10 testes Vitest validando renderização de unidades, botões de ação e persistência de itens entregues.

---

## 2. Resultados das Verificações Locais

| Verificação | Comando | Resultado | Evidência |
| --- | --- | --- | --- |
| Documentação | `npm run docs:check` | PASS, exit 0 | 47 arquivos Markdown verificados, sem links locais quebrados |
| Backend Supabase | `npm run supabase:check` | PASS, exit 0 | 40 funções, 84 migrations com versões únicas |
| Tipagem TypeScript | `npm run typecheck` | PASS, exit 0 | `tsc --noEmit` sem erros em todo o repositório |
| Qualidade de Código | `npm run lint` | PASS, exit 0 | `eslint` com 0 erros e 0 warnings |
| Testes Unitários | `npm test` | PASS, exit 0 | 39 arquivos de teste / 309 testes Vitest aprovados |
| Testes de Banco descartável | `npm run test:database` | PASS, exit 0 | 10 arquivos pgTAP / 168 testes aprovados em instância temporária Docker |
| Build de Produção | Turbopack build | PASS, exit 0 | Compilação com Next.js 16.3.1 (Turbopack) e 30 rotas estáticas pré-renderizadas |
| Operações de Produção / Deploy | Nenhum | NÃO EXECUTADOS | Nenhuma alteração remota realizada; preservada a governança humana |

---

## 3. Conclusão da Etapa 1B

A Etapa 1B soluciona de forma definitiva o ciclo individual por unidade e em lote no quadro operacional, mantendo a integridade financeira, sem duplicação de dados, com concorrência segura entre múltiplos operadores e total compatibilidade com a Etapa 1A (PR #236).
