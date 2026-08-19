# Prompt: Delivery — Fase 4 (Motoboy Próprio) — PDV Marcos Krep's

---

## Papel

Você é um engenheiro sênior full-stack trabalhando no **PDV Marcos Krep's**. As Fases 1, 2 e 3 do módulo de delivery estão em produção e funcionando, e a validação de endereço por CEP (melhoria pós-Fase 3) também já foi mergeada, deployada e testada de ponta a ponta — inclusive um incidente real que ela causou já foi corrigido. Este prompt te dá o estado real e completo pra você decidir com o usuário como seguir. Leia `FEATURE_DELIVERY.md` inteiro (é o documento vivo do módulo, atualizado a cada fase) antes de qualquer coisa.

---

## Estado real confirmado (verificado, não estimado)

### Em produção agora, funcionando
- **Fases 1-3** do delivery: pedido `ENTREGA` (presencial e público), frete por zona/bairro, endereço reutilizável, entregador cadastrado por filial, métricas de tempo de despacho/entrega.
- **Validação de endereço por CEP** (melhoria pós-Fase 3, PR #123, squash-merged em `main`): CEP obrigatório no checkout público e no do atendente, autofill via ViaCEP, servidor sempre revalida e usa o bairro retornado pelo CEP (não o digitado) pra calcular a zona de entrega — fecha a brecha de digitar um bairro atendido pra escapar do bloqueio.
- Todas as Edge Functions relevantes confirmadas `ACTIVE` em produção: `dispatch-delivery`, `confirm-delivery`, `get-public-customer-profile`, `lookup-cep`, `create-public-order`, `create-attendant-order`.

### Incidente que já aconteceu e já foi corrigido (contexto importante, não precisa agir de novo)
O workflow de deploy (`.github/workflows/deploy-functions.yml`) usava uma **lista fixa de nomes de function** que nunca era atualizada quando uma function nova era criada. Isso já causou um problema real: o PR #123 atualizou `create-public-order` pra exigir CEP resolvido antes de aceitar o pedido, mas a function `lookup-cep` (usada pelo autofill) nunca tinha sido deployada — checkout de entrega ficou bloqueado em produção até ser percebido e corrigido manualmente. **A lista do workflow já foi corrigida e agora cobre as 28 functions do repo** — mas se você criar uma function nova, **lembre de adicionar o nome dela no workflow**, ou ela nunca vai ser deployada automaticamente por mais que o merge tenha sucesso.

### O que NÃO está feito
- **Fase 4 — motoboy com login próprio.** Decisão de negócio já **confirmada pelo usuário: motoboy será próprio** (não terceirizado). Isso desbloqueia a fase, mas nada foi desenhado ou codado ainda. Escopo (do `FEATURE_DELIVERY.md`):
  - `couriers.profile_id` — motoboy loga e atualiza status pelo próprio celular (hoje `couriers` só tem nome/telefone/filial, sem vínculo de autenticação).
  - Painel agregado de métricas por entregador/filial/dia (hoje só existe tempo por pedido individual, calculado em `OrderDetailsSheet`/`OrderDetailsModal`).
- **Rastreamento em tempo real (GPS)** — fora do escopo realista, decisão já tomada de ficar só com status discreto.
- **Interação com split-bill** — continua bloqueado pra `ENTREGA`, não revisitado.

### Contexto operacional importante — leia antes de mexer em qualquer coisa

1. **Rode `git fetch origin main && git log origin/main --oneline -20` primeiro.** Houve pelo menos um squash-merge recente (PR #123) e possivelmente mais atividade desde então (pode haver sessão paralela). **Sempre crie uma branch nova a partir do `main` atualizado** — nunca continue numa branch antiga depois de um squash-merge (quebra detecção de rename do git em PRs subsequentes).
2. **`supabase db reset` local agora funciona do zero, de verdade.** 4 bugs de infra pré-existentes (JSON inválido no seed, ordem de migration do `sort_order`, filial "Águas Claras" travando reset, `branch_id` faltando no seed da Loja Principal) foram corrigidos e estão em `main`. Se `db reset` falhar de novo, é bug novo — investigue, não assuma que é o de sempre.
3. **`next dev` (modo do preview) agora aceita interação normal.** Um bug de hidratação do React em `/login` (`useState` calculando um valor browser-only direto, sem guardar contra SSR) foi corrigido. Se "nada responde a clique" acontecer de novo em qualquer página, o padrão certo é `useSyncExternalStore` com `getServerSnapshot` estável — não `useEffect` + `setState` solto (a regra `react-hooks/set-state-in-effect` deste repo rejeita esse padrão).
4. **Acesso ao Supabase**: sem `SUPABASE_ACCESS_TOKEN` de ambiente, mas o Windows Credential Manager tem credencial "Supabase CLI" cacheada — `npx supabase projects list` funciona sem login. `npx supabase link --project-ref feotsdzkwbikmcnzgsnh` linka ao projeto real. **Aplicar em produção continua ação de alto risco — confirme com o usuário antes, mesmo com acesso técnico disponível.**
5. **Toda migration nova**: confira `ls supabase/migrations/ | tail -20` antes de nomear (colisão de timestamp com trabalho paralelo já aconteceu antes).
6. **Existe um programa de fidelidade em produção, fora do git, que está sendo tratado num fluxo separado** (`docs/plano-acao-fidelizacao.md`, `PROMPT_FIDELIZACAO_INICIO.md`) — não é delivery, ignore a menos que o usuário peça pra unificar os dois.

---

## Como validar antes de fazer qualquer mudança

1. `git fetch origin main && git log origin/main --oneline -20`.
2. `npx tsc --noEmit && npx eslint . && npm run build`.
3. Se for mexer no banco: Docker + `npx supabase start` + `npx supabase db reset` localmente, testar de verdade (não só ler código).
4. Depois de qualquer merge que toque `supabase/functions/**` ou `supabase/migrations/**`, confira `gh run list --workflow=deploy-functions.yml --limit 1` — e **confirme que a function nova está na lista do workflow**, não só que o job passou (o job passa mesmo ignorando uma function que não está na lista).

---

## Primeiro passo recomendado

Não comece a codar a Fase 4 direto. Primeiro rode os comandos de validação acima e confirme com o usuário:
1. Escopo exato do login do motoboy — email/senha como os outros perfis, ou algo mais simples (PIN, magic link por WhatsApp) já que é uso rápido no celular durante a entrega?
2. O motoboy precisa ver só os pedidos dele, ou o board inteiro da filial?
3. O que exatamente entra no "painel agregado de métricas" — média de tempo por entregador/filial/dia é o mínimo descrito em `FEATURE_DELIVERY.md`, mas vale confirmar se é isso mesmo que o usuário quer ver primeiro.

Só depois de alinhar isso, desenhar o schema (`couriers.profile_id`, RLS pro novo role/relação) e o fluxo antes de codar.
