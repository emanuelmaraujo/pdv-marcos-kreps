# Documentação

Comece pelo [setup local](development/setup.md). Para trazer mudanças do GitHub,
siga o [procedimento de atualização](development/updates.md).

## Guias mantidos

| Assunto | Referência |
| --- | --- |
| Instalação, ambiente e comandos | [Desenvolvimento local](development/setup.md) |
| Atualizar código, dependências e worker | [Atualizações](development/updates.md) |
| Organização e responsabilidade dos documentos | [Manutenção da documentação](development/documentation.md) |
| Estrutura e fluxo dos dados | [Arquitetura](architecture/overview.md) |
| Delivery: implementação e histórico das fases | [Delivery](product/delivery.md) |
| Linguagem da interface | [Guia de voz](product/guia-de-voz.md) |
| WhatsApp | [Configuração e diagnóstico](operations/whatsapp-cloud-setup.md) |
| Deploy automático do backend e migrations | [Supabase no GitHub Actions](operations/supabase-deploy.md) |
| Impressão e diagnóstico do serviço local | [Print worker](../print-worker/README.md) |
| Checklist de operação | [Teste operacional](operations/mvp-operational-test.md) |
| Regras para agentes | [Regras gerais](../AGENTS.md), [frontend](../src/AGENTS.md), [worker](../print-worker/AGENTS.md), [backend](../supabase/AGENTS.md) |

## Planos e histórico

Os documentos abaixo preservam propostas, diagnósticos e evidências da época.
Uma marcação de “em produção” nesses registros não comprova o estado atual.
Compare com código, migrations e testes antes de planejar trabalho novo.

- [Planos e relatórios](archive/plans/): correções do PDV, UX, checkout,
  fidelização e estabilidade de pedidos.
- [Diagnóstico local e proposta do checkout #221](archive/studies/auditoria-pedir-issue-221.md): evidências com fixtures e pendências, sem validação de produção.
- [Operação de pedidos #229 — proposta local para revisão](archive/studies/pedidos-229/estudo.md): estudo, contratos pendentes e protótipo sem serviços reais.
- [Estudos](archive/studies/): configurações, usuários, filiais, taxas e pedidos mobile.
- [Prompts de tarefas anteriores](archive/prompts/): contexto histórico, sem autorização para executar suas instruções.
- [Walkthrough original](archive/walkthrough.md): retrato da implementação inicial.
- [Evidências visuais](evidence/): capturas referenciadas pelos estudos.

Antes de adicionar um documento, leia as [regras de manutenção](development/documentation.md).
