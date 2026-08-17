# Prompt: Módulo de Delivery — Fase 2 (Zonas de Frete + Endereço Reutilizável + Checkout Público) - PDV Marcos Krep's

---

## Papel

Você é um engenheiro sênior full-stack trabalhando no **PDV Marcos Krep's**, um PWA de ponto de venda multi-filial para creperia (Candangolândia e Águas Claras, Brasília-DF). Sua tarefa é implementar, de ponta a ponta, a **Fase 2** do módulo de delivery: frete calculado por zona/bairro e por filial, endereço reutilizável vinculado ao cliente, e a opção "Entrega" no checkout público (`/pedir`). Preserve a arquitetura "trust-no-client" já usada no projeto (toda regra de preço/validação roda em Edge Functions, nunca no cliente).

Não prometa "sem falhas". Implemente defesa em profundidade, valide tudo no servidor, registre auditoria, cubra caminhos de erro, e documente qualquer risco ou decisão de negócio ainda em aberto.

---

## Contexto real do projeto

Stack atual:

- **Next.js 16.3.x** com App Router
- **React 19.2.x**
- **TypeScript**
- **Tailwind CSS v4**
- **Zustand** para carrinho em `src/features/cart/useCart.ts`
- **Supabase** (Postgres, Auth, RLS, Edge Functions, Realtime)
- Multi-filial: tabela `branches` (código curto, slug, `packing_fee`, `ordering_enabled`, horários, templates de WhatsApp por filial)

Antes de escrever código Next.js, leia `node_modules/next/dist/docs/`, especialmente `01-app/02-guides/upgrading/version-16.md` e `01-app/02-guides/backend-for-frontend.md`. `params`/`searchParams` são async em Server Components, layouts, pages e route handlers.

### O que a Fase 1 já entregou (mergeada em `main`, PR #109)

Documentado em `FEATURE_DELIVERY.md` (mantenha esse arquivo atualizado a cada fase — é um documento vivo, diferente deste prompt que é descartável após concluído):

- `order_type` ganhou `ENTREGA`; `order_status` ganhou `SAIU_PARA_ENTREGA` (entre `PRONTO` e `ENTREGUE`).
- `orders` tem colunas soltas de endereço (`delivery_street`, `delivery_number`, `delivery_complement`, `delivery_neighborhood`, `delivery_city`, `delivery_state`, `delivery_postal_code`, `delivery_reference`), `delivery_fee`, `courier_name`, `courier_phone`, `dispatched_at`, `delivery_delivered_at`.
- Settings globais `delivery_enabled` (bool) e `default_delivery_fee` (numeric) — **um valor fixo único, sem variação por bairro ou filial**.
- `supabase/functions/create-attendant-order/index.ts`: único ponto de entrada que cria pedidos `ENTREGA` hoje — só o atendente, via `/app/novo-pedido`. Valida endereço (rua + bairro obrigatórios), calcula `delivery_fee` a partir do setting global, bloqueia `split_bill` em pedidos de entrega.
- `supabase/functions/dispatch-delivery/index.ts` e `supabase/functions/confirm-delivery/index.ts`: fluxo `PRONTO → SAIU_PARA_ENTREGA → ENTREGUE`, com `courier_name`/`courier_phone` como texto livre digitado pelo atendente no despacho (sem tabela `couriers`).
- `supabase/functions/update-order-status/index.ts`: bloqueia pular direto `PRONTO → ENTREGUE` para `ENTREGA`.
- `src/types/pdv.ts`: `OrderType = 'BALCAO' | 'VIAGEM' | 'ENTREGA'`, `DeliveryAddress`, campos de entrega em `Order`.
- `src/lib/api/pdv-api.ts`: `dispatchDelivery`, `confirmDelivery`.
- `src/components/checkout/OrderSummarySheet.tsx`: toggle + formulário de endereço + prévia de taxa (fluxo interno do atendente).
- `src/app/app/pedidos/*`: timeline, badges, coluna Kanban/aba mobile para `SAIU_PARA_ENTREGA`, ações "Despachar"/"Confirmar Entrega".
- `src/app/pedido/[publicToken]/PedidoStatusClient.tsx`: já tem o mapeamento de `SAIU_PARA_ENTREGA` preparado, mas **não há como um pedido público chegar nesse estado hoje** — `/pedir` só aceita `BALCAO`/`VIAGEM`.

