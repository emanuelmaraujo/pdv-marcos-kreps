# Proposta — Programa de Fidelidade Krep's

> **Status:** proposta para discussão · **Autor:** Claude (full-stack + atendimento) · **Data:** 2026-05-25
>
> **Confirmado em 2026-08-04:** auditoria de código não encontrou nenhuma tabela, Edge Function ou componente de fidelidade — a proposta segue não iniciada, aguardando decisão.
> **Branch sugerida:** `feat/fidelidade-mvp`
> **Pré-requisitos já no projeto:** `customers` (E.164, opt-in), `whatsapp_messages` (fila + retry + idempotência), Edge Functions Supabase, multi-filial (`branches`), checkout público em `/pedir/[slug]`.

---

## 1. Resumo executivo

Krep's já tem três peças críticas prontas:
1. **Identidade do cliente por telefone E.164** (`customers` é único por `phone_e164` e já é alimentado em todo pedido público).
2. **Pipeline WhatsApp Cloud API transacional** com fila, retry exponencial, opt-in/opt-out, idempotência por `(order_id, event_type)` e auditoria.
3. **Edge Functions com trust-no-client** (`create-public-order`, `confirm-order`, `mark-payment`) — o lugar certo para amarrar regras de fidelidade.

Em cima disso, a proposta é um **programa de selos digitais (stamp card)** — "compre N, ganhe 1" — com:
- **Carteira digital do cliente** (PWA passwordless, acessada por link assinado enviado no WhatsApp; sem app nativo, sem login).
- **Notificações WhatsApp transacionais** (templates UTILITY, custo baixo) a cada selo ganho e quando a recompensa fica disponível.
- **Console no PDV** para o atendente identificar o cliente por telefone, ver o status e bater "resgatar".
- **Dashboard de fidelidade** com KPIs de engajamento, taxa de resgate, frequência, retenção e ROI do programa.

O modelo de selo foi escolhido em vez de pontos porque (i) é o que o cliente de lanchonete entende em 2 segundos sem explicação, (ii) cabe num cartão visual de carteira, (iii) tem custo previsível por brinde, (iv) gera gatilhos naturais de WhatsApp ("faltam 2 selos", "recompensa liberada"). **Pontos ficam como evolução futura** (Fase 4) quando quisermos múltiplas recompensas e níveis VIP.

### Por que isso traz mais clientes
- **Reativação:** todo cliente que pediu uma vez deixou telefone — o programa transforma esse histórico em motivo de retorno.
- **Ancoragem:** "faltam 2 selos para o krep grátis" é o gatilho clássico de **endowed progress effect** (já tem progresso, não quer perder).
- **Boca-a-boca incentivado** (Fase 3): cupom de indicação para cliente que traz outro novo telefone.
- **Base própria de marketing** (Fase 4): com opt-in marketing separado, dá pra disparar campanhas segmentadas (chuva, dia de pouco movimento, lançamento) sem depender de Instagram.

---

## 2. Opinião técnica e escolhas

