# PDV Marcos Krep's — guia para agentes de IA

Sistema de Ponto de Venda (PDV) mobile-first para a Marcos Krep's (creperia), com múltiplas filiais. Fluxo: atendente cria pedido → cozinha produz → cliente é notificado por WhatsApp → pagamento e impressão térmica. Também existe um fluxo público de autoatendimento (`/pedir/[slug]`) com checkout online via Mercado Pago.

## Stack e versões travadas
- **Frontend**: Next.js `16.2.4` (App Router, versão travada — não usar `^`/`latest`), React `19.2.4`, TailwindCSS v4, Zustand (carrinho).
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions, Realtime). Sem ORM — SQL puro em `supabase/migrations/`.
- **Impressão**: worker Node.js separado em `/print-worker`, fala ESC/POS via TCP com a impressora.
- **Notificações**: WhatsApp Cloud API (Meta), ver `docs/whatsapp-cloud-setup.md`.

<!-- BEGIN:nextjs-agent-rules -->
### Aviso: Next.js 16 tem breaking changes reais
Esta versão do Next difere do que está no seu treinamento (ex.: `proxy.ts` substitui `middleware.ts`). **Depois de rodar `npm install`**, leia o guia relevante em `node_modules/next/dist/docs/` antes de mexer em rotas, middleware/proxy ou convenções de arquivo — em especial `01-app/01-getting-started/16-proxy.md` e `01-app/02-guides/upgrading/version-16.md`. Respeite avisos de depreciação.
<!-- END:nextjs-agent-rules -->

## Convenções de domínio
- **Português para negócio, inglês para técnico**: status e enums de negócio ficam em português (`AGUARDANDO_CONFIRMACAO`, `NA_FILA`, `PRONTO`, `ENTREGUE`, `CANCELADO`), campos técnicos genéricos em inglês. Siga o padrão já existente em `src/types/pdv.ts` — não traduza um lado para o outro.
- **Trust-no-client**: preço final e regras de negócio são sempre recalculados nas Edge Functions a partir do banco. O payload do cliente pode enviar preços/adicionais, mas eles são revalidados e podem ser rejeitados (400) — nunca confie em valores vindos do frontend.
- **RLS por role**: `ADMIN` tem acesso total às tabelas administrativas; `ATTENDANT` normalmente só tem `SELECT`. O frontend nunca usa a service role nem tenta contornar RLS.

## Onde procurar contexto (nessa ordem)
1. `walkthrough.md` — arquitetura por tela (pedidos, impressão, cardápio, caixa, usuários). É o doc mais confiável sobre *como o sistema funciona hoje*, mas pode estar um passo atrás do código mais recente — confira o código quando a dúvida for crítica.
2. `docs/` — operacional: `deployment-checklist.md`, `mvp-operational-test.md`, `whatsapp-cloud-setup.md`, `caixa-action-plan.md` (plano faseado do módulo de caixa).
3. `docs/archive/` — os 6 `PROMPT_*.md` e `release-notes-mvp.md` **são briefings históricos**, já auditados contra o código em 2026-08-04 (ver `docs/archive/README.md` para a tabela completa de veredito/evidência) — todos implementados, exceto duas lacunas menores em `PROMPT_MELHORIA_PEDIR_PEDIDO_RETENCAO.md`. Não são backlog ativo; não reimplemente o que já existe.
4. `docs/proposals/` — propostas em aberto ainda não iniciadas, ex.: `PROPOSTA_FIDELIDADE.md`.

## Comandos
- Raiz: `npm run dev`, `npm run build`, `npm run lint`.
- `print-worker/`: sub-projeto independente, tem seu próprio `.env` (ver `print-worker/.env.example`) e `npm run dev`.

## Objetivos atuais
*(mantenha esta seção atualizada quando a direção do projeto mudar — é a primeira coisa que um agente lê)*

O MVP (release candidate) já foi entregue — pedidos, impressão, WhatsApp, cardápio e checkout Mercado Pago estão em produção. O foco atual é expansão pós-MVP:
- **Precisão financeira**: reconciliar caixa vs. relatório, custo/margem por produto, comparação entre períodos, gargalo por etapa do pedido.
- **Multi-filial**: rollout de cardápios por filial (ex.: Águas Claras / Candangolândia).
- **Login por passkey/WebAuthn** como alternativa a senha.
- **Programa de fidelidade** (`docs/proposals/PROPOSTA_FIDELIDADE.md`): proposta escrita e detalhada, mas **ainda não iniciada** — confirmar com o time antes de começar a implementar.
- **Caixa**: auditoria de pagamentos e abertura/fechamento formal de sessão (`cash_sessions` existe no schema mas está órfã) — ver plano faseado em `docs/caixa-action-plan.md`.
