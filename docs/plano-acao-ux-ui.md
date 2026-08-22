# Auditoria Heurística e Plano de Ação Tático — UX/UI e Frontend Engineering

**Status:** proposto, aguardando aprovação para iniciar implementação.
**Escopo:** `/pedir` (B2C), `/app/pedidos` + `/app/novo-pedido` (B2B/operacional), `/app/caixa` + `/app/caixa/relatorio` (data-viz), com consolidação do design system iniciado em `/app/configuracoes` (PR #133).
**Objetivo:** elevar o ecossistema a "sistema de referência" — conversão no funil B2C, eficiência operacional no balcão, densidade de informação legível nos relatórios — com paridade real de craft entre mobile (375px) e desktop, e comunicação que fala com quem usa, não com quem programou.

---

## 1. Diagnóstico crítico

Cada achado é mapeado à heurística de Nielsen que ele viola e à causa técnica no código (arquivo:linha), levantados por auditoria direta do repositório.

### 1.1 `/pedir` (B2C) — funil de conversão

| Achado | Heurística violada | Evidência técnica |
|---|---|---|
| Funil de 5 telas cheias (`MENU → REVIEW → INFO → PAYMENT → PAID`) sem checkout expresso para cliente recorrente, mesmo já existindo reconhecimento de perfil por telefone | Flexibilidade e eficiência de uso | `pedir/page.tsx:406` (state machine), autofill de perfil em `:579-617` não reduz etapas, só preenche campos |
| Zero upsell/cross-sell; `ordersToday` (prova social) é buscado e nunca renderizado | Reconhecimento em vez de recall / oportunidade de negócio perdida | `publicStats.topByCategory` só alimenta uma badge estática; `ordersToday` sem consumidor visual |
| Carrinho em `sessionStorage` — perdido ao trocar de app (comum em Pix/banco) durante o próprio checkout | Controle e liberdade do usuário | Zustand `persist` com `sessionStorage`, `src/features/cart/useCart.ts` |
| E-mail obrigatório só no PIX, inconsistente com o resto do fluxo (WhatsApp/nome opcionais) | Consistência e padrões | `PixCheckout.tsx:40-43` |
| `deliveryBlocked` é beco sem saída — não oferece retirada como alternativa | Controle e liberdade do usuário | `pedir/page.tsx:794-797` |
| `TimelineStep` pós-pagamento mostra estado genérico ("Em preparo") em vez do status real do pedido | Visibilidade do status do sistema | `_components/TimelineStep.tsx` consumido em `pedir/page.tsx:2096-2213`, sem binding ao real-time que já existe em `/app/pedidos` |
| Spinners isolados sem texto explicando o que está sendo verificado (exceção correta: `PixResult.tsx:55`, que deveria virar o padrão) | Visibilidade do status do sistema | `Loader2` solto em `pedir/page.tsx:1697,1972` |
| Progresso fixo de 5 passos mesmo quando etapas não se aplicam (ex. sem endereço em pedido local) | Estética e design minimalista | `ProgressSteps.tsx`, lista hardcoded de 5 labels |
| Muitos `<button>` crus fora do `Button` do kit — feedback tátil (`active:scale`) inconsistente | Consistência e padrões | Predominante em `PedirLanding.tsx` e trechos de `pedir/page.tsx` |

### 1.2 `/app/pedidos` + `/app/novo-pedido` (B2B/operacional)

| Achado | Heurística violada | Evidência técnica |
|---|---|---|
| Ações rápidas de status **não são otimistas** — aguardam resposta da API antes de atualizar visualmente | Visibilidade do status do sistema (percepção de performance sob alta latência) | `handleQuickAction`, `pedidos/page.tsx:417-440`, resync via `fetchOrders(false)` após await |
| Efeito colateral silencioso: avançar status dispara WhatsApp + impressão sem indicar isso perto do controle | Correspondência entre sistema e mundo real | `pedidos/page.tsx:417-425` |
| Status ambíguos sem explicação (`"Pronto parcial"`, `"Aguardando pgto"` abreviado) | Reconhecimento em vez de recall | `OrderStatusBadge.tsx:14,18,22` |
| Sem `Modal` genérico — `OrderDetailsModal` e `PayItemsModal` reimplementam `fixed inset-0` cada um à sua maneira | Consistência e padrões | `OrderDetailsModal.tsx:258`, `PayItemsModal.tsx:198` |
| Kanban desktop sem skeleton de loading (mobile tem) | Visibilidade do status do sistema | `pedidos/page.tsx:603-608` vs. ausência de equivalente no Kanban |
| Badges de status custom em vez do `Badge` do kit; `DataTable` do kit não usado nos relatórios do módulo | Consistência e padrões | Grep confirma `Badge`/`DataTable` sem uso nas 4 áreas auditadas |
| `ProductCard` divergente entre `/pedir` (foto-forward) e `/novo-pedido` (lista compacta) — mesmo catálogo, dois acabamentos | Consistência e padrões | Comparação direta `pedir/page.tsx` produtos vs. `novo-pedido/page.tsx:598-634` |
| Lógica de scroll-spy/tags de categoria duplicada por copy-paste entre as duas telas | Dívida técnica (não é heurística de UX, mas amplia risco de regressão assimétrica) | Mesma função replicada em `pedir/page.tsx` e `novo-pedido/page.tsx` |
| Real-time é redundante por design (Supabase channel + polling 15s + refetch em `visibilitychange`) — correto e documentado, mas não otimista na camada de escrita | Visibilidade do status do sistema | `pedidos/page.tsx:376-414`, comentários confirmam decisão deliberada para wifi de feira |

### 1.3 `/app/caixa` + `/app/caixa/relatorio` (data-viz)

| Achado | Heurística violada | Evidência técnica |
|---|---|---|
| `/app/caixa` (dashboard do dia) é quase inteiramente textual — estatística numérica sem representação visual (sparkline/barra) | Estética e design minimalista (falta de reforço visual proposital) | `caixa/page.tsx`, hero + `StatPill`s, sem elemento gráfico |
| `/app/caixa/relatorio` tem gráficos 100% custom (`WaterfallPanel`, `HeatmapPanel`) sem linguagem visual unificada entre painéis — sem lib de charting, decisão consciente mas sem manual de estilo interno | Consistência e padrões | 2473 linhas, nenhuma dependência de chart confirmada em `package.json` |
| Tela mais madura tecnicamente das quatro (cache de relatório, `TopLoadingBar`, export CSV) — risco é reescrever o que já funciona em vez de refinar | N/A — nota de escopo | `buildReportCacheKey`/`readReportCache`/`writeReportCache` |

### 1.4 Vazamento de jargão de infraestrutura para a camada de apresentação

- Padrão `error instanceof Error ? error.message : "..."` repetido em 9+ ocorrências (`pedidos/page.tsx:357`, `configuracoes/page.tsx`, `usuarios/page.tsx`) — quando existe exceção real (caso comum), texto técnico cru do Postgres/Supabase/PostgREST chega ao toast; o fallback amigável só aparece no caso raro sem `.message`.
- `configuracoes/page.tsx` expõe "heartbeat", "worker", "Raspberry ativo", "IP lido pelo worker" a um público de dono/gerente de loja, não de desenvolvedor.
- Botões de processo em lote ("Processar fila agora", "Reprocessar falhas recuperáveis") não explicam o que vai acontecer antes do clique — só o resultado aparece depois, no toast.

### 1.5 Design system / dívida de primitivas

- **Sem `Modal`/`Sheet` agnóstico**: todo overlay de desktop é reimplementado à mão em vez de uma única primitiva que troca apresentação por breakpoint.
- **Sem sistema de elevação com intenção**: tokens `--shadow-sm/md/lg` existem em `globals.css`, mas aplicados de forma genérica, não hierárquica.
- **Sem escala tipográfica deliberada**: hierarquia resolvida majoritariamente por peso de fonte (`font-black`/`font-bold`), não por escala/`line-height`/`letter-spacing` combinados.
- **`package.json` com 7 dependências de produção** (`@supabase/*`, `lucide-react`, `next`, `react`, `react-dom`, `zustand`) — sem lib de motion, sem confirmação de uso de `next/image`. Base deliberadamente enxuta: qualquer adição precisa se justificar por ganho de qualidade percebida ou performance mensurável.

---

## 2. Princípios de arquitetura visual

O Design System precisa se comportar assim para sustentar o status de "sistema de referência":

1. **Uma primitiva de overlay, duas apresentações.** `Sheet`/`Modal` único: `BottomSheet` como base (mobile, 375px), progressão para modal centralizado em `md:`/`lg:` — nunca duas implementações paralelas. Toda tela migrada consome essa primitiva; nenhuma reimplementa `fixed inset-0`.
2. **Elevação com semântica, não decoração.** 3-4 níveis de `--shadow-*` mapeados a papéis fixos (superfície de fundo / card padrão / card em destaque / overlay), aplicados de forma consistente em todo o kit — não escolhidos caso a caso por tela.
3. **Escala tipográfica estrita.** Tokens de display/título/subtítulo/corpo/legenda com `line-height`/`letter-spacing` combinados, substituindo o uso de peso de fonte como único mecanismo de hierarquia.
4. **Um catálogo, um `ProductCard`.** Variante `compact` (toque rápido, `/novo-pedido`) e `full` (exploração, `/pedir`) compartilham base visual, tags e lógica de scroll-spy — elimina duplicação de código e de linguagem visual simultaneamente.
5. **Estado determinístico em todo processo assíncrono.** Todo carregamento/espera/fila tem: (a) skeleton dimensionalmente preciso (evita CLS), (b) texto explicando o que está acontecendo — padrão já correto em `PixResult.tsx:55`, generalizado para CEP, perfil de cliente, filas de envio — e (c) UI otimista onde a mutação é de baixo risco (status de pedido), com reversão determinística em erro.
6. **Dicionário de erros como camada obrigatória, não fallback.** Nenhuma exceção crua (`error.message`) chega à UI sem passar por um mapeamento centralizado para linguagem humana; jargão de infraestrutura (JWT, heartbeat, worker, stack trace) nunca aparece na camada de apresentação.
7. **Acessibilidade como parte do contrato do componente**, não auditoria posterior: `:focus-visible` com anel de cor de marca em todo controle interativo desde a primitiva; `aria-live="polite"` em toda região que muda por real-time (contadores, badges de status, filas).
8. **Paridade de craft, não paridade de layout.** Onde a interação muda genuinamente por espaço (Kanban de arrastar coluna vs. tabs em `/app/pedidos`), manter implementações distintas é correto — o contrato é que ambas recebam o mesmo padrão de loading/erro/motion/a11y, não que sejam o mesmo componente.
9. **Motion parcimonioso e determinístico.** Decisão explícita (Fase 0) entre lib leve de animação e CSS/View Transitions nativas — usado em transição de step, skeleton→conteúdo, entrada/saída de `Sheet`/`Modal`, feedback de "adicionado ao carrinho" — nunca como enfeite sem função de comunicar estado.

---

## 3. Roadmap faseado (0–5)

Cada fase lista critérios de aceite técnicos verificáveis — nenhuma fase fecha sem eles.

### Fase 0 — Fundação de design system e infraestrutura de mensagens (~4-5 dias)
**Escopo:**
- `Sheet`/`Modal` responsivo único; migração de `OrderDetailsModal`/`PayItemsModal`.
- Sistema de elevação e escala tipográfica aplicados ao kit (`Button`, `Card`, `SettingsPanel`).
- `ProductCard` único (`compact`/`full`) com imagem via `next/image`.
- Auditoria e correção de `:focus-visible` e alvo de toque (≥44px) em todo o kit.
- Dicionário central de mensagens de erro (mapeamento de erros conhecidos de API/Supabase → PT-BR humano) e guia de voz de 1 página.
- Decisão técnica sobre motion (lib leve vs. View Transitions API nativa).

**Critérios de aceite:**
- [ ] `Sheet`/`Modal` renderiza corretamente em 375px (folha de baixo) e 1440px (modal centralizado), sem duplicação de componente.
- [ ] Todo controle interativo do kit tem `:focus-visible` visível por teclado (`Tab`) e alvo de toque medido ≥44×44px.
- [ ] `error.message` cru não aparece em nenhum ponto do kit sem passar pelo dicionário central — testável por grep de regressão (`error instanceof Error ? error.message`) restrito a chamadas que não passam pelo helper novo.
- [ ] `ProductCard` renderiza a partir da mesma fonte de dados nas duas variantes, sem props divergentes de formatação.

### Fase 1 — `/pedir`: funil de conversão (prioridade máxima)
**Escopo:**
- Checkout expresso para cliente recorrente (pular INFO sem dado novo); `ProgressSteps` dinâmico.
- Upsell no `Sheet` de customização e na REVIEW via `publicStats.topByCategory`; exposição de `ordersToday`.
- E-mail opcional no PIX (ou justificativa visível); `deliveryBlocked` oferece retirada em um toque.
- `TimelineStep` consumindo status real via real-time.
- Carrinho migrado para `localStorage` (TTL 90 dias, alinhado ao perfil salvo).
- Migração de `<button>` crus para `Button` do kit; texto de processo em toda espera (padrão `PixResult.tsx`); microcopy revisada por completo.

**Critérios de aceite:**
- [ ] Cliente com perfil salvo completa o funil em no máximo 3 telas (MENU → REVIEW → PAYMENT), medido manualmente.
- [ ] Carrinho sobrevive a fechar/reabrir aba (teste manual: adicionar item, fechar aba, reabrir link, carrinho presente).
- [ ] `TimelineStep` reflete mudança de status em até 1 ciclo de real-time após alteração feita em `/app/pedidos` (teste ponta a ponta).
- [ ] Nenhum `<button>` cru remanescente em `PedirLanding.tsx`/`pedir/page.tsx` (grep de regressão).
- [ ] Paridade mobile/desktop confirmada via screenshot lado a lado em 375px e 1440px para as 5 telas do funil.
- [ ] Contraste AA validado (ferramenta automatizada + revisão manual em simulação de luz solar) em todos os textos novos/alterados.

### Fase 2 — `/app/novo-pedido`: paridade de catálogo
**Escopo:**
- Adoção do `ProductCard` compartilhado (variante `compact`); upsell reaproveitado da Fase 1.
- Microcopy revisada para leitura em <1s sob pressão de balcão; erros via dicionário central.

**Critérios de aceite:**
- [ ] Zero duplicação de lógica de tags/scroll-spy entre `/pedir` e `/novo-pedido` (hook único, grep confirma remoção do copy-paste).
- [ ] Alvo de toque ≥44px confirmado em todos os controles de adição/quantidade (medição direta em DevTools).
- [ ] Paridade visual entre card do catálogo público e do catálogo interno confirmada por screenshot comparativo.

### Fase 3 — `/app/pedidos`: UI otimista e consolidação de overlay
**Escopo:**
- Migração de `OrderDetailsModal`/`PayItemsModal` para o `Sheet`/`Modal` único.
- Badges via `Badge` do kit; UI otimista nas ações rápidas com reversão determinística em erro.
- Skeleton no Kanban desktop; explicação de status ambíguos; indicação de efeito colateral (WhatsApp/impressão) perto do controle.
- Manutenção deliberada de Kanban desktop / tabs+grid mobile como implementações distintas.

**Critérios de aceite:**
- [ ] Ação rápida de status atualiza visualmente em <100ms (otimista), com teste de reversão simulando erro de rede (DevTools throttling/offline).
- [ ] Kanban desktop exibe skeleton dimensionalmente equivalente ao da grade mobile durante carregamento inicial (paridade confirmada).
- [ ] `aria-live="polite"` confirmado por teste de leitor de tela (ou inspeção de árvore de acessibilidade) nas colunas/contadores que mudam por real-time.
- [ ] Zero overlay `fixed inset-0` customizado remanescente fora da primitiva `Sheet`/`Modal` (grep de regressão).

### Fase 4 — `/app/caixa` + `/app/caixa/relatorio`: linguagem de dados
**Escopo:**
- Manual de estilo interno para paleta/eixos/tooltips/legendas dos painéis SVG custom.
- Elemento visual (sparkline/barra) no dashboard do dia, hoje só numérico.
- Aplicação do sistema de elevação/tipografia sem alterar a arquitetura de informação já madura.
- Labels técnicos de `/app/configuracoes` reescritos para linguagem de negócio primeiro; botões de processo em lote com texto prévio de escopo/duração.

**Critérios de aceite:**
- [ ] Paleta de cor de gráfico auditada e idêntica entre `WaterfallPanel`, `HeatmapPanel` e demais painéis (comparação direta de tokens usados).
- [ ] Dashboard do dia (`/app/caixa`) exibe ao menos um elemento gráfico não-textual por métrica-chave.
- [ ] Nenhuma regressão de funcionalidade no relatório (cache, export CSV, comparação de período) confirmada por teste manual completo pós-mudança.
- [ ] Termos de infraestrutura ("worker", "heartbeat") não aparecem mais como texto primário em `/app/configuracoes` (grep + revisão visual).

### Fase 5 — Polimento, performance e verificação transversal
**Escopo:**
- Auditoria de contraste AA em todas as telas tocadas, em condição de luz solar direta simulada.
- Auditoria de payload de `/pedir` (imagens via `next/image`, JS inicial) sob throttling 3G/4G real do Chrome DevTools.
- Checklist final de paridade mobile/desktop por tela.
- Auditoria final de vazamento de `error.message` cru em todo o escopo tocado.

**Critérios de aceite:**
- [ ] Lighthouse mobile (throttled) em `/pedir` com métricas de LCP/CLS/TBT documentadas antes/depois — meta: CLS < 0.1, LCP < 2.5s em simulação 4G.
- [ ] 100% das imagens de produto em `/pedir` e `/novo-pedido` servidas via `next/image` (grep confirma ausência de `<img>` cru para fotos de catálogo).
- [ ] Contraste AA (4.5:1 texto normal, 3:1 texto grande) confirmado por ferramenta automatizada em 100% das telas do escopo.
- [ ] Zero ocorrência de `error.message` cru fora do dicionário central em todo o escopo tocado pelo plano (grep de regressão final).

---

## 4. Métricas de telemetria

### KPIs técnicos
- **LCP / CLS / TBT** de `/pedir` em mobile 4G simulado (Lighthouse), antes/depois de cada fase que toca a tela.
- **Payload de imagem** de `/pedir` (peso total de fotos de produto na carga inicial do MENU) — meta de redução mensurável pós-`next/image`.
- **Latência percebida de mutação** em `/app/pedidos` — tempo entre toque na ação rápida e atualização visual (deve cair para ~0 com UI otimista, hoje limitado pelo round-trip da API).
- **Taxa de erro não mapeado** — contagem de vezes que o dicionário central de erros não encontra um mapeamento e cai no fallback genérico (sinal de gap de cobertura, não de falha aceitável).

### KPIs de negócio
- **Taxa de conclusão do funil `/pedir`** (MENU → PAID), segmentada por dispositivo — requer confirmar se há analytics implantado antes da Fase 1; se não houver, é pré-requisito a resolver.
- **Ticket médio** antes/depois da introdução de upsell na REVIEW e no `Sheet` de customização.
- **Tempo até pagamento** (MENU → PAID), mobile vs. desktop.
- **Taxa de retomada de carrinho** após troca de app — indicador indireto do impacto da migração `sessionStorage` → `localStorage`.
- **Qualitativo**: feedback informal de clientes/equipe pós-fase sobre percepção de confiança — não substituível só por número, mas coletado de forma estruturada (mesma pergunta, mesmo canal, a cada fase).

---

## 5. Ordem de execução

1. Fase 0 — fundação (desbloqueia tudo, define o padrão de acabamento e a infraestrutura de mensagens que as fases seguintes consomem).
2. Fase 1 — `/pedir` (maior alavanca de receita e de confiança do cliente final).
3. Fase 2 — `/novo-pedido` (reaproveita a Fase 1).
4. Fase 3 — `/pedidos` (consolidação operacional interna, UI otimista).
5. Fase 4 — `/caixa` + relatório (eleva a tela mais "séria" do sistema sem reescrever o que já funciona).
6. Fase 5 — polimento, performance e verificação transversal.

Cada fase é validada manualmente em mobile (375px) **e** desktop (1440px) antes de avançar, com os critérios de aceite técnicos desta seção como gate — não avança por sensação de "está bom", avança por checklist cumprido.

### Fora de escopo (deliberado)
- Abertura/fechamento de caixa físico: não existe hoje, fora do pedido atual — projeto próprio se necessário.
- Programa de fidelidade / recuperação de carrinho via WhatsApp: mapeado em `docs/plano-acao-fidelizacao.md`; a Fase 1 aqui só prepara o terreno (persistência de carrinho), sem implementar disparo de mensagem.
- Reescrita estrutural de `/app/caixa/relatorio`: já é a tela mais madura do sistema; a Fase 4 refina linguagem visual e texto, não arquitetura de informação.