| Decisão | Recomendação | Justificativa |
|---|---|---|
| Modelo do programa | **Stamp card** (compre N, ganha 1) | Simples, visual, custo previsível, casa com "carteira". Pontos vêm depois. |
| Carteira | **PWA própria** em `/fidelidade/[token]` (link assinado HMAC + JWT curto) | Sem fricção de instalação. Apple/Google Wallet pass entra como Fase 3 (overhead de certificados Apple não vale no MVP). |
| Identidade | **Telefone E.164** (reaproveitar `customers`) | Já é a fonte da verdade. Sem senha, sem cadastro extra. |
| Acúmulo | **Server-side, na Edge Function que confirma pagamento** | Trust-no-client. Idempotente por `order_id` (igual ao WhatsApp). |
| Unidade do selo | **1 selo por pedido pago** (com valor mínimo configurável) | Não recompensa por item — evita gaming (separar pedido em vários). Valor mínimo configurável por filial. |
| Resgate | **PDV scanneia QR/código do cliente OU busca por telefone**, atendente confirma | Fricção zero no caixa, mesmo fluxo que já existe pra buscar pedido por telefone (`lookup-orders-by-phone`). |
| Validade do selo | **90 dias rolling** (configurável) | Cria urgência sem ser punitivo. |
| Validade da recompensa | **30 dias** após desbloqueio | Recompensa "queima" se o cliente sumir; vira gatilho de reengajamento. |
| WhatsApp | **Templates UTILITY** amarrados a evento de pedido | Custo ~10× menor que MARKETING e fica dentro da política da Meta. |
| Multi-filial | **Programa global por padrão** + flag pra restringir filiais participantes | A maioria das redes pequenas roda 1 programa só. Schema permite escopar depois. |
| LGPD | **Opt-in transacional ≠ opt-in marketing** (já está separado) | Reaproveitar `whatsapp_opt_in` (transacional) e `marketing_opt_in` (campanhas). Fidelidade conta como transacional. |
| Compliance Meta | **Texto do template não pode ser promocional puro** | Templates devem informar status do pedido + status da conta. Modelos sugeridos abaixo. |

### Onde discordo de uma abordagem ingênua
- **Não** dar selo no momento do pedido (`create-public-order`). O cliente pode cancelar / não pagar. **Dar selo só em `mark-payment` quando `payment_status='PAID'`**, e revogar se houver estorno.
- **Não** mandar WhatsApp avulso fora de evento transacional no MVP — a Meta penaliza, e o custo de MARKETING + risco de bloqueio do número não compensa. Toda mensagem de selo é gatilhada por pedido pago.
- **Não** acoplar fidelidade ao desconto de cardápio. O brinde fica **fora do pedido** (item de cortesia que o atendente lança como `discount`/cortesia, igual ao que já existe no projeto). Mantém o cálculo de receita limpo e o `cash-report` reflete o custo de cortesia como hoje.

---

## 3. Arquitetura — Camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cliente (WhatsApp)                                                   │
│   recebe template "ganhou um selo" → link curto /fidelidade/[token]  │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PWA Carteira (Next.js, rota pública)                                 │
│   - mostra selos, recompensas, histórico                             │
│   - gera QR efêmero (TOTP-like) para resgate no balcão               │
│   - botão opt-out marketing (LGPD)                                   │
└──────────────────────────────────────────────────────────────────────┘
                            │  GET via Edge Function (token assinado)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Edge Functions (Supabase)                                            │
