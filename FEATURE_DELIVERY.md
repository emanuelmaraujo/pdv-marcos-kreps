# Feature: Delivery (Entrega)

> Documento vivo — diferente dos antigos `PROMPT_*.md` (specs de tarefa única, descartadas depois de prontas), este arquivo é atualizado a cada fase da funcionalidade de delivery. Mantenha-o em sincronia com o código real.

## Status atual: **Fase 3 concluída + validação de endereço por CEP (pós-Fase 3) — CONCLUÍDA**

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

## Melhoria pós-Fase 3: validação de endereço por CEP (ViaCEP)

Até aqui, "validar" um endereço de entrega era só texto livre com match de bairro por string normalizada (ver `resolveDeliveryFee`) — qualquer erro de digitação bloqueava um pedido válido, e qualquer pessoa podia digitar o nome de um bairro atendido para escapar do bloqueio, mesmo morando em outro lugar. Esta melhoria fecha as duas brechas.

### Banco de dados
- `customer_addresses.postal_code` ganha uma constraint de formato (permite `NULL` para não quebrar endereços salvos antigos; exige 8 dígitos quando presente).
  - Migration: `supabase/migrations/20260818000000_customer_addresses_postal_code_format.sql`

### Backend (Edge Functions)
- `supabase/functions/_shared/cep.ts` **(novo)**: `fetchCepAddress` — consulta o ViaCEP com timeout (5s via `AbortController`), retorna `null` em qualquer falha (CEP inexistente, timeout, erro de rede). `lookup-cep/index.ts` **(novo, público)**: proxy pro ViaCEP com rate limit por IP (30/15min) — só autofill de UX.
- `create-public-order/index.ts` e `create-attendant-order/index.ts`: CEP passa a ser obrigatório para endereço digitado na hora (endereço salvo reaproveitado não revalida de novo). O servidor refaz a consulta ao ViaCEP e usa o **bairro retornado pelo ViaCEP** — não o que o cliente/atendente digitou — para chamar `resolveDeliveryFee`. CEP não encontrado ou serviço fora do ar → pedido **bloqueado** (sem fallback manual, mesma filosofia de "nunca confiar no client" que já regia o cálculo de taxa).

### Frontend
- `src/lib/utils/cep.ts` **(novo)**: máscara e validação de formato de CEP.
- `src/lib/api/pdv-api.ts`: `lookupCep`.
- `src/app/pedir/page.tsx` e `src/components/checkout/OrderSummarySheet.tsx` (checkout público e fluxo do atendente): CEP vira o primeiro campo do formulário de entrega, obrigatório; ao completar 8 dígitos, busca o endereço e trava rua/bairro/cidade/UF como somente-leitura (derivados do CEP) — número/complemento/referência continuam livres. Envio do pedido bloqueado até o CEP resolver com sucesso.

### Decisões de negócio confirmadas
- Aplicar tanto no checkout público quanto no fluxo do atendente.
- Bairro do CEP é a fonte de verdade para o match de zona (substitui o texto digitado).
- CEP não encontrado/serviço fora do ar → bloqueia o pedido, sem fallback manual.
- Endereços salvos sem CEP continuam válidos como estão — a exigência vale só para endereços novos.

