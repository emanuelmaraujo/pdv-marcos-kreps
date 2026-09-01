# Estudo mobile-first — pedidos e consulta de cliente

Data: 2026-09-01. Escopo de estudo, sem implementação de redesenho.

## Método e limites

Foram inspecionados os fluxos e componentes em 360 px, 390 px, 768 px e
desktop, com walkthrough autenticado no Supabase local. A evidência funcional
em 360 px incluiu quadro com dois pedidos, detalhe, pagamento por itens,
polling de 15 s, evento Realtime e consulta de cliente. As capturas contendo
dados sintéticos não foram versionadas e todos esses dados foram removidos ao
fim. O navegador integrado não reproduz o teclado virtual do sistema
operacional; esse comportamento foi avaliado por estrutura, foco e espaço
reservado, e precisa de confirmação em aparelho físico.

## Fluxo atual do atendente

| Tarefa | Caminho atual | Toques/etapas aproximados |
|---|---|---:|
| Novo pedido simples | Novo → produto → personalização → adicionar → revisar → cliente → pagamento → confirmar | 8–12 |
| Identificar cliente | Checkout, etapa Cliente → telefone → aguardar debounce/consulta → confirmar ou completar nome | 2–4 |
| Abrir e cobrar pedido | Pedidos → card → detalhe → pagar integral ou itens → método → confirmar | 5–8 |
| Cobrar por itens | Pedidos → card → detalhe → itens pendentes → marcar itens → escolher método → registrar | 7–10 |
| Consultar pedido | Pedidos → aba/status ou busca → card → detalhe | 2–4 |

O fluxo funciona, mas a velocidade no balcão depende de o atendente manter
contexto entre várias superfícies: página, bottom sheet de item, resumo do
checkout, detalhe do pedido e sheet/modal de pagamento.

## Leitura por largura

| Largura | O que funciona | Fricção observada |
|---|---|---|
| 360 px | cards em coluna, ações alcançáveis e pagamento por itens com resumo visível | títulos, contadores, abas e filtros disputam altura; tab de status corta horizontalmente; sheets longos deixam a ação distante |
| 390 px | melhora a leitura de valores e a grade de formas de pagamento | não resolve a profundidade de navegação nem o teclado cobrindo campos no terço inferior |
| 768 px | detalhe passa a modal e há mais área para listas | transição de bottom sheet para modal muda o modelo de interação; duplicação de detalhe mobile/desktop aumenta risco de divergência |
| desktop | kanban e pesquisa dão boa visão geral | acompanhamento do detalhe e pagamento ainda exige foco em modal; densidade de colunas deve preservar contraste e ordem de leitura |

## Problemas de usabilidade

### Hierarquia, leitura e toque

- No quadro em mobile, cabeçalho, métricas, busca e abas consomem a primeira
  dobra antes da fila; a prioridade operacional deveria ser “qual pedido exige
  ação agora”.
- Abas por status têm rolagem horizontal pouco explícita em 360 px. A aba ativa
  é perceptível, mas há pouca pista de conteúdo fora da tela.
- Cards e valores são legíveis, porém status, horário, cliente e ações rápidas
  competem visualmente em cartões compactos.
- O resumo do pagamento por itens é útil, mas quatro métricas em pouco espaço
  ficam densas; a diferença entre selecionado, pendente e total deve continuar
  inequívoca sob pressão.
- Botões principais respeitam em geral altura confortável, mas chips, abas e
  controles incrementais precisam de auditoria de alvo mínimo de 44 × 44 px.

### Uso rápido no balcão

- Pagamento por itens exige uma mudança de etapa adicional antes de mostrar
  métodos. Isso reduz erros, mas aumenta toques para o cenário recorrente.
- Não há um resumo persistente do pedido quando se percorre uma lista longa de
  itens; o atendente pode perder o valor que falta cobrar.
- Abrir o detalhe esconde o contexto do quadro. Para operação contínua, falta
  uma indicação compacta de atualização recebida enquanto o detalhe está aberto.
- A busca e os filtros do quadro não têm prioridade adaptativa: em celular,
  todos os controles aparecem antes da tarefa principal.

### Teclado, sheets, modais e ações fixas

- `BottomSheet` e `Sheet` bloqueiam o scroll de fundo e deixam margem para a
  navegação móvel; isso evita clique acidental no quadro, mas reduz a área útil
  em telas baixas.
- O checkout é um sheet de três etapas e pode ultrapassar a altura quando
  endereço, desconto ou campos de pagamento são abertos. Ações de avançar e
  confirmar devem permanecer acessíveis acima do teclado e da safe area.
- Não há evidência de `dvh`, rolagem do campo ativo para a vista ou estratégia
  de restauração de foco. Em Android/iOS, o teclado pode ocultar telefone,
  observações, troco ou o CTA.
- Em desktop, `OrderDetailsModal` e em mobile `OrderDetailsSheet` mantêm
  interfaces paralelas. A diferença de superfície é apropriada, mas o conteúdo
  duplicado dificulta garantir os mesmos atalhos e estados.

## Estados e resiliência

| Estado | Situação atual | Risco/próxima melhoria |
|---|---|---|
| carregamento | menu e pedidos têm estado de carregamento | usar skeleton que preserve a geometria dos cards e evite salto visual |
| vazio | quadro pode não ter pedidos e consulta pode não encontrar cliente | orientar próxima ação sem confundir “sem pedido” com falha de filtro |
| sucesso | checkout tem confirmação e consulta preenche nome | feedback deve manter número/total como confirmação rápida |
| erro | mensagens existem para consulta e submissão | consulta de perfil não tem timeout: indisponibilidade pode ficar em “procurando” |
| atualização automática | polling, Realtime e visibilidade atualizam o quadro | manter detalhe congelado foi validado; sinalizar atualização pendente sem forçar troca de contexto |

