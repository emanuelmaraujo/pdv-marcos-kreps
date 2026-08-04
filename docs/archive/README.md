# Arquivo histórico

Esta pasta guarda briefings de tarefa que foram escritos para uma sessão de IA específica (`PROMPT_*.md`) e um snapshot de release antigo (`release-notes-mvp.md`). Não são documentação viva — servem de referência histórica de como e por que cada funcionalidade foi construída. Para o estado atual do projeto, veja a seção "Objetivos atuais" em `/AGENTS.md`.

Uma proposta ainda **não iniciada** (`PROPOSTA_FIDELIDADE.md`) fica em `/docs/proposals/`, não aqui — só entra neste arquivo o que já foi implementado.

## Auditoria (verificada em código em 2026-08-04)

| Arquivo | Veredito | Evidência |
|---|---|---|
| `PROMPT_CHECKOUT_MERCADO_PAGO.md` | ✅ Implementado | `supabase/functions/create-mercado-pago-payment`, `supabase/functions/mercado-pago-webhook`, migration `20260511000000_public_checkout_mercado_pago.sql`, tabelas `payment_method_configs`/`payment_transactions` |
| `PROMPT_MELHORIA_PEDIR_PEDIDO_RETENCAO.md` | ✅ Implementado (2 lacunas) | Tracking real em `src/app/pedido/[publicToken]/PedidoStatusClient.tsx`, retenção via `localStorage` + `get-public-customer-profile`. Faltou: extrair `src/app/pedir/page.tsx` (~2.560 linhas) em componentes menores; sem suporte a `prefers-reduced-motion` |
| `PROMPT_MELHORIA_TELA_CONFIGURACOES.md` | ✅ Implementado | Tabs mobile + sticky header em `src/app/app/configuracoes/page.tsx`, `src/lib/api/settings-api.ts` centralizado |
| `PROMPT_MELHORIA_TELA_PEDIDO_MERCADO_PAGO.md` | ✅ Implementado | Filtros por proteína/sabor derivados de `product_ingredients` reais em `src/app/pedir/page.tsx` |
| `PROMPT_PIX_CONFIG_GLOBAL.md` | ✅ Implementado | Pix direto (sem Brick) com QR/copy-paste em `create-mercado-pago-payment`; webhook valida `x-signature`; `settings` já é chave global única |
| `PROMPT_RESPONSIVIDADE.md` | ✅ Implementado | `src/components/layout/Sidebar.tsx`, `src/lib/nav-items.ts` compartilhado, `max-w-md` removido do layout global |
| `release-notes-mvp.md` | 📦 Snapshot histórico | Descreve a fase RC1 (maio/2026); o projeto já passou dessa fase (expansão multi-filial, relatórios avançados, passkeys) |

Antes de tratar qualquer coisa nesta pasta como "a fazer", confira o código/`git log` — o nome do arquivo não é garantia de que a tarefa ainda está pendente.
