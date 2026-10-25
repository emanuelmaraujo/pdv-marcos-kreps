# Cardápio e checkout público — diagnóstico e proposta da issue #221

Data: 25/10/2026. Base local: `a69253bc8af1938749671f4209b127ce07624413`,
branch `cez/51430302`; `origin/main` local aponta ao mesmo SHA. Não houve fetch,
merge, deploy, consulta de dados operacionais ou alteração de autenticação.
Fonte do escopo: [issue #221](https://github.com/emanuelmaraujo/pdv-marcos-kreps/issues/221).

## Estado desta entrega

Diagnóstico local e proposta para revisão, **não aprovação de redesign nem implementação
concluída de COD**. O usuário autorizou pagamentos e migrations locais após o bloqueio
inicial. Continuam proibidos serviços reais, dados reais, produção, merge e deploy.
A issue exige proposta antes de mudança visual ampla; esta entrega prepara essa decisão.
Foram implementadas apenas correções pontuais de custos, texto de modalidade e overflow, descritas abaixo.

O [protótipo navegável](../../evidence/issue-221/proposta.html) usa dados sintéticos,
sem chamadas de rede, sem criar pedidos e sem coletar pagamentos. É ilustrativo:
não representa preço, endereço, foto, horário ou capacidade de uma filial real.
Mantém a paleta bege/marrom/vermelho e propõe composição compacta; não substitui
os tokens CSS do aplicativo nem comprova a fonte de produção.

## Evidências de código e jornada atual

| Área | Evidência no checkout consultado | Implicação |
| --- | --- | --- |
| Entrada | `src/lib/constants/branches.ts`: `/pedir` usa `nb`; `/pedir/[slug]/page.tsx` reutiliza a página principal | Preservar QR e deep links; não reintroduzir seleção obrigatória de filial |
| Menu | `src/app/pedir/page.tsx`: hero, categorias, filtros por tags, cards, personalização e carrinho fixo | Evoluir componentes existentes; não reimplementar recursos já presentes |
| Preços | Prévia em `estimatedTotal`; servidor em `create-public-order` valida produtos, adicionais, cupom, filial e frete | Nenhum total do navegador pode autorizar cobrança |
| Embalagem | `create-public-order`: VIAGEM com flag ativa usa taxa da filial positiva, senão global; cobra por pedido | Não aplicar por engano `calculatePackagingEstimate`, que é do PDV interno e por item |
| Revisão | REVIEW detalha subtotal, embalagem e desconto, mas não tem linha de frete normal | Total pode incluir frete sem explicar sua composição nessa tela |
| Envio | INFO permite mudar modalidade depois de REVIEW; rodapé mostra total e apenas “com embalagem” | Última revisão não apresenta valor separado de embalagem/frete/desconto |
| Cadastro | `validateCustomerIdentity`: telefone obrigatório em ENTREGA, opcional nas outras modalidades; nome/e-mail opcionais | Preservar compra sem cadastro e não obrigar telefone em compras online que hoje o dispensam |
| Entrega | CEP consultado, bairro normalizado e zonas por filial; endereço salvo possui fluxo próprio | CEP/GPS não provam posse do contato nem identidade do destinatário |
| Carrinho | `src/features/cart/useCart.ts`: persistência 24h e vínculo de filial; checkout restaura sessão de pedido | Preservar rascunhos e isolamento de filial; não repetir correções anteriores |
| Upsell | `upsellSuggestions` deriva dos mais pedidos retornados pelo backend | Não foi constatado uso de popularidade inventada nesse bloco |
| Pagamento | Pedido é criado antes de escolher Pix/cartão na tela PAYMENT | Mudança de etapas exige preservar pedido existente e retries |
| Confirmação | `confirm-order` recusa AGUARDANDO_PAGAMENTO não pago | COD precisa de autorização operacional própria, sem fingir aprovação de pagamento |
| Baixa | `mark-payment` deriva pagamento dos itens e pode liberar fila/impressão | Não reutilizar baixa financeira para a simples aceitação de COD |
| Expiração | `expire-pending-public-orders` seleciona AGUARDANDO_PAGAMENTO/PENDING | COD não pode entrar inadvertidamente na expiração de Pix |

### Mapa atual

```mermaid
flowchart LR
  A[Link ou QR /pedir] --> B[MENU: escolher produto]
  B --> C[Personalizar e adicionar]
  C --> D[REVIEW: itens e cupom]
  D --> E[INFO: dados e modalidade]
  E --> F[Criar pedido no servidor]
  F --> G[PAYMENT: Pix ou cartão]
  G --> H[Pagamento aprovado pelo servidor]
  H --> I[PAID e acompanhamento]
```

Caminho usual sem cadastro: abrir produto → adicionar → abrir carrinho → continuar
→ continuar para pagamento → escolher meio. Contagem de campos obrigatórios varia
com modalidade, CEP e endereço salvo; não se atribui uma contagem universal.
O caminho expresso para cliente reconhecido precisa continuar permitindo editar dados.

## Priorização

### P0 — pré-condições para pagamento na entrega

1. **Risco de pedidos duplicados por concorrência, constatado por leitura; não
   reproduzido em banco nesta auditoria.** Em `create-public-order`, lookup da chave,
   RPC de criação e UPDATE de `public_idempotency_key` são operações separadas.
   O erro do UPDATE é não bloqueante. Dois requests podem criar duas linhas antes
   de disputar o índice único. A chave deve fazer parte da transação de criação,
   com comparação de payload e filial e resposta estável para retries. Testar
   concorrência em banco descartável antes de classificar como corrigido.
2. COD precisa separar momento esperado, método esperado e pagamento efetivo;
   nunca marcar PAID ou emitir aprovação online na aceitação da unidade.
3. Confirmação deve ser atômica e idempotente, com uma única liberação de produção
   e impressão. Verificar efeitos dos triggers/RPCs antes de qualquer alteração.
4. Faltam decisões operacionais da unidade para habilitação: meios aceitos,
   limite, troco, verificação de contato, prazo e responsável pela baixa.
   Padrão obrigatório da proposta: COD desativado em todas as filiais.

### P1 — transparência e recuperação

- Apresentar resumo discriminado no último passo antes do envio e na via expressa:
  itens/adicionais, desconto, embalagem, entrega, total e modalidade. Não tratar
  frete ainda não determinado como grátis; indicar “a calcular” até endereço válido.
- Preservar revalidação autoritativa, cupom, idempotência, carrinho, sessão de pedido
  e formulário diante de falhas. Não criar nova cobrança ao navegar para trás.
- Texto de WhatsApp no INFO diz que dados são opcionais mesmo em entrega; adaptar
  a explicação à modalidade mantendo a validação existente.
- Instrumentar funil somente com consentimento apropriado e allowlist de dimensões.
  Não transmitir texto livre, identificadores de clientes, endereço, CEP exato,
  token, URL completa, conteúdo de erros ou chaves de idempotência.

### P2 — composição comercial, condicionada à aprovação

- Compactar hero e identificar unidade/endereço com dados confiáveis; comida deve
  aparecer cedo. Nunca inventar prazo, avaliações, promoção, estoque ou fotografias.
- Preservar categorias/personalização; considerar busca textual se o catálogo justificar.
- Desktop: avaliar carrinho lateral; mobile: CTA acessível sem cobrir campos ou teclado.
- Não mudar todos os tokens, navegação ou SDK de pagamento para obter novo visual.

## Baseline e inventário

| Indicador | Resultado desta auditoria |
| --- | --- |
| Sessões, visitantes, fontes e UTMs | Não medido; sem acesso autorizado a analytics real |
| Produto visto → adição → checkout → pedido → pagamento | Não medido; não há integração de funil encontrada em `src/` ou manifest |
| Conversão e abandono por filial/dispositivo | Não medido; nenhuma taxa estimada ou inventada |
| Pedidos/dia e produto popular | Existe endpoint de estatística pública; valores reais não consultados; não equivale a analytics de visita |
| Cobertura, peso e qualidade das fotos reais | Não medido; catálogo operacional não consultado |
| Catálogo no checkout | Código suporta `image_url`, descrição, preço, tags e fallback; isso não prova que as fotos estejam cadastradas |
| LCP, INP, CLS reais | Não medido; dev local com fixtures não é medição de produção |

## Proposta antes/depois

Aprovação solicitada para a direção, não para habilitar COD ou executar operações remotas.

- **Antes:** hero alto → produtos → revisão → dados/modalidade → criar pedido → escolher pagamento.
- **Proposta incremental:** identificação compacta e modalidade cedo → produtos existentes
  → revisão/dados com resumo completo → envio idempotente → pagamento online existente.
  Validar agrupamento de REVIEW/INFO com usuários antes de remover etapas.
- Desktop: conteúdo e resumo em duas colunas; mobile: uma coluna e resumo junto ao CTA.
  Preços dos exemplos são fixtures e não propostas comerciais.
- Primeira implementação recomendada: transparência do resumo e correção transacional;
  evoluir vitrine e instrumentação em diffs independentes; COD após contratos e testes.

```mermaid
flowchart TD
  A[Filial e modalidade] --> B[Escolher e personalizar]
  B --> C[Revisar itens, custos e dados pertinentes]
  C --> D{Momento autorizado}
  D -->|Online| E[Pedido idempotente e pagamento existente]
  E --> F[Aprovação financeira verificada]
  D -->|Entrega com COD habilitado| G[Pedido pendente de confirmação e pagamento]
  G --> H[Equipe verifica contato, endereço e risco]
  H -->|Rejeitar ou expirar| I[Sem produção ou baixa]
  H -->|Confirmar uma vez| J[Produção, pagamento ainda pendente]
  J --> K[Despacho com orientação de cobrança]
  K --> L[Registro autorizado de recebimento efetivo]
  L --> M[Conciliação e status financeiro derivado]
```

## Contrato proposto para COD, ainda não implementado

- `payment_timing`: ONLINE por padrão, ON_DELIVERY somente para ENTREGA autorizada.
- `expected_payment_method`: CASH, DEBIT_CARD, CREDIT_CARD ou PIX; meio recebido
  continua seguindo o contrato financeiro existente, sem sobrecarregar enums atuais.
- Valor para troco em centavos, opcional apenas em dinheiro e nunca inferior ao total;
  isso registra intenção, não prova recebimento.
- Flag por filial inicialmente falsa; métodos presenciais e limite obrigatórios
  para habilitar. Ausência de configuração deve negar COD no servidor.
- Pedido COD recebido: AGUARDANDO_CONFIRMACAO e PENDING; confirmar mantém PENDING;
  entregue mantém PENDING até registro de recebimento. Não retornar “pagamento aprovado”.
- Reusar autorização existente sem modificar auth; filial e ação precisam ser
  autorizadas no servidor. Se a implementação exigir mudar auth/RBAC, pedir
  autorização específica antes dessa mudança.
- Registrar responsável, momento e transição, sem expor sinais antifraude no público.
  Telefone digitado não é verificação de posse; fallback humano quando necessário.
- Distinguir expiração operacional de COD de expiração de Pix. Não criar integração
  WhatsApp ou login de entregador sem decisão e autorização próprias.

## Plano de verificação e limitações

Fixtures devem cobrir matriz filial × modalidade × custos, erros e retries sem rede
externa. Banco descartável deve provar idempotência concorrente, confirmação única,
negação entre filiais e recebimento efetivo antes de liberar COD.

Não foram consultados sites reais de concorrentes nem Baymard: a restrição de serviços
reais foi mantida. Não se apresenta benchmark atualizado de iFood, McDonald's,
Domino's, Burger King ou Uber Eats como realizado. Comparação e pesquisa de referência
continuam pendentes, assim como teste com usuários e inventário de mídia real.

A matriz completa de Fase 0 inclui aberto/fechado, filiais, CEP, cupom, recusa de cartão,
conexão lenta, teclado e acompanhamento. Capturas de fixtures cobrem apenas os estados
explicitamente relacionados nas evidências locais; não comprovam gateway, impressão,
WhatsApp, autenticação ou ambiente publicado.


## Correções pontuais implementadas localmente

- `CheckoutSummary.tsx`: resumo compartilhado em REVIEW e INFO; linhas explícitas
  de itens/adicionais, embalagem, entrega e cupom; total parcial enquanto o endereço
  não está validado. Não altera a criação do pedido, precificação ou cobrança.
- `page.tsx`: usa o resumo nas duas telas e ajusta o texto de WhatsApp conforme
  a modalidade. Telefone continua obrigatório apenas para entrega.
- `ProgressSteps.tsx`: permite encolhimento dos itens; em mobile mantém o nome da
  etapa atual e as demais etapas acessíveis aos leitores de tela. Marca a atual
  com `aria-current="step"`.
- O repro anterior registrou documento com 496 px nos viewports 360, 390 e 430;
  os de 768/1280/1440 já cabiam. O mesmo repro verifica a correção localmente.

Essas correções não constituem redesign amplo nem conclusão da issue.
Idempotência transacional, COD, instrumentação e alterações de vitrine permanecem
pendentes. Nenhuma migration ou Edge Function foi alterada nesta entrega.

### Verificações

- PASS: 74 testes existentes de pagamento, acompanhamento, identidade, entrega
  e embalagem (cinco arquivos), executados antes das correções.
- PASS: sete testes novos do resumo, cobrindo VIAGEM com/sem taxa, frete e desconto,
  endereço pendente, região bloqueada e frete grátis por cupom.
- PASS: 81 testes da área no diff com as correções (seis arquivos).
- PASS: typecheck, lint focado e verificação de links da documentação.
- PASS: repro de navegador nas seis larguras; documento cabe no viewport e resumo final discrimina embalagem.
- Comparativos do aplicativo: [antes](../../evidence/issue-221/antes-dados-viagem-360.png),
  [depois](../../evidence/issue-221/depois-dados-viagem-360.png) e
  [resumo final visível](../../evidence/issue-221/depois-resumo-final-360.png).
- [Roteiro reproduzível e limites](../../evidence/issue-221/README.md).

As capturas existentes cobrem MENU, produto, REVIEW e INFO/VIAGEM nas seis larguras;
não cobrem a matriz completa de estados da issue. CEP, cupons e falhas de pagamento
possuem testes de partes do fluxo, mas não foram demonstrados visualmente nesta auditoria.
Teclado físico/virtual, pagamento, acompanhamento completo, banco, impressão e
serviços reais não foram validados. Build de produção e teste com usuários não executados.

Comandos efetivamente executados para as correções:

```bash
npm test -- src/app/pedir/_components src/lib/utils/packaging-fee.test.ts src/lib/utils/delivery.test.ts src/lib/utils/customer-identity.test.ts
npm run typecheck
npx eslint src/app/pedir/page.tsx src/app/pedir/_components/ProgressSteps.tsx src/app/pedir/_components/CheckoutSummary.tsx src/app/pedir/_components/CheckoutSummary.test.tsx docs/evidence/issue-221/*.mjs
npm run docs:check
git diff --check
```

O teste direcionado passou com **81 testes em seis arquivos**. Lint focado não
emitiu erros ou avisos. O verificador de documentação analisou 40 arquivos Markdown
sem links locais quebrados. A primeira instalação omitiu dependências de desenvolvimento;
foi repetida com `npm ci --include=dev --ignore-scripts`, sem alterar lockfile.
Uma tentativa de lint foi interrompida (exit 143), e a execução completa seguinte
passou. Capturas interrompidas durante recompilação foram refeitas com servidor
estável; não contam como validação aprovada.

O roteiro de navegador foi executado com `PLAYWRIGHT_MODULE` apontando ao
`index.mjs` do Playwright disponível no ambiente; `AUDIT_PHASE=after` verifica
largura e presença da embalagem no último resumo. O roteiro original CommonJS
foi convertido para ESM para respeitar o lint; a execução ESM validou as correções.

| Viewport | Largura do documento antes | Depois |
| --- | --- | --- |
| 360 | 496 | 360 |
| 390 | 496 | 390 |
| 430 | 496 | 430 |
| 768 | 768 | 768 |
| 1280 | 1280 | 1280 |
| 1440 | 1440 | 1440 |

Os dados brutos estão nos arquivos `antes-auditoria-local.json` e
`depois-auditoria-local.json` junto às capturas; o critério anterior falhou
explicitamente com “Checkout ultrapassa largura do viewport” antes da correção.