│   - loyalty-accrue       (chamada interna por mark-payment)          │
│   - loyalty-redeem       (PDV → debita recompensa, audit log)        │
│   - get-public-loyalty   (PWA → status do cliente)                   │
│   - loyalty-generate-link (envia link assinado para WhatsApp)        │
│   - loyalty-expire       (cron diário → expira selos/recompensas)    │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Postgres (RLS)                                                       │
│   loyalty_programs · loyalty_accounts · loyalty_transactions         │
│   loyalty_rewards · (extends customers, orders)                      │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PDV / Console interno (rotas /app/*)                                 │
│   - Tela caixa: mostra status fidelidade ao identificar telefone     │
│   - /app/fidelidade: dashboard KPIs                                  │
│   - /app/configuracoes → aba Fidelidade: regras e templates          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Schema (migration)

`supabase/migrations/20260601000000_loyalty_program.sql`

```sql
-- =============================================================================
-- 1. Programas (config). Default: 1 programa global "selo".
-- =============================================================================
CREATE TABLE loyalty_programs (
  id              TEXT PRIMARY KEY,                       -- 'default'
  name            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  stamps_required INTEGER NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 3 AND 30),
  reward_label    TEXT NOT NULL DEFAULT '1 Krep tradicional grátis',
  min_order_brl   NUMERIC(10,2) NOT NULL DEFAULT 0,       -- valor mínimo p/ contar selo
  stamp_ttl_days  INTEGER NOT NULL DEFAULT 90,            -- expira selo após X dias
  reward_ttl_days INTEGER NOT NULL DEFAULT 30,
  branch_scope    TEXT[] NOT NULL DEFAULT '{}',           -- vazio = todas as filiais
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO loyalty_programs (id, name) VALUES ('default', 'Cartão Fidelidade Krep''s');

-- =============================================================================
-- 2. Conta do cliente (1 por customer × program).
-- =============================================================================
CREATE TABLE loyalty_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  program_id      TEXT NOT NULL REFERENCES loyalty_programs(id),
  current_stamps  INTEGER NOT NULL DEFAULT 0,
  lifetime_stamps INTEGER NOT NULL DEFAULT 0,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, program_id)
);

CREATE INDEX idx_loyalty_accounts_customer ON loyalty_accounts(customer_id);

-- =============================================================================
-- 3. Transações (append-only — fonte da verdade. current_stamps é cache).
-- =============================================================================
CREATE TYPE loyalty_tx_kind AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVOKE');

CREATE TABLE loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  kind          loyalty_tx_kind NOT NULL,
  delta         INTEGER NOT NULL,                          -- +1 EARN, -N REDEEM, etc.
  balance_after INTEGER NOT NULL,
  order_id      UUID REFERENCES orders(id),                -- nullable: ADJUST manual
  reward_id     UUID,                                      -- FK abaixo
  reason        TEXT,
  actor_user_id UUID REFERENCES profiles(id),              -- quem operou (ADJUST/REDEEM)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotência: 1 EARN por pedido pago.
CREATE UNIQUE INDEX uniq_loyalty_earn_per_order
  ON loyalty_transactions(account_id, order_id)
  WHERE kind = 'EARN';

CREATE INDEX idx_loyalty_tx_account_time ON loyalty_transactions(account_id, created_at DESC);

-- =============================================================================
-- 4. Recompensas (geradas quando current_stamps atinge limiar; debitam selos).
-- =============================================================================
CREATE TYPE loyalty_reward_status AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'REVOKED');

CREATE TABLE loyalty_rewards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  program_id       TEXT NOT NULL REFERENCES loyalty_programs(id),
  code             TEXT NOT NULL UNIQUE,                   -- ex: 'KRP-4F2A-9XQ1' (curto, falável)
  label            TEXT NOT NULL,                          -- snapshot de reward_label
  status           loyalty_reward_status NOT NULL DEFAULT 'AVAILABLE',
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  redeemed_at      TIMESTAMPTZ,
  redeemed_order_id UUID REFERENCES orders(id),
  redeemed_by      UUID REFERENCES profiles(id)
);

CREATE INDEX idx_loyalty_rewards_account_status ON loyalty_rewards(account_id, status);
CREATE INDEX idx_loyalty_rewards_expiring ON loyalty_rewards(expires_at) WHERE status = 'AVAILABLE';

ALTER TABLE loyalty_transactions
  ADD CONSTRAINT fk_loyalty_tx_reward FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id);

-- =============================================================================
-- 5. Tracking de mensagens fidelidade (extende whatsapp_messages event_type).
-- =============================================================================
ALTER TABLE whatsapp_messages DROP CONSTRAINT chk_whatsapp_messages_event_type;
ALTER TABLE whatsapp_messages ADD CONSTRAINT chk_whatsapp_messages_event_type
  CHECK (event_type IN (
    'order_received', 'order_ready',
    'loyalty_stamp_earned', 'loyalty_reward_ready', 'loyalty_reward_expiring'
  ));

-- =============================================================================
-- 6. Link assinado: token salvo p/ não revalidar HMAC toda hora.
-- =============================================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS loyalty_portal_token TEXT,        -- HMAC(customer_id + secret), refresh sob demanda
  ADD COLUMN IF NOT EXISTS loyalty_portal_token_issued_at TIMESTAMPTZ;

-- =============================================================================
-- 7. RLS
-- =============================================================================
ALTER TABLE loyalty_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards      ENABLE ROW LEVEL SECURITY;

-- Equipe lê tudo; só ADMIN escreve. Mutações de cliente são via service-role.
CREATE POLICY "Equipe le loyalty_programs" ON loyalty_programs
  FOR SELECT TO authenticated USING (get_my_role() IN ('ADMIN','ATTENDANT'));
CREATE POLICY "Admin escreve loyalty_programs" ON loyalty_programs
  FOR ALL TO authenticated
  USING (get_my_role() = 'ADMIN') WITH CHECK (get_my_role() = 'ADMIN');

CREATE POLICY "Equipe le loyalty_accounts" ON loyalty_accounts
  FOR SELECT TO authenticated USING (get_my_role() IN ('ADMIN','ATTENDANT'));
CREATE POLICY "Equipe le loyalty_transactions" ON loyalty_transactions
  FOR SELECT TO authenticated USING (get_my_role() IN ('ADMIN','ATTENDANT'));
CREATE POLICY "Equipe le loyalty_rewards" ON loyalty_rewards
  FOR SELECT TO authenticated USING (get_my_role() IN ('ADMIN','ATTENDANT'));

-- Resgates partem do ATTENDANT via Edge Function (service role).
-- ADJUST manual fica restrito ao ADMIN via Edge Function.
```

---

## 5. Edge Functions

### 5.1 `supabase/functions/loyalty-accrue/index.ts` (interna)
- **Chamada por:** `mark-payment` (e `confirm-order` quando pagamento já bateu).
- **Auth:** service-role only (header interno `x-internal-secret`).
- **Pré-condições:** `orders.payment_status = 'PAID'`, `orders.customer_id IS NOT NULL`, total ≥ `min_order_brl`.
- **Idempotência:** unique `(account_id, order_id) WHERE kind='EARN'` cuida disso — INSERT racing falha graciosamente.
- **Lógica:**
  1. Upsert `loyalty_accounts(customer_id, program_id='default')`.
  2. INSERT `loyalty_transactions(kind='EARN', delta=+1, order_id, balance_after=current+1)`.
  3. UPDATE `loyalty_accounts` (`current_stamps`, `lifetime_stamps`, `last_activity_at`).
  4. Se `current_stamps >= stamps_required` → criar `loyalty_rewards(status='AVAILABLE', expires_at=now+TTL)`, debitar `stamps_required` via outra TX `REDEEM` (não, melhor: `delta=-N, kind='ADJUST', reason='unlock_reward', reward_id=X`), zerar `current_stamps`.
  5. Enqueue WhatsApp:
     - se nasceu recompensa → `event_type='loyalty_reward_ready'`.
     - senão → `loyalty_stamp_earned` (mas: rate-limit, ver §8).

### 5.2 `supabase/functions/loyalty-redeem/index.ts` (PDV)
- **Auth:** Bearer JWT ATTENDANT/ADMIN.
- **Input:** `{ reward_code, order_id }` (order_id opcional — pode resgatar sem pedido associado se for cortesia avulsa).
- **Lógica:**
  1. SELECT recompensa por code, valida `status='AVAILABLE'` e `expires_at > now`.
  2. UPDATE → `REDEEMED`, `redeemed_at`, `redeemed_by`, `redeemed_order_id`.
  3. INSERT `loyalty_transactions(kind='REDEEM', delta=0, reward_id=X, actor_user_id=auth.uid)`.
  4. INSERT `audit_logs(action='LOYALTY_REWARD_REDEEMED', ...)`.
  5. Retorna `{ ok, customer_name, label }` pro PDV exibir confirmação.

### 5.3 `supabase/functions/get-public-loyalty/index.ts`
- **Auth:** token HMAC no path (`/fidelidade/[token]`) — valida `loyalty_portal_token` + idade < 30 dias.
- **Retorna:** snapshot da conta (selos atuais, próximos passos, recompensas ativas com QR code/code, histórico últimas 10 tx, label de privacidade).
- **Rate limit:** 60 req/min por IP (Upstash ou simples in-memory cache).

### 5.4 `supabase/functions/loyalty-expire/index.ts` (cron)
- **Auth:** `x-cron-secret` (igual ao `send-whatsapp`).
- **Roda diariamente.** Dois passos:
  1. Recompensas `AVAILABLE` com `expires_at < now()` → `EXPIRED` + tx `EXPIRE`.
  2. Selos avulsos (transações `EARN` mais velhas que `stamp_ttl_days` sem ter contribuído pra recompensa): recalcula balance e gera tx `EXPIRE` se aplicável.
  3. Recompensas a 5 dias de expirar com cliente opt-in → enqueue `loyalty_reward_expiring` (UTILITY ok porque referencia recompensa específica da conta dele).

### 5.5 `_shared/whatsapp-enqueue.ts` (extensão)
Adicionar handlers para os 3 novos `event_type`. Manter `template_name` em `settings`:
```
whatsapp_template_stamp_earned     → "fidelidade_selo"
whatsapp_template_reward_ready     → "fidelidade_recompensa_liberada"
whatsapp_template_reward_expiring  → "fidelidade_recompensa_vencendo"
```

---

## 6. Templates WhatsApp (Meta, categoria UTILITY)

> Devem ser aprovados no Business Manager. Categoria **UTILITY** porque referenciam transação concreta (pedido pago, recompensa do cliente). Política Meta atual exige que o conteúdo dê estado/ação relacionado a serviço — os textos abaixo cumprem.

**`fidelidade_selo`** (após pedido pago, sem ainda atingir o brinde)
```
Olá {{1}}! Seu pedido foi confirmado. Você ganhou +1 selo no Cartão Krep's.
Selos atuais: {{2}}/{{3}}. Faltam {{4}} para o próximo {{5}}.

Veja seu cartão: {{6}}
```

**`fidelidade_recompensa_liberada`** (recompensa nasceu)
```
{{1}}, parabéns! Seu Cartão Krep's completou {{2}} selos.
Você ganhou: {{3}}.

Código de resgate: {{4}} — válido até {{5}}.
Mostre no balcão ou abra: {{6}}
```

**`fidelidade_recompensa_vencendo`** (5 dias antes do vencimento)
```
{{1}}, sua recompensa "{{2}}" expira em {{3}}.
Código: {{4}}. Passe no Krep's para resgatar: {{5}}
```

> **Custo Meta:** UTILITY na BR é da ordem de R$ 0,03–0,08 por mensagem entregue (varia por contrato; cotar). Volume estimado abaixo em §10.

---

## 7. UX — Carteira do cliente (PWA `/fidelidade/[token]`)

Mobile-first, single-page, server-rendered:

```
┌───────────────────────────────────────────┐
│  Olá, Carlos                              │
│  +55 61 ****-**42                         │
│                                           │
│  ╔═══════════════════════════════════╗    │
│  ║  Cartão Krep's                    ║    │
│  ║  ● ● ● ● ● ● ○ ○ ○ ○              ║    │
│  ║  6 / 10 selos                     ║    │
│  ║  Faltam 4 para 1 Krep tradicional ║    │
│  ╚═══════════════════════════════════╝    │
│                                           │
│  🎁 Recompensa disponível                 │
│  ┌─────────────────────────────────────┐  │
│  │ 1 Krep tradicional grátis           │  │
│  │ Código: KRP-4F2A-9XQ1               │  │
│  │ [ QR CODE ]                         │  │
│  │ Vence em 18 dias                    │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Histórico                                │
│  · 25/05  +1 selo  (Pedido #142)          │
│  · 21/05  +1 selo  (Pedido #138)          │
│                                           │
│  [ Não quero mais receber promoções ]     │  ← toggle marketing_opt_in
└───────────────────────────────────────────┘
```

Decisões finas:
- **QR code = `code` da recompensa** (estático, não rotaciona). É um cupom — perda equivale a perder o brinde, igual a cartão físico. Simplifica resgate offline.
- **Não pedir login.** Token assinado no link já comprova posse do número (já recebeu no WhatsApp dele).
- **PWA installable**: `manifest.ts` adiciona shortcut "Krep's Fidelidade". `apple-mobile-web-app-capable` para iOS salvarem na home.

---

## 8. UX — PDV / Console interno

### 8.1 `/app/caixa` (tela de cobrança)
Quando o atendente digita o telefone do cliente (fluxo já existe):
- Card abaixo de "cliente identificado": **`6/10 selos · 1 recompensa disponível [Resgatar]`**.
- Botão "Resgatar" → modal com input de `code` ou scanner de QR (lib `html5-qrcode`). Atendente confirma → chama `loyalty-redeem`.

### 8.2 `/app/fidelidade` (novo)
- **Visão geral:** clientes inscritos, selos emitidos (7d/30d), recompensas liberadas, recompensas resgatadas, taxa de resgate, frequência média de retorno.
- **Lista de clientes** com filtro (ativo/inativo/perto do brinde), exportável CSV.
- **Ajustes manuais (ADMIN):** dar/tirar selos com motivo (vai pro `audit_logs`).

### 8.3 `/app/configuracoes` → aba **Fidelidade**
- Editar `stamps_required`, `reward_label`, `min_order_brl`, TTLs.
- Editar nomes de templates WhatsApp.
- Botão "Enviar template teste" (reaproveita `send_test` do `send-whatsapp`).
- Toggle "Pausar programa" (continua resgatando mas não acumula).

---

## 9. Hooks no fluxo existente

### 9.1 `mark-payment` (e `confirm-order` quando o pedido nasce já pago)
Após confirmar que `payment_status='PAID'`, chamar `loyalty-accrue` **antes** de retornar:
```ts
// Pseudocódigo
if (order.payment_status === 'PAID' && order.customer_id) {
  await fetch(`${SUPABASE_URL}/functions/v1/loyalty-accrue`, {
    method: 'POST',
    headers: { 'x-internal-secret': INTERNAL_SECRET },
    body: JSON.stringify({ order_id: order.id }),
  });
  // Não bloquear resposta principal por falha aqui — log + retry (cron pega).
}
```
Falha de acrual nunca trava o checkout. Um cron `loyalty-reconcile` (rodar a cada hora) varre pedidos `PAID` sem `EARN` correspondente e refaz — mesmo padrão de resiliência do WhatsApp.

### 9.2 Estorno / cancelamento de pedido pago
Hook no caminho de cancelamento de pedido `PAID`: emite tx `REVOKE` (delta=-1) e marca order_id como revogado. Se a revogação derrubar uma recompensa já resgatada → bloqueia operação, força ADMIN a decidir.

### 9.3 Rate-limit das notificações de selo
Não vale a pena mandar WhatsApp a cada selo se o cliente pede 3 vezes na semana. Regra: **enviar `loyalty_stamp_earned` no máximo 1× a cada 48h por cliente**; coalescer (último pedido vence). `loyalty_reward_ready` e `loyalty_reward_expiring` sempre enviam (alto valor).

---

## 10. KPIs e instrumentação

Tudo derivável dos `loyalty_transactions` + `loyalty_rewards` + `orders` existentes. View materializada `loyalty_dashboard_v1`:

| Métrica | Fórmula | Meta inicial |
|---|---|---|
| **Inscritos** | `count(*) FROM loyalty_accounts` | — |
| **Engajamento (30d)** | accounts com ≥1 EARN em 30d / total | > 35% |
| **Selos emitidos (30d)** | `sum(delta) WHERE kind=EARN AND created_at > now()-30d` | — |
| **Recompensas liberadas (30d)** | `count FROM loyalty_rewards WHERE issued_at > now()-30d` | — |
| **Taxa de resgate** | `REDEEMED / (REDEEMED + EXPIRED)` em 90d | > 60% |
| **Tempo médio até 1ª recompensa** | mediana de (1ª recompensa.issued - enrolled_at) | — |
| **Frequência média (cliente fidelidade)** | pedidos/cliente/mês entre inscritos | comparar com não-inscritos |
| **Uplift de receita** | ticket × frequência (inscritos) vs (não-inscritos), pareado por mês de cadastro | > 15% |
| **CAC do programa** | custo total brindes + WhatsApp / novos inscritos | — |
| **LTV/CAC** | receita 90d média por inscrito / CAC | > 5× |
| **Taxa de entrega WhatsApp** | `delivery_status='DELIVERED' / SENT` | > 92% |
| **Taxa de clique no link** | encurtador (Fase 2) — clicks/sent | > 35% |
| **Reativados** | clientes inativos 30d+ que voltaram após mensagem fidelidade | acompanhar |

**Eventos para o `audit_logs`** (telemetria operacional):
- `LOYALTY_ENROLLED`, `LOYALTY_STAMP_EARNED`, `LOYALTY_REWARD_ISSUED`, `LOYALTY_REWARD_REDEEMED`, `LOYALTY_REWARD_EXPIRED`, `LOYALTY_ADJUSTED`, `LOYALTY_REVOKED`.

**A/B test sugerido na Fase 2:** dividir clientes em grupo controle (sem mensagem de selo) e tratamento. Comparar frequência de retorno 60 dias depois. Sem isso, atribuir crescimento ao programa é ilusão.

---

## 11. LGPD e operação

- **Consentimento transacional** (selo, recompensa, vencimento): coberto pelo `whatsapp_opt_in` que já é `TRUE` por default ao criar pedido — alinhado ao precedente já adotado no projeto.
- **Consentimento marketing** (Fase 4 — promos, cardápio novo, "saudades"): separado em `marketing_opt_in`, **opt-in explícito**. Caixa marcado no checkout e no portal de fidelidade.
- **Portabilidade/exclusão:** botão "Excluir minha conta" no portal de fidelidade → marca conta como `enrolled=false`, anonimiza `customer.name`, mantém transações para auditoria fiscal (são lançamentos de cortesia, contábeis).
- **Termos:** texto curto na primeira aparição do programa no portal e no `/pedir`.

---

## 12. Custos estimados (premissas: 1.500 pedidos/mês, 60% inscritos)

| Item | Volume/mês | Custo unit | Total/mês |
|---|---|---|---|
| WhatsApp `loyalty_stamp_earned` (após rate-limit) | ~450 | R$ 0,05 | R$ 22,50 |
| WhatsApp `loyalty_reward_ready` | ~90 | R$ 0,05 | R$ 4,50 |
| WhatsApp `loyalty_reward_expiring` | ~15 | R$ 0,05 | R$ 0,75 |
| Brindes (recompensas resgatadas) | ~55 | custo de produto (ex: R$ 8) | R$ 440 |
| Cron execução (Supabase) | — | incluso | R$ 0 |
| **Total operacional** | | | **~R$ 468** |

Se o programa gerar +15% de frequência num ticket médio de R$ 30 entre os ~900 inscritos: +R$ 4.050/mês de receita incremental. Margem para validar.

---

## 13. Roadmap

### Fase 1 — MVP (2–3 semanas)
- [ ] Migration `20260601000000_loyalty_program.sql`
- [ ] Edge Function `loyalty-accrue` + hook em `mark-payment`/`confirm-order`
- [ ] Edge Function `loyalty-redeem` + tela `/app/caixa` (botão resgate)
- [ ] Edge Function `get-public-loyalty` + página `/fidelidade/[token]`
- [ ] 2 templates Meta aprovados (`fidelidade_selo`, `fidelidade_recompensa_liberada`)
- [ ] Aba "Fidelidade" em `/app/configuracoes`
- [ ] Auditoria + rate-limit de mensagens
- [ ] `audit_logs` cobrindo eventos

### Fase 2 — Operação e medição (1–2 semanas)
- [ ] `loyalty-expire` (cron diário) + template `fidelidade_recompensa_vencendo`
- [ ] `/app/fidelidade` dashboard com KPIs
- [ ] `loyalty-reconcile` (cron horário) — pedidos PAID sem EARN
- [ ] Exportação CSV (clientes + transações)
- [ ] Ajustes manuais ADMIN

### Fase 3 — Crescimento
- [ ] Cupom de indicação: cliente A traz B (novo telefone), ambos ganham selo bônus
- [ ] Apple/Google Wallet pass (PassKit / Google Wallet API)
- [ ] Encurtador próprio com tracking de clique (clicks→retorno)
- [ ] A/B test mensagem on/off

### Fase 4 — Marketing ativo
- [ ] Templates MARKETING aprovados ("saudades", "novo sabor", "chove hoje")
- [ ] Segmentação RFM (Recência, Frequência, Monetário) baseada em `orders`
- [ ] Editor de campanha em `/app/fidelidade/campanhas`
- [ ] Pontos paralelos a selos (níveis VIP / bronze-prata-ouro)
- [ ] Cashback opcional em vez de selo (alternativa B/B)

---

## 14. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Meta bloquear número por excesso de UTILITY | Rate-limit (§9.3), templates honestamente transacionais, monitorar `delivery_status`. |
| Cliente acha o brinde mixaria | Pesquisar com 5 clientes regulares antes de fixar `stamps_required` e `reward_label`. Começar generoso (`10` selos, brinde de bom valor percebido). |
| Atendente esquecer de aplicar resgate | Card visível ao identificar telefone no caixa (§8.1) + relatório de "recompensas vencendo" no dashboard. |
| Fraude (atendente queimando recompensa pra si) | Resgate sempre logado em `audit_logs` com `actor_user_id`. Recompensa só nasce de pedido pago — não dá pra gerar do nada. ADMIN tem visão de "resgates por atendente" no dashboard. |
| Cliente perde telefone / troca número | Edge Function admin `loyalty-merge` (Fase 2) — funde duas contas no número novo. |
| Programa não gera retorno | Métricas claras desde dia 1 (§10). Se em 90 dias o uplift for < 5%, repensar o brinde antes de matar o programa. |

---

## 15. Checklist de implementação (para uma próxima sessão)

```
[ ] supabase/migrations/20260601000000_loyalty_program.sql
[ ] supabase/functions/_shared/whatsapp-enqueue.ts  (handlers novos)
[ ] supabase/functions/loyalty-accrue/index.ts
[ ] supabase/functions/loyalty-redeem/index.ts
[ ] supabase/functions/get-public-loyalty/index.ts
[ ] supabase/functions/loyalty-expire/index.ts
[ ] supabase/functions/loyalty-reconcile/index.ts
[ ] supabase/functions/mark-payment/index.ts        (hook accrue)
[ ] supabase/functions/confirm-order/index.ts       (hook accrue se já pago)
[ ] src/app/fidelidade/[token]/page.tsx             (carteira PWA)
[ ] src/app/app/fidelidade/page.tsx                 (dashboard)
[ ] src/app/app/configuracoes/(loyalty)/...         (aba config)
[ ] src/app/app/caixa/ ...                          (botão resgate + lookup)
[ ] src/lib/api/loyalty-api.ts                      (client)
[ ] src/components/loyalty/StampCard.tsx
[ ] src/components/loyalty/RewardQR.tsx
[ ] templates Meta: fidelidade_selo, fidelidade_recompensa_liberada, fidelidade_recompensa_vencendo
[ ] docs/loyalty-operational-test.md                (checklist QA)
[ ] cron schedule loyalty-expire (diário 03:00 BRT)
[ ] cron schedule loyalty-reconcile (horário)
```

---

**Próximo passo recomendado:** validar (i) `stamps_required` e `reward_label` com o Marcos, (ii) cotação do template UTILITY com o BSP atual, (iii) se faz sentido limitar a 1 filial no piloto antes de abrir global. Com isso fechado, abro `feat/fidelidade-mvp` e começo pela migration + `loyalty-accrue`.
