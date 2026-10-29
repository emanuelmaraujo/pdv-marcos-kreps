# Etapa 1A — evidências locais da implementação

Data: 2026-10-27. Implementação 1A validada localmente na branch `cez/74b5ea0d`.
Aplicação Next e Supabase exclusivamente descartável, sem serviços reais.
Estudo e 24 capturas históricas preservados nos diretórios anteriores.

Resultados abaixo correspondem à implementação; revisão e aprovação seguem no workflow.
Não há alegação de deploy, migração aplicada remotamente ou impressão física.

## Escopo do diff

- Uma migration aditiva para configuração, unidades de repasse, comandos idempotentes,
  eventos imutáveis e cobertura dos jobs por revisão. RLS por filial, comandos
  autenticados e nenhuma escrita direta de clientes nas tabelas novas.
- Quadro real: nome primeiro, estados e modificadores legíveis, repasse por unidade,
  autoria/horário, histórico, recuperação manual com motivo e correção por ADMIN.
- API de repasse separada da consulta de pedidos, com timeout e fallback explícito;
  assinatura de estado permite reconciliar mesmo sem mudança em orders.updated_at.
- Produtores de comanda adicionam cobertura do snapshot usado no texto. Não foram
  alteradas regras financeiras, RPCs de pagamento, condições do split_bill ou COD.
- Guia operacional e roteiro local reproduzível. Estudos e capturas do protótipo
  foram preservados; screenshots novos pertencem à aplicação Next real.

## Diferenças em relação ao protótipo

A tela é `/app/pedidos`, com login local real, providers, adaptadores, PostgREST,
RPCs e Realtime da instância descartável. Não usa o espelho em memória do HTML.
Configuração começa desativada; legado/consulta indisponível não parecem confirmados.
Autoria e hora vêm do banco. Uma disputa de versões gera conflito real, não um
contador alterado em JavaScript. A recuperação manual preserva a falha do job.

O protótipo simulava produção independente por unidade e parcelas financeiras.
Esses controles **não foram portados**: na 1A, o preparo continua por linha inteira
(e isso é indicado na tela). Ações em lote e produção por unidade são 1B;
checkout/viagem são etapa 2; pagamentos fracionados são etapa 3, com gates próprios.

O cartão usa componentes, tema e navegação existentes. Abrir detalhes é um botão
no nome, evitando uma região com role=button contendo outros botões. As linhas não
somem ao confirmar repasse. Configuração por setor é recolhível e restrita ao ADMIN
na UI, com autorização também no banco.

## Falhas encontradas e correções

- Layout em 320 px: cabeçalho tinha margem horizontal negativa, levando scrollWidth
  a 332 px. [Captura antes da correção](overflow-320.png). Corrigida a margem no
  cabeçalho; sem esconder overflow. A nova execução valida todas as larguras.
- O teste novo que tentava escrever PRINTED como authenticated encontrou a proibição
  de UPDATE já existente. O teste passou a exigir 42501; não se concedeu privilégio.
- O roteiro offline inicial não concluiu: o botão podia desaparecer durante a
  recuperação de consultas. O quadro mobile trocava pedidos em cache por uma tela
  de erro quando uma atualização falhava. Corrigido para manter dados e sinalizar
  desatualização, com novos botões de repasse desabilitados pelo estado de conexão.
  A nova execução exige pedido visível e ação bloqueada com a rede realmente desligada.

## Leitura operacional das capturas

No desktop, colunas precisam de mais largura para os controles por unidade: mínimo
320 px, mantendo rolagem horizontal regional do Kanban. Em linhas quantity>1 já
repassadas integralmente, as unidades ficam recolhidas em um grupo com contagem e
última autoria visível; o operador pode abrir o histórico por unidade. Isso reduz
altura depois da confirmação sem ocultar unidades ainda pendentes.

As capturas usam o aplicativo e banco locais reais com fixtures; o carregamento
de fontes Google é substituído por fonte local no roteiro para impedir dependência
de rede externa. Não representam o equipamento físico, dados reais ou produção.

