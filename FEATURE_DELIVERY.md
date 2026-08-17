# Feature: Delivery (Entrega)

> Documento vivo — diferente dos antigos `PROMPT_*.md` (specs de tarefa única, descartadas depois de prontas), este arquivo é atualizado a cada fase da funcionalidade de delivery. Mantenha-o em sincronia com o código real.

## Status atual: **Fase 3 (cadastro de entregadores + métricas de tempo) — CONCLUÍDA**

## Contexto

O PDV Marcos Krep's é uma creperia com filiais físicas em Brasília-DF (Candangolândia, Águas Claras). Até a Fase 1, o sistema só suportava dois tipos de pedido: `BALCAO` (consumo no local) e `VIAGEM` (para levar). A Fase 1 adicionou um terceiro tipo, `ENTREGA`, mas só criado internamente pelo atendente, com taxa fixa global e endereço não reutilizável. A Fase 2 (este documento) leva a funcionalidade para o cliente final: checkout público, frete por bairro e por filial, e endereço salvo.

Toda regra de preço/validação continua rodando em Edge Functions (arquitetura "trust-no-client"): a taxa de entrega nunca é confiada a partir do cliente, mesmo quando a tabela de zonas é pública para permitir a prévia de preço na tela.

## O que foi entregue na Fase 1 (resumo — detalhes no histórico do PR #109)

- `order_type.ENTREGA`, `order_status.SAIU_PARA_ENTREGA`.
- `orders` com colunas de endereço/taxa/entregador/timestamps de entrega.
- `create-attendant-order`, `dispatch-delivery`, `confirm-delivery`, `update-order-status` com o fluxo `PRONTO → SAIU_PARA_ENTREGA → ENTREGUE`.
- UI interna (`/app/novo-pedido`, `/app/pedidos`) com endereço, taxa, despacho e confirmação.
- Limitação: só o atendente cria pedidos de entrega; taxa fixa global (`settings.default_delivery_fee`); sem endereço reutilizável; sem notificação WhatsApp de despacho.

## O que foi entregue na Fase 2

### Banco de dados
- `delivery_zones` **(nova tabela)**: bairro → taxa, por filial, com `neighborhood_normalized` para matching robusto (sem acento/case). RLS: leitura pública dos ativos (mesmo padrão de `categories`/`products`/`branches`), gestão só ADMIN.
  - Migration: `supabase/migrations/20260817050000_delivery_zones.sql`
- `customer_addresses` **(nova tabela)**: endereços salvos por cliente (`customer_id` → `customers.id`, que é o telefone E.164), opt-in explícito no checkout público. Sem policy pública — acesso só via Edge Function com Service Role (mesmo modelo de `customers`).
  - Migration: `supabase/migrations/20260817050100_customer_addresses.sql`
- `branches.delivery_enabled` e `branches.default_delivery_fee` substituem os antigos settings globais `delivery_enabled`/`default_delivery_fee` da Fase 1 (dados migrados, settings globais removidos). Mesmo padrão de `packing_fee`/`ordering_enabled` por filial.
  - Migration: `supabase/migrations/20260817050200_branch_delivery_settings.sql`
- Evento WhatsApp `order_out_for_delivery` adicionado ao CHECK de `whatsapp_messages` + template default global `whatsapp_template_out_for_delivery`.
  - Migration: `supabase/migrations/20260817050300_whatsapp_out_for_delivery_event.sql`

### Regra de cálculo de frete (decidida com o usuário para esta fase)
- Filial **sem nenhuma zona cadastrada**: usa `branches.default_delivery_fee` como taxa fixa única (comportamento herdado da Fase 1 — permite adoção gradual, filial por filial).
- Filial **com ao menos uma zona ativa**: bairro precisa bater com uma zona cadastrada (normalizado); fora da lista, o pedido de entrega é **bloqueado** (não há fallback silencioso para a taxa default).
- Sem pedido mínimo para entrega nesta fase.
- Cancelamento após despacho (`SAIU_PARA_ENTREGA`) continua **não permitido** (mesma regra da Fase 1).
- Lógica centralizada em `supabase/functions/_shared/delivery.ts` (`resolveDeliveryFee`), usada por `create-attendant-order` e `create-public-order` — sem duplicação de regra entre os dois pontos de entrada.

### Backend (Edge Functions)
- `supabase/functions/_shared/delivery.ts` **(novo)**: `normalizeNeighborhood` + `resolveDeliveryFee` — cálculo autoritativo de taxa, chamado a partir do servidor.
- `supabase/functions/create-attendant-order/index.ts`: passa a usar `resolveDeliveryFee` + `branches.delivery_enabled` em vez dos settings globais da Fase 1.
- `supabase/functions/create-public-order/index.ts`: aceita `order_type = 'ENTREGA'`, endereço digitado ou `delivery_address_id` de um endereço salvo (revalidado e recalculado no servidor em ambos os casos), salva novo endereço reutilizável quando o cliente opta explicitamente (`save_address`).
- `supabase/functions/get-public-checkout-config/index.ts`: retorna `branch.delivery_enabled`/`branch.default_delivery_fee` para o frontend saber se deve oferecer a opção Entrega.
- `supabase/functions/get-public-customer-profile/index.ts`: retorna também `addresses[]` do cliente (quando `remember_checkout_data = true`).
- `supabase/functions/dispatch-delivery/index.ts`: enfileira notificação WhatsApp `order_out_for_delivery` (não bloqueia o despacho em caso de falha).
- `supabase/functions/_shared/whatsapp-enqueue.ts`: novo `WhatsAppEventType = 'order_out_for_delivery'`.