**Limitações conhecidas que esta fase resolve:**

1. Sem checkout público — só o atendente cria pedido de entrega.
2. Taxa de entrega fixa e global — sem variação por bairro/zona, sem variação por filial (`packing_fee` já é por filial em `branches`; `default_delivery_fee` não é).
3. Endereço não é reutilizável — cada pedido pede o endereço do zero.
4. Sem tabela `couriers` formal (mantido assim nesta fase — ver "Fora de escopo").

Arquivos-chave existentes a reaproveitar/estender:

- `src/app/pedir/[slug]/page.tsx` e `src/app/pedir/page.tsx`: fluxo público atual (menu real via `src/lib/api/menu-api.ts`).
- `supabase/functions/create-public-order/index.ts`: cria pedido público hoje só para `BALCAO`/`VIAGEM`, com Service Role, valida itens/preços no servidor.
- `supabase/functions/get-public-checkout-config/index.ts`, `list-public-branches/index.ts`, `get-public-branch-stats/index.ts`: config pública por filial — modelo para expor zonas/taxas de entrega da filial ao público.
- `supabase/functions/get-customer-profile/index.ts`, `get-public-customer-profile/index.ts`: perfil público do cliente por telefone (`customers.remember_checkout_data`) — modelo para "lembrar endereço".
- `supabase/migrations/20260512000100_public_customer_profiles.sql`: `customers.remember_checkout_data`, `checkout_profile_updated_at` — mesmo padrão de opt-in a seguir para endereços salvos.
- `supabase/migrations/20260515230000_multi_branch_schema.sql`: `branches.packing_fee` é o precedente direto de "taxa configurável por filial" — siga o mesmo padrão para frete.
- `docs/whatsapp-cloud-setup.md` e `supabase/functions/send-whatsapp`, `whatsapp-webhook`: fila/templates de notificação existente — reaproveitar para o evento de despacho.

---

## Objetivo

1. **Frete por zona/bairro, por filial.**
   - Nova tabela `delivery_zones` (bairro/lista de bairros → taxa, por `branch_id`), com fallback explícito para `branches.default_delivery_fee` (renomear/mover o setting global atual para coluna por filial, com migração de dados) quando o bairro não estiver cadastrado.
   - Painel em `/app/configuracoes` (ou nova subseção) para o ADMIN cadastrar/editar zonas por filial.

2. **Endereço reutilizável vinculado ao cliente.**
   - Nova tabela `customer_addresses` (endereço completo + label opcional tipo "Casa"/"Trabalho", vinculada a `customers` por telefone, seguindo o padrão de opt-in de `remember_checkout_data`).
   - Cliente que já pediu antes e permitiu lembrar dados vê os endereços salvos ao voltar em `/pedir`.

3. **Checkout público com opção "Entrega".**
   - `/pedir` ganha a opção `ENTREGA` ao lado de `BALCAO`/`VIAGEM` (respeitando `delivery_enabled` por filial).
   - Formulário de endereço com autocompletar de bairro a partir das zonas cadastradas da filial e taxa estimada exibida **antes** do pagamento/confirmação.
   - `create-public-order` passa a aceitar `order_type = 'ENTREGA'`, recalculando a taxa no servidor a partir de `delivery_zones`/fallback — nunca confiar em taxa vinda do cliente.
   - `/pedido/[publicToken]` exibe publicamente o estado "Saiu para entrega" (o mapeamento já existe em `PedidoStatusClient.tsx`, confirme que cobre esse fluxo ponta a ponta).

4. **Notificação WhatsApp no despacho.**
   - Estender a fila `whatsapp_messages`/templates existentes com o evento "pedido saiu para entrega", disparado por `dispatch-delivery`.

### Fora de escopo desta fase (não implementar)

- Tabela `couriers` formal com login próprio (Fase 3 do `FEATURE_DELIVERY.md`).
- Rastreamento em tempo real (GPS).
- Pedido mínimo para entrega (a menos que o usuário decida incluir — ver "Decisões de negócio").
- Integrações externas tipo iFood/Rappi como canal de pedido (Fase 4; hoje `IFOOD` só existe como `payment_method`).
- Split bill em pedidos de entrega (mantém bloqueado, igual à Fase 1).

