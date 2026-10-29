# Evidências locais — redesign aprovado da #235

Capturas de 29/10/2026, branch `cez/26179825`. `antes` = captura do código anterior
ao redesign, em [`../fase0/atual-*`](../fase0/); `depois` = esta pasta. Catálogo
sintético; o navegador intercepta o Supabase fictício (`127.0.0.1:9`), inclusive
`create-public-order` e `create-mercado-pago-payment`, que respondem com fixtures, e
aborta qualquer outro destino. Nenhum pedido, pagamento, impressão ou mensagem real
foi criado. Fonte substituída localmente; o indicador do Next em modo dev aparece
nas imagens e não faz parte do produto. Não comprova a versão publicada.

Decisões aprovadas pelo operador (relatório da [Fase 0](../../../archive/studies/proposta-pedir-issue-235.md)):
direção visual do protótipo, remoção imediata de “Cancelamento fácil”, ilustrações
substituindo todas as artes de bebidas, “+” adicionando direto e hub de filiais
mantido como está.

| Tela | Antes | Depois |
| --- | --- | --- |
| Cardápio, 1ª dobra 390 | [antes](../fase0/atual-menu-dobra-390.png) | [depois](depois-menu-dobra-390.png) |
| Cardápio 390 | [antes](../fase0/atual-menu-390.png) | [depois](depois-menu-390.png) |
| Cardápio 1440 | [antes](../fase0/atual-menu-1440.png) | [depois](depois-menu-1440.png) |
| Personalização 390 | [antes](../fase0/atual-produto-390.png) | [depois](depois-produto-390.png) |
| Sacola 390 / 1440 | [antes](../fase0/atual-revisao-390.png) | [390](depois-sacola-390.png) · [1440](depois-sacola-1440.png) |
| Editar item 390 | — | [depois](depois-editar-item-390.png) |
| Dados (entrega) 390 / 1440 | [antes 390](../fase0/atual-dados-390.png) · [antes 1440](../fase0/atual-dados-1440.png) | [390](depois-dados-entrega-390.png) · [1440](depois-dados-entrega-1440.png) |
| Pagamento 390 / 1440 | não capturado antes | [390](depois-pagamento-390.png) · [1440](depois-pagamento-1440.png) |
| Confirmação 390 / 1440 | não capturado antes | [390](depois-confirmacao-390.png) · [1440](depois-confirmacao-1440.png) |

Em página inteira, barras fixas e avisos (toast) aparecem sobre o conteúdo; isso é
efeito da captura, não sobreposição no uso real.

## Matriz de QA (`qa-redesign.mjs`, 360/390/430/768/1440 px)

| Critério | Resultado | Evidência |
| --- | --- | --- |
| 1º produto na 1ª dobra | PASS: topo a 308 px (antes 679 px em 390) | `checks.firstProductTop` |
| “+” adiciona direto e soma no mesmo item | PASS | rótulo “(1 na sacola)” |
| “+” com adicional obrigatório abre a personalização | PASS | `checks.requiredOpensSheet` |
| Todos os adicionais visíveis, sem limite (Bacon ×3) | PASS | `checks.baconQty = 3` |
| Editar item da sacola (reabre folha, “Salvar”) e ajustar quantidade | PASS | `checks.bagAfterEdit` |
| Modalidade como resumo com “Alterar” nos dados | PASS | fluxo troca para Entrega |
| Nome → WhatsApp, CEP, nº do imóvel | PASS | capturas de dados |
| Pagamento sem “Cancelamento fácil” | PASS | `checks.paymentHasSeal = false` |
| Confirmação com nome (“Obrigado, Ana!”) e nº do pedido secundário | PASS | `checks.thanks` |
| Contrato do envio inalterado (nome, modalidade, itens) | PASS | `checks.createdOrder` |
| Sem overflow horizontal em nenhuma tela | PASS | `overflow` |
| Sem erro de página e sem requisição fora do fixture | PASS | `errors`, `blocked` |
| Teclado virtual real, leitor de tela real, LCP/INP/CLS | BLOCKED | headless; sem medição |
| Cartão (Mercado Pago Brick), Pix pendente/expirado, COD | SKIP | SDK externo bloqueado; fluxos sem mudança de lógica |

Durante o QA apareceu um defeito real: fechar a folha do produto e logo tocar em
“Ver sacola” ou “Salvar” podia devolver o checkout ao cardápio (corrida entre
`history.back()` e `pushState`). Corrigido em `page.tsx` (back pendente bloqueia
novos `pushState`; efeito do checkout declarado antes do efeito da folha). Depois da
correção, 6 rodadas completas passaram. Rodar o roteiro gravando capturas **dentro**
do repositório faz o `next dev` recompilar no meio da jornada e pode falhar por isso;
use `OUT_DIR` fora do repositório e copie as imagens depois.

## Reprodução

Servidor de fixture como no README da [#221](../../issue-221/README.md), depois:

```bash
PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs APP_PORT=3221 OUT_DIR=/tmp/qa-235 \
  node docs/evidence/issue-235/redesign/qa-redesign.mjs
```

`WIDTHS`, `KEEP` (larguras com captura; padrão `390,1440`) e `TRACE_HISTORY=1`
(registra `pushState`/`back`/`popstate` na falha) são opcionais.