### Frontend
- `src/types/pdv.ts`: `DeliveryZone`, `CustomerAddress`; `Branch` ganhou `delivery_enabled`/`default_delivery_fee`.
- `src/lib/utils/delivery.ts` **(novo)**: `normalizeNeighborhood` — espelha a regra do backend para a prévia de taxa no cliente.
- `src/lib/api/branches-admin-api.ts`: `deliveryZonesApi` (CRUD de zonas, ADMIN, RLS-gated — mesmo padrão de `branchesAdminApi`).
- `src/lib/api/pdv-api.ts`: `listDeliveryZones` (leitura pública direta), `createPublicOrder`/`getPublicCustomerProfile`/`getPublicCheckoutConfig` estendidos com os campos de entrega.
- `src/app/app/configuracoes/filiais/page.tsx`: nova seção "Entrega" — toggle por filial, taxa padrão, CRUD de bairros/zonas inline.
- `src/app/pedir/page.tsx`: opção "Entrega" na modalidade (quando a filial habilita), formulário de endereço com prévia de taxa em tempo real, seleção de endereço salvo, opt-in para salvar novo endereço, bloqueio visual quando o bairro não é atendido.

### Validação já feita
- `npx tsc --noEmit` — sem erros.
- `npx eslint` — sem novos erros/warnings introduzidos por esta fase (seguem os 2 erros pré-existentes de `react-hooks/set-state-in-effect` em `/app/caixa`, não relacionados, sinalizados à parte).
- `npm run build` — compila e type-checks; a etapa de prerender de `/app/caixa` falha apenas por falta de `.env.local` neste ambiente (sem credenciais Supabase), não é regressão desta mudança.
- **Não testado** contra um Supabase real (migrations não aplicadas em nenhum ambiente vivo) — ver "Como testar" abaixo.

### Limitações conhecidas da Fase 2
- **Endereço salvo não tem edição** — só criar e reutilizar; editar/apagar um endereço salvo exigiria uma tela dedicada (não implementada).
- **Template WhatsApp de despacho sem campo na tela global de Configurações** — só o default (`pedido_saiu_entrega`) e override por filial via `branches.whatsapp_templates` (JSON), igual ao gap que já existia para `order_partial_ready`.

## O que foi entregue na Fase 3

### Banco de dados
- `couriers` **(nova tabela)**: entregador cadastrado por filial (nome, telefone, `active`). RLS: leitura para equipe da filial/ADMIN, gestão só ADMIN — sem policy pública (sem login próprio ainda).
- `orders.courier_id` (nullable, FK para `couriers`) — coexiste com `courier_name`/`courier_phone` (snapshot), que continuam aceitando entregador avulso digitado livremente.
  - Migration: `supabase/migrations/20260817130000_couriers.sql`

### Backend
- `supabase/functions/dispatch-delivery/index.ts`: aceita `courier_id` opcional. Quando informado, busca nome/telefone no servidor (nunca confia no que vem do client) e valida que o entregador pertence à mesma filial do pedido — rejeita com "Entregador inválido para esta filial." caso contrário. Sem `courier_id`, mantém o comportamento de entregador avulso da Fase 1.

### Frontend
- `src/lib/api/branches-admin-api.ts`: `couriersApi` (CRUD por filial, ADMIN, RLS-gated — mesmo padrão de `deliveryZonesApi`).
- `src/app/app/configuracoes/filiais/page.tsx`: seção "Entregadores cadastrados" dentro do bloco de Entrega — cadastrar/ativar/desativar/remover.
- `src/app/app/pedidos/components/OrderDetailsSheet.tsx` e `OrderDetailsModal.tsx`: formulário de despacho ganha um seletor de entregador cadastrado (com fallback para digitar avulso); métricas "Pronto > saiu" e "Saiu > entregue" (além de "Fila" e "Total") para pedidos de entrega, calculadas a partir de `ready_at`/`dispatched_at`/`delivery_delivered_at`.

### Validação já feita
- `npx tsc --noEmit`, `npx eslint .` sem erros novos, `npm run build` compila.
- Testado contra um Supabase local real: migration aplica em sequência com todo o histórico (incluindo o trabalho paralelo de hardening/transacional); despacho com entregador cadastrado grava `courier_id`/nome/telefone corretamente; entregador de outra filial é rejeitado; RLS de `couriers` confirmada (anon sem leitura/escrita, ADMIN com CRUD completo).

