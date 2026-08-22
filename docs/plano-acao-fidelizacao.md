# Plano de Ação — Programa de Fidelidade (PDV Marcos Krep's)

> Este documento foi reconstruído em 2026-08-19 a partir de verificação direta em produção
> (projeto Supabase `feotsdzkwbikmcnzgsnh`). Uma versão anterior deste mesmo doc (investigação
> inicial, sem decisões nem código) foi mergeada em `main` via PR #124 por uma sessão paralela —
> este arquivo reconcilia as duas: mantém a investigação e a estratégia de retenção de lá,
> e adiciona as decisões de negócio confirmadas, o trabalho de Fase 0 já feito, e os achados
> técnicos adicionais (verify_jwt, order_id nullable) descobertos nesta sessão. Tudo marcado
> como "confirmado" foi checado ao vivo (schema dump, `functions list`, `functions download`,
> leitura de código local). O que não foi verificado por mim está marcado explicitamente.

## Estado real confirmado

### Existe em produção, fora do git

- **4 tabelas** + colunas em `customers`, todas confirmadas via `supabase db dump --linked`:
  - `loyalty_programs` (`id text`, `stamps_required` 3–30, padrão 10, `reward_label` padrão
    `'1 Krep tradicional grátis'`, `min_order_brl` padrão 0, `stamp_ttl_days` padrão 90,
    `reward_ttl_days` padrão 30, `branch_scope uuid[]`)
  - `loyalty_accounts` (`customer_id`, `program_id`, `current_stamps`, `lifetime_stamps`,
    unique `(customer_id, program_id)`)
  - `loyalty_rewards` (`status` enum `loyalty_reward_status`: AVAILABLE/REDEEMED/EXPIRED/REVOKED,
    `code` unique, `expires_at`, rastreio de resgate por pedido/usuário/filial)
  - `loyalty_transactions` (`kind` enum `loyalty_tx_kind`: EARN/REDEEM/EXPIRE/ADJUST/REVOKE,
    `delta`, `balance_after`, unique parcial por `(account_id, order_id)` quando `kind='EARN'`
    e `order_id` não nulo — evita crédito duplicado por pedido)
  - `customers.loyalty_portal_token` (unique) + `loyalty_portal_token_issued_at`
  - RLS habilitada nas 4 tabelas; policies restringem escrita/leitura a `ADMIN`/`ATTENDANT`.
  - **Nenhuma migration correspondente existia em `supabase/migrations/`** até a Fase 0
    desta sessão (ver "Status de execução" abaixo).

- **6 Edge Functions ativas** (`functions list --project-ref feotsdzkwbikmcnzgsnh`),
  nenhuma com pasta local em `supabase/functions/` até a Fase 0 desta sessão:
  - `loyalty-accrue`, `loyalty-redeem`, `loyalty-revoke`, `loyalty-reconcile`,
    `loyalty-expire`, `get-public-loyalty`
  - Código baixado e lido via `supabase functions download <nome> --workdir <pasta>`
    (extrai do bundle ESZip deployado).

- **`settings`**: `loyalty_enabled = 'true'`, `loyalty_public_base_url = '""'` (vazio).
  Confirmado via `supabase db dump --linked --data-only --schema public`.

- **`_shared/whatsapp-enqueue.ts` divergiu entre prod e git.** A versão deployada
  (extraída do bundle de `loyalty-accrue`) tem `enqueueLoyaltyWhatsAppMessage(...)` e os
  3 tipos de evento de fidelidade em `SETTING_TEMPLATE`/`DEFAULT_TEMPLATE`
  (`loyalty_stamp_earned`, `loyalty_reward_ready`, `loyalty_reward_expiring`). A versão em
  `supabase/functions/_shared/whatsapp-enqueue.ts` no git não tinha nenhum dos dois —
  só cobria `order_received`, `order_ready`, `order_partial_ready`, `order_out_for_delivery`.
  **Qualquer redeploy de uma function que importe esse shared file a partir do git, sem
  reconciliar antes, quebraria silenciosamente o que já está rodando em prod** — resolvido
  na Fase 0 desta sessão (união dos dois, ver abaixo).

