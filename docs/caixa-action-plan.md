# Plano de ação — Caixa / Fechamento do Dia

Levantamento feito em 2026-08-04 (auditoria de código, não só de `walkthrough.md`). Referenciado por `walkthrough.md` §8.

## Estado real hoje

- `src/app/app/caixa/page.tsx`: resumo operacional do dia (recebido, pendente, cortesia, ticket médio, breakdown por método de pagamento). Já usa a tabela `payments` (não só `orders`) para agregar corretamente split-bill.
- `src/app/app/caixa/relatorio/page.tsx` + Edge Function `cash-report`: relatório gerencial completo — margem/custo (`products.cost_price`, `order_items.cost_price_snapshot`), heatmap dia×hora, gargalo por etapa do pedido, comparação entre períodos. Exportação CSV existe **só** na aba "Pedidos" deste relatório.
- Tabela `cash_sessions` (abertura/fechamento de caixa) existe no schema desde a migration inicial, com `branch_id` e RLS, mas está **órfã** — nenhum código em `src/` ou `supabase/functions/` a usa.
- Enum `REFUNDED` existe em `payment_status` mas nenhum fluxo de estorno o escreve.

## Fase 1 — sem decisão de negócio pendente

Pode ser implementado direto, usa dados que já existem:

1. **Auditoria de pagamentos**: nova seção/aba em `caixa/relatorio/page.tsx` (ou `cash-report`) que lista `payments` por pedido comparado a `orders.total_amount`, sinalizando pedidos com soma de pagamentos divergente do total (candidatos a estorno/erro de lançamento).
2. **Exportação no resumo diário**: levar a exportação CSV (hoje só na aba "Pedidos" do relatório) também para `caixa/page.tsx`.

## Fase 2 — depende de decisão de negócio

**Não iniciar sem resposta às perguntas abaixo:**

- O caixa vai passar a exigir abertura (valor inicial declarado) e fechamento (conferência de valores) formais por sessão, usando `cash_sessions`?
- Se sim: a sessão é por filial/dia, ou por atendente/turno dentro do dia?
- Quem pode abrir/fechar sessão — só `ADMIN`, ou `ATTENDANT` também?
- O que acontece com pedidos criados fora de uma sessão aberta (bloqueia, ou só fica sem sessão associada)?

Depois de definido: Edge Functions `open-cash-session` / `close-cash-session`, tela de abertura (valor inicial) e fechamento (conferência, diferença entre `final_amount` declarado e o calculado pelo sistema), e `caixa/page.tsx` passa a poder filtrar por sessão além de por data.

## Fase 3 — baixa prioridade / dívida técnica

- Decidir entre renomear a coluna `packing_fee` para bater com "taxa de embalagem" na UI, ou documentar formalmente que o nome do banco fica assim.
- Avaliar se vale adicionar `subtotal_amount` real em `orders`, ou manter o cálculo atual a partir de `total_amount`.
- Exportação em PDF/xlsx, se algum dia for pedida pela operação.