### Limitações conhecidas desta fase
- **Sem login próprio do entregador** (`couriers.profile_id`) — decisão de negócio "motoboy próprio vs. terceirizado" ainda não tomada; adicionar depois é um `ALTER TABLE` simples.
- **Sem painel agregado de métricas** (média por entregador/filial/dia) — só o tempo por pedido individual nesta fase.
- **Entregador é sempre por filial** — se a mesma pessoa entrega para mais de uma filial, precisa de um cadastro por filial (sem vínculo N:N ainda).

## Próximas fases (pendentes)

- **Fase 4 — Motoboy com login próprio (se a decisão de negócio for tomada)**
  - `couriers.profile_id` habilitado — motoboy loga e atualiza status pelo próprio celular.
  - Painel agregado de métricas de tempo por entregador/filial/dia.
- **Fase 5 — Integrações externas (fora do escopo desta proposta)**
  - Aceitar pedidos do iFood/Rappi como fulfillment real (hoje `IFOOD` só existe como `payment_method`, não como origem de pedido) — projeto à parte.

## Decisões de negócio já resolvidas

**Fase 2:**
1. Bairro fora da lista de zonas cadastradas → **bloqueado** (sem fallback silencioso).
2. Pedido mínimo para entrega → **não implementado**.
3. Cancelamento após despacho → **não permitido**.
4. Settings globais de delivery da Fase 1 → **descontinuados**, migrados para `branches.delivery_enabled`/`branches.default_delivery_fee`.

**Fase 3:**
5. Entregador é por filial (não compartilhado entre todas) — decidido para manter consistência com o padrão operacional existente (`packing_fee`, `delivery_zones`).
6. `couriers.profile_id`/login próprio **não implementado nesta fase** — fica para quando a decisão "motoboy próprio vs. terceirizado" for tomada.
7. Painel agregado de métricas **não implementado nesta fase** — só tempo por pedido individual.

## Decisões de negócio ainda em aberto

1. Motoboy próprio, terceirizado, ou ambos? (define se/quando habilitar `couriers.profile_id`)
2. Rastreamento em tempo real (GPS do motoboy) — fora do escopo realista atual; a proposta é status discreto.
3. Interação com split-bill — continua bloqueado explicitamente para `ENTREGA`; confirmar se essa é a regra desejada a longo prazo.

## Arquivos-chave

**Fase 2:** `supabase/migrations/20260817050000_delivery_zones.sql`, `20260817050100_customer_addresses.sql`, `20260817050200_branch_delivery_settings.sql`, `20260817050300_whatsapp_out_for_delivery_event.sql`, `supabase/functions/_shared/delivery.ts`, `create-public-order/index.ts`, `get-public-checkout-config/index.ts`, `get-public-customer-profile/index.ts`, `src/lib/utils/delivery.ts`, `src/app/pedir/page.tsx`

**Fase 3:** `supabase/migrations/20260817130000_couriers.sql`, `supabase/functions/dispatch-delivery/index.ts`, `src/lib/api/branches-admin-api.ts` (`couriersApi`), `src/app/app/configuracoes/filiais/page.tsx`, `src/app/app/pedidos/components/OrderDetailsSheet.tsx`, `OrderDetailsModal.tsx`

**Comuns às duas fases:** `src/lib/api/pdv-api.ts`, `src/types/pdv.ts`, `supabase/functions/create-attendant-order/index.ts`

## Como testar

1. `npx tsc --noEmit && npx eslint . && npm run build` (build completo exige `.env.local` com credenciais Supabase).
2. Aplicar as 4 migrations novas em ordem, num ambiente Supabase local/sandbox.
3. Em `/app/configuracoes/filiais`, habilitar "Aceitar pedidos de entrega" numa filial, definir a taxa padrão e cadastrar 1-2 bairros com taxas diferentes.
4. Em `/pedir/<slug-da-filial>`, escolher "Entrega", digitar um endereço com bairro cadastrado → conferir a taxa estimada; testar um bairro **não** cadastrado → conferir o bloqueio.
5. Finalizar o pedido com telefone e marcar "salvar este endereço"; voltar em `/pedir` com o mesmo telefone → conferir que o endereço salvo aparece para reuso.
6. Avançar o pedido até `PRONTO`, despachar em `/app/pedidos` → conferir que a notificação WhatsApp de despacho foi enfileirada em `whatsapp_messages` (evento `order_out_for_delivery`).
7. Repetir o fluxo de despacho/confirmação de entrega da Fase 1 para garantir que não regrediu.
8. Em `/app/configuracoes/filiais`, cadastrar um entregador na seção "Entregadores cadastrados".
9. Ao despachar um pedido de entrega em `/app/pedidos`, selecionar o entregador cadastrado no lugar de digitar avulso → conferir que nome/telefone aparecem corretos no pedido e no recibo.
10. Conferir que um entregador cadastrado em outra filial não aparece/não pode ser usado para despachar um pedido desta filial.
11. Depois de confirmar a entrega, conferir as métricas "Pronto > saiu" e "Saiu > entregue" no `OrderDetailsSheet`/`OrderDetailsModal`.
