# Validação local do estudo #229

Data: 2026-10-27. Escopo: HTML estático com fixtures, sem backend/autenticação.
Não houve deploy, migração, cobrança, impressão, consulta a dados reais ou acesso
a Supabase. As capturas são do protótipo, não do aplicativo autenticado.

## Navegador

Roteiro reproduzível: [validar-prototipo.mjs](validar-prototipo.mjs). Executar da
raiz com Node e Playwright já disponível no ambiente (nenhuma dependência foi
adicionada ao projeto):

```bash
TMPDIR=/tmp PDV_QA_PLAYWRIGHT=/caminho/para/playwright-core PDV_QA_CHROMIUM=/caminho/para/chrome node docs/archive/studies/pedidos-229/validar-prototipo.mjs
```

O script importa `playwright-core` padrão se PDV_QA_PLAYWRIGHT não for definido;
o executável pode usar o padrão instalado pelo Playwright. Os caminhos absolutos
usados nesta sessão pertencem à instalação de ferramentas local, não ao produto.

PASS: confirmação manual sem avanço de produção; três itens continuam no cartão
após preparo e entrega; quantity=3 com 1/3 repassados; seleção de duas unidades e
entrega somente dos prontos; falha de impressão preservada na recuperação manual;
PENDING → PROCESSING não vira impresso; delivery sem entrega direta; viagem paga
com aviso EMBALAR e elegibilidade; offline bloqueia ações; acréscimo em lote novo;
viagem todos/nenhum/individual; nome preservado ao alternar telas; parcelas 30+40+20
com saldo zero; parcela 30 mantém saldo 60; rejeição de parcela acima do saldo;
divisão de R$ 89,99 em 30+30+29,99. Sem erros JS ou requisições HTTP do documento.

Layout: 360×800, 390×844, 768×1024 e 1440×1000, claro e escuro; três telas em cada
combinação (24 capturas). PASS: nenhuma largura excedeu viewport; botões visíveis
com altura mínima 44 px. Inspeção visual levou a aumentar a largura mínima das
ações para evitar palavras quebradas no celular. Nova execução após o ajuste.

Exemplos de capturas (arquivos em docs/evidence/pedidos-229):

| Largura | Antes esquemático | Quadro proposto | Checkout proposto |
| --- | --- | --- | --- |
| 360 | [Antes](../../../evidence/pedidos-229/antes-360-light.png) | [Quadro](../../../evidence/pedidos-229/quadro-360-light.png) | [Checkout](../../../evidence/pedidos-229/checkout-360-light.png) |
| 390 | [Antes](../../../evidence/pedidos-229/antes-390-light.png) | [Quadro](../../../evidence/pedidos-229/quadro-390-light.png) | [Checkout](../../../evidence/pedidos-229/checkout-390-light.png) |
| 768 | [Antes](../../../evidence/pedidos-229/antes-768-light.png) | [Quadro](../../../evidence/pedidos-229/quadro-768-light.png) | [Checkout](../../../evidence/pedidos-229/checkout-768-light.png) |
| 1440 | [Antes](../../../evidence/pedidos-229/antes-1440-light.png) | [Quadro](../../../evidence/pedidos-229/quadro-1440-light.png) | [Checkout](../../../evidence/pedidos-229/checkout-1440-light.png) |
| 390 escuro | [Antes](../../../evidence/pedidos-229/antes-390-dark.png) | [Quadro](../../../evidence/pedidos-229/quadro-390-dark.png) | [Checkout](../../../evidence/pedidos-229/checkout-390-dark.png) |

A viewport reduzida 390×420 permite rolar até confirmar com campo em foco, mas
**não comprova teclado virtual real/safe area de dispositivo físico**. Não houve
validação com operador, leitor de tela ou auditoria completa de contraste. CSS
inclui foco visível, estados com texto, redução de movimento e forced-colors.
Navegação por teclado e contraste exigem QA assistivo posterior.

Primeira tentativa de Chromium: falhou por caminho temporário longo
(`Socket path too long`). Resolvido somente com TMPDIR=/tmp; sem mudar permissões.

## Verificações do repositório

Resultados finais: Testes locais não comprovam
concorrência real, RLS, impressão física ou contabilidade. O script do protótipo
valida demonstração em memória; não substitui os testes exigidos para implementar
os contratos propostos no estudo.

- `npm ci --ignore-scripts --no-audit --no-fund`: concluiu; NODE_ENV=production
  omitiu dependências dev. Tentativas de teste antes da instalação dev terminaram
  com exit 127 (`vitest: not found`), não com falha de comportamento.
- `npm ci --include=dev --ignore-scripts --no-audit --no-fund`: concluiu com exit 0;
  sem alteração de manifest ou lockfile.
- `npm test -- src/app/app/pedidos/components/OrderCard.test.tsx src/lib/utils/order-board-sync.test.ts src/lib/utils/order-refresh.test.ts src/lib/utils/payment-items-state.test.ts src/lib/utils/packaging-fee.test.ts src/lib/utils/customer-identity.test.ts`:
  **PASS, exit 0, 6 arquivos / 49 testes**.
- `npm run docs:check`: **PASS**, 42 Markdown, sem links locais quebrados.
- `git diff --check`: **PASS**.
- Roteiro Playwright com os caminhos locais de Chromium/playwright-core e
  TMPDIR=/tmp: **PASS, exit 0**, incluindo confirmação por Enter e layout
  forced-colors sem overflow. A navegação assistiva completa segue pendente.

Não executados: suíte completa `npm test`, typecheck/build web, build/checks do
print-worker, testes SQL/E2E autenticados ou serviços reais. As únicas mudanças são
documentação, HTML de estudo e roteiro de QA local; a suíte completa e a revisão
independente ficam para os passos seguintes do workflow. Graphify não executado:
não há alteração de código da aplicação nem artefato graphify-out/graph.json neste
checkout.

Lint inicial: 3 erros de import CommonJS no roteiro de QA. Convertido para módulos ES; sem alterar configuração ou relaxar regras.

- `npm run lint`: **PASS, exit 0**, após conversão do roteiro para módulos ES.
- `node --check docs/archive/studies/pedidos-229/validar-prototipo.mjs`: **PASS**.

Capturas completas registradas com rolagem ao fim da tela para que o rodapé sticky apareça em sua posição final. O antes é esquemático; as comparações não equivalem a reprodução do app autenticado.
