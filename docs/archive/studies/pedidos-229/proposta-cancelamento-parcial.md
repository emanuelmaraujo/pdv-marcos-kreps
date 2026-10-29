# Proposta — cancelar só as unidades restantes de uma linha parcialmente entregue (#229)

Status: **proposta para aprovação**. Nada aqui foi implementado. Altera contrato financeiro
(valor da linha, saldo do pedido, pagamentos) e por isso depende de decisão humana, idealmente
junto da etapa de pagamentos fracionados.

## Situação atual (1B)

- Linha `3× crepe`, 1 unidade entregue, 2 pendentes. O cliente desiste das 2.
- A 1B **recusa** cancelar a linha (e o pedido inteiro): a unidade entregue continua cobrável.
  Sem essa trava, `recompute_order_payment_status_from_items` passaria a ignorar a linha e o
  crepe consumido deixaria de ser cobrado.
- Hoje o operador só tem duas saídas: entregar/descartar as restantes fora do sistema
  ou pedir ajuste manual ao gerente. Nenhuma das duas fica auditada como cancelamento.

## Solução recomendada: dividir a linha (split) numa transação

Uma RPC `cancel_remaining_units(p_order_id, p_item_id, p_unit_ids, p_reason, p_command)`:

1. Trava pedido → linha → unidades (mesma ordem do lote e de `pay_order_items`).
2. Valida: unidades pertencem à linha, ativas, não `DELIVERED`; motivo obrigatório;
   papel ADMIN/ATTENDANT e filial; chave de comando idempotente (como o repasse da 1A).
3. Cria uma **linha nova** com as `k` unidades canceladas:
   `quantity = k`, mesmos snapshots de produto/adicionais/removidos, `status = CANCELLED`,
   `total_price` proporcional (abaixo). As unidades canceladas passam para a linha nova
   (`order_item_id`, `revision`), preservando histórico de repasse e preparo.
4. Reduz a linha original para `quantity = n − k` e `total_price` restante.
   A linha original mantém o `id`: pagamentos, auditoria e impressão já ligados a ela
   continuam válidos.
5. Recalcula `orders.total_amount`, status e `payment_status` na mesma transação; grava
   auditoria `ITEM_PARTIAL_CANCEL` com antes/depois (quantidade, valores, unidades).
6. Reimpressão: opcional, só o aviso de cancelamento para a produção (não reimprime a comanda).

Por que dividir em vez de "cancelar unidade" com valor por unidade: `order_items.total_price`
continua sendo a fonte única do valor da linha. Relatórios, caixa, divisão de conta e
`recompute_order_payment_status_from_items` seguem funcionando sem ler unidades.

## Regras financeiras a decidir

| Situação | Proposta | Decisão necessária |
| --- | --- | --- |
| Valor proporcional | `(preço + adicionais) × k`, arredondado em centavos; diferença de arredondamento fica na linha original | Confirmar |
| Linha **não paga** | Saldo do pedido cai pelo valor cancelado | — |
| Linha **paga** (total ou dividida) | Não cancelar sem estorno registrado; oferecer "crédito/estorno" na etapa de pagamentos | Sim — fluxo de estorno |
| Desconto/cupom do pedido | Recalcular pela regra atual do cupom; se o mínimo deixar de ser atingido, manter o desconto e registrar | Sim |
| COD (#221) | Mantém bloqueio atual de cancelar item isolado; ajuste só com o cliente via cancelamento do pedido sem valor recebido | Confirmar que continua bloqueado |
| Delivery despachado | Não permitir (produção encerrada) | Confirmar |
| Fidelidade | Pontos calculados no fechamento usam o valor final; revisar `loyalty-accrue` se já acumulou | Sim |

## Testes exigidos antes de liberar

- pgTAP: split proporcional, linha paga bloqueada, COD bloqueado, idempotência por chave,
  concorrência com `pay_order_items` e com o lote de preparo, auditoria antes/depois.
- E2E: caixa/relatório do dia com linha dividida; restauração de pedido (o snapshot de
  `update-order-status` precisa incluir a linha nova).
- Regressão COD (#221) e divisão de conta.

## Interface sugerida

No detalhe do item com parte entregue: ação "Cancelar restantes (k)", com confirmação mostrando
"Fica cobrado: 1× crepe R$ 20,00 · Sai da conta: 2× crepe R$ 40,00" e motivo obrigatório.