---

## Arquitetura alvo

### Banco/migrations (aditivas, sem DROP destrutivo)

```sql
-- Zonas de frete por filial
CREATE TABLE delivery_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  neighborhood  TEXT NOT NULL,           -- normalizado (lower/trim) para matching
  fee           NUMERIC(10,2) NOT NULL CHECK (fee >= 0),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, neighborhood)
);

-- Endereços salvos do cliente (opt-in, mesmo padrão de remember_checkout_data)
CREATE TABLE customer_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label         TEXT,
  street        TEXT NOT NULL,
  number        TEXT,
  complement    TEXT,
  neighborhood  TEXT NOT NULL,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT,
  reference     TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Taxa default por filial substitui o setting global default_delivery_fee
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS default_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
-- Migration de dados: copiar o valor atual do setting global para todas as
-- filiais ativas antes de o código parar de ler o setting global.
```

Decida explicitamente (documente no PR) se `settings.delivery_enabled`/`default_delivery_fee` globais são descontinuados nesta fase ou mantidos como fallback final quando a filial não tiver valor próprio — **não delete o setting global sem migrar os dados primeiro**.

Habilitar RLS em `delivery_zones` (leitura pública restrita ao necessário — igual ao padrão de `get-public-checkout-config`, nunca acesso direto amplo pelo anon client) e em `customer_addresses` (mutação só via Edge Function autenticada/validada por telefone, nunca policy que permita um cliente ler endereço de outro).

### Edge Functions

- Atualizar `create-public-order`: aceitar `order_type = 'ENTREGA'`, endereço, recalcular `delivery_fee` a partir de `delivery_zones` (match por `branch_id` + bairro normalizado) com fallback para `branches.default_delivery_fee`.
- Atualizar `get-public-checkout-config` (ou criar `list-delivery-zones`): expor ao público as zonas ativas da filial (bairro + taxa) para o formulário mostrar taxa estimada antes de enviar.
- Criar/estender `get-public-customer-profile` (ou função dedicada) para retornar endereços salvos do cliente quando `remember_checkout_data = true`.
- Criar `save-customer-address` (ou incorporar em `create-public-order` com flag "salvar este endereço") — sempre com opt-in explícito do cliente, nunca salvar endereço sem consentimento.
- Estender `dispatch-delivery` para enfileirar a notificação WhatsApp de "saiu para entrega" (reaproveitar o padrão de `send-whatsapp`/fila `whatsapp_messages`, não bloquear a resposta da função em caso de falha de envio).
- Reaproveitar a lógica de cálculo de taxa entre `create-attendant-order` e `create-public-order` — extraia para um módulo compartilhado em `supabase/functions/_shared/` em vez de duplicar a query de `delivery_zones` nos dois arquivos.

### Frontend

- `src/app/pedir/[slug]/page.tsx` / componentes de checkout público: adicionar opção "Entrega" (gated por `delivery_enabled` da filial), formulário de endereço com sugestão de bairros cadastrados, exibição de taxa estimada e endereços salvos quando o cliente tiver perfil.
- `src/lib/api/menu-api.ts` ou novo `src/lib/api/delivery-api.ts`: buscar zonas/taxa da filial.
- `src/lib/api/pdv-api.ts`: estender `createPublicOrder`/`CreatePublicOrderPayload` com endereço e (opcional) `save_address`.
- `src/app/app/configuracoes/`: nova seção para ADMIN gerenciar `delivery_zones` por filial (CRUD simples: bairro, taxa, ativo/inativo).
- `src/types/pdv.ts`: novos tipos `DeliveryZone`, `CustomerAddress`.

---

## Fluxo backend seguro

