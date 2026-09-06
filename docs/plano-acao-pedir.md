# Plano de Ação de Correção — Fluxo Público `/pedir`

Este documento consolida os problemas encontrados na auditoria do fluxo público de pedidos (`src/app/pedir/**`) e o plano de correção. O foco é o caminho que o cliente final percorre: cardápio → carrinho → dados → pagamento → confirmação.

## Status de implementação

_Atualizado em 2026-09-05. Auditoria e correções na branch `analise/pedir-review`. Todas as fases implementadas e validadas em dev; **nada foi mergeado nem deployado ainda**._

| Fase | Item | Status | Commit |
|---|---|---|---|
| F0 | Rede de segurança (helpers puros + testes vitest) | ✅ Implementado | `bc249f4` |
| F1.0 | Telefone com DDD 55 rejeitado (`P13`) | ✅ Implementado | `3fa8f0f` |
| F1.1 | Revalidação de horário sem filial (`P2`) | ✅ Implementado | `3fa8f0f` |
| F1.2 | Copy "em esta unidade" (`P5`) | ✅ Implementado | `3fa8f0f` |
| F1.3 | Tabs de categoria vazia são mortas (`P6`) | ✅ Implementado | `3fa8f0f` |
| F1.4 | Vazamento do Brick do Mercado Pago (`P7`) | ✅ Implementado | `3fa8f0f` |
| F2 | Cartão recusado sem feedback (`P3`) | ✅ Implementado | `53117a8` |
| F3 | Filial inexistente → cardápio fantasma (`P1`) | ✅ Implementado | `13a1d18` |
| F4 | Modalidade ENTREGA órfã (`P4`) | ✅ Implementado | `055c138` |
| F5 | Higiene (`P8`–`P12`) | ✅ Implementado | `d770d49` |

**Baseline no fim das fases:** `npx tsc --noEmit` limpo · `npx eslint src/app/pedir src/lib` limpo · `npm test` 127 testes em 15 arquivos (eram 116 em 14 antes da F4; 8 arquivos antes da F0).

**O que falta antes de considerar isto entregue:**
- Abrir o PR e mergear (nenhuma fase foi para produção).
- **Deploy da Edge Function `get-public-checkout-config` ANTES do frontend** — é a única mudança de backend, e é retrocompatível (campo aditivo). Depois do merge: `gh run list --workflow=deploy-functions.yml --limit 1`.
- **F2 precisa de teste com cartão de sandbox do Mercado Pago** — a lógica está coberta por teste unitário, mas o comportamento do Brick após `reject()` (formulário reaberto para nova tentativa) não dá para exercitar em localhost, porque as Edge Functions restringem origem e o checkout não roda aqui. É o único item da lista sem validação ponta a ponta.
- Reavaliar `PIX_WAIT_MINUTES` e o restante do fluxo de Pix, que não foi auditado a fundo.

**Notas de validação (o que foi realmente exercitado em dev):**
- `P13`: número com DDD 55 digitado na tela de dados é aceito e formatado como `(55) 99999-8888`; antes `normalizeBrazilPhone` devolvia `null` e o checkout recusava. Comparação lado a lado das duas implementações registrada no commit.
- `P1`: `/pedir/slug-que-nao-existe` mostra "Unidade não encontrada" e o botão leva a `/pedir/filiais`; `/pedir` e `/pedir/nb` seguem normais e `pdv-last-branch-slug` não guarda o slug inválido. Validado pelo caminho de fallback do `pdv-api` (Edge Function bloqueada por CORS em localhost), que é o mais difícil de acertar.
- `P4`: numa filial que entrega, escolher Entrega continua funcionando e o formulário de endereço aparece — este era o risco de regressão da fase. A correção em si (filial que não entrega força "Para levar") está coberta pelos 11 testes de `delivery.test.ts`; a simulação equivalente no browser não se mostrou confiável e foi trocada pelo teste, que é prova mais forte e permanente.
- Fluxo completo cardápio → item → carrinho → dados percorrido depois da F5, sem erro novo no console (só os de CORS das Edge Functions, que são pré-existentes em localhost).

---

## Inventário de problemas

Severidade: **P0** = perde pedido ou dinheiro · **P1** = quebra o fluxo do cliente · **P2** = confunde/atrapalha · **P3** = higiene.

