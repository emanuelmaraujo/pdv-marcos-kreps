# Prompt: melhoria premium das telas publicas `/pedir` e `/pedido/[publicToken]`

Voce e um engenheiro senior full-stack trabalhando no **PDV Marcos Krep's**, um PWA de ponto de venda para creperia. Sua tarefa e melhorar profundamente a experiencia publica de pedido do cliente nas telas `/pedir` e `/pedido/[publicToken]`, preservando a identidade visual atual da marca e elevando a experiencia em telas maiores, checkout, pagamento e acompanhamento do pedido.

Este projeto usa **Next.js 16.2.4**, **React 19.2.4**, **Tailwind CSS v4**, **Supabase**, **Edge Functions**, **Zustand** e **lucide-react**. Antes de alterar codigo Next.js, leia a documentacao local relevante em `node_modules/next/dist/docs/`, porque este Next tem mudancas de API, convencoes e estrutura em relacao ao conhecimento comum.

## Objetivo principal

Transformar `/pedir` em uma experiencia publica excelente, fluida, responsiva e com alto potencial de retencao, principalmente no momento de montar e finalizar o pedido. Transformar `/pedido/[publicToken]` em uma tela real de acompanhamento do pedido, bonita, confiavel e responsiva, usando dados reais e feedback visual claro.

Nao fazer uma landing page. A primeira tela deve continuar sendo a experiencia util de pedir.

## Contexto real do projeto

Arquivos principais:

- `src/app/pedir/page.tsx`: tela publica atual de pedido. Ja possui cardapio real via `menuApi.getMenuData()`, carrinho, personalizacao de item, Pix, Mercado Pago Brick, status de horario, `sessionStorage` para pedido publico e polling de pagamento.
- `src/app/pedido/[publicToken]/page.tsx`: tela publica atual de acompanhamento. Hoje esta mockada e precisa virar implementacao real.
- `src/features/cart/useCart.ts`: store Zustand persistida em `sessionStorage`, com `items`, `orderType`, `customerName`, `customerPhone`, `orderNotes`.
- `src/lib/api/pdv-api.ts`: contem `createPublicOrder`, `getPublicOrderStatus`, `getPublicCheckoutConfig`, `createMercadoPagoPayment`.
- `supabase/functions/create-public-order/index.ts`: cria pedido publico com Service Role, valida itens/precos no servidor, cria `customers`, cria `orders` com `source = APP`, `status = AGUARDANDO_PAGAMENTO`, `payment_status = PENDING`.
- `supabase/functions/get-public-order-status/index.ts`: busca status publico apenas por `public_token`, sem numero diario na URL.
- `supabase/migrations/20260511040000_public_customers_pending_orders.sql`: criou `customers` com `id`, `phone_e164`, `name`, `orders_count`, `marketing_opt_in`, `source`, etc.
- `src/app/globals.css`: identidade de cores atual: `brand-red #E73335`, `brand-yellow #FFE11A`, `brand-amber #FACC15`, `brand-charcoal #2F2F31`, fundo claro quente.
- `src/components/ui/Button.tsx`, `BottomSheet.tsx`, `Badge.tsx`, `Card.tsx`: componentes base.
- `src/app/app/pedidos/page.tsx` e componentes em `src/app/app/pedidos/components/`: referencia para status, cards, badges, realtime e linguagem visual operacional.

Status e pagamentos:

