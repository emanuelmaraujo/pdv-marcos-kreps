# Prompt: Módulo de Delivery — Fase 3 (Cadastro de Entregadores + Métricas de Tempo) - PDV Marcos Krep's

---

## Papel

Você é um engenheiro sênior full-stack trabalhando no **PDV Marcos Krep's**. Sua tarefa é implementar a **Fase 3** do módulo de delivery: um cadastro formal de entregadores (`couriers`) reutilizável no despacho, e métricas de tempo do ciclo de entrega (`PRONTO → SAIU_PARA_ENTREGA` e `SAIU_PARA_ENTREGA → ENTREGUE`) visíveis no painel operacional. Preserve a arquitetura "trust-no-client" e não regrida nada das Fases 1 e 2 (já em produção).

---

## Contexto real do projeto

Fases já entregues (ver `FEATURE_DELIVERY.md` para o histórico completo):

- **Fase 1**: pedido `ENTREGA` interno, fluxo `PRONTO → SAIU_PARA_ENTREGA → ENTREGUE` via `dispatch-delivery`/`confirm-delivery`, `courier_name`/`courier_phone` como texto livre em `orders`.
- **Fase 2**: `delivery_zones` (frete por bairro/filial), `customer_addresses` (endereço reutilizável), checkout público com `ENTREGA`, notificação WhatsApp no despacho.

Nota: em paralelo a este módulo, outra frente de trabalho neste mesmo repositório fez um endurecimento geral de segurança/confiabilidade (`create_attendant_order_transactional`, `create_public_order_transactional`, `pay_order_items_transactional`, `rls_hardening`, rate limiting) — **leia o `git log` e o schema atual antes de assumir que qualquer arquivo está do jeito descrito nas Fases 1/2**; várias Edge Functions podem ter sido movidas para chamar funções SQL transacionais em vez de fazer os inserts diretamente em JS. Adapte-se ao código real, não ao que este prompt presume.

Arquivos-chave a reaproveitar/estender:

- `supabase/functions/dispatch-delivery/index.ts`: hoje aceita `courier_name`/`courier_phone` como texto livre opcional.
- `src/app/app/pedidos/components/OrderDetailsSheet.tsx` / `OrderDetailsModal.tsx`: formulário de despacho (nome/telefone do entregador digitados na hora), timeline do pedido.
- `orders.dispatched_at`, `orders.delivery_delivered_at`, `orders.ready_at`: timestamps já existentes — base para as métricas de tempo, sem precisar de novas colunas.
- `src/app/app/configuracoes/filiais/page.tsx`: padrão de CRUD simples dentro da tela de filiais (usado para `delivery_zones` na Fase 2) — modelo de referência para o CRUD de `couriers`.

---

## Objetivo

1. **Cadastro de entregadores (`couriers`)**
   - Tabela `couriers`: nome, telefone, `active`, vinculada a uma ou mais filiais (ou global — decidir, ver seção de decisões).
   - CRUD simples para ADMIN (mesmo padrão RLS-gated direto do client, sem Edge Function dedicada — ver como `delivery_zones` foi feito na Fase 2).
   - `dispatch-delivery` passa a aceitar `courier_id` (referência a `couriers`) **além** de continuar aceitando `courier_name`/`courier_phone` como texto livre — nunca remover a opção de entregador avulso/eventual, só adicionar a opção de selecionar um cadastrado.
   - `orders` ganha `courier_id UUID REFERENCES couriers(id)` (nullable); `courier_name`/`courier_phone` continuam sendo o snapshot exibido/impresso (preenchidos a partir do cadastro quando `courier_id` for usado, ou digitados livremente quando não).

2. **Métricas de tempo**
   - Calcular e exibir, por pedido de entrega, em `OrderDetailsSheet`/`OrderDetailsModal`:
     - Tempo "Pronto → Saiu": `dispatched_at - ready_at`.
     - Tempo "Saiu → Entregue": `delivery_delivered_at - dispatched_at`.
   - Considerar uma visão agregada (média por entregador, por filial, por dia) — avaliar se cabe num painel existente (`/app/caixa/relatorio`) ou se merece uma seção nova; não superdimensionar se o volume de pedidos de entrega ainda for baixo.

### Fora de escopo desta fase (não implementar sem decisão explícita)

- Login próprio do entregador (`couriers.profile_id` + app/tela do motoboy) — fica para uma Fase 4, só depois da decisão de negócio "motoboy próprio vs. terceirizado" ser tomada.
- Rastreamento em tempo real (GPS).
- Qualquer coisa relacionada a iFood/Rappi.

---

## Arquitetura alvo

```sql
CREATE TABLE couriers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = disponível para todas as filiais; decidir se faz sentido pro negócio
  name        TEXT NOT NULL,
  phone       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id);
```

RLS: sem policy pública (entregador não tem app próprio nesta fase); leitura para `authenticated` (equipe), gestão só ADMIN — mesmo padrão de `delivery_zones`.

`dispatch-delivery`: se `courier_id` vier no payload, buscar `couriers.name`/`phone` no servidor (nunca confiar em nome/telefone vindo do client quando um `courier_id` é informado) e gravar tanto `courier_id` quanto o snapshot `courier_name`/`courier_phone`. Se só vier `courier_name`/`courier_phone` livre (sem `courier_id`), manter o comportamento atual da Fase 1.

---

## Critérios de aceitação

- [ ] CRUD de `couriers` funcional em `/app/configuracoes` (ou seção própria), restrito a ADMIN.
- [ ] Despacho permite escolher um entregador cadastrado **ou** digitar um avulso, sem quebrar o fluxo existente.
- [ ] `orders.courier_id` gravado corretamente quando um entregador cadastrado é usado.
- [ ] Tempo "Pronto → Saiu" e "Saiu → Entregue" visível no `OrderDetailsSheet`/`OrderDetailsModal` para pedidos de entrega.
- [ ] Nenhuma regressão nas Fases 1 e 2 (rodar o roteiro de testes delas de novo).
- [ ] `npx tsc --noEmit`, `npx eslint .` sem novos erros, `npm run build` compila.
- [ ] Testado contra um Supabase local real antes do merge (mesmo padrão usado nas Fases 1/2 — não confiar só em leitura de código).
- [ ] `FEATURE_DELIVERY.md` atualizado com o status da Fase 3.

---

## Decisões de negócio a confirmar com o usuário antes de codar

1. Entregador é por filial ou compartilhado entre todas? (afeta se `couriers.branch_id` é obrigatório, opcional, ou se existe `courier_branches` N:N como `profile_branches`)
2. Motoboy próprio, terceirizado, ou ambos — não bloqueia esta fase, mas orienta se vale a pena já desenhar `couriers.profile_id` (mesmo que não usado ainda) para não precisar de outra migration na Fase 4.
3. As métricas de tempo precisam de um painel agregado agora, ou só o tempo por pedido individual já resolve por enquanto?

---

## Primeiro passo recomendado

1. Confirmar as decisões de negócio acima.
2. Ler o código atual de `dispatch-delivery`, `create-attendant-order`, `OrderDetailsSheet`/`OrderDetailsModal` — não assumir que estão como nas Fases 1/2, dado o refactor transacional paralelo mencionado no contexto.
3. Migration aditiva para `couriers` + `orders.courier_id`.
4. Implementar em incrementos pequenos, testando contra Supabase local real antes do merge.