- Nunca confiar em `delivery_fee` vindo do cliente em nenhum dos dois pontos de entrada (`create-attendant-order`, `create-public-order`) — sempre recalcular a partir de `delivery_zones`/fallback no servidor.
- Normalizar bairro (trim + lower, e considere acentos) tanto ao salvar zonas quanto ao fazer o match do endereço do cliente, para evitar taxa 0 por divergência de string ("Águas Claras" vs "aguas claras").
- Validar que a filial (`branch_id`) do pedido é a mesma dona da zona usada no cálculo — nunca aplicar taxa de zona de outra filial.
- `customer_addresses`: mutação (criar/editar/apagar) só via Edge Function que valida o telefone do dono (mesmo padrão de `get-public-customer-profile`), nunca update direto client-side.
- Auditoria (`audit_logs`) para criação/edição de `delivery_zones` (ação administrativa) e para o evento de despacho com notificação WhatsApp.
- CORS restrito em produção, validação de payload/tamanho/schema, sanitização de strings — mesmo padrão de `create-public-order` já existente.

---

## UX obrigatória

- Mobile-first, consistente com o restante de `/pedir`.
- Opção "Entrega" só aparece se a filial tiver `delivery_enabled = true`.
- Ao digitar/selecionar o bairro, mostrar a taxa estimada antes de avançar — sem taxa surpresa na tela final.
- Se o bairro não estiver na lista de zonas atendidas da filial, deixar claro que não há entrega para aquele endereço (ou aplicar o fallback, conforme decisão de negócio) — nunca falhar silenciosamente.
- Cliente que tem `remember_checkout_data = true` e endereço salvo: mostrar endereço(s) salvos com opção de escolher ou cadastrar novo.
- Opt-in explícito e visível para salvar o endereço ("Salvar este endereço para próximos pedidos"), nunca marcado por padrão sem o cliente ver.
- Inputs com fonte mínima de 16px em mobile, touch targets de pelo menos 44px, sem quebrar layout em 360px.
- `/pedido/[publicToken]`: confirmar que o estado "Saiu para entrega" tem copy amigável (ex.: "Seu pedido saiu para entrega!") e, se houver `courier_name`, exibir de forma opcional/discreta.

---

## Segurança obrigatória

- Server-side validation completa em todos os novos payloads.
- RLS habilitado em `delivery_zones` e `customer_addresses`.
- `customer_addresses` nunca exposto a outro cliente — nunca por `customer_id`/telefone alheio.
- Endereços salvos e taxa nunca vêm do client em `create-public-order`/`create-attendant-order`; sempre recalculados.
- Rate limiting ou proteção equivalente nas Edge Functions públicas novas/alteradas.
- Logs sem PII sensível (endereço completo, telefone) em nível de erro exposto ao cliente.
- Mensagens públicas genéricas para falhas — nunca stack trace nem erro cru de banco.

---

## Critérios de aceitação

- [ ] `delivery_zones` existe, com CRUD funcional em `/app/configuracoes` restrito a ADMIN.
- [ ] `branches.default_delivery_fee` substitui (ou complementa com fallback claro e documentado) o setting global `default_delivery_fee`, com migração de dados sem perda.
- [ ] `/pedir` oferece "Entrega" quando a filial habilita, com formulário de endereço e taxa estimada exibida antes da confirmação.
- [ ] `create-public-order` recalcula `delivery_fee` no servidor a partir de `delivery_zones`/fallback e rejeita taxa divergente vinda do cliente.
- [ ] Pedido público de entrega segue o mesmo fluxo operacional `PRONTO → SAIU_PARA_ENTREGA → ENTREGUE` já existente (`dispatch-delivery`/`confirm-delivery`), sem duplicar lógica.
- [ ] `/pedido/[publicToken]` mostra corretamente o estado "Saiu para entrega" para pedidos públicos.
- [ ] Cliente com `remember_checkout_data = true` vê endereços salvos e pode escolher ou cadastrar um novo, com opt-in explícito para salvar.
- [ ] `customer_addresses` não vaza entre clientes diferentes (testar acesso cruzado).
- [ ] Notificação WhatsApp de "saiu para entrega" é enviada no despacho, sem bloquear a resposta da função em caso de falha do provedor.
- [ ] Bairro não cadastrado na filial tem comportamento definido e documentado (bloqueio ou fallback), nunca taxa 0 por erro silencioso de matching.
- [ ] Split bill continua bloqueado para `ENTREGA` (regressão da Fase 1).
- [ ] `npm run lint` passa (ou lista explicitamente os warnings pré-existentes não relacionados).
- [ ] `npx tsc --noEmit` passa.
- [ ] `npm run build` passa (validar com `.env.local` configurado com credenciais reais/sandbox).
- [ ] `FEATURE_DELIVERY.md` atualizado com o status da Fase 2, limitações conhecidas e o que ficou para a Fase 3.

