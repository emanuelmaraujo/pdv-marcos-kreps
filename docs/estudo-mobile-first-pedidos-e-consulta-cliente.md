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
| erro | mensagens existem para consulta e submissão | consulta de perfil expira em 8 s e oferece retentativa; falta validar continuamente em aparelho físico/rede lenta |
| atualização automática | polling, Realtime e visibilidade atualizam o quadro | manter detalhe congelado foi validado; sinalizar atualização pendente sem forçar troca de contexto |

## Riscos de perda de dados ou reinicialização

1. A confirmação de descarte já protege personalização e checkout, mas ainda
   precisa de validação em aparelho físico com teclado aberto.
2. O pagamento por itens preserva o rascunho quando recebe uma nova versão do
   mesmo pedido; a regra está coberta por teste unitário e deve permanecer
   junto ao componente em futuras refatorações.
3. Chamadas lentas de consulta expiram em 8 s. Trocar o telefone durante uma
   resposta tardia continua exigindo proteção por identidade da requisição.
4. Dados de nomes recentes ficam em `localStorage`; em balcão compartilhado,
   a política de retenção precisa ser deliberada.

## Melhorias recomendadas

### P0 — resiliência e prevenção de erro operacional

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Timeout, cancelamento e retentativa da consulta de cliente | Implementado e homologado no PR #157 com abort em 8 s; após prazo definido, “procurando” vira erro acionável; **Tentar novamente** reexecuta somente o telefone atual; o timeout e a preservação do erro original têm teste unitário | `OrderSummarySheet.tsx`, `pdv-api.ts`, `abort-timeout.ts`, testes de consulta |
| Retorno sem falso descarte e identificação por sessão | Implementado; fechar checkout preserva o rascunho sem confirmação de descarte, e nome/WhatsApp não são reidratados em uma nova sessão | `OrderSummarySheet.tsx`, `useCart.ts`, `pedir/page.tsx` |
| Ação do checkout acima do teclado/safe area | em 360/390 com teclado aberto, campo ativo e CTA continuam visíveis; nenhuma submissão ocorre por toque encoberto | `BottomSheet.tsx`, `OrderSummarySheet.tsx`, tokens CSS |
| Proteção de rascunho sujo | fechar checkout/personalização com alteração exibe confirmação; cancelar preserva o formulário e confirmar descarta apenas o rascunho correto | `novo-pedido/page.tsx`, `BottomSheet.tsx`, store do carrinho |
| Regressão de estado no pagamento por itens | Implementado: teste unitário cobre a política de não reinicializar o mesmo pedido e o componente só limpa o rascunho ao trocar de pedido; a validação funcional de item, valor, etapa e método segue registrada no walkthrough | `PayItemsModal.tsx`, `payment-items-state.ts`, `order-refresh.ts`, testes |

### P1 — velocidade e clareza de balcão

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Cabeçalho do quadro priorizado | Implementado: em 360/390 px busca, atualização e abas ficam visíveis primeiro; o resumo operacional recolhe por padrão e abre sem ocultar filtros nem busca | `pedidos/page.tsx`, `OrderTab`, `QuickMetric` |
| Resumo persistente de pagamento por itens | Implementado: o cabeçalho fixo exibe selecionado, restante e, na etapa de método, a forma atual; os CTAs informam quantidade e valor do lote | `PayItemsModal.tsx`, `Sheet.tsx` |
| Indicador de atualização não intrusivo | Implementado: Realtime/polling atualiza a lista, preserva o detalhe e exibe um aviso breve somente se o quadro mudou enquanto há pedido aberto | `pedidos/page.tsx`, `order-refresh.ts`, `Toast.tsx` |
| Identificação de cliente no mesmo bloco | Implementado: WhatsApp, estado da consulta, retentativa, nome preenchido e opção de salvar ocupam uma única seção; a consulta antecede o nome e a retentativa tem alvo de 44 px | `OrderSummarySheet.tsx`, utilitários de telefone |

### P2 — consistência e refinamento

