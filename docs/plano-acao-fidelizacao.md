# Plano de Ação — Programa de Fidelidade e Retenção de Clientes

> Documento vivo — atualizar a cada fase executada, seguindo o mesmo padrão de `docs/plano-acao-correcao-pdv.md`.

## Resumo executivo

Investiguei o "programa de fidelidade fantasma" encontrado em produção (6 Edge Functions + 4 tabelas, sem rastro no git) e baixei o código-fonte real de cada função direto do projeto Supabase (`supabase functions download`) para entender exatamente o que existe. Conclusão: **não é um esqueleto abandonado — é um backend de cartão-fidelidade quase completo e bem construído** (idempotente, auditado, com RLS correta, cron de reconciliação e expiração já rodando em produção). Ele nunca "decolou" por uma combinação de 3 causas concretas, todas identificadas com evidência direta do banco:

1. **Ninguém liga a torneira principal.** `mark-payment`/`confirm-order` (as funções que processam pagamento) nunca chamam `loyalty-accrue`. O único caminho que credita selos é o cron `loyalty-reconcile` (roda de hora em hora), que varre pedidos pagos com `customer_id` preenchido — e ele está rodando desde 2026-06-02.
2. **O gargalo real é ainda mais básico: quase ninguém informa telefone no balcão.** De 2580 pedidos pagos no total, só 99 (3,8%) têm `customer_id` — e **zero** nas últimas 48h. O campo de WhatsApp no checkout do atendente é opcional e raramente preenchido. Mesmo com o backend 100% funcional, sem telefone não há como identificar o cliente pra dar o selo.
3. **A notificação por WhatsApp está silenciosamente quebrada.** A constraint `chk_whatsapp_messages_event_type` no banco de produção não inclui os 3 tipos de evento que o código de fidelidade tenta gravar (`loyalty_stamp_earned`, `loyalty_reward_ready`, `loyalty_reward_expiring`) — todo INSERT falharia. O código foi escrito pra nunca lançar exceção (fidelidade é melhoria, não pode travar o caixa), então essa falha nunca apareceu como erro visível — só como silêncio.

Nenhum desses três problemas é difícil de resolver. O trabalho pesado (schema, lógica de acúmulo/resgate/expiração, segurança) já está feito. O que falta é: (a) trazer o código pra dentro do git com governança normal, (b) ligar os 3 fios soltos acima, e (c) resolver o problema de produto real — dar ao atendente um motivo forte e rápido pra pedir o WhatsApp do cliente.

## O que existe hoje em produção (investigado via `supabase db query --linked` e `supabase functions download`)

### Banco de dados
| Tabela | Papel |
|---|---|
| `loyalty_programs` | Config do programa. Hoje: 1 programa (`default`) — "Cartão Fidelidade Krep's", 10 selos → 1 Krep tradicional grátis, sem pedido mínimo, selo expira em 90 dias, recompensa expira em 30 dias, todas as filiais. |
| `loyalty_accounts` | 1 conta por cliente (`customer_id` = telefone E.164) por programa. `current_stamps`/`lifetime_stamps`. |
| `loyalty_rewards` | Recompensas emitidas (`code` tipo `KRP-XXXX-XXXX`, status `AVAILABLE`/`REDEEMED`/`EXPIRED`/`REVOKED`). |
| `loyalty_transactions` | Ledger de auditoria (`EARN`/`REDEEM`/`ADJUST`/`REVOKE`/`EXPIRE`, delta, saldo após). |

RLS correta e consistente com o resto do app: leitura só ADMIN/ATTENDANT autenticados, escrita só via Edge Function com Service Role (nenhuma policy pública de escrita). `customers.loyalty_portal_token`/`loyalty_portal_token_issued_at` já existem pra dar acesso a um portal público sem login.

**Dado real:** 0 contas, 0 recompensas, 0 transações. `settings.loyalty_enabled = true` (o flag está ligado!), mas `settings.loyalty_public_base_url` está vazio (então nenhum link de portal pode ser montado ainda).

