# PDV Marcos Krep's

Sistema de ponto de venda para atendimento, pedidos públicos, delivery, caixa e
produção, com impressão térmica e notificações WhatsApp. Interface mobile-first em pt-BR.

## Começar

Requer Git, Node.js 20.9 ou superior e npm. Na primeira instalação:

```powershell
npm ci
Copy-Item .env.example .env.local
# Preencha .env.local com o ambiente de desenvolvimento.
npm run dev
```

Abra `http://localhost:3000`. Não sobrescreva um `.env.local` existente.
Veja [setup e comandos](docs/development/setup.md) para preparar frontend e worker.

## Atualizar e validar

Com árvore de trabalho limpa:

```powershell
npm run update:check
npm run update:local
npm ci
npm run check
```

O atualizador incorpora `origin/main` por fast-forward na branch atual e para se
houver trabalho pendente ou histórico divergente. Consulte o [guia de atualizações](docs/development/updates.md)
para backups, dependências, build do worker e limites da atualização local.

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `src/` | Next.js 16 App Router, React 19, TypeScript e Tailwind CSS 4 |
| `supabase/` | Banco, RLS, migrations e Edge Functions |
| `print-worker/` | Serviço Node de impressão ESC/POS por rede |
| `scripts/` | Ferramentas de manutenção e integração |
| `docs/` | Guias mantidos, produto, operação e histórico |

## Referências

- [Índice da documentação](docs/README.md)
- [Arquitetura](docs/architecture/overview.md)
- [Impressão e diagnóstico do worker](print-worker/README.md)
- [Delivery](docs/product/delivery.md)
- [Regras para agentes](AGENTS.md)
- [Planos, estudos e prompts arquivados](docs/archive/README.md)

Precificação e autorização precisam ser validadas no servidor, com as políticas
RLS correspondentes. Nunca coloque chaves de serviço em variáveis `NEXT_PUBLIC_*`.