| ID | Sev. | Problema | Onde |
|---|---|---|---|
| P13 | P0 | Cópia local desatualizada de `normalizeBrazilPhone` rejeitava celular com **DDD 55** (RS) — cliente não conseguia informar WhatsApp nem pedir entrega | [page.tsx](../src/app/pedir/page.tsx) vs [utils/phone.ts](../src/lib/utils/phone.ts) |
| P1 | P0 | Slug de filial inexistente renderiza cardápio de **todas** as filiais misturadas; pedido só é recusado no fim | [page.tsx:400](../src/app/pedir/page.tsx#L400), [page.tsx:419](../src/app/pedir/page.tsx#L419), [get-public-checkout-config/index.ts:111](../supabase/functions/get-public-checkout-config/index.ts#L111) |
| P2 | P0 | Revalidação de horário no clique de "Continuar para pagamento" ignora a filial | [page.tsx:1084](../src/app/pedir/page.tsx#L1084) |
| P3 | P0 | Cartão recusado pelo Mercado Pago não mostra mensagem nenhuma | [MercadoPagoBrick.tsx:69-77](../src/app/pedir/_components/MercadoPagoBrick.tsx#L69) |
| P4 | P1 | `orderType` persistido = `ENTREGA` numa filial sem entrega deixa o cliente num formulário que o servidor recusa | [page.tsx:2031](../src/app/pedir/page.tsx#L2031), [page.tsx:2054](../src/app/pedir/page.tsx#L2054), [page.tsx:550](../src/app/pedir/page.tsx#L550) |
| P5 | P2 | Copy quebrada: "Pra pedir aqui **em esta unidade**" | [page.tsx:1431](../src/app/pedir/page.tsx#L1431) |
| P6 | P2 | Tabs de categorias sem produto não fazem nada ao serem tocadas | [page.tsx:1525](../src/app/pedir/page.tsx#L1525) vs [page.tsx:1558](../src/app/pedir/page.tsx#L1558) |
| P7 | P2 | Brick do Mercado Pago pode vazar (criado depois do cleanup, nunca desmontado) | [MercadoPagoBrick.tsx:44](../src/app/pedir/_components/MercadoPagoBrick.tsx#L44) |
| P8 | P3 | `PixResult` reaproveitado pro resultado de cartão mostra contador congelado em `05:00` | [page.tsx:2391](../src/app/pedir/page.tsx#L2391) |
| P9 | P3 | `savePublicOrderSession` grava no sessionStorage a cada tecla do e-mail do Pix | [page.tsx:2371](../src/app/pedir/page.tsx#L2371) |
| P10 | P3 | `.then()` sem `.catch()` na listagem de filiais e no lookup por telefone | [PedirLanding.tsx:88](../src/app/pedir/PedirLanding.tsx#L88), [PedirLanding.tsx:124](../src/app/pedir/PedirLanding.tsx#L124) |
| P11 | P3 | Fragmento `<>…</>` sem condição (resto de refactor) na tela INFO | `page.tsx` (bloco "Seus dados") |
| P12 | P3 | Botão "Editar item" da REVIEW usa ícone `Plus` | `page.tsx` (lista de itens da REVIEW) |

### Detalhamento dos P0

**P13 — DDD 55 bloqueado.** Encontrado durante a execução da F0, não na leitura inicial. `/pedir` tinha cópias locais de `normalizeBrazilPhone`/`formatWhatsAppInput` que ficaram para trás quando a versão de `@/lib/utils/phone` foi corrigida: elas cortam o `55` inicial de **qualquer** número, sem checar o tamanho. Um celular de Santa Maria/Uruguaiana (`(55) 9xxxx-xxxx`, 11 dígitos) vira 9 dígitos e é rejeitado como inválido. Efeito: o cliente não consegue informar o WhatsApp, não recebe aviso de pedido pronto, não acumula fidelidade e **não consegue pedir entrega**, que exige telefone. O `/app` do atendente já usava a versão corrigida — só o fluxo público estava para trás. Serve de alerta: a duplicação por cópia é o que fez a correção não chegar aos dois lados.

**P1 — cardápio fantasma.** Reproduzido em dev: `/pedir/slug-que-nao-existe` renderiza o cardápio normalmente. A edge function faz fallback silencioso pra config global quando não acha o slug, `config.branch` volta `null`, e `menuApi.getMenuData(null)` não filtra por `branch_id` — então vêm categorias de todas as filiais e do legado juntas ("Kreps Salgados" + "Crepes Salgados" + "Bebidas" + "Bebidas / Combustíveis"…), com o horário global (23:59) em vez do da filial (23:30). O cliente monta o pedido inteiro e só descobre no `create-public-order`, que lança `"Filial inexistente."` ([create-public-order/index.ts:323](../supabase/functions/create-public-order/index.ts#L323)). Um QR Code impresso errado, um link velho ou um typo levam a isso.

**P2 — revalidação sem filial.** As chamadas de [:400](../src/app/pedir/page.tsx#L400) e [:623](../src/app/pedir/page.tsx#L623) passam `branchSlug`; a de [:1084](../src/app/pedir/page.tsx#L1084) não. Duas consequências: (a) uma filial pausada ou fora do próprio horário passa no gate do cliente e só é barrada pelo servidor — e o `catch` de `OrderingClosedError` **limpa o carrinho**, ou seja, o cliente perde o pedido montado; (b) os `setOrderingSchedule`/`setOnlineOrderingEnabled` logo abaixo sobrescrevem os dados da filial pelos globais, e o hero passa a exibir o horário errado.

**P3 — cartão recusado silencioso.** Quando o Mercado Pago recusa por risco, ele responde **HTTP 200** com `payment.status === "rejected"`, e o edge devolve `success: true` ([create-mercado-pago-payment/index.ts:775](../supabase/functions/create-mercado-pago-payment/index.ts#L775)). O `onSubmit` só trata `!response.success` e `status === "approved"` — qualquer outro status cai no `resolve()` sem erro e sem avanço de tela. O cliente fica olhando a tela de pagamento sem saber que foi recusado. Só o caminho HTTP 400 (erro de payload/credencial) mostra mensagem.

---

## Princípios para não quebrar o sistema

1. **O servidor continua sendo a autoridade.** Nenhuma correção move validação de preço, taxa, horário ou disponibilidade de entrega pro cliente. As correções alinham o cliente ao que o servidor já decide — nunca substituem a checagem do servidor.
2. **Mudanças de contrato só aditivas.** Campo novo em resposta de edge function é opcional; cliente antigo que ignora o campo continua funcionando igual. Nada de renomear ou remover campo de resposta.
3. **Uma fase = um PR = um assunto.** Facilita revisão e reverter só a parte problemática.
4. **Lógica nova entra como função pura em `src/lib/`,** coberta por vitest — é o padrão que o repo já usa (`src/lib/utils/*.test.ts`). O ambiente do vitest é `node`, sem jsdom/testing-library: não escrever teste de componente sem antes decidir adicionar essa infra (fora do escopo deste plano).
5. **Não tocar em `menuApi.getMenuData`.** O `branchId` opcional é usado de propósito pelo PDV interno ([novo-pedido/page.tsx:128](../src/app/app/novo-pedido/page.tsx#L128), [pedidos/page.tsx:403](../src/app/app/pedidos/page.tsx#L403)) quando ainda não há filial selecionada. O guard vai no chamador do `/pedir`.
6. **Deploy de edge function antes do frontend.** Onde houver mudança nos dois, subir a função primeiro (ela é retrocompatível) e só depois o frontend que lê o campo novo.
7. **Baseline verde antes e depois de cada fase:** `npx tsc --noEmit`, `npx eslint src/app/pedir`, `npm test`.

---

## Fases

### F0 — Rede de segurança (pré-requisito, sem mudança de comportamento)

Antes de mexer no fluxo, extrair pra funções puras testáveis o que as fases seguintes vão alterar. Nenhuma mudança visível ao usuário.

| Ação | Arquivo |
|---|---|
| `mapMercadoPagoStatus(status, statusDetail)` → `{ kind: "approved" \| "pending" \| "rejected", message }` | `src/app/pedir/_components/payment-helpers.ts` |
| `resolveInitialCategoryId(categories, products)` — primeira categoria **com produto** | `src/lib/menu/productTags.ts` (já é o módulo de apoio do cardápio) |
| Testes dos dois helpers | `*.test.ts` ao lado, padrão do repo |

**Validação:** `npm test` verde com os casos novos. Nenhum arquivo de UI alterado ainda.

---

### F1 — Correções cirúrgicas de baixo risco

Quatro mudanças pequenas e independentes entre si. Podem ir num PR só.

**F1.1 — `P2`: passar a filial na revalidação de horário**

```diff
- const config = await pdvApi.getPublicCheckoutConfig();
+ const config = await pdvApi.getPublicCheckoutConfig(branchSlug);
```

*Por que não quebra:* é a mesma chamada que já roda em outros dois pontos do mesmo componente, com o mesmo argumento. O caminho de fallback do `pdv-api` (leitura direta da tabela quando a edge function falha) já trata `branchSlug`. O comportamento muda só no sentido correto: uma filial fechada passa a ser barrada **antes** do `createPublicOrder`, com a mensagem certa, em vez de virar `OrderingClosedError` com carrinho apagado.

*Como validar:* com uma filial de teste com `ordering_enabled = false` (ou fora do `ordering_start_time`/`ordering_end_time`) e o global aberto, montar um carrinho e clicar em "Continuar para pagamento" → deve aparecer o motivo da filial, e o carrinho **não** deve ser limpo pela mensagem de gate. Conferir também que o horário do hero continua o da filial depois do clique.

**F1.2 — `P5`: copy**

```diff
- Pra pedir aqui em {branchName ?? "esta unidade"}, comece um novo pedido — …
+ Pra pedir aqui {branchName ? `em ${branchName}` : "nesta unidade"}, comece um novo pedido — …
```

**F1.3 — `P6`: tabs só de categorias com produto**

Filtrar a lista de tabs pelo mesmo critério que as sections já usam, e usar `resolveInitialCategoryId` (F0) no `loadMenu` em vez de `data.categories[0]?.id`.

*Por que não quebra:* as sections já pulam categorias vazias, então nenhuma âncora de scroll deixa de existir — só somem tabs que hoje não levam a lugar nenhum. O scroll-spy passa a ter 1:1 entre tab e section.

*Como validar:* com uma categoria ativa e sem produto ativo cadastrado, confirmar que a tab some e que as demais continuam navegando; e que a primeira tab já vem selecionada corretamente ao abrir.

**F1.4 — `P7`: desmontar o Brick criado após o cleanup**

```diff
- controller = await bricksBuilder.create("payment", "public-payment-brick", { … });
+ const created = await bricksBuilder.create("payment", "public-payment-brick", { … });
+ if (cancelled) { created.unmount(); return; }
+ controller = created;
```

*Por que não quebra:* é o mesmo guard de `cancelled` que já existe logo depois do `loadMercadoPagoScript()`, aplicado também depois do `create()`. No caminho normal (sem cleanup no meio) nada muda.

---

### F2 — `P3`: feedback de pagamento recusado

Caminho crítico de dinheiro; PR próprio.

**Mudança** em `MercadoPagoBrick.onSubmit`, usando o `mapMercadoPagoStatus` de F0:

- `approved` ou `already_paid` → `onPaid()` + `resolve()` (comportamento atual, mantido).
- `pending` / `in_process` → mensagem de "em análise" e `resolve()`; o polling do pai (a cada 5s) já leva pra tela PAID quando a aprovação sair.
- `rejected` / `cancelled` / desconhecido → `setError(mensagem amigável)` + `reject()`.

O `reject()` é exatamente o que o caminho de erro atual já faz — no Payment Brick isso mantém o formulário na tela para nova tentativa, e cada tentativa gera um `idempotency_key` novo (`crypto.randomUUID()` a cada submit), então não há risco de cobrança duplicada nem de reaproveitar uma tentativa recusada.

**Cuidados:**
- A tabela `status_detail` → mensagem deve ser conferida contra a documentação oficial do Mercado Pago antes do merge (não deduzir de memória). Cobrir pelo menos: `cc_rejected_insufficient_amount`, `cc_rejected_bad_filled_card_number`, `cc_rejected_bad_filled_security_code`, `cc_rejected_bad_filled_date`, `cc_rejected_call_for_authorize`, `cc_rejected_high_risk`, `cc_rejected_max_attempts`. Qualquer detalhe fora da lista cai numa mensagem genérica — nunca vazar o código cru do provedor pro cliente.
- O pedido continua em `AGUARDANDO_PAGAMENTO`; a expiração já é tratada por `expire-pending-public-orders`. Não inventar novo estado.

*Como validar:* cartões de teste do Mercado Pago em sandbox — usar os que forçam `rejected` por saldo insuficiente e por CVV inválido, e um que fique `in_process`. Confirmar: mensagem correta na tela, formulário reaberto para nova tentativa, e que o caso aprovado continua indo pra tela de confirmação.

---

### F3 — `P1`: filial inexistente

Duas camadas, edge function primeiro.

**Camada 1 — `get-public-checkout-config`.** Manter o fallback pra config global (ele existe pra não quebrar a página), mas **sinalizar** o que aconteceu, com campo novo e opcional:

```jsonc
{ "success": true, "branch": null, "branch_not_found": true, /* resto igual */ }
```

*Por que não quebra:* campo aditivo; o único consumidor é `pdvApi.getPublicCheckoutConfig`, usado só pelo `/pedir` (confirmado por busca no repo). Cliente que ainda não conhece o campo se comporta exatamente como hoje.

**Camada 2 — `pdv-api` + `/pedir`.**
- Refletir o mesmo `branch_not_found` no caminho de fallback do `pdv-api` (quando a edge function está fora do ar e a leitura direta de `branches` não acha o slug).
- No `loadMenu`: se `branchSlug` foi informado e a resposta veio com `branch_not_found` (ou `branch` nulo), **não chamar `menuApi.getMenuData`** e renderizar um estado "unidade não encontrada", com CTA pra `/pedir/filiais` (`BRANCHES_PAGE_PATH`) — reaproveitando a tela de erro que já existe no arquivo.

*Por que não quebra:* `/pedir` sem slug continua caindo em `DEFAULT_BRANCH_SLUG`, que é um slug válido; o caminho feliz não passa pelo novo ramo. E `menuApi` fica intacta para o PDV interno.

*Como validar:* `/pedir/slug-invalido` deve mostrar "unidade não encontrada" com link pras filiais, sem carregar cardápio nenhum. `/pedir`, `/pedir/nb` e `/pedir?branch=nb` seguem normais. Simular a edge function indisponível (CORS/offline) e conferir que o fallback direto também detecta o slug inválido.

*Rollback:* reverter só a camada 2 devolve o comportamento atual sem precisar mexer na edge function.

---

### F4 — `P4`: modalidade ENTREGA órfã

**Mudanças:**
1. Efeito de saneamento: quando a config da filial já carregou e `deliveryEnabled === false` mas `orderType === "ENTREGA"`, voltar pra `VIAGEM`.
2. No autofill do perfil salvo em `localStorage` ([page.tsx:550](../src/app/pedir/page.tsx#L550)), aplicar o mesmo filtro que o lookup do servidor já aplica: só aceitar `BALCAO`/`VIAGEM` (ou `ENTREGA` quando a filial atual tem entrega).

**Cuidado que decide se isso quebra ou não:** `deliveryEnabled` **começa `false`** e só vira `true` depois do `getPublicCheckoutConfig`. Se o efeito rodar antes disso, ele derruba a escolha legítima de quem já tinha selecionado Entrega. O efeito precisa depender de um sinal explícito de "config carregada" (não do `deliveryEnabled` sozinho, nem do `loading`, que também cobre o carregamento do cardápio). Sem esse cuidado, a correção vira um bug pior que o original.

*Como validar:* filial A com entrega → escolher Entrega → abrir filial B sem entrega: modalidade deve cair em "Para levar", o bloco de endereço deve sumir e o total não deve mais somar taxa. Em seguida voltar pra filial A e confirmar que Entrega volta a ser oferecida (e não é forçada sozinha).

---

### F5 — Higiene

Um PR só, sem mudança de fluxo.

- **P8:** não renderizar `PixResult` para resultado de cartão; se houver algo a mostrar do cartão, é um bloco próprio (o contador de Pix não faz sentido ali).
- **P9:** parar de gravar a sessão a cada tecla do e-mail — gravar no `blur` ou com debounce curto.
- **P10:** `.catch()` nos dois pontos do `PedirLanding`, com mensagem de erro na UI e `setLoading(false)` garantido. Hoje a `pdvApi` engole os erros internamente e por isso não quebra — o `.catch` é para que isso continue verdade se a API mudar.
- **P11:** remover o fragmento sem condição.
- **P12:** trocar o ícone do botão "Editar item" (o `aria-label` já está correto).

---

## Ordem de execução recomendada

```
F0 → F1 → F2 → F3 → F4 → F5
```

F1 e F2 entregam a maior parte do valor com o menor risco e não dependem de decisão de produto. F3 é o de maior impacto real, mas mexe em duas camadas — vale já ter F1/F2 estáveis em produção antes. F4 depende do cuidado com o estado inicial descrito acima. F5 pode ir a qualquer momento depois de F1.

## Checklist por PR

- [ ] `npx tsc --noEmit` limpo
- [ ] `npx eslint src/app/pedir` limpo
- [ ] `npm test` verde
- [ ] Fluxo feliz testado no browser: cardápio → item → carrinho → dados → pagamento
- [ ] O cenário específico da fase reproduzido **antes** (falhando) e **depois** (corrigido)
- [ ] Se tocou `supabase/functions/**`: função deployada antes do frontend, e `gh run list --workflow=deploy-functions.yml --limit 1` verde
- [ ] Tabela de status no topo deste documento atualizada com o PR

## Fora de escopo (decisões que não são deste plano)

- Adicionar jsdom/testing-library para testes de componente — mudaria a infra de teste do repo.
- Refatorar `page.tsx` (2.764 linhas) em componentes menores. É desejável, mas refatoração estrutural junto com correção de bug dificulta revisão e rollback; merece plano próprio depois que estas fases estabilizarem.
- OTP/verificação para acompanhamento de pedido por telefone (já registrado como pendência em `plano-acao-correcao-pdv.md`, P1.2).
