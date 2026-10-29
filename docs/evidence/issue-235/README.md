# Evidências locais — issue #235 (etapa “Seus dados”)

Capturas de 29/10/2026. `antes-*` = `origin/main` `2fe6c2c` (após PR #234);
`depois-*` = esta branch. Fixtures totalmente sintéticas; o navegador intercepta o
Supabase fictício (`127.0.0.1:9`) e aborta qualquer outro destino. Nenhum pedido,
pagamento, impressão ou mensagem foi criado. Fonte substituída localmente (mock do
README da [#221](../issue-221/README.md)); o indicador do Next em modo dev aparece
nas imagens e não faz parte do produto.

Escopo: só a reorganização dos campos do cliente pedida na #235 (Fase 2, item 1–5) e
acessibilidade dos campos. **O redesign visual amplo da vitrine/checkout (Fases 0, 1
e 3) não foi implementado**: depende da aprovação da proposta visual exigida pela
issue. Não comprova a versão publicada nem a fonte web real.

| Captura | Antes | Depois |
| --- | --- | --- |
| VIAGEM, 390 px | [antes](antes-dados-viagem-390.png) | [depois](depois-dados-viagem-390.png) |
| ENTREGA após lookup, 390 px (página inteira) | [antes](antes-dados-entrega-390.png) | [depois](depois-dados-entrega-390.png) |
| Endereço, 390 px (viewport) | [antes](antes-endereco-390.png) | [depois](depois-endereco-390.png) |
| ENTREGA, 1440 px | [antes](antes-dados-entrega-1440.png) | [depois](depois-dados-entrega-1440.png) |

Na página inteira, a barra fixa do rodapé aparece sobre o endereço; a captura de
viewport mostra o endereço sem essa sobreposição.

Fase 0 (auditoria, diagnóstico e protótipo para aprovação): [relatório](../../archive/studies/proposta-pedir-issue-235.md) e capturas em [`fase0/`](fase0/).

## Matriz de QA (360, 390, 430, 768 e 1440 px)

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Nome antes do WhatsApp | PASS (antes: WhatsApp primeiro) | `*-qa-dados.json` → `fieldOrder` |
| Lookup pelo WhatsApp não sobrescreve nome digitado | PASS antes e depois | `nameAfterLookup` |
| Nome salvo oferecido como sugestão, “Não é você?” presente | PASS | `suggestionVisible`, capturas |
| `autocomplete` `name`/`tel`/`email`/`postal-code` | PASS (antes: ausente) | `fieldOrder[].autocomplete` |
| Campos do endereço com nome acessível; “Número do imóvel” distinto do WhatsApp | PASS (antes: só placeholder “Número”) | `entregaOrder` |
| Sem overflow horizontal | PASS antes e depois | `bodyWidth` |
| Console/pageerror e requisições fora do fixture | PASS (vazio) | `problems` |
| Foco visível no campo | PASS (borda vermelha + anel) | `focusRing` |
| Teclado virtual aberto, leitor de tela real, LCP/INP/CLS | BLOCKED | Chromium headless não simula teclado virtual; sem medição |
| Pagamento, Pix/cartão, criação de pedido | SKIP | fora do escopo; nada no contrato mudou |

## Reprodução

Com o servidor de fixture descrito no README da #221 rodando na porta `APP_PORT`:

```bash
PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs APP_PORT=3221 \
  node docs/evidence/issue-235/qa-dados-cliente.mjs
AUDIT_PHASE=after PLAYWRIGHT_MODULE=… APP_PORT=3221 node docs/evidence/issue-235/qa-dados-cliente.mjs
```

`WIDTHS` e `KEEP` (larguras com captura; padrão `390,1440`) são opcionais. Só o
subconjunto acima é versionado.
