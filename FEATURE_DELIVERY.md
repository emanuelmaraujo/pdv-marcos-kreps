# Feature: Delivery (Entrega)

> Documento vivo — diferente dos antigos `PROMPT_*.md` (specs de tarefa única, descartadas depois de prontas), este arquivo é atualizado a cada fase da funcionalidade de delivery. Mantenha-o em sincronia com o código real.

## Status atual: **Fase 1 (MVP interno) — CONCLUÍDA**

## Contexto

O PDV Marcos Krep's é uma creperia com filiais físicas em Brasília-DF (Candangolândia, Águas Claras). Até esta funcionalidade, o sistema só suportava dois tipos de pedido: `BALCAO` (consumo no local) e `VIAGEM` (para levar). Não havia nenhum conceito de endereço de cliente, taxa de entrega, ou entregador/motoboy em lugar nenhum do schema ou do código — o que parecia "entrega" (`ENTREGUE`, `entregar`) significava apenas "cliente retirou o pedido no balcão".

Esta funcionalidade adiciona um terceiro tipo de pedido, `ENTREGA`, com endereço, taxa de entrega e um fluxo operacional de despacho/confirmação, seguindo a arquitetura "trust-no-client" já existente no projeto (toda regra de preço roda em Edge Functions, nunca no cliente).

A análise de viabilidade completa e a arquitetura proposta (todas as fases, riscos e decisões de negócio) foram documentadas em sessão anterior e estão resumidas abaixo.

## O que foi entregue na Fase 1

### Banco de dados
- `order_type` ganhou o valor `ENTREGA`; `order_status` ganhou `SAIU_PARA_ENTREGA` (entre `PRONTO` e `ENTREGUE`).
  - Migrations: `supabase/migrations/20260729120000_add_delivery_order_type.sql`
- `orders` ganhou colunas de entrega: `delivery_street`, `delivery_number`, `delivery_complement`, `delivery_neighborhood`, `delivery_city`, `delivery_state`, `delivery_postal_code`, `delivery_reference`, `delivery_fee`, `courier_name`, `courier_phone`, `dispatched_at`, `delivery_delivered_at`.
  - Migration: `supabase/migrations/20260729120100_orders_delivery_columns.sql`
- Novos settings globais: `delivery_enabled` (bool), `default_delivery_fee` (numeric) — mesmo padrão de `packaging_fee`/`apply_packaging_fee_for_takeout`.
- A trigger `recompute_order_status_from_items()` foi ajustada para proteger `SAIU_PARA_ENTREGA` contra sobrescrita automática (mesmo padrão já usado para `AGUARDANDO_CONFIRMACAO`/`AGUARDANDO_PAGAMENTO`/`EXPIRADO`).
  - Migration: `supabase/migrations/20260729120200_delivery_status_trigger_update.sql`

### Backend (Edge Functions)
- `supabase/functions/create-attendant-order/index.ts`: aceita `order_type = 'ENTREGA'`, valida endereço (rua + bairro obrigatórios), calcula `delivery_fee` a partir do setting `default_delivery_fee` (gated por `delivery_enabled`), bloqueia dividir conta (`split_bill`) em pedidos de entrega.
- `supabase/functions/dispatch-delivery/index.ts` **(novo)**: transição `PRONTO → SAIU_PARA_ENTREGA`, atribui `courier_name`/`courier_phone`, seta `dispatched_at`.
- `supabase/functions/confirm-delivery/index.ts` **(novo)**: transição `SAIU_PARA_ENTREGA → ENTREGUE`, marca itens como `DELIVERED`, seta `delivery_delivered_at`.
- `supabase/functions/update-order-status/index.ts`: bloqueia a transição direta `PRONTO → ENTREGUE` para pedidos `ENTREGA` (força o fluxo despachar → confirmar).
- `supabase/functions/_shared/print-format.ts`: recibo térmico (cliente e cozinha) agora imprime endereço de entrega e taxa de entrega quando aplicável.

### Frontend
- `src/types/pdv.ts`: `OrderType` e `OrderStatus` atualizados; `Order` ganhou os campos de entrega; novo tipo `DeliveryAddress`.
- `src/lib/api/pdv-api.ts`: novas funções `dispatchDelivery` e `confirmDelivery`.
- `src/components/checkout/OrderSummarySheet.tsx`: toggle "Pedido para entrega" no passo Cliente, formulário de endereço, prévia da taxa de entrega no resumo.
- `src/app/app/pedidos/components/OrderDetailsSheet.tsx` e `OrderDetailsModal.tsx`: timeline com a etapa "Saiu p/ Entrega", exibição de endereço/entregador, botões "Despachar" (com formulário de nome/telefone do entregador) e "Confirmar Entrega".
- `src/app/app/pedidos/components/OrderCard.tsx` e `src/app/app/pedidos/page.tsx`: badge "Entrega", nova coluna no quadro kanban e nova aba mobile para `SAIU_PARA_ENTREGA`, quick actions ajustadas (despachar exige o formulário completo, então não tem ação de 1 toque; confirmar entrega tem).

