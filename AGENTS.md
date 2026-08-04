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
2. `docs/` — operacional: `deployment-checklist.md`, `mvp-operational-test.md`, `whatsapp-cloud-setup.md`, `release-notes-mvp.md` (esta última é um snapshot antigo da fase RC1, não reflete o estado atual).
3. Os arquivos `PROMPT_*.md` e `PROPOSTA_FIDELIDADE.md` na raiz **são briefings históricos de tarefas** escritos para uma sessão de IA específica, não specs vivas mantidas. Antes de tratar algo ali como "a fazer", confira no código/`git log` se já foi implementado. Exemplo real: `PROMPT_CHECKOUT_MERCADO_PAGO.md` descreve um checkout que **já está implementado** (`supabase/functions/create-mercado-pago-payment`, `supabase/functions/mercado-pago-webhook`, migration `20260511000000_public_checkout_mercado_pago.sql`, uso em `src/app/pedir/page.tsx`). Não reimplemente algo que já existe só porque um PROMPT_*.md pede.

## Comandos
- Raiz: `npm run dev`, `npm run build`, `npm run lint`.
- `print-worker/`: sub-projeto independente, tem seu próprio `.env` (ver `print-worker/.env.example`) e `npm run dev`.

## Objetivos atuais
*(mantenha esta seção atualizada quando a direção do projeto mudar — é a primeira coisa que um agente lê)*

O MVP (release candidate) já foi entregue — pedidos, impressão, WhatsApp, cardápio e checkout Mercado Pago estão em produção. O foco atual é expansão pós-MVP:
- **Precisão financeira**: reconciliar caixa vs. relatório, custo/margem por produto, comparação entre períodos, gargalo por etapa do pedido.
- **Multi-filial**: rollout de cardápios por filial (ex.: Águas Claras / Candangolândia).
- **Login por passkey/WebAuthn** como alternativa a senha.
- **Programa de fidelidade** (`PROPOSTA_FIDELIDADE.md`): proposta escrita e detalhada, mas **ainda não iniciada** — confirmar com o time antes de começar a implementar.