## Riscos de perda de dados ou reinicialização

1. Fechar acidentalmente a personalização ou checkout pode descartar
   observações, adicionais, endereço e desconto; não há confirmação de descarte
   baseada em rascunho sujo.
2. O pagamento por itens dependia da identidade de `order.items`; o PR #156
   protege a atualização automática, mas uma futura refatoração que sincronize
   o pedido aberto sem intenção pode reintroduzir o reset.
3. Chamadas lentas de consulta não têm cancelamento/timeout visível. Trocar o
   telefone durante uma resposta tardia deve continuar protegido por identidade
   da requisição.
4. Dados de nomes recentes ficam em `localStorage`; em balcão compartilhado,
   a política de retenção precisa ser deliberada.

## Melhorias recomendadas

### P0 — resiliência e prevenção de erro operacional

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Timeout, cancelamento e retentativa da consulta de cliente | Implementado no PR #157 com abort em 8 s; após prazo definido, “procurando” vira erro acionável; **Tentar novamente** reexecuta somente o telefone atual; resposta antiga não sobrescreve edição recente | `OrderSummarySheet.tsx`, `pdv-api.ts`, testes de consulta |
| Ação do checkout acima do teclado/safe area | em 360/390 com teclado aberto, campo ativo e CTA continuam visíveis; nenhuma submissão ocorre por toque encoberto | `BottomSheet.tsx`, `OrderSummarySheet.tsx`, tokens CSS |
| Proteção de rascunho sujo | fechar checkout/personalização com alteração exibe confirmação; cancelar preserva o formulário e confirmar descarta apenas o rascunho correto | `novo-pedido/page.tsx`, `BottomSheet.tsx`, store do carrinho |
| Regressão de estado no pagamento por itens | testes de componente cobrem polling/Realtime com item, total, etapa e método selecionados; ações explícitas continuam sincronizando | `PayItemsModal.tsx`, `order-refresh.ts`, testes |

### P1 — velocidade e clareza de balcão

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Cabeçalho do quadro priorizado | em 360 px há pelo menos um card acionável na primeira dobra; filtros secundários podem recolher sem perder busca | `pedidos/page.tsx`, `OrderTab`, `QuickMetric` |
| Resumo persistente de pagamento por itens | selecionado, restante e método atual ficam visíveis ao rolar; CTA informa valor e quantidade | `PayItemsModal.tsx`, `Sheet.tsx` |
| Indicador de atualização não intrusivo | Realtime/polling atualiza lista sem resetar detalhe e avisa discretamente quando houver mudança relacionada | `pedidos/page.tsx`, `order-refresh.ts` |
| Identificação de cliente no mesmo bloco | telefone, estado, nome e retentativa têm ordem visual estável e mensagem curta | `OrderSummarySheet.tsx`, utilitários de telefone |

### P2 — consistência e refinamento

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Unificar detalhe responsivo | uma fonte de conteúdo/ações alimenta sheet e modal, com paridade de atalhos e estados | `OrderDetailsSheet.tsx`, `OrderDetailsModal.tsx`, componente compartilhado |
| Pistas de overflow e alvo de toque | tabs horizontais indicam continuação; todos os controles operacionais atingem 44 × 44 px | `pedidos/page.tsx`, componentes UI |
| Modo de concentração | reduzir métricas secundárias durante atendimento sem eliminar acesso | layout de `pedidos/page.tsx`, preferências locais |

## Implementação incremental proposta

1. Criar testes de regressão para timeout/abort de consulta e rascunho sujo,
   sem alterar layout.
2. Corrigir P0 de consulta e safe area em feature flag interna; validar em
   aparelho físico 360/390 e com rede lenta.
3. Reorganizar o topo do quadro e o resumo persistente de pagamento (P1),
   medindo toques e tempo de tarefa com atendentes.
4. Extrair conteúdo comum de detalhe e normalizar os componentes de superfície
   (P2), mantendo contratos e regras atuais.
5. Liberar por tela e acompanhar erros de pagamento, abandono de checkout e
   tempo até confirmar pedido. Cada passo precisa de rollback somente de
   frontend.

## Riscos técnicos e guardrails

- Não alterar schema, cálculo, taxas, status, regras de impressão ou integração
  de pagamento para executar este estudo.
- Preservar `getSelectedOrderSyncCandidate`: atualização automática nunca
  deve rehidratar indiscriminadamente o detalhe.
- Usar `AbortController`/identificador de requisição na consulta de perfil e
  cobrir respostas fora de ordem.
- Não persistir telefone ou dados do checkout além da política atual sem revisão
  de privacidade.
- Validar em Supabase local com contas sintéticas e, antes de produção, em
  preview com uma conta de homologação isolada.

## Evidências funcionais do walkthrough

- Em 360 px, foi aberto um pedido sintético com dois itens, marcado um item de
  R$ 23,00 e escolhido Crédito. Após mais de 15 s e uma mudança Realtime em
  outro pedido, permaneceram item, valor, etapa e método.
- Na consulta do checkout, `55999987654` foi formatado como
  `(55) 99998-7654` e encontrou o cliente; `6199997777` mostrou cliente
  novo.
- A pausa controlada da Edge Function local revelou a ausência de timeout,
  corrigida no PR #157: após 8 s a interface exibiu erro e **Tentar novamente**;
  ao reativar a função, a retentativa retornou “Cliente novo”. Não foi criado
  pedido nem pagamento durante a validação.

![Consulta de cliente com timeout e retentativa em 360 px](evidence/p0-consulta-timeout-360.png)