| Melhoria | Critérios de aceite | Arquivos/componentes prováveis |
|---|---|---|
| Unificar detalhe responsivo | Implementado o primeiro incremento: uma fonte de dados de apresentação e ações alimenta sheet e modal; os layouts continuam próprios para cada largura, preservando os atalhos existentes | `OrderDetailsSheet.tsx`, `OrderDetailsModal.tsx`, `order-details-shared.ts` |
| Pistas de overflow e alvo de toque | tabs horizontais indicam continuação; todos os controles operacionais atingem 44 × 44 px | `pedidos/page.tsx`, componentes UI |
| Modo de concentração | reduzir métricas secundárias durante atendimento sem eliminar acesso | layout de `pedidos/page.tsx`, preferências locais |

## Implementação incremental proposta

1. Criar testes de regressão adicionais para timeout/abort da consulta e
   descarte de rascunho, sem alterar layout.
2. Validar os P0 entregues em aparelho físico 360/390 e com rede lenta.
3. Reorganizar o topo do quadro e o resumo persistente de pagamento (P1),
   medindo toques e tempo de tarefa com atendentes.
4. Extrair conteúdo comum de detalhe e normalizar os componentes de superfície
   (P2), mantendo contratos e regras atuais. Primeiro incremento concluído:
   catálogo de pagamento, cálculos de detalhe e ações operacionais são comuns;
   qualquer consolidação visual posterior deve preservar as superfícies e ser
   validada separadamente.
5. Liberar por tela e acompanhar erros de pagamento, abandono de checkout e
   tempo até confirmar pedido. Cada passo precisa de rollback somente de
   frontend.

### Incremento P0 entregue após o estudo

O primeiro incremento foi limitado às superfícies de interação, sem redesenho
das telas nem mudança de regra operacional: `BottomSheet` e `Sheet` agora
respeitam safe area, teclado (via `visualViewport`) e ficam acima da navegação
fixa; o foco de um campo é trazido à área visível. A personalização de produto
e o checkout com rascunho alterado usam uma confirmação acessível antes de
fechar. Em 360 px, cancelar preservou o nome digitado e descartar manteve os
itens no carrinho.

O segundo incremento formalizou a política do pagamento por itens: uma nova
versão do mesmo pedido não limpa seu rascunho local; somente a troca de pedido
faz essa inicialização. Isso mantém o comportamento homologado para polling e
Realtime mesmo se a fonte do pedido mudar de referência numa refatoração futura.

O primeiro incremento P1 aproveita a estrutura já persistente do sheet de
pagamento por itens: durante a escolha do método, o cabeçalho informa lote,
valor e método; os CTAs também identificam quantidade e valor antes de avançar
ou registrar. Não houve mudança em cálculo, método selecionado ou chamada de
pagamento.

O segundo incremento P1 reduz a altura inicial do quadro em telas menores: o
resumo de métricas recolhe por padrão, enquanto busca, atualização e abas de
status seguem imediatamente disponíveis. Isso antecipa o primeiro card sem
remover filtros ou dados operacionais.

O terceiro incremento P1 torna a atualização automática observável sem tomar o
controle do atendente: ao detectar mudança material no quadro com um detalhe
aberto, a aplicação mostra um aviso breve e mantém o pedido aberto intacto.

O quarto incremento P1 organiza a identificação para o balcão: o WhatsApp vem
primeiro, seu estado (incluindo erro e retentativa) aparece imediatamente abaixo
e o nome fica no mesmo bloco, tornando visível o preenchimento automático sem
alterar a consulta, o telefone enviado ou a persistência do checkout.

Em 01/09/2026, a tentativa de repetir o walkthrough autenticado deste
incremento em 360/390 px confirmou a conexão do navegador integrado, mas ele
não pode alcançar `localhost` nem o IP local pela política de navegação. A
conta e os dois pedidos criados exclusivamente para esse teste foram removidos;
portanto, a homologação visual do cabeçalho e do aviso de atualização continua
pendente em navegador com acesso ao ambiente local ou aparelho físico.

![Confirmação de descarte do checkout em 360 px](evidence/p0-rascunho-mobile-360.png)

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