## Resultados efetivos (antes da revisão independente)

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| `npm run check` | PASS, exit 0 | Documentação, configuração Supabase, tipos, lint e 39 arquivos / 306 testes Vitest |
| `npm run test:database -- --handoff-qa --cod-e2e`: SQL | PASS | 9 arquivos / 139 testes pgTAP no banco descartável |
| Concorrência HTTP | PASS | Duas sessões reais disputaram a mesma versão; um commit e um conflito 40001; replay idempotente |
| Aplicação Next `/app/pedidos` | PASS | Dois usuários locais: registro por teclado, atualização na segunda sessão sem reload, recuperação manual com falha do job preservada |
| Layout e controles | PASS | 320/360/390/768/1440, claro/escuro; sem overflow da página; novos botões de repasse com pelo menos 44 px |
| Offline | PASS | Rede do contexto realmente desligada; pedido já carregado mantido, repasse desabilitado; reconexão remove sinalização |
| Regressão COD local | PASS | `cod-e2e-flow.mjs`: 46 verificações, incluindo confirmação, impressão única por setor, recebimento, caixa, concorrência e estorno |
| Worker | PASS, exit 0 | `npm run typecheck --prefix print-worker` e `npm run build --prefix print-worker`; serviço de impressão não iniciado |
| Build web Webpack | PASS, exit 0 | `npm run build -- --webpack`: compilação, TypeScript e 30 páginas, com loopback e mock local de fontes |
| Build web padrão Turbopack | PASS, exit 0 | Compilação com Next.js 16.3.1 (Turbopack), verificação TypeScript e geração estática de 30 páginas, executado com as variáveis de ambiente do CI (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-build-only-not-a-real-key`) |
| Impressão térmica, dispositivos físicos, produção | NÃO EXECUTADOS | Fora da autorização; não equivalem a mocks ou testes locais |

O comando combinado de banco/QA terminou as asserções SQL, browser e COD acima;
a sessão foi interrompida com sinal 143 durante o encerramento. Foi conferido
separadamente que nenhum container `pdv-db-*` dessa execução permaneceu ativo.
Esse status não é apresentado como exit 0 do comando completo. Os 46 checks COD e
os PASS individuais foram emitidos pelo roteiro, não inferidos dos screenshots.

O build de produção foi validado tanto com Webpack quanto com o pipeline padrão Turbopack do Next.js 16.3.1, utilizando as variáveis padrão de compilação sem serviços externos descritas no CI (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e chave anon dummy), gerando as 30 rotas e passando pelo TypeScript sem falhas. O navegador nos testes locais utilizou fallback local de fonte para evitar chamadas de rede externas.

Roteiro reproduzível: [qa-etapa-1a.mjs](../qa-etapa-1a.mjs), invocado pelo script
normal de banco, com `--handoff-qa`. Caminhos das ferramentas nesta sessão:
Playwright core da instalação do cockpit e Chromium 1247 no cache local; passados
pelas variáveis PDV_QA_PLAYWRIGHT/PDV_QA_CHROMIUM. Nenhuma dependência adicionada ao
manifest ou lockfile. Nenhum `.env` copiado. API aceita somente 127.0.0.1:55431 e
container com prefixo exclusivo `supabase_db_pdv-db-`.

## Capturas da aplicação (dados sintéticos)

| Tela | Claro | Escuro |
| --- | --- | --- |
| 320 px | [Quadro](quadro-320-light.png) | [Quadro](quadro-320-dark.png) |
| 360 px | [Quadro](quadro-360-light.png) | [Quadro](quadro-360-dark.png) |
| 390 px | [Quadro](quadro-390-light.png) | [Quadro](quadro-390-dark.png) |
| 768 px | [Quadro](quadro-768-light.png) | [Quadro](quadro-768-dark.png) |
| 1440 px | [Quadro](quadro-1440-light.png) | [Quadro](quadro-1440-dark.png) |
| Cartão completo 390 px | [Cartão](card-390-light.png) | [Cartão](card-390-dark.png) |

[Estado offline real](offline-390.png). Capturas de 390 claro, 1440 escuro e offline
foram abertas e inspecionadas nesta sessão. Captura de elemento completo pode
mostrar a navegação fixa sobre uma faixa intermediária; as capturas de viewport
registram o estado normal da área visível. A coluna Kanban tem rolagem própria.

## Riscos e limites para aprovação

Não há deploy nem migrations aplicadas remotamente. O backfill aditivo de unidades
precisa ser dimensionado contra o volume real antes de qualquer autorização de
produção. Schema deve preceder funções que selecionam handoff_revision; ativação
por setor fica desligada até configuração explícita. Jobs legados sem cobertura
não são promovidos a impressos.

Produção e entrega por unidade/lote permanecem fora da 1A: os endpoints existentes
continuam responsáveis por produção, com as limitações concorrentes documentadas
no estudo. Não houve implementação de checkout, viagem tardia ou parcelas por valor.
Ajustes em funções de pagamento limitam-se à consulta da revisão e inclusão de
metadados dos jobs, sem mudar regras, valores ou RPCs financeiros.

Não houve auditoria completa de contraste, leitor de tela, teclado virtual/Safari
ou teste físico de safe area. Não foram testados pagamentos com provedores reais,
WhatsApp externo ou impressora física. Configuração/correção têm testes SQL de
permissão e concorrência; o roteiro de browser valida o caminho principal de
confirmação e recuperação, não todos os controles administrativos.

Revisão independente e aprovação humana são os próximos passos do workflow `com-revisao`.
Este relatório conclui somente a etapa Implementar. Esta etapa não resolve a
issue #229 integralmente e sua aprovação não autoriza merge, deploy ou produção.