- `OrderStatus`: `AGUARDANDO_CONFIRMACAO`, `AGUARDANDO_PAGAMENTO`, `NA_FILA`, `PRONTO`, `ENTREGUE`, `CANCELADO`, `EXPIRADO`.
- `PaymentStatus`: `PENDING`, `PAID`, `REFUNDED`, `CANCELED`, `COURTESY`.
- `PaymentMethod`: `PIX`, `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `PENDING`, `COURTESY`.
- O total oficial sempre vem do backend. Nao confiar em total calculado no cliente para fechar pedido.

## Direcao de produto

A experiencia deve parecer:

- Rapida, gostosa e confiavel para cliente final.
- Claramente Marcos Krep's: vermelho, amarelo/amber, charcoal, fundo quente, linguagem direta, cards limpos.
- Mais premium em desktop/tablet, sem ficar parecendo dashboard interno.
- Mobile-first, mas nao limitada a uma coluna estreita em telas grandes.
- Com microinteracoes fluidas e discretas: entrada de cards, feedback ao adicionar item, transicoes entre etapas, estados de carregamento, sucesso e pagamento.
- Focada em retencao: reduzir friccao no checkout, lembrar dados quando autorizado, recuperar pedido em andamento, deixar o cliente confiante depois de pagar.

## Requisitos de UX para `/pedir`

### Layout responsivo

Melhorar a tela atual para funcionar muito bem em:

- Mobile pequeno: fluxo vertical, barra de carrinho fixa, bottom sheet confortavel, inputs grandes.
- Tablet: cardapio em duas colunas, checkout mais espacoso, modal/sheet sem ocupar a tela toda quando fizer sentido.
- Desktop/wide: usar layout em duas ou tres areas, por exemplo:
  - coluna esquerda com categorias/filtros;
  - area central com produtos;
  - painel direito sticky com carrinho/resumo quando houver itens.

Nao esticar cards ate ficarem gigantes. Definir `max-width`, grids e alturas estaveis. Evitar texto quebrando de forma feia. Garantir que botoes, badges, precos e nomes longos nao sobreponham conteudo.

### Cardapio e personalizacao

Manter a logica atual de categorias, filtros, tags, ingredientes, adicionais e observacoes. Melhorar a apresentacao:

- Produto com nome, codigo quando existir, resumo de ingredientes, tags e preco.
- Feedback visual ao clicar/adicionar, sem bloquear o fluxo.
- Personalizacao com bottom sheet no mobile e modal/painel mais adequado em telas maiores.
- Controles de quantidade e adicionais com icones lucide, areas de toque grandes e estado ativo claro.
- Carrinho deve permitir editar/remover item com clareza.

### Checkout bonito e confiavel

O checkout deve ser uma etapa bonita, clara e com sensacao de progresso. Implementar ou refatorar para conter:

- Indicador de etapas: `Cardapio -> Revisao -> Pagamento -> Acompanhamento`.
- Resumo do pedido bem escaneavel, com itens, adicionais, removidos, observacoes, subtotal estimado, taxa de embalagem e total oficial quando ja existir pedido.
- Se `orderType === VIAGEM` e taxa de embalagem aplicada, explicar a taxa de forma discreta.
- Se houver erro de horario fechado, pagamento ou validacao, mostrar alerta claro e recuperavel.
- Botao principal forte e persistente no mobile, sem cobrir conteudo.
- Depois de criar o pedido, direcionar para `/pedido/{public_token}`. Nao colocar `daily_number` na URL publica.

### Retencao por telefone e dados salvos

Implementar uma experiencia de dados salvos usando o numero de WhatsApp como chave principal, com privacidade correta.

Comportamento esperado:

1. O cliente digita o WhatsApp com DDD.
2. Ao detectar um telefone valido, a tela tenta preencher nome/e-mail/preferencias de forma segura.
3. Se o cliente marcou "Salvar meus dados para proximos pedidos", salvar os dados localmente e tambem permitir busca segura pelo backend.
4. Em visitas futuras, ao digitar o mesmo numero ou ao abrir no mesmo dispositivo, preencher automaticamente nome, e-mail e preferencia de retirada/viagem.
5. O cliente deve poder desmarcar/remover dados salvos neste dispositivo.

Implementacao recomendada:

- Criar uma chave local em `localStorage`, por exemplo `pdv-public-customer-profile`, separada do carrinho em `sessionStorage`.
- Salvar localmente apenas com opt-in explicito:
  - `phone_e164`
  - `name`
  - `email`
  - `order_type`
  - `marketing_opt_in`
  - `saved_at`
- Nunca salvar CPF localmente.
- Nao preencher dados sensiveis sem consentimento.
- Ao buscar por telefone no backend, nao criar uma API que permita enumerar clientes livremente. Usar rate limit simples por IP/origem se possivel, validar telefone, resposta generica em caso de nao encontrado e retornar apenas dados de clientes que aceitaram salvar dados.

Alteracoes backend sugeridas:

- Criar migration adicionando em `customers`:
  - `email TEXT`
  - `remember_checkout_data BOOLEAN NOT NULL DEFAULT FALSE`
  - `last_order_type order_type`
  - `checkout_profile_updated_at TIMESTAMPTZ`
- Atualizar `create-public-order` para receber `remember_checkout_data?: boolean` e, quando true, persistir `email`, `last_order_type` e consentimento.
- Criar Edge Function publica segura, por exemplo `get-public-customer-profile`, que recebe `customer_phone`, normaliza para E.164 Brasil, e retorna:
  - `found: boolean`
  - `profile?: { name, email, order_type, marketing_opt_in }`
- Essa function deve usar Service Role, validar origem com `PUBLIC_CHECKOUT_ALLOWED_ORIGINS`, limitar retorno a `remember_checkout_data = true`, nao retornar `id`, `phone_e164`, historico de pedidos, total gasto ou qualquer dado operacional.
- Atualizar `src/lib/api/pdv-api.ts` com `getPublicCustomerProfile`.

### Pagamento e pos-pedido

Manter o Mercado Pago atual:

- Pix via `createMercadoPagoPayment` com `direct_payment_method: "pix"`.
- Cartao via Brick oficial.
- Nunca criar inputs manuais para numero de cartao, CVV ou validade.
- Manter idempotencia com `crypto.randomUUID()` como ja existe.
- Mostrar Pix com QR Code, copia e cola, expiracao e polling.
- Se pagamento for aprovado, limpar carrinho e ir para uma tela/rota de acompanhamento.

Melhorar o estado `PAID`:

- Mostrar numero do pedido, status atual e CTA para acompanhar pedido.
- Navegar para `/pedido/${public_token}`. O numero diario so deve aparecer dentro da tela depois que o backend validar o token.

## Requisitos para `/pedido/[publicToken]`

Substituir o mock por uma tela real.

Entrada:

- Ler `publicToken` dos params.
- Nao aceitar `daily_number` como identificador publico da rota.
- Se o token estiver ausente/malformado, mostrar estado de link invalido, sem vazar dados.

Dados:

- Usar `pdvApi.getPublicOrderStatus({ public_token })`.
- Fazer polling a cada 5s a 10s enquanto status estiver ativo.
- Se possivel, considerar realtime apenas se nao complicar seguranca; polling ja e suficiente.

UI:

- Header Marcos Krep's com numero do pedido.
- Timeline visual do status:
  - Pagamento
  - Confirmacao
  - Na fila/preparo
  - Pronto
  - Entregue
- Para `AGUARDANDO_PAGAMENTO`, mostrar pagamento pendente e, se houver transacao Pix ativa, mostrar expiracao/estado.
- Para `AGUARDANDO_CONFIRMACAO`, explicar que a equipe esta conferindo o pedido.
- Para `NA_FILA`, mostrar preparo em andamento.
- Para `PRONTO`, destacar fortemente que pode retirar.
- Para `ENTREGUE`, estado final positivo.
- Para `CANCELADO` ou `EXPIRADO`, mostrar estado final com explicacao simples.
- Mostrar total, metodo/status de pagamento, horario de criacao e nome do cliente quando disponivel.
- Nao mostrar itens se a function atual nao retorna itens; se quiser mostrar resumo completo, alterar `get-public-order-status` com cuidado para retornar snapshots dos itens sem dados sensiveis.

Responsividade:

- Mobile: timeline vertical, CTA fixo/discreto quando util.
- Desktop: painel principal + lateral com resumo/status, bem aproveitado sem virar dashboard.

## Animacoes e microinteracoes

Usar apenas CSS/Tailwind e React, sem adicionar biblioteca nova salvo necessidade real.

Adicionar:

- `animate-in`, transicoes ou keyframes leves para entrada de cards/sheets.
- Hover e active states em desktop/mobile.
- Skeletons/loading states refinados.
- Feedback ao adicionar item no carrinho.
- Pulse discreto para status ao vivo/pagamento aguardando.
- Transicao suave entre checkout e pagamento.

Respeitar `prefers-reduced-motion`: reduzir animacoes para usuarios que preferem menos movimento.

Nao usar decoracao de orbs/bokeh. Nao transformar a tela em landing page. Nao usar gradientes roxos/azuis dominantes. A identidade deve continuar vermelho + amber + charcoal + fundo quente.

## Regras de seguranca e consistencia

- Total oficial sempre pelo backend.
- Mutacoes publicas sempre por Edge Function, nunca insert/update direto em tabelas pelo cliente publico.
- Nao vazar dados de cliente por telefone sem opt-in.
- Nao armazenar CPF localmente.
- Nao quebrar RLS existente.
- Manter validacao de horario em `getPublicCheckoutConfig` e revalidacao no clique de criar pedido.
- Manter CORS/origem nas Edge Functions publicas.
- Preservar `payment_transactions` e webhook Mercado Pago.
- Preservar compatibilidade com pedidos internos e painel `/app/pedidos`.

## Escopo tecnico esperado

Implemente de ponta a ponta:

1. Refatorar `src/app/pedir/page.tsx` se necessario, extraindo componentes para reduzir complexidade:
   - `src/components/public-order/PublicMenu.tsx`
   - `src/components/public-order/PublicProductCustomizer.tsx`
   - `src/components/public-order/PublicCartPanel.tsx`
   - `src/components/public-order/PublicCheckout.tsx`
   - `src/components/public-order/PublicPaymentStep.tsx`
   - `src/components/public-order/PublicOrderProgress.tsx`
   - Use nomes diferentes se combinar melhor com o codigo, mas evite deixar `page.tsx` gigante.
2. Implementar dados salvos/retencao:
   - localStorage com opt-in;
   - API client em `pdvApi`;
   - Edge Function segura;
   - migration para campos faltantes em `customers`;
   - atualizar `create-public-order`.
3. Transformar `/pedido/[publicToken]` em tela real de acompanhamento.
4. Opcional, se necessario para bom design: pequenos ajustes nos componentes base (`Button`, `BottomSheet`) sem quebrar outras telas.
5. Manter tipos em `src/types/pdv.ts` atualizados.

## Criterios de aceite

- `/pedir` continua carregando cardapio real.
- Cliente consegue adicionar, personalizar, editar e remover itens.
- Checkout fica bonito, claro e responsivo.
- Em desktop, `/pedir` aproveita a largura com menu/produtos/carrinho ou checkout lateral.
- Ao digitar telefone valido com dados salvos e consentidos, nome/e-mail/preferencias preenchem automaticamente.
- Cliente pode salvar dados para proximos pedidos e remover/desativar isso no dispositivo.
- Pedido publico continua sendo criado por `create-public-order`.
- Pix e cartao continuam funcionando pelo Mercado Pago sem inputs manuais de cartao.
- Apos pedido/pagamento, cliente tem caminho claro para acompanhamento.
- `/pedido/[publicToken]` usa `getPublicOrderStatus` e nao mostra mock.
- `/pedido/[publicToken]` lida com token invalido, pedido nao encontrado, carregamento, erro, cancelado, expirado, pendente, pronto e entregue.
- Nao ha regressao visual em mobile.
- Nao ha textos quebrados/elementos sobrepostos em 360px, 768px, 1024px e 1440px.
- `npm run lint` e `npm run build` passam, ou qualquer falha e documentada com causa clara.

## Verificacao obrigatoria

Depois de implementar:

1. Rodar `npm run lint`.
2. Rodar `npm run build`.
3. Iniciar `npm run dev`.
4. Testar no navegador/in-app browser:
   - `/pedir` em 360x800, 768x1024, 1440x900.
   - fluxo de adicionar item, abrir personalizacao, checkout, salvar dados, voltar.
   - telefone valido preenchendo dados salvos.
   - estado de horario fechado se possivel simular.
   - `/pedido/123` deve falhar como link invalido e nao exibir dados.
   - `/pedido/{public_token}` com token real de um pedido criado.
5. Capturar screenshots ou inspecionar visualmente para garantir que nao existe sobreposicao, texto cortado ou layout desperdicado em telas grandes.

## Resultado esperado da resposta

Ao finalizar, entregue:

- Resumo curto das mudancas.
- Arquivos alterados.
- Como testar manualmente.
- Resultado de `lint` e `build`.
- Qualquer decisao de seguranca tomada para busca por telefone e dados salvos.