- **2 jobs `pg_cron`** (`loyalty-reconcile-hourly` de hora em hora, `loyalty-expire-daily`
  diário) — mencionados na investigação original (PR #124), **não reverificados
  independentemente por mim nesta sessão**: `cron.job` é uma tabela de config de extensão
  que `pg_dump`/`db dump` ignora por padrão, e não persegui uma query direta alternativa.
  Tratar como não confirmado por esta sessão até checar via SQL direto.

- **Segredo em texto claro** (achado da investigação original, PR #124, não reverificado
  por mim): o `command` do job `loyalty-reconcile-hourly` guardaria o `x-cron-secret` em
  texto plano na tabela `cron.job` — visível a quem tem acesso privilegiado ao banco. Baixo
  risco prático, mas vale corrigir (mover pra `vault` do Postgres ou rotacionar) quando os
  jobs pg_cron forem trazidos pro git formalmente.

- **Dado real**: 0 contas, 0 recompensas, 0 transações de fidelidade (achado da investigação
  original) — schema e código podiam ser mexidos sem risco de quebrar uso real. Volume atual
  não reverificado por mim nesta sessão.

### As causas raiz confirmadas

1. **`mark-payment` e `confirm-order` nunca chamam `loyalty-accrue`.** Confirmado por
   grep direto nos dois arquivos locais — zero referência a `loyalty-accrue` ou
   `loyalty_accrue`. O "fio" que credita o selo simplesmente não existe no código atual.
   O único caminho de crédito hoje é o cron `loyalty-reconcile`, que varre pedidos pagos
   com `customer_id` preenchido — e por isso mesmo nunca creditou nada de fato (ver causa #2).
2. **Captura de telefone no checkout é o gargalo real.** Da investigação original (PR #124):
   de 2580 pedidos pagos, só 99 (3,8%) tinham `customer_id`, e 0% nas últimas 48h medidas
   então — não reverificado por mim nesta sessão, tratado como hipótese herdada até
   reconfirmar. O campo é opcional no checkout do atendente e raramente preenchido.
3. **`chk_whatsapp_messages_event_type` não inclui os 3 eventos de fidelidade.** Confirmado
   no schema dump: a constraint só permitia `order_received`, `order_ready`,
   `order_partial_ready`, `order_out_for_delivery`. Qualquer notificação de fidelidade
   falharia ao tentar inserir em `whatsapp_messages` — mesmo com o helper de prod já
   preparado para esses eventos. **Corrigido na Fase 0 desta sessão.**
4. **Achado adicional desta sessão**: `whatsapp_messages.order_id` era `NOT NULL`, mas
   `loyalty-expire` dispara `loyalty_reward_expiring` sem `order_id` (aviso de recompensa
   vencendo nasce de um cron, não de um pedido específico) — o insert falharia mesmo depois
   de corrigir a constraint de evento. **Corrigido na Fase 0 desta sessão** (coluna virou
   nullable).

## Estratégia de retenção — por que este modelo já é a escolha certa

O modelo escolhido (cartão de selos — "compre 10, ganhe 1") é, segundo as melhores práticas
de retenção pra food service de bairro, a escolha certa — não precisa trocar de estratégia,
só executar o que já foi desenhado:

- **Simplicidade bate sofisticação.** Programas de pontos com conversão complexa (R$1 = X
  pontos, resgates parciais) têm adesão pior em negócios pequenos. Cartão de selos é
  intuitivo, visual, e cria "quase lá" (a psicologia do "faltam 2 selos" é o motor de
  recompra mais forte que existe nesse formato).
- **Sem app, via WhatsApp.** Apps próprios de fidelidade têm taxa de instalação/retenção
  baixíssima. WhatsApp (que este PDV já usa pra tudo) é o canal certo: zero fricção. O
  backend já está desenhado assim (`loyalty_stamp_earned`, `loyalty_reward_ready`,
  `loyalty_reward_expiring` como mensagens de WhatsApp).
- **Identificação no ponto de venda é o gargalo #1 de qualquer programa físico** — confirmado
  pelos próprios dados (3,8% de captura). Não pode ficar como campo opcional silencioso;
  precisa virar parte do script do atendente, com motivo claro.
- **Redução de fricção no resgate.** Código curto falável (`KRP-XXXX-XXXX`, alfabeto sem
  0/O/1/I) já está certo.
- **Portal sem login (token na URL)** é a abordagem certa pra baixo compromisso.

## Decisões de negócio — confirmadas em 2026-08-19/20

1. **Validade do selo: 90 → 180 dias.** `loyalty_programs.stamp_ttl_days` passa de 90
   para 180. Mantém 10 selos → 1 Krep tradicional grátis, sem pedido mínimo, recompensa
   expira em 30 dias (inalterado).

2. **Selo por unidade de crepe, não por pedido — mudança de desenho, não só de config.**
   A implementação já deployada em `loyalty-accrue` credita **+1 selo fixo por pedido
   pago inteiro** (`delta: 1`, idempotência via `UNIQUE(account_id, order_id)`). Isso não
   serve mais: um pedido com 3 crepes agora precisa dar 3 selos, creditados quando *aquele
   crepe* é pago — não quando o pedido inteiro fecha.

   Categorias que contam: **flag configurável**, não lista fixa nem regex de nome — decisão
   revista em 2026-08-20, já implementada na Fase 0. `categories.counts_for_loyalty BOOLEAN`
   (migration
   [20260820100000_categories_loyalty_flag.sql](../supabase/migrations/20260820100000_categories_loyalty_flag.sql)),
   editável direto na tela `/app/cardapio` → aba Categorias (checkbox "Conta para o selo de
   fidelidade" no `CategoryModal`, badge visível na listagem). Backfill aplicado para as 6
   categorias de Krep/Crepe já identificadas em produção em 2026-08-19 (`Kreps Salgados`/
   `Kreps Doces` na filial `0b194416-...`, `Crepes Salgados`/`Crepes Doces` nas filiais
   `2127cc6c-...` e `3a8774e8-...`). Resolve o risco de nome de categoria não padronizado
   entre filiais — quem abre filial nova marca a categoria certa no cadastro, sem migration
   nem código novo.

   Consequência técnica pra Fase 1:
   - Gatilho muda de "pedido virou PAID" para "estes itens de pedido viraram PAID nesta
     chamada de `mark-payment`" (`mark-payment` já suporta pagamento por `order_item_ids`,
     granularidade por item já existe em `order_items.payment_status`/`quantity`).
   - `delta` do `EARN` passa a ser a soma de `quantity` dos itens de categoria Krep/Crepe
     que acabaram de ficar `PAID` naquela chamada — pode ser >1 numa chamada só.
   - A trava `UNIQUE(account_id, order_id) WHERE kind='EARN'` bloqueia hoje um segundo
     crédito no mesmo pedido — incompatível com pagamento parcelado por item. Precisa migrar
     para trava por item pago pra não perder nem duplicar selo em pagamento fracionado.

3. **`mark-payment` é o ponto de disparo, não `confirm-order`.** Único evento comum aos
   dois canais que garante "o cliente pagou de verdade" — presencial confirma o pedido
   antes de pagar; público (`/pedir`) só libera `confirm-order` depois de já estar `PAID`.
   `loyalty-accrue` passa a olhar `order_items` recém-pagos na chamada de `mark-payment`.

4. **`remember_checkout_data` vira opt-out** (vem marcado quando o telefone é informado;
   cliente desmarca se não quiser). Precisa de texto de consentimento visível no checkout
   (LGPD) mesmo vindo marcado — ataca direto a causa raiz #2.

5. **Fase 5 (indicação de amigo / aniversário / RFM) fica pra depois.** Sem dado real de
   fidelidade rodando ainda, não há histórico pra RFM ou indicação analisarem.

## Status de execução

### Fase 0 — concluída em 2026-08-19/20 (não deployada em produção ainda)

- Migrations criadas: [20260819100000_loyalty_program_schema.sql](../supabase/migrations/20260819100000_loyalty_program_schema.sql)
  (schema completo + seed idempotente + `stamp_ttl_days` 90→180),
  [20260819100100_whatsapp_loyalty_event_types.sql](../supabase/migrations/20260819100100_whatsapp_loyalty_event_types.sql)
  (constraint de evento + `order_id` nullable), e
  [20260820100000_categories_loyalty_flag.sql](../supabase/migrations/20260820100000_categories_loyalty_flag.sql)
  (`categories.counts_for_loyalty` + backfill).
- As 6 Edge Functions trazidas para `supabase/functions/` com tipagem TS restaurada,
  comportamento idêntico ao bundle deployado (nada de Fase 1 aplicado ainda):
  `loyalty-accrue`, `loyalty-redeem`, `loyalty-revoke`, `loyalty-reconcile`,
  `loyalty-expire`, `get-public-loyalty`.
- `_shared/whatsapp-enqueue.ts` reconciliado: é uma **união**, não uma substituição —
  mantém `order_out_for_delivery` (que só existia no git) e adiciona
  `enqueueLoyaltyWhatsAppMessage` + os 3 tipos de evento de fidelidade (que só existiam em
  prod). Nenhum dos dois lados perde funcionalidade.
- Novo shared file trazido: `_shared/loyalty-accrue-fire.ts` (helper fire-and-forget usado
  por `loyalty-reconcile`; não existia no git).
- UI: checkbox "Conta para o selo de fidelidade" no `CategoryModal` do cardápio + badge na
  listagem.
- `config.toml`: 5 entradas `[functions.loyalty-*]` com `verify_jwt = false` (ver achado
  abaixo).
- Validado: `npx tsc --noEmit` limpo, `npx eslint .` sem erro novo, `npx supabase db reset`
  local aplicou as 3 migrations sem erro, valores confirmados no banco local pós-reset.
  `npm run build` falha por falta de `.env.local` no worktree — pré-existente, não
  relacionado.
- **Nada disso foi aplicado em produção.** Existe só em branch até virar PR revisado e
  decidido explicitamente com o usuário.

### Achado desta sessão: `verify_jwt` das 6 functions

`supabase functions list` mostra as 6 functions de fidelidade com `verify_jwt: true` em
produção — e não havia entrada `[functions.loyalty-*]` em `supabase/config.toml`. Isso
importa porque `loyalty-accrue` só aceita `x-internal-secret` (sem fallback de Bearer JWT):
uma chamada interna fire-and-forget de `mark-payment` não envia `Authorization`, e com
`verify_jwt=true` o gateway rejeitaria com 401 antes mesmo de chegar no código da function —
independente do fio existir ou não. Mesmo problema em potencial pra `loyalty-revoke`,
`loyalty-reconcile`, `loyalty-expire` e `get-public-loyalty`.

**Resolvido na Fase 0**: adicionadas 5 entradas `[functions.loyalty-*]` com
`verify_jwt = false` em `config.toml` (mesmo padrão já usado pra `send-whatsapp`/`webauthn`/
`expire-pending-public-orders`). `loyalty-redeem` ficou no default (`verify_jwt=true`), usa
Bearer JWT de atendente normal. Confirmado via `supabase secrets list` que
`LOYALTY_INTERNAL_SECRET`/`LOYALTY_CRON_SECRET` já existem em produção — não faltava
secret, só a config de gateway.

### Achado crítico desta sessão: deploy automático via CI

`.github/workflows/deploy-functions.yml` dispara **automaticamente em todo push pro `main`**
que toque `supabase/functions/**`, `supabase/config.toml` ou `supabase/migrations/**`. O
job roda `supabase db push` (aplica migration em produção de verdade) e `supabase functions
deploy` — mas só para functions explicitamente listadas em dois loops fixos no YAML
("Deploy authenticated Edge Functions" e "Deploy public Edge Functions (JWT verification
disabled)"). Essa é a mesma causa raiz do incidente do `lookup-cep` documentado no PR #124.

**Consequência prática**: mergear o PR de Fase 0 em `main` dispara migration real em
produção automaticamente, e as 6 functions de fidelidade não seriam deployadas por não
estarem nessa lista — ficariam fantasmas de novo. **Resolvido em 2026-08-20**: adicionadas
`loyalty-redeem` no grupo "authenticated" e `loyalty-accrue`/`loyalty-revoke`/
`loyalty-reconcile`/`loyalty-expire`/`get-public-loyalty` no grupo "public (JWT verification
disabled)" — mesmo padrão de `send-whatsapp` (dual auth interno/cron).

**Importante**: isso significa que, a partir deste PR, **merge em `main` = deploy real em
produção automaticamente** (migration + as 6 functions), não um passo manual separado.
Confirmar isso explicitamente com o usuário antes do merge, mesmo que o PR em si já esteja
revisado e aprovado.

## Sequência recomendada

**Fase 0 — Governança.** Ver "Status de execução" acima — código pronto, falta decidir
sobre o workflow de CI e então merge/deploy.

**Fase 1 — Ligar os fios + selo por crepe.** Reescrever a lógica de crédito de
`loyalty-accrue` para operar por item pago, com a trava de idempotência por item. Chamar
`loyalty-accrue` a partir de `mark-payment`. Ligar `loyalty-revoke` no fluxo de estorno.
Configurar `settings.loyalty_public_base_url`. Configurar templates de WhatsApp na Meta/
Evolution API. Trocar `remember_checkout_data` para opt-out no checkout (presencial e
`/pedir`). Validar ponta a ponta localmente: pagar → selo → WhatsApp → recompensa → resgate.

**Fase 2 — Captura de telefone no balcão.** O item que decide se o programa funciona:
tornar a pergunta do WhatsApp parte do script do atendente com motivo explícito na tela;
mostrar progresso do cliente ("faltam 3 selos") assim que o telefone é digitado no checkout.
Meta mensurável: sair de ~4% pra 40-50% de captura antes de investir nas fases seguintes.

**Fase 3 — Frontend faltante.** Página pública `/fidelidade/[token]` (via
`get-public-loyalty`); campo de resgate de `reward_code` no checkout do atendente
(`OrderSummarySheet.tsx`); indicador de progresso em `/pedir`; painel ADMIN mínimo em
`/app/configuracoes`.

**Fase 4 — Comunicação e reforço de hábito.** Confirmar que as 3 mensagens de WhatsApp
chegam de verdade; adicionar link do portal na mensagem de confirmação de pedido normal.

**Fase 5 — Indicação, aniversário, RFM.** Adiado — revisitar após dado real de uso.

## Como validar antes de mexer em qualquer coisa

```bash
git fetch origin main && git log origin/main --oneline -20
npx tsc --noEmit && npx eslint . && npm run build
```

Para mudanças de banco: Docker Desktop + `npx supabase start` + `npx supabase db reset`
localmente — teste de verdade, não só leitura de código.

## Notas operacionais

- Pode haver outra sessão trabalhando em paralelo neste repositório — já aconteceu (PR #124
  mergeou uma versão anterior deste mesmo doc enquanto esta sessão trabalhava). Sempre
  `git fetch origin main` e checar `git log origin/main --oneline` antes de assumir que a
  base está atualizada — e checar `ls supabase/migrations/ | tail -20` antes de criar
  migration nova.
- Acesso ao Supabase: `npx supabase projects list` funciona sem `SUPABASE_ACCESS_TOKEN` de
  ambiente (credencial cacheada no Windows Credential Manager). `npx supabase link
  --project-ref feotsdzkwbikmcnzgsnh` linka ao projeto real. Aplicar qualquer coisa em
  produção continua sendo ação de alto risco — confirmar explicitamente com o usuário
  antes, mesmo com acesso técnico disponível. **Merge em `main` não é mais "sem risco":
  o workflow de deploy automático roda migration + function deploy reais.**
