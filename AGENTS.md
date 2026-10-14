<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — PDV Marcos Krep's

## Produto e contexto

PDV mobile-first para atendimento, pedidos públicos/delivery, caixa e produção
(cozinha/sucos), com impressão térmica e notificações WhatsApp.
Leia `README.md`, `walkthrough.md` e `FEATURE_DELIVERY.md` conforme a área;
`docs/` guarda planos e guias operacionais, sem equivaler a produção verificada.
Compare documentos com manifests, código, configuração e testes antes de agir.

## Stack e estrutura

- Manifest: Next.js 16.3, React 19.2, TypeScript, Tailwind 4, Supabase
  (Auth, Postgres/RLS, Realtime e Edge Functions); Vitest e ESLint.
  O README ainda menciona Next.js 15: prevalece o manifest/lock instalado.
- `src/app/`: rotas e telas; `src/components/`, `contexts/`, `hooks/`, `features/`:
  UI e estado; `src/lib/`: regras/helpers; `src/types/`: contratos.
- `supabase/`: migrations, testes SQL e Edge Functions; `print-worker/`:
  serviço Node local ESC/POS/TCP; `docs/`: documentação; `scripts/`: ferramentas.
- Precificação e autorização devem ser validadas no servidor; preserve RLS e
  regras das Edge Functions, sem confiar em parâmetros enviados pelo navegador.

## Comandos verificados nos manifests

- Web: `npm ci`; desenvolver: `npm run dev`; testar: `npm test`;
  teste da área: `npm test -- <caminho>`; lint: `npm run lint`; build: `npm run build`.
- Não existe script `typecheck` na raiz; não invente `npm run typecheck`.
- Print worker: `npm ci --prefix print-worker`; `npm run typecheck --prefix print-worker`;
  `npm run build --prefix print-worker`; `npm run dev --prefix print-worker`.
- O CI encontrado executa operações remotas de deploy/migrations e expiração de
  pedidos; esses workflows não são testes locais e não devem ser disparados por agentes.
- Rode validação proporcional; reporte os testes/áreas não executados. Scripts de
  backend/payment/concurrency podem escrever dados reais: não use como smoke automático.

## Limites e aprovação humana

- Pagamentos, auth/usuários, dados reais, migrations e produção exigem aprovação
  humana antes de alterar; nada de merge, deploy, cobrança ou impressão real automática.
- Trabalhe em branch própria; preserve mudanças existentes e não reduza testes para passar.
- Não copie `.env` para worktrees, imprima chaves ou ligue testes aos serviços reais.
- Confirme o projeto/banco correto antes de qualquer operação autorizada; dados de
  outro negócio não são fixtures nem um ambiente descartável.
- Interface em pt-BR; decisões de negócio e riscos precisam ficar claras para o operador.

## Workflows do César por repositório

- `.ai/cezar/workflows/rapido.yaml`: tarefa pequena de baixo risco; implementação
  e `npm test`, com no máximo uma correção, sem revisão por LLM ou escalada.
- `.ai/cezar/workflows/com-revisao.yaml`: teste com até duas correções e revisão
  de segurança, negócio e escopo com até duas rodadas de correção.
  `ask-user` apresenta diff, riscos e testes; somente “Aprovar” conclui com sucesso.
  Revisão esgotada ainda exige decisão explícita sobre as pendências.
- A aprovação final não autoriza merge/deploy nem substitui a autorização prévia
  para áreas sensíveis. Os workflows usam apenas os testes locais do manifest.

## Graphify (quando os artefatos existirem)

Se `graphify-out/graph.json` existir, comece perguntas de código por
`graphify query "<pergunta>"`; use `graphify path "<A>" "<B>"` ou
`graphify explain "<conceito>"` para relações e conceitos específicos.
Se existir, `graphify-out/wiki/index.md` orienta a navegação ampla; leia
`graphify-out/GRAPH_REPORT.md` só quando precisar de arquitetura ampla ou
as consultas não bastarem. Após mudança de código, `graphify update .`
atualiza o grafo por AST; mudanças somente de documentação não exigem isso.
