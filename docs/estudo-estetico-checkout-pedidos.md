# Estudo estético — checkout de pedidos

Data: 2026-09-01  
Escopo: checkout interno de `/app/novo-pedido`, em `OrderSummarySheet`, e sua relação com o carrinho flutuante e `BottomSheet`.

Este é um estudo, não uma alteração visual aprovada. A análise foi feita por leitura dos componentes e estados. O navegador integrado desta sessão não alcança o servidor local; portanto, não há capturas novas nem alegação de inspeção visual autenticada.

## Fluxo atual

1. O atendente adiciona produtos e abre o carrinho flutuante.
2. No sheet “Novo Pedido”, revisa os itens e avança para Cliente.
3. Informa WhatsApp, usa a consulta de perfil, escolhe balcão, viagem ou entrega e preenche endereço quando aplicável.
4. Escolhe pagamento, podendo informar troco, valor iFood, desconto ou divisão por pessoa, revisa o total e confirma.

O fluxo já preserva rascunho no retorno e durante atualizações automáticas. Uma mudança estética não deve alterar esses contratos.

## Diagnóstico por largura

| Largura | Leitura atual | Oportunidade |
|---|---|---|
| 360 px | Progresso, formulário e resumo ficam em uma coluna; os sete métodos em três colunas são densos. | Fixar total e CTA; reduzir competição entre bordas, microtextos e opções raras. |
| 390 px | Há mais respiro, mas o total ainda aparece após blocos condicionais longos. | Criar uma faixa de total reconhecível e separar decisões essenciais de opções. |
| Tablet | O sheet mantém `max-w-md`, desperdiçando área lateral. | Criar duas zonas somente com largura suficiente, sem mudar a sequência de teclado. |
| Desktop | A ergonomia móvel é preservada, mas itens, total e pagamento não são vistos juntos. | Painel lateral de resumo com os mesmos dados e estados do mobile. |

## Problemas de hierarquia estética

- “Novo Pedido” e o indicador de etapa não mostram quantidade nem total; é preciso percorrer conteúdo para recuperar o contexto financeiro.
- Itens, entrega, cliente, desconto, pagamento e resumo possuem peso visual semelhante. Opções raras disputam atenção com o método e o CTA.
- A grade de métodos fica compacta e não torna o método ativo suficientemente dominante.
- O total é tipograficamente forte, mas aparece no fim da etapa de pagamento e pode sair da área visível após dinheiro, iFood, desconto ou divisão.
- O `BottomSheet` protege teclado, safe area e footer quando fornecido; o checkout deixa CTA dentro do conteúdo, então uma interação longa pode exigir rolagem adicional.

## Estados a preservar e comunicar

| Estado | Direção estética |
|---|---|
| Carregando | CTA conserva largura e mostra o contexto que está sendo confirmado. |
| Erro | aparece junto à decisão bloqueada, sem apagar valores preenchidos. |
| Vazio | carrinho orienta retorno ao cardápio, sem abrir sheet ambíguo. |
| Sucesso | número, total e próxima ação são o foco visual único. |
| Atualização automática | nunca reordena, fecha ou troca a etapa do checkout. |

## Proposta incremental para aprovação

### P0 — total e ação sempre visíveis

Criar footer fixo com quantidade, total estimado e CTA contextual. Em Cliente, avança; em Pagamento, confirma. O corpo rola independente e o footer usa os mecanismos já existentes de teclado e safe area.

**Aceite:** em 360/390 px, total e próxima ação ficam visíveis sem rolar; o teclado não cobre o CTA; voltar não apaga campos; dinheiro, iFood, desconto e divisão mantêm valores.

### P1 — hierarquia do pagamento

Separar método, valor recebido e opções avançadas com uma única área de ênfase por vez. Desconto e divisão ficam em seções secundárias expansíveis, sem ocultar o resumo.

**Aceite:** método ativo, total, troco/diferença e status pendente são identificados rapidamente; controles mantêm rótulo, foco de teclado e 44 px de toque.

### P2 — composição responsiva

Em tablet/desktop, apresentar itens e resumo em duas zonas, reutilizando componentes e estado do mobile. Não duplicar cálculo de taxa, desconto, entrega, cliente ou pagamento.

**Aceite:** a tabulação segue o fluxo móvel; 360/390 px continuam em uma coluna; cálculos e payload ao servidor são idênticos antes e depois.

## Arquivos prováveis e riscos

| Área | Arquivos |
|---|---|
| Etapas e visual do checkout | `src/components/checkout/OrderSummarySheet.tsx` |
| Teclado e safe area | `src/components/ui/BottomSheet.tsx` |
| Carrinho e gatilho | `src/app/app/novo-pedido/page.tsx` |
| Regras protegidas | `src/features/cart/useCart.ts`, `src/lib/utils/order-refresh.ts` |

- Não alterar payload de `pdvApi`, cálculo oficial do servidor, taxas, impressão, desconto, entrega ou pagamentos.
- Não persistir cliente, telefone ou método além da política atual.
- Extrair dados de total e CTA antes de trocar layout; cobrir cada modo de pagamento e validar em 360, 390, tablet e desktop.

## Evidências e pendências

O código confirma três etapas, métodos, opções condicionais e CTA no corpo do sheet. Screenshots autenticados e validação em 360/390 px continuam pendentes porque o navegador integrado não alcança o ambiente local. Antes de aprovar P0, validar em aparelho físico com teclado aberto, entrega, dinheiro, iFood, desconto e divisão por pessoa.