### Validação já feita
- `npx tsc --noEmit` — sem erros.
- `npx eslint` nos arquivos alterados — sem novos warnings/erros (2 warnings pré-existentes, não relacionados).
- `npm run build` — build completo passa.

### Limitações conhecidas desta fase
- **Sem checkout público**: só o atendente cria pedidos de entrega (ex: pedido recebido por telefone/WhatsApp). `/pedir` continua aceitando só `BALCAO`/`VIAGEM`.
- **Taxa de entrega fixa e única**: um valor global (`default_delivery_fee`), sem variação por bairro/zona ou por filial.
- **Entregador informal**: `courier_name`/`courier_phone` são texto livre digitado pelo atendente no momento do despacho — não há tabela `couriers`, cadastro, nem login próprio para motoboy.
- **Sem notificação WhatsApp** de "saiu para entrega" (a fila `whatsapp_messages` existente não foi estendida com esse evento ainda).
- **Endereço não é reutilizável**: cada pedido de entrega pede o endereço do zero; não há uma tabela de endereços vinculada ao cliente.

## Próximas fases (pendentes)

- **Fase 2 — Frete por zona + endereço reutilizável + checkout público**
  - Tabela `customer_addresses` (endereços salvos por cliente).
  - Tabela `delivery_zones` (taxa por bairro/filial, com fallback para `default_delivery_fee`).
  - `/pedir` ganha a opção "Entrega" com formulário de endereço e taxa estimada antes do pagamento.
  - `create-public-order` passa a aceitar `order_type = 'ENTREGA'`.
  - `/pedido/[publicToken]` exibe o estado "Saiu para entrega" publicamente (o mapeamento de status já foi preparado em `PedidoStatusClient.tsx`).
  - Tabela `couriers` formal (ainda sem login).
  - Notificação WhatsApp no momento do despacho.
- **Fase 3 — Motoboy com login próprio + métricas**
  - `couriers.profile_id` habilitado — motoboy loga e atualiza status pelo próprio celular.
  - Métricas de tempo "Pronto → Saiu" e "Saiu → Entregue" no `OrderDetailsSheet`.
- **Fase 4 — Integrações externas (fora do escopo desta proposta)**
  - Aceitar pedidos do iFood/Rappi como fulfillment real (hoje `IFOOD` só existe como `payment_method`, não como origem de pedido) — projeto à parte.

## Decisões de negócio ainda em aberto

1. Motoboy próprio, terceirizado, ou ambos? (define se/quando habilitar `couriers.profile_id`)
2. Regra de frete: taxa fixa única (atual) ou por bairro/zona? Se por zona, precisa da lista de bairros atendidos e valores por filial.
3. Pedido mínimo para entrega — não existe hoje; se quiserem, precisa validação no servidor.
4. Rastreamento em tempo real (GPS do motoboy) — fora do escopo realista atual; a proposta é status discreto.
5. Interação com split-bill — hoje bloqueado explicitamente para `ENTREGA`; confirmar se essa é a regra desejada.
6. Cancelamento após despacho — hoje bloqueado (não está na lista de transições permitidas para `CANCELADO` em `update-order-status`); decidir se deve ser permitido e qual o tratamento financeiro.

## Arquivos-chave

- `supabase/migrations/20260729120000_add_delivery_order_type.sql`, `20260729120100_orders_delivery_columns.sql`, `20260729120200_delivery_status_trigger_update.sql`
- `supabase/functions/dispatch-delivery/index.ts`, `supabase/functions/confirm-delivery/index.ts`
- `supabase/functions/create-attendant-order/index.ts`, `supabase/functions/update-order-status/index.ts`
- `supabase/functions/_shared/print-format.ts`
- `src/types/pdv.ts`, `src/lib/api/pdv-api.ts`
- `src/components/checkout/OrderSummarySheet.tsx`
- `src/app/app/pedidos/components/OrderDetailsSheet.tsx`, `OrderDetailsModal.tsx`, `OrderCard.tsx`
- `src/app/app/pedidos/page.tsx`
- `src/app/pedido/[publicToken]/PedidoStatusClient.tsx` (preparado para o novo status, ainda sem entry point público)

## Como testar

1. `npx tsc --noEmit && npx eslint <arquivos alterados> && npm run build`.
2. Aplicar as migrations num ambiente Supabase local/sandbox (a migration de `ALTER TYPE` precisa rodar isolada antes das demais).
3. Habilitar `delivery_enabled = true` e definir `default_delivery_fee` em Configurações.
4. Criar um pedido de entrega pelo atendente (`/app/novo-pedido`), preenchendo endereço.
5. Avançar o pedido até `PRONTO`, despachar (informando entregador) e confirmar a entrega em `/app/pedidos`.
6. Conferir que a taxa de entrega aparece no recibo e no resumo financeiro, e que o quadro/abas mostram a etapa "Saiu p/ Entrega" corretamente.
