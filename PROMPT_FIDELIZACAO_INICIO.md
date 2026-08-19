# Prompt: Início do Programa de Fidelidade — PDV Marcos Krep's

---

## Papel

Você é um engenheiro sênior full-stack trabalhando no **PDV Marcos Krep's**. Uma sessão anterior investigou a fundo um "programa de fidelidade fantasma" que já existe em produção (schema + 6 Edge Functions criados fora do git) e escreveu um plano de ação completo. Este prompt não pede investigação nova — ele te dá o estado real, já verificado, para você decidir com o usuário por onde começar a executar. Leia `docs/plano-acao-fidelizacao.md` inteiro antes de qualquer coisa — ele tem o plano de 5 fases, as decisões de negócio pendentes, e os achados técnicos com evidência. Não repita a investigação; ela já foi feita com dados reais do banco de produção.

---

## Estado real confirmado (verificado, não estimado)

### O que já existe em produção, sem estar no git
- 4 tabelas (`loyalty_programs`, `loyalty_accounts`, `loyalty_rewards`, `loyalty_transactions`) + colunas em `customers` (`loyalty_portal_token`, `loyalty_portal_token_issued_at`).
- 6 Edge Functions: `loyalty-accrue`, `loyalty-redeem`, `loyalty-revoke`, `loyalty-reconcile`, `loyalty-expire`, `get-public-loyalty` — código real já baixado e lido (`supabase functions download <nome> --project-ref feotsdzkwbikmcnzgsnh --workdir <pasta>`, funciona e extrai do bundle ESZip deployado — útil se precisar reconferir).
- 2 jobs `pg_cron` já ativos: `loyalty-reconcile-hourly` (de hora em hora) e `loyalty-expire-daily` (diário, 6h).
- `settings.loyalty_enabled = true` (o flag já está ligado), mas `settings.loyalty_public_base_url` vazio.
- **Zero dado de cliente real**: 0 contas, 0 recompensas, 0 transações. Schema e código podem ser mexidos com segurança total, sem risco de quebrar algo em uso.

### As 3 causas raiz confirmadas de por que nunca funcionou (não são suposição — ver `docs/plano-acao-fidelizacao.md`)
1. `mark-payment`/`confirm-order` nunca chamam `loyalty-accrue` — falta o "fio" que credita o selo.
2. Só 3,8% dos pedidos pagos têm `customer_id` (telefone) capturado, 0% nas últimas 48h — o campo é opcional no checkout do atendente e raramente preenchido. **Este é o problema real do produto, não um bug de código.**
3. A constraint `chk_whatsapp_messages_event_type` no banco não inclui os 3 eventos de fidelidade (`loyalty_stamp_earned`, `loyalty_reward_ready`, `loyalty_reward_expiring`) — qualquer notificação de fidelidade falharia silenciosamente ao tentar ser enfileirada.

### Outro achado de governança a resolver
`supabase/functions/_shared/whatsapp-enqueue.ts` em produção **já divergiu** da versão no git — a de produção tem `enqueueLoyaltyWhatsAppMessage` e os tipos de evento de fidelidade, a do git não. Qualquer redeploy futuro de uma function que importe esse shared file a partir do git, sem reconciliar primeiro, arrisca quebrar silenciosamente o que já está rodando. **Resolver isso é bloqueante antes de mexer em qualquer function que use esse shared file.**

### Contexto operacional importante — leia antes de mexer em qualquer coisa

1. **Rode `git fetch origin main && git log origin/main --oneline -20` primeiro.** PR #123 (validação de CEP + correção de bugs de infra local) foi squash-merged em `main` em 2026-08-19 — se você está numa branch antiga, **crie uma branch nova a partir do `main` atualizado**, não continue numa branch velha (squash-merge quebra detecção de rename do git em PRs subsequentes da mesma branch — lição já registrada em `docs/plano-acao-correcao-pdv.md`).
2. **Pode haver outra sessão trabalhando em paralelo** neste mesmo repositório. Já aconteceu colisão de timestamp de migration antes. Confira `ls supabase/migrations/ | tail -20` antes de criar uma migration nova.
3. **`supabase db reset` local agora funciona do zero** — 4 bugs de infra pré-existentes (JSON inválido no seed, ordem de coluna `sort_order`, filial "Águas Claras" travando reset, `branch_id` faltando no seed) foram corrigidos e já estão em `main`. Se `db reset` falhar de novo, algo novo quebrou — não é o bug antigo.
4. **Acesso ao Supabase**: sem `SUPABASE_ACCESS_TOKEN` de ambiente, mas o Windows Credential Manager já tem credencial "Supabase CLI" cacheada — `npx supabase projects list` funciona sem login. `npx supabase link --project-ref feotsdzkwbikmcnzgsnh` linka ao projeto real. **Aplicar qualquer coisa em produção continua sendo ação de alto risco — confirme explicitamente com o usuário antes, mesmo com acesso técnico disponível.**
5. **`next dev` (modo usado pelo preview do ambiente) agora aceita interação normalmente** — um bug de hidratação do React (`showBiometric` calculado direto no `useState` inicial em `/login`, sem guardar contra SSR) foi corrigido e está em `main`. Se voltar a acontecer "nada responde a clique/digitação" no preview, use `useSyncExternalStore` com `getServerSnapshot` estável como padrão, não `useEffect` + `setState` (a regra `react-hooks/set-state-in-effect` deste repo rejeita esse padrão).

---

## Decisões de negócio pendentes — pergunte ao usuário antes de codar

Estão detalhadas em `docs/plano-acao-fidelizacao.md`, seção "Decisões de negócio a confirmar":
1. Manter os parâmetros atuais do programa (10 selos → 1 Krep tradicional grátis, sem pedido mínimo, selo vence em 90 dias, recompensa em 30) ou ajustar?
2. Onde exatamente entra a chamada de `loyalty-accrue` — `mark-payment`, `confirm-order`, ou os dois? Cobre pedido presencial e público (`/pedir`) igual?
3. `remember_checkout_data` vira padrão marcado (opt-out) quando o telefone é informado, ou continua opt-in explícito?
4. A Fase 5 (indicação de amigo, aniversário, RFM) fica mesmo pra depois, ou algo interessa adiantar?

---

## Como validar antes de fazer qualquer mudança

1. `git fetch origin main && git log origin/main --oneline -20` — veja se há atividade nova.
2. `npx tsc --noEmit && npx eslint . && npm run build` — confirme que `main` está saudável antes de começar.
3. Se for mexer no banco: Docker Desktop + `npx supabase start` + `npx supabase db reset` localmente — teste de verdade, não só leitura de código.

---

## Primeiro passo recomendado

Não comece a codar. Leia `docs/plano-acao-fidelizacao.md` inteiro, rode os comandos de "Como validar" acima, e confirme com o usuário as decisões de negócio pendentes listadas ali. Depois disso, o ponto de entrada natural é a **Fase 0 (Governança)** do plano: trazer o schema e as 6 functions pra dentro do git via migration + PR normal (sem mudar comportamento), reconciliar o `_shared/whatsapp-enqueue.ts` divergente, e corrigir a constraint `chk_whatsapp_messages_event_type` — só depois disso faz sentido ligar os fios soltos (Fase 1) ou mexer em UI (Fase 2/3).
