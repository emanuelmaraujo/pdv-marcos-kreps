# Arquitetura

Revisão estrutural em 2026-10-24. Descreve a organização do código local;
não atesta o estado dos serviços publicados.

## Componentes

| Componente | Responsabilidade |
| --- | --- |
| `src/app/` | Rotas Next App Router; atendimento em `/app`, checkout em `/pedir`, acompanhamento em `/pedido` |
| `src/components/`, `src/features/` | Componentes de interface e funcionalidades compartilhadas |
| `src/contexts/`, `src/hooks/` | Estado e integração da interface |
| `src/lib/api/` | Acesso a dados e chamadas às funções de negócio |
| `src/lib/`, `src/types/` | Regras auxiliares, clientes e contratos TypeScript |
| `src/proxy.ts` | Tratamento de sessão e navegação entre rotas públicas/protegidas |
| `supabase/functions/` | Validações e operações de negócio no servidor |
| `supabase/migrations/` | Evolução versionada do banco e das políticas |
| `supabase/manual-data/` | Operações pontuais de catálogo, fora do deploy automático |
| `supabase/tests/` | Verificações de banco, com ambiente próprio |
| `print-worker/` | Consumo da fila de impressão e ESC/POS na rede da loja |
| `scripts/` | Ferramentas locais e scripts de integração |

## Fluxo de uma alteração de pedido

A interface usa os adaptadores de API e o cliente Supabase conforme a operação.
As operações de negócio implementadas nas Edge Functions validam parâmetros e
autorização no servidor. As políticas RLS também controlam o acesso direto ao banco.
Preço exibido, sessão ou permissões no frontend não substituem essas validações.

As telas conciliam dados após ações e eventos Realtime; as estratégias de
atualização variam por área. Leia os helpers e testes de sincronização antes de
alterar frequência de consultas ou inscrições.

## Impressão

O backend cria jobs em `printer_jobs`. O worker local reivindica jobs por RPC e
envia o conteúdo para a impressora. Na implementação atual, Realtime é a via
principal; o polling de contingência é ativado quando necessário. O heartbeat
grava saúde em `settings` a cada dois minutos. Não assuma os intervalos menores
descritos no walkthrough histórico.

O browser não se comunica diretamente com a impressora. O serviço tem dependências,
ambiente e compilação separados. Consulte o [runbook](../../print-worker/README.md).

## Como navegar

Para mudanças de UI, comece pela rota e siga seus componentes e adaptadores de API.
Para mudança de regra, siga o adaptador até a função e a migration correspondente.
Use os testes existentes para identificar contratos e casos de borda.
Os [documentos arquivados](../archive/README.md) ajudam a recuperar o contexto de
decisões, mas precisam ser confrontados com o código atual.