### Validação já feita
- `npx tsc --noEmit`, `npx eslint .` sem erros novos, `npm run build` compila.
- `supabase db reset` local agora completa do zero (ver "Bugs de infra pré-existentes corrigidos" abaixo) — migration nova aplicada de verdade, não só lida.
- `lookup-cep` testado via `supabase functions serve` contra o ViaCEP real: CEP válido retorna endereço correto, formato inválido rejeitado (400), CEP inexistente retorna 404 com mensagem clara; rate limit confirmado "fail open".
- `create-public-order` testado ponta a ponta contra o Supabase local real (não só lido): pedido de entrega com CEP válido cria normalmente e grava `delivery_neighborhood`/`city`/`state` vindos do ViaCEP (não do que foi digitado); pedido sem CEP é bloqueado; CEP inexistente é bloqueado; e o caso que motivou a mudança — cliente digita o nome de uma zona cadastrada ("Asa Sul") mas o CEP real aponta pra outro bairro ("Bela Vista", não cadastrado) — é corretamente **bloqueado**, confirmando que a brecha de spoofing de bairro está fechada.
- **Testado visualmente no navegador** (build de produção local, `next start`, contra Supabase local real): fluxo completo em `/pedir` — adicionar item, ir até "Dados", escolher "Entrega", digitar CEP válido → autofill de "Avenida Paulista, Bela Vista — São Paulo/SP" e "Taxa de entrega estimada: R$ 5,00" aparecem corretamente, campos Número/Complemento/Referência destravam; digitar CEP inexistente → mensagem "CEP não encontrado." aparece limpa na tela (ver bug corrigido abaixo). `create-attendant-order`/`OrderSummarySheet` não testado visualmente nesta rodada (exige JWT de atendente).
- **Bug encontrado e corrigido durante o teste visual**: `pdvApi.lookupCep` usava o formatador de erro genérico e compartilhado (`extractEdgeFunctionError`, usado por todas as outras chamadas de Edge Function no arquivo), que produz texto de diagnóstico técnico tipo `"[lookup-cep] Status: 404 | Error: CEP não encontrado."` — isso ia parar direto na tela do cliente no checkout público. Corrigido: `lookupCep` agora lê o campo `error` do corpo JSON da resposta diretamente, sem passar pelo formatador de diagnóstico, mostrando só a mensagem limpa.

### Bugs de infra pré-existentes corrigidos (não relacionados à Fase 2/3, mas bloqueavam `supabase db reset` local)
Descobertos ao tentar validar esta mudança localmente — sem eles, nenhuma mudança de schema neste repo conseguia ser testada com reset do zero:
1. `supabase/seed.sql`: `public_ordering_start_time`/`public_ordering_end_time` eram inseridos como `'17:00'`/`'23:30'` — não é JSON válido pra uma coluna `JSONB` (falta aspas de string). Corrigido pra `'"17:00"'`/`'"23:30"'`.
2. `supabase/migrations/20260521120000_feira_candangolandia_menu.sql`: usava `addons.sort_order`/`products.sort_order`, colunas que só foram criadas 3 meses depois por `20260817100000_fix_addons_sort_order_drift.sql` (drift manual em produção, nunca formalizado em migration na época). Corrigido adicionando `ADD COLUMN IF NOT EXISTS` no topo desta migration, antes do primeiro uso — a migration de "fix" mais tardia continua existindo como no-op idempotente redundante (já aplicada em produção, não é removida).
3. `supabase/migrations/20260530140000_aguas_claras_menu.sql` e `20260530150000_aguas_claras_rename_to_candangolandia.sql`: abortavam com `RAISE EXCEPTION` se a filial "Águas Claras" não existisse — mas essa filial é dado operacional (criado pela UI), não por seed, então nunca existe num ambiente novo. Trocado por `RAISE NOTICE` + `RETURN` (skip silencioso), mesmo padrão já usado no arquivo pro caso "cardápio já existe".
4. `supabase/seed.sql`: todo o cardápio da Loja Principal (categorias, ingredientes, addons, produtos) era inserido sem `branch_id` — coluna `NOT NULL` desde a migration de multi-filial (`20260515230100`), nunca atualizada no seed. Corrigido: resolve `v_branch_id` pela filial `slug='principal'` e passa a inserir/limpar tudo escopado a ela (antes a limpeza também apagava produtos de **todas** as filiais, não só da Loja Principal — corrigido junto).

Nenhum desses 4 bugs afeta produção (schema já tem os dados via drift/migrations já aplicadas lá) — só bloqueavam ambiente local do zero e CI.