---

## Testes esperados

Cenários obrigatórios (documentar manual se não houver framework de testes automatizados configurado):

- Pedido público de entrega em bairro cadastrado calcula a taxa correta da zona.
- Pedido público de entrega em bairro não cadastrado segue a regra definida (bloqueio ou fallback) sem taxa 0 acidental.
- Taxa adulterada enviada pelo cliente no payload não afeta o total oficial.
- Zona de outra filial não é aplicada a pedido de filial diferente.
- Cliente sem `remember_checkout_data` não tem endereço salvo nem exposto.
- Cliente com endereço salvo consegue reutilizá-lo em um novo pedido.
- Um cliente não consegue ler/editar endereço de outro cliente.
- Despacho de pedido de entrega dispara a notificação WhatsApp corretamente; falha no envio não derruba `dispatch-delivery`.
- Fluxo `BALCAO`/`VIAGEM` público existente não regride.
- Split bill continua rejeitado para `ENTREGA` no checkout público e no interno.

---

## Entregáveis

Ao finalizar, entregar:

1. Resumo do que foi implementado, com decisões tomadas nos pontos em aberto abaixo.
2. Lista dos arquivos alterados/criados.
3. Migrations novas e ordem de aplicação.
4. Resultado de `npm run lint`, `npx tsc --noEmit` e `npm run build`.
5. Checklist de testes manuais feitos (local/sandbox Supabase).
6. `FEATURE_DELIVERY.md` atualizado.
7. Limites conhecidos e o que fica para a Fase 3 (`couriers` com login, métricas de tempo).

---

## Proibições

- Não confiar em taxa de entrega vinda do navegador.
- Não expor `customer_addresses` de um cliente para outro.
- Não salvar endereço sem opt-in explícito e visível do cliente.
- Não remover o setting global de taxa sem migrar os dados existentes para `branches.default_delivery_fee` primeiro.
- Não duplicar a lógica de cálculo de taxa entre `create-attendant-order` e `create-public-order` — compartilhar via `supabase/functions/_shared/`.
- Não desabilitar RLS para "facilitar".
- Não quebrar o fluxo interno existente de `/app/novo-pedido`, `/app/pedidos`, despacho/confirmação de entrega da Fase 1, nem o checkout público `BALCAO`/`VIAGEM`.
- Não implementar tabela `couriers`/login de motoboy nesta fase (fica para a Fase 3).
- Não implementar integrações externas (iFood/Rappi) nesta fase (fica para a Fase 4).

---

## Decisões de negócio a confirmar com o usuário antes de codar

Herdadas do `FEATURE_DELIVERY.md` e ainda sem resposta — pergunte antes de assumir:

1. Bairro fora da lista de zonas cadastradas: bloquear pedido de entrega ou aplicar `branches.default_delivery_fee` como fallback?
2. Pedido mínimo para entrega — existe algum valor, geral ou por filial?
3. Cancelamento após despacho (`SAIU_PARA_ENTREGA`) — permitir? Qual o tratamento financeiro (estorno, taxa de entrega já paga ao entregador, etc.)?
4. O setting global `delivery_enabled`/`default_delivery_fee` deve ser completamente descontinuado nesta fase ou mantido como fallback de última instância abaixo de `branches.default_delivery_fee`?
5. Motoboy próprio, terceirizado ou ambos — decisão que não bloqueia a Fase 2, mas deve ser registrada para orientar a Fase 3.

---

## Primeiro passo recomendado

Antes de codar, produza um plano técnico curto contendo:

1. Confirmação das decisões de negócio acima com o usuário.
2. Desenho final das tabelas `delivery_zones` e `customer_addresses` (incluindo RLS).
3. Estratégia de migração do setting global `default_delivery_fee` para `branches.default_delivery_fee`.
4. Lista de Edge Functions novas/alteradas e o módulo compartilhado de cálculo de taxa.
5. Contrato dos payloads públicos (`create-public-order` estendido).

Depois implemente em incrementos pequenos, validando `tsc`/`lint`/`build` a cada etapa, e sem quebrar o fluxo de delivery interno (Fase 1) já em produção.
