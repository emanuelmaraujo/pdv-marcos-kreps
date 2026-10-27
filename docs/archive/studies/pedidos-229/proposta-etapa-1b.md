# Proposta de Arquitetura e Implementação — Etapa 1B

> **Contexto:** Continuação da issue [#229](https://github.com/emanuelmaraujo/pdv-marcos-kreps/issues/229) após a conclusão e abertura do PR da **Etapa 1A** ([#236](https://github.com/emanuelmaraujo/pdv-marcos-kreps/pull/236)).  
> **Escopo:** Controle de preparo e entrega individual ou em lote diretamente no quadro operacional (`/app/pedidos`), sem perda de visibilidade dos itens, com concorrência segura para dois operadores simultâneos.

---

## 1. Diagnóstico do Estado Atual e Problemas a Resolver

A Etapa 1A estabeleceu com sucesso o **repasse independente por unidade** (`production_handoff_units` e `production_handoff_events`), autoria, histórico e proteção contra falhas de impressora. Contudo, o ciclo de **preparo e entrega** permaneceu nos contratos herdados:

1. **Ações restritas ao detalhe (Sheet/Modal):** Para avançar o preparo de itens individuais ou registrar entregas parciais, o operador precisa sair do quadro e abrir a `OrderDetailsSheet` ou `OrderDetailsModal`. O cartão no quadro só oferece botões globais no rodapé ("Marcar pronto" para o pedido todo ou "Ver itens prontos").
2. **Entrega em lote via loop sequencial no cliente:** Em `OrderItemsControl.tsx`, a ação "Entregar prontos" itera sobre os itens executando chamadas HTTP individuais sequenciais (`await pdvApi.updateOrderItemStatus`). Se a conexão falhar ou houver concorrência no 3º item de 5, o pedido entra em estado parcialmente inconsistente.
3. **Ausência de concorrência atômica:** O endpoint `update-order-item-status` lê o item e o pedido, valida regras em memória e executa um `update` sem lock pessimista (`FOR UPDATE`) nem controle de versão otimista (`CAS`). Se dois operadores tentarem avançar itens distintos ao mesmo tempo, triggers de recálculo concorrentes em `orders` podem disputar a mesma linha sem garantia de serialização.
4. **Perda de visibilidade dos itens no fluxo do cartão:** Quando um pedido entra em `PRONTO_PARCIAL`, o operador do balcão não consegue enxergar rapidamente no próprio cartão quais itens específicos estão prontos e quais ainda estão na chapa ou suqueira.

---

## 2. Princípios de Experiência do Operador (UI/UX)

Para atender à operação simultânea rápida de dois operadores em horários de pico (chapa/cozinha e balcão/atendimento):

1. **Visibilidade permanente e integral:** Nenhum item é omitido ou ocultado do cartão. Mesmo quando uma linha atinge o estado `DELIVERED`, ela permanece visível com estilo suave (diminuição de opacidade, check verde, horário de entrega), permitindo conferência imediata da comanda completa a qualquer momento.
2. **Ações no próprio cartão com 1 clique (Touch target ≥ 44 px):**
   - **Controle individual por linha:** Cada item no cartão passa a exibir seu status de produção atual e um botão direto de avanço contextual:
     - `PENDING` → botão "Em preparo" ou "Marcar pronto" (configurável / atalho rápido).
     - `IN_PREPARATION` → botão "Marcar pronto".
     - `READY` → botão "Entregar" (disponível em `BALCAO` e `VIAGEM`; desabilitado em `ENTREGA` delivery, onde a conclusão depende do motoboy).
   - **Ações em lote por setor:**
     - Botão rápido "Prontos todos de Kreps" / "Prontos todos de Cozinha".
     - Botão rápido "Entregar todos prontos" diretamente no rodapé do cartão quando houver itens `READY`.
3. **Feedback visual imediato sem travamento de tela:** Estados otimistas locais ou spinners discretos por item para evitar clique duplo, sem travar o restante do quadro.
4. **Sem quebras de layout:** Preservação estrita das larguras de coluna (mínimo 320 px no Kanban desktop), sem overflow horizontal em telas de 320 px a 1440 px.

---

## 3. Contratos de Backend e Persistência Propostos

### 3.1 RPC Atômica no PostgreSQL: `batch_update_order_items_status`

Para eliminar requisições HTTP em cascata e garantir atomicidade e concorrência segura, propõe-se uma RPC única executada em transação de banco com `SECURITY DEFINER` (armazenada em `handoff_private` ou `public` com permissões restritas):

```sql
CREATE OR REPLACE FUNCTION public.batch_update_order_items_status(
  p_order_id UUID,
  p_item_ids UUID[],
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB;
```

#### Regras da Transação:
1. **Autenticação e RLS:** Valida `auth.uid()`, perfil ativo e se o operador pertence ou tem acesso à filial do pedido (`public.can_access_branch(orders.branch_id)`).
2. **Locking Determinístico:**
   - Adquire `SELECT ... FROM public.orders WHERE id = p_order_id FOR UPDATE;` garantindo que nenhuma outra mutação altere o pedido durante o lote.
   - Adquire `SELECT ... FROM public.order_items WHERE id = ANY(p_item_ids) AND order_id = p_order_id ORDER BY id FOR UPDATE;` (ordenação por ID previne deadlocks entre operadores).
3. **Validação de Regras de Negócio e Estados do Pedido:**
   - Pedidos em `AGUARDANDO_CONFIRMACAO`, `AGUARDANDO_PAGAMENTO`, `EXPIRADO` ou `CANCELADO` recusam mutações em itens.
   - Em pedidos `ENTREGA` (delivery), o status `DELIVERED` não pode ser atribuído via balcão (preserva regra do motoboy / confirmação de entrega).
   - Em pedidos `ON_DELIVERY` (COD - issue #221), o status `CANCELLED` em itens individuais permanece estritamente proibido sem recálculo do pedido inteiro.
4. **Validação de Transições Permitidas:**
   - `PENDING` → `IN_PREPARATION`, `READY`, `CANCELLED`
   - `IN_PREPARATION` → `READY`, `CANCELLED`
   - `READY` → `DELIVERED`, `CANCELLED`
   - Itens que já se encontram no status alvo são ignorados de forma idempotente (sem erro fatal).
5. **Atualização em Massa dos Timestamps:**
   - Define `prep_started_at`, `item_ready_at`, `delivered_at` ou `cancelled_at` conforme o status.
6. **Recomputação Atômica do Pedido:**
   - Invoca os triggers/funções existentes `recompute_order_status_from_items` e `recompute_order_payment_status_from_items` uma única vez após todas as linhas do lote serem atualizadas.
7. **Trilha de Auditoria:**
   - Insere eventos em `public.audit_logs` para cada item alterado dentro da mesma transação atômica.
8. **Retorno:**
   - Retorna payload consolidado com IDs dos itens atualizados e status final do pedido (`status`, `payment_status`, `ready_at`, `delivered_at`).

### 3.2 Notificações Transacionais e Integrações

- **WhatsApp e Webhooks:** As notificações de `order_partial_ready` e `order_ready` utilizam o índice unique partial existente, garantindo envio único e idempotente quando o status do pedido migrar para `PRONTO_PARCIAL` ou `PRONTO`.
- **Compatibilidade com COD (#221) e Split Bill:** Preservada integralmente. Nenhum cálculo financeiro, split ou regra de entrega externa é alterado.

---

## 4. Plano de Implementação Incremental

A Etapa 1B será executada nos seguintes passos estruturados:

| Passo | Foco | Entregáveis |
| --- | --- | --- |
| **Passo 1 (Schema & Backend)** | Migration e RPC atômica | Migration `batch_update_order_items_status`, validações de concorrência, locks ordenados e testes pgTAP em banco descartável. |
| **Passo 2 (API Client & Frontend)** | Adaptador e Componentes | Método na API (`pdvApi.batchUpdateOrderItemsStatus`), integração dos botões de ação rápida no `OrderCard` e `ProductionHandoff`, estados visuais claros por item. |
| **Passo 3 (Ações em Lote no Card)** | Botões de lote no cartão | "Prontos todos da cozinha/bebidas", "Entregar prontos", mantendo itens entregues visíveis e auditáveis. |
| **Passo 4 (Testes & QA)** | Concorrência e Regressão | Testes com duas sessões simultâneas no Playwright, verificação offline, layout 320/360/390/768/1440 px, regressão COD (#221) e build Turbopack/CI. |

---

## 5. Limites e Governança

- Nenhuma migration será aplicada em bancos remotos/produção sem autorização prévia explícita.
- Toda validação inicial de banco será conduzida na instância descartável via `npm run test:database`.
- Não haverá merge automático nem deploy automático.
- As evidências e o relatório da etapa 1A permanecem intocados e preservados em `docs/evidence/pedidos-229/etapa-1a/`.