### Mismatch de hidratação do React (investigado, não totalmente corrigido)
Ao tentar testar no navegador pela primeira vez, nenhuma página do app aceitava clique/digitação — reproduzido também em `/login`, página não tocada por esta mudança. Investigação:
- `src/app/layout.tsx` colocava um `<script dangerouslySetInnerHTML>` bruto manualmente dentro de `<head>` (bootstrap de tema, pra evitar flash do tema errado). Trocado pelo componente `next/script` com `strategy="beforeInteractive"`, dentro de `<body>` — é o padrão documentado do Next.js para exatamente esse caso (o `<head>` do App Router deveria ser só gerenciado pela Metadata API/Script component, não escrito manualmente).
- Essa troca **não eliminou** o erro de hidratação (React error #418) — ele persiste tanto em `next dev` quanto em build de produção (`next start`), então não é causado só por esse script; a causa raiz de fato não foi identificada nesta sessão.
- Achado importante: em **modo dev** (`next dev`/Turbopack, usado pelo `preview_start`), esse erro de hidratação trava a interatividade da página inteira (cliques/digitação não fazem nada). Em **build de produção** (`next start`), o mesmo erro aparece no console mas o React se recupera e a página fica interativa normalmente — foi assim que consegui validar o fluxo de CEP no navegador (ver acima).
- **Ação recomendada, não feita nesta sessão**: investigar a causa raiz do React error #418 (provavelmente ligado a alguma diferença entre o HTML gerado no servidor e o esperado no cliente — data-theme, formatação de data/hora, ou algo assim). Não bloqueia produção (o app funciona), mas deixa o modo `next dev` inutilizável para teste manual neste ambiente específico até ser corrigido.

### Limitações conhecidas
- Sem fallback manual quando o ViaCEP está fora do ar — decisão consciente, mas significa que uma instabilidade do serviço de terceiro bloqueia checkout de entrega até normalizar.
- Não há geocodificação real (lat/lng) nem zonas por polígono/raio — o match de zona continua por nome de bairro (agora vindo do CEP, não mais digitado). Isso é suficiente para o objetivo desta melhoria, mas ainda não dá suporte a cálculo de distância/rota, que é relevante para a Fase 4 (motoboy).

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

**Pós-Fase 3 (validação de CEP):**
8. Bairro retornado pelo ViaCEP substitui o texto digitado como fonte de verdade para o match de zona.
9. CEP não encontrado/serviço fora do ar → bloqueia o pedido, sem fallback manual.
10. Aplicar a validação tanto no checkout público quanto no fluxo do atendente.
11. Motoboy será **próprio** (não terceirizado) — desbloqueia a Fase 4, ainda não implementada.

## Decisões de negócio ainda em aberto

1. Rastreamento em tempo real (GPS do motoboy) — fora do escopo realista atual; a proposta é status discreto.
2. Interação com split-bill — continua bloqueado explicitamente para `ENTREGA`; confirmar se essa é a regra desejada a longo prazo.

## Arquivos-chave

**Fase 2:** `supabase/migrations/20260817050000_delivery_zones.sql`, `20260817050100_customer_addresses.sql`, `20260817050200_branch_delivery_settings.sql`, `20260817050300_whatsapp_out_for_delivery_event.sql`, `supabase/functions/_shared/delivery.ts`, `create-public-order/index.ts`, `get-public-checkout-config/index.ts`, `get-public-customer-profile/index.ts`, `src/lib/utils/delivery.ts`, `src/app/pedir/page.tsx`

**Fase 3:** `supabase/migrations/20260817130000_couriers.sql`, `supabase/functions/dispatch-delivery/index.ts`, `src/lib/api/branches-admin-api.ts` (`couriersApi`), `src/app/app/configuracoes/filiais/page.tsx`, `src/app/app/pedidos/components/OrderDetailsSheet.tsx`, `OrderDetailsModal.tsx`

**Comuns às duas fases:** `src/lib/api/pdv-api.ts`, `src/types/pdv.ts`, `supabase/functions/create-attendant-order/index.ts`

**Validação de CEP (pós-Fase 3):** `supabase/migrations/20260818000000_customer_addresses_postal_code_format.sql`, `supabase/functions/_shared/cep.ts`, `supabase/functions/lookup-cep/index.ts`, `src/lib/utils/cep.ts`, `src/lib/api/pdv-api.ts` (`lookupCep`), `src/app/pedir/page.tsx`, `src/components/checkout/OrderSummarySheet.tsx`

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
12. (Validação de CEP) Em `/pedir` e em `/app/novo-pedido` → pedido de entrega: digitar um CEP válido e conferir o autofill de rua/bairro/cidade/UF; digitar um CEP inexistente ou mal formatado e conferir que o pedido fica bloqueado com mensagem clara; conferir que a taxa de entrega estimada bate com a zona do bairro retornado pelo CEP.
13. Reutilizar um endereço salvo antigo sem CEP no checkout público e confirmar que continua funcionando normalmente (a exigência de CEP vale só para endereço novo).