### Edge Functions (código real, lido via `supabase functions download`)
| Função | O que faz | Qualidade observada |
|---|---|---|
| `loyalty-accrue` | +1 selo por pedido pago (chamada interna, `x-internal-secret`). Idempotente (unique `account_id+order_id`). Ao bater `stamps_required`, emite recompensa com código curto e debita os selos. Enfileira WhatsApp. | Bem feita, resiliente (nunca derruba o caixa). |
| `loyalty-redeem` | Atendente resgata `reward_code` no balcão (JWT ADMIN/ATTENDANT). Update com guarda de status evita resgate duplo em corrida. | Bem feita. |
| `loyalty-revoke` | Estorno de pedido → revoga selo/recompensa. Bloqueia e exige `force=true` de ADMIN se a recompensa já foi resgatada. | Bem feita, cuidadosa com o caso difícil. |
| `loyalty-reconcile` | **Cron horário já ativo** (`pg_cron`, `12 * * * *`). Varre pedidos pagos das últimas 48h sem `EARN` e credita — é o mecanismo de auto-recuperação de falhas do fire-and-forget. | Único caminho de crédito hoje — e por isso mesmo nunca creditou nada (ver causa raiz #2). |
| `loyalty-expire` | **Cron diário já ativo** (`0 6 * * *`). Expira recompensas/selos vencidos, avisa por WhatsApp 5 dias antes de vencer. | Bem feita. |
| `get-public-loyalty` | Portal público via token opaco (não por telefone/OTP) — devolve saldo, recompensas, últimas 10 transações. Também serve de toggle de opt-in de marketing (LGPD). | Bem feita, telefone mascarado na resposta. |

### O que falta (confirmado, não suposição)
- **Wiring**: `mark-payment`/`confirm-order` (as versões no git, que batem com produção) não chamam `loyalty-accrue`/`loyalty-revoke`.
- **Constraint do banco**: `chk_whatsapp_messages_event_type` falta os 3 valores de evento de fidelidade.
- **`loyalty_public_base_url`**: setting vazio, portal não é linkável ainda.
- **Frontend**: zero referências a "loyalty" em todo `src/` — não existe página de portal (`/fidelidade/[token]`), não existe campo de resgate (`reward_code`) no checkout do atendente, não existe indicador de progresso em lugar nenhum (nem `/pedir`, nem WhatsApp de confirmação de pedido).
- **Governança**: nada disso está no git. Todo o schema e as 6 functions foram criados direto no projeto Supabase (SQL editor / CLI local), fora do fluxo normal de migration + PR que o resto do repo segue rigorosamente. Isso significa: sem code review, sem CI, sem rollback via git, e risco real de alguém sobrescrever sem querer (ex.: `git diff` do arquivo compartilhado `_shared/whatsapp-enqueue.ts` mostra que a versão em produção já divergiu da versão no git — a de produção tem as funções de fidelidade, a do git não).
- **Segredo em texto claro**: o `pg_cron` job `loyalty-reconcile-hourly` guarda `x-cron-secret` em texto plano no `command` da tabela `cron.job` (visível a quem tem acesso ao banco). Não é exploração ativa, mas é uma prática de higiene de segredo a corrigir (usar `vault` do Postgres ou rotacionar + mover pra fora do SQL).

## Estratégia de retenção — por que este modelo já é a escolha certa

O modelo escolhido (cartão de selos — "compre 10, ganhe 1") é, segundo as melhores práticas de retenção pra food service de bairro, a escolha certa — não precisa trocar de estratégia, só executar o que já foi desenhado:

- **Simplicidade bate sofisticação.** Programas de pontos com conversão complexa (R$1 = X pontos, resgates parciais) têm adesão pior em negócios pequenos — o cliente não entende o valor. Cartão de selos é intuitivo, visual, e cria "quase lá" (a psicologia do "faltam 2 selos" é o motor de recompra mais forte que existe nesse formato).
- **Sem app, via WhatsApp.** A tendência atual (2025-2026) é abandonar apps próprios de fidelidade — taxa de instalação e retenção de apps de fidelidade é baixíssima. WhatsApp (que este PDV já usa pra tudo — confirmação, pronto, saiu pra entrega) é o canal certo: zero fricção, o cliente já está lá. O backend já está desenhado exatamente assim (`loyalty_stamp_earned`, `loyalty_reward_ready`, `loyalty_reward_expiring` como mensagens de WhatsApp).
- **Identificação no ponto de venda é o gargalo #1 de qualquer programa físico.** Isso é confirmado pelos próprios dados (3,8% de captura). A prática recomendada pra varejo presencial é nunca deixar a captura de contato como campo opcional silencioso — precisa virar parte do script do atendente, com motivo claro ("é pra você entrar no cartão fidelidade e não perder os selos"), não uma pergunta "burocrática" de checkout.
- **Redução de fricção no resgate.** Código curto falável (`KRP-XXXX-XXXX`) já está certo — dá pra ditar por telefone/balcão sem erro (alfabeto sem 0/O/1/I já pensado nisso).
- **Portal sem login (token na URL) é a abordagem certa pra baixo compromisso** — cliente vê o saldo sem precisar criar conta/senha.

## Plano de execução por fases

### Fase 0 — Governança (pré-requisito pra tudo abaixo)
Trazer o que já existe em produção pra dentro do git, sem mudar comportamento:
- Criar migrations retratando o schema atual (`loyalty_programs`, `loyalty_accounts`, `loyalty_rewards`, `loyalty_transactions`, colunas em `customers`, os 2 `pg_cron` jobs).
- Adicionar as 6 functions + `_shared/loyalty-accrue-fire.ts` + a versão estendida de `_shared/whatsapp-enqueue.ts` (com `enqueueLoyaltyWhatsAppMessage`) ao repo — reconciliando com a versão atual do git (que não tem os tipos de evento de fidelidade).
- Resolver a constraint faltante: `ALTER TABLE whatsapp_messages` incluindo `loyalty_stamp_earned`/`loyalty_reward_ready`/`loyalty_reward_expiring`.
- Mover o `x-cron-secret` do `pg_cron` pra fora de texto plano (ou documentar como risco aceito, se a decisão for essa).
- Testar tudo localmente (Docker) antes de qualquer deploy — mesma disciplina usada no módulo de delivery.

### Fase 1 — Ligar os fios soltos (sem UI nova ainda)
- `create-attendant-order`/`create-public-order` ou `mark-payment`: decidir onde entra a chamada a `loyalty-accrue` (o comentário do código original sugere `mark-payment`/`confirm-order` — provavelmente o ponto certo é assim que o pedido vira `PAID`). Ligar de forma fire-and-forget (não bloqueia o caixa, igual ao padrão já usado em `dispatch-delivery` pro WhatsApp).
- Ligar `loyalty-revoke` no fluxo de estorno de pagamento.
- Configurar `settings.loyalty_public_base_url` com a URL real de produção.
- Configurar os templates de WhatsApp (`whatsapp_template_stamp_earned`, `whatsapp_template_reward_ready`, `whatsapp_template_reward_expiring`) na Meta/Evolution API, do mesmo jeito que os templates de pedido já existem.
- Validar ponta a ponta num pedido de teste local: pagar → selo aparece → WhatsApp enfileirado → (repetir até 10) → recompensa emitida → resgate.

### Fase 2 — Resolver o gargalo real: captura de telefone no balcão
Este é o item que decide se o programa funciona ou não — sem isso, a Fase 1 sozinha não muda nada na prática:
- Tornar a pergunta do WhatsApp parte do script padrão do atendente, com o motivo do fidelidade explícito na tela (não só "WhatsApp (opcional)" genérico).
- Considerar tornar `remember_checkout_data` marcado por padrão (opt-out em vez de opt-in) quando o cliente informa o telefone — hoje é uma ação extra que o atendente provavelmente pula na correria.
- Mostrar o progresso do cliente na hora (ex.: "faltam 3 selos") assim que o telefone é digitado no checkout do atendente, puxando de `get-public-loyalty`-like — dá ao atendente um motivo imediato de mostrar valor ao cliente ali na hora, reforçando o hábito.
- Meta mensurável: sair de ~4% pra pelo menos 40-50% de captura em pedidos presenciais antes de investir mais nas fases seguintes — sem isso, qualquer coisa depois é cosmético.

### Fase 3 — Frontend faltante
- Página pública `/fidelidade/[token]` (consumindo `get-public-loyalty`): saldo de selos, recompensas disponíveis com código, toggle de opt-in de marketing.
- Campo de resgate de `reward_code` no checkout do atendente (`OrderSummarySheet.tsx`), chamando `loyalty-redeem`.
- Indicador de progresso simples em `/pedir` (checkout público) pro cliente logado por telefone — mesma lógica de "endereço salvo" já usada lá.
- Painel ADMIN mínimo em `/app/configuracoes`: ver quantos clientes cadastrados, recompensas emitidas/resgatadas, editar `stamps_required`/`reward_label`/`min_order_brl` sem precisar mexer no banco direto.

### Fase 4 — Comunicação e reforço de hábito
- Confirmar que as 3 mensagens de WhatsApp (`selo ganho`, `recompensa liberada`, `recompensa vencendo`) estão realmente chegando — o rate-limit de 48h pra "selo ganho" já existe no código (evita spam a cada compra).
- Adicionar o link do portal de fidelidade na mensagem de confirmação de pedido normal (`order_received`), não só nas mensagens de fidelidade — aumenta a visibilidade sem pedir permissão nova.

### Fase 5 — Extensões de tendência (só depois que Fases 1-4 estiverem rodando de verdade)
- **Indicação de amigo**: selo bônus pra quem indica + pra quem é indicado no primeiro pedido — mecanismo de aquisição orgânica, baixo custo.
- **Aniversário/reativação**: campanha simples de WhatsApp pra clientes com `last_activity_at` há mais de 45-60 dias sem pedido (usar o próprio `loyalty_accounts.last_activity_at` como sinal de churn) — "sentimos sua falta, seus selos ainda estão aqui".
- **Segmentação leve (RFM)**: usar `loyalty_transactions`/`orders` pra separar clientes frequentes de esporádicos e ajustar a régua de mensagens — não precisa de ferramenta nova, dá pra fazer com queries simples no que já existe.

## Decisões de negócio a confirmar com o usuário antes de codar

1. Manter a regra atual do programa (10 selos → 1 Krep tradicional grátis, sem pedido mínimo, 90 dias de validade do selo, 30 dias da recompensa) ou ajustar algum parâmetro?
2. Onde exatamente entra a chamada de `loyalty-accrue` — em `mark-payment` (quando o pedido vira PAID) e/ou em `confirm-order`? Cobre pedido presencial e público (`/pedir`) do mesmo jeito?
3. `remember_checkout_data` vira padrão marcado (opt-out) quando telefone é informado, ou continua opt-in explícito?
4. Prioridade da Fase 5 (indicação/aniversário/RFM) — fica pra depois mesmo, ou algum item interessa adiantar?

## Riscos e observações de governança

- Segredo em texto claro no `pg_cron.command` — baixo risco prático (exige acesso privilegiado ao banco pra ler), mas vale corrigir na Fase 0.
- O `_shared/whatsapp-enqueue.ts` de produção já divergiu do git — qualquer redeploy futuro de uma function que importe esse shared file (feito a partir do git, sem reconciliar primeiro) pode quebrar o que já está rodando em produção. Reconciliar é bloqueante pra qualquer outro trabalho nesse arquivo compartilhado.
- Zero dado de cliente real em risco hoje (0 contas) — a migração pro git e os ajustes de Fase 0/1 podem ser feitos e testados com segurança total antes de tocar produção.

## Como validar cada fase

1. `npx tsc --noEmit && npx eslint . && npm run build` sempre.
2. Testar contra Supabase local real (Docker + `supabase functions serve`) — nunca só leitura de código, seguindo a disciplina já usada nas Fases 1-3 do delivery.
3. Fase 1: pedido de teste completo (criar → pagar → conferir `loyalty_accounts`/`loyalty_transactions`/`whatsapp_messages` no banco local).
4. Fase 2: acompanhar taxa de captura de telefone por 1-2 semanas depois da mudança de script/UI antes de decidir se a Fase 3 vale a pena.
5. Aplicar em produção só com autorização explícita, migration por migration — mesmo processo já usado pro delivery.
