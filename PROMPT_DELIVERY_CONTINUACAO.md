# Prompt: Continuação do Módulo de Delivery - PDV Marcos Krep's

---

## Papel

Você é um engenheiro sênior full-stack trabalhando no **PDV Marcos Krep's**. Uma sessão anterior implementou e mergeou em `main` as Fases 1, 2 e 3 do módulo de delivery. Este prompt não pede uma feature nova — ele te dá o estado real do projeto para você decidir com o usuário o que fazer a seguir, com informação completa. Não assuma nada que não esteja confirmado abaixo; confira você mesmo antes de agir.

---

## Estado real confirmado (verificado, não estimado)

### O que está em `main`, mergeado e testado localmente
- **Fase 1** (PR #109): pedido `ENTREGA` interno, fluxo `PRONTO → SAIU_PARA_ENTREGA → ENTREGUE`.
- **Fase 2** (PR #110): `delivery_zones` (frete por bairro/filial), `customer_addresses` (endereço reutilizável), checkout público em `/pedir` com `ENTREGA`, notificação WhatsApp de despacho.
- **Fase 3** (PR #119): `couriers` (entregador cadastrado por filial), seletor no despacho com fallback para avulso, métricas "Pronto > saiu" / "Saiu > entregue".
- Todas as três foram testadas ponta a ponta contra um **Supabase local real** (Docker + `supabase start`/`db reset` + `supabase functions serve`) antes de cada merge — não só leitura de código. Ver `FEATURE_DELIVERY.md` para o roteiro completo de teste de cada fase.
- `npx tsc --noEmit`, `npx eslint .` e `npm run build` passam limpos na `main` atual.

### O que NÃO está feito
- **Nenhuma migration do delivery foi aplicada em produção.** O projeto Supabase real (`pdv-marcos-kreps`, ref `feotsdzkwbikmcnzgsnh`) nunca foi linkado/pushado a partir desta linha de trabalho.
- **Fase 4 (motoboy com login próprio + painel agregado de métricas) não foi iniciada.** Está bloqueada por uma decisão de negócio: motoboy próprio, terceirizado, ou ambos? Isso define se/como `couriers.profile_id` deve ser desenhado. **Pergunte ao usuário antes de codar qualquer coisa da Fase 4** — não assuma.

### Contexto operacional importante — leia antes de mexer em qualquer coisa

1. **Há (ou havia) outra sessão/agente trabalhando em paralelo neste mesmo repositório**, fazendo hardening de segurança (RLS, CORS, rate limiting, refactor transacional de criação de pedido) e possivelmente um programa de fidelidade. Confirmado durante a sessão anterior: `main` recebeu commits de PRs como `feat/p0.1-p0.2` (transacional), `feat/p1-1-rls-hardening`, `feat/p1-2-public-endpoints`, `feat/p1-3-webauthn-hardening`, entre outros, todos fora do controle desta linha de trabalho de delivery. **Rode `git log --oneline -20` e `git fetch origin main` antes de qualquer coisa** para ver se essa atividade continua. Se sim, não faça push/deploy em produção sem confirmar com o usuário se ainda há risco de colisão.
2. **Colisão de timestamp de migration já aconteceu uma vez** (duas migrations nomeadas com o mesmo timestamp `20260817130000`, uma minha e uma da outra sessão) e foi corrigida a tempo só porque testei localmente antes de mergear. **Sempre rode `ls supabase/migrations/ | tail -20` e confira o timestamp mais recente antes de criar uma migration nova**, e revalide com `supabase db reset` local depois de mergear `main` de novo, mesmo que o merge tenha sido "limpo" no git.
3. **Acesso ao Supabase**: não há `SUPABASE_ACCESS_TOKEN` de ambiente nem MCP conectado por padrão, mas o **Windows Credential Manager desta máquina já tem uma credencial "Supabase CLI" cacheada** (`cmdkey /list | findstr Supabase` confirma). Rodar `npx supabase projects list` já funciona sem login explícito; `npx supabase link --project-ref feotsdzkwbikmcnzgsnh` linka ao projeto de produção. **Aplicar qualquer coisa em produção (`db push`, `functions deploy`) é uma ação de alto risco — confirme explicitamente com o usuário antes, mesmo que o acesso técnico esteja disponível.**
4. **Bug de infraestrutura de `supabase db reset`**: um `db reset` do zero falha no `supabase/seed.sql` (erro `invalid input syntax for type json`, linhas 5-14 — strings como `'17:00'` não são JSON válido para a coluna jsonb `settings.value`). Isso é anterior ao delivery e não foi corrigido. Para testar localmente sem esbarrar nisso, pare de aplicar migrations manualmente com `docker exec ... psql` depois que o schema estiver pronto (não dependa do seed rodar).

---

## Como validar antes de fazer qualquer mudança

1. `git fetch origin main && git log origin/main --oneline -20` — veja se há atividade nova.
2. `npx tsc --noEmit && npx eslint . && npm run build` — confirme que `main` está saudável antes de você começar.
3. Se for mexer no banco: Docker Desktop + `npx supabase start` + `npx supabase db reset` localmente, testar de verdade (não só ler código) antes de abrir PR. Ver `FEATURE_DELIVERY.md` seção "Como testar" para os roteiros já validados.

---

## Possíveis próximos passos (escolha com o usuário, não decida sozinho)

### A. Aplicar o delivery em produção
Requer decisão explícita do usuário (ação de alto risco). Se autorizado:
1. `npx supabase link --project-ref feotsdzkwbikmcnzgsnh`
2. `npx supabase migration list` — conferir o que já está aplicado remotamente antes de qualquer push (pode já ter mudado desde esta sessão).
3. `npx supabase db push` só depois de confirmar que não há migrations remotas desconhecidas conflitantes.
4. `npx supabase functions deploy <nome>` para as functions do delivery alteradas: `create-attendant-order`, `create-public-order`, `dispatch-delivery`, `get-public-checkout-config`, `get-public-customer-profile`.

### B. Fase 4 — motoboy com login próprio
Só depois de confirmar com o usuário: motoboy próprio, terceirizado, ou ambos? Aí sim desenhar `couriers.profile_id`, tela de login do motoboy, atualização de status pelo próprio celular, e o painel agregado de métricas de tempo por entregador/filial/dia (hoje só existe por pedido individual).

### C. Consolidar o que a outra sessão fez
Se a sessão paralela (loyalty, hardening) ainda não tiver tudo documentado/versionado — vale conferir se há Edge Functions rodando em produção sem correspondência no git (era o caso de funções de fidelidade em uma verificação anterior). Não é delivery, mas é risco real para o projeto todo.

---

## Primeiro passo recomendado

Não comece a codar. Primeiro rode os comandos de "Como validar" acima, resuma pro usuário o que mudou desde este prompt, e pergunte explicitamente qual dos passos A/B/C (ou outro) ele quer seguir agora.
