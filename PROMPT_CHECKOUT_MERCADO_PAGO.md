# Prompt: Checkout Publico Seguro com Mercado Pago - PDV Marcos Krep's

---

## Papel

Voce e um engenheiro senior full-stack trabalhando no **PDV Marcos Krep's**, um PWA de ponto de venda para creperia. Sua tarefa e implementar, de ponta a ponta, o fluxo publico de pedido do cliente com pagamento online via Mercado Pago, preservando a seguranca, a consistencia financeira e a experiencia mobile-first.

Trate esta implementacao como fluxo critico de dinheiro real. Nao prometa "100% seguro" ou "sem falhas"; em vez disso, implemente defesa em profundidade, valide tudo no servidor, registre auditoria, cubra os caminhos de erro e documente claramente qualquer risco residual.

---

## Contexto real do projeto

Stack atual:

- **Next.js 16.2.4** com App Router
- **React 19.2.4**
- **TypeScript**
- **Tailwind CSS v4**
- **lucide-react**
- **Zustand** para carrinho em `src/features/cart/useCart.ts`
- **Supabase** para banco, auth, RLS e Edge Functions
- PWA com foco operacional mobile/tablet/desktop

Antes de escrever codigo Next.js, leia a documentacao local exigida pelo projeto em `node_modules/next/dist/docs/`, especialmente:

- `01-app/02-guides/upgrading/version-16.md`
- `01-app/02-guides/backend-for-frontend.md`

Pontos obrigatorios de Next 16:

- `params` e `searchParams` sao async em Server Components, layouts, pages e route handlers.
- Route Handlers sao endpoints publicos; trate-os como superficie de ataque.
- Nao exponha informacao sensivel em mensagens de erro ao cliente.

Arquivos principais existentes:

- `src/app/pedir/page.tsx`: tela publica atual, ainda mockada/incompleta.
- `src/app/pedido/[dailyNumber]/page.tsx`: acompanhamento publico atual, ainda mockado.
- `src/app/app/novo-pedido/page.tsx`: fluxo interno de pedido do atendente, bom modelo de UX e carrinho.
- `src/components/checkout/OrderSummarySheet.tsx`: fluxo interno de resumo, cliente, pagamento, taxa de embalagem e desconto.
- `src/features/cart/useCart.ts`: carrinho persistido em `sessionStorage`, com produtos, adicionais, ingredientes removidos, observacoes e `orderType`.
- `src/lib/api/menu-api.ts`: leitura publica de categorias, produtos, ingredientes, addons e vinculos.
- `src/lib/api/pdv-api.ts`: wrapper para Edge Functions.
- `src/lib/api/orders-api.ts`: pedidos internos do dia.
- `src/types/pdv.ts`: tipos alinhados ao schema Supabase.
- `supabase/functions/create-public-order/index.ts`: cria pedido publico com Service Role, valida itens/precos no servidor e hoje cria pedido `QR_CODE`, `AGUARDANDO_CONFIRMACAO`, `payment_status = PENDING`.
- `supabase/functions/get-public-order-status/index.ts`: busca status publico via `daily_number` + `public_token`.
- `supabase/functions/mark-payment/index.ts`: marcacao manual interna de pagamento por usuario autenticado.
- `supabase/functions/confirm-order/index.ts`: confirmacao interna do pedido e criacao de jobs de impressao.
- `supabase/migrations/20260502232400_init_pdv_schema.sql`: schema base.
- `supabase/migrations/20260509020000_fix_orders_rls.sql`: RLS atual, onde atendente le pedidos mas mutacoes passam por Edge Functions.

Modelo de dados atual:

- `orders.status`: `AGUARDANDO_CONFIRMACAO`, `AGUARDANDO_PAGAMENTO`, `NA_FILA`, `PRONTO`, `ENTREGUE`, `CANCELADO`, `EXPIRADO`.
- `orders.payment_status`: `PENDING`, `PAID`, `REFUNDED`, `CANCELED`, `COURTESY`.
- `orders.payment_method`: `PIX`, `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `PENDING`, `COURTESY`.
- `orders.public_token`: token seguro para acompanhamento publico.
- `payments`: historico financeiro atual, mas ainda nao possui campos especificos do Mercado Pago.
- Publico nao deve inserir/alterar diretamente `orders` ou `order_items`; toda mutacao publica deve passar por Edge Function com validacao server-side.

---

## Objetivo

Implementar o fluxo em que o cliente:

1. Acessa `/pedir`.
2. Ve o cardapio real ativo do Supabase.
3. Personaliza produtos com ingredientes removidos, adicionais, quantidade e observacoes.
4. Informa nome e, opcionalmente, WhatsApp/e-mail quando necessario para pagamento.
5. Escolhe forma de retirada/consumo: `BALCAO` ou `VIAGEM`.
6. Envia o pedido.
7. O backend cria o pedido oficial com total calculado no servidor.
8. O pedido nasce com pagamento pendente.
9. O cliente escolhe entre metodos online configuraveis processados pelo Mercado Pago por enquanto: cartao de credito, cartao de debito, Pix e, somente se confirmados oficialmente para checkout online Mercado Pago Brasil, Google Pay e Apple Pay. NuPay e outros metodos ficam preparados para futuro.
10. A tela renderiza a experiencia correta para o metodo escolhido: Payment Brick/Card Payment Brick, carteira digital, QR Code/copia-e-cola quando for Pix, status, expiracao e feedback claro.
11. O webhook do Mercado Pago confirma o pagamento no servidor.
12. O pedido passa para o fluxo operacional correto:
    - pagamento aprovado: `payment_status = PAID`, `payment_method` interno coerente com o metodo aprovado, registrar provider/method details em transacao, registrar `payments`, auditoria e liberar/confirmar conforme regra definida.
    - pagamento pendente: continuar visivel no painel interno como pendente.
    - pagamento recusado/cancelado/expirado: manter estado consistente e informar cliente.

Regra de negocio preferida:

- Pedido publico com pagamento online deve nascer como `AGUARDANDO_PAGAMENTO` + `payment_status = PENDING`.
- Apos webhook `approved`, atualizar para `payment_status = PAID`.
- Decidir explicitamente se o pedido pago vai direto para `NA_FILA` com impressao automatica ou se ainda exige confirmacao humana. Para PDV de alimentos, recomendo: pago online entra em `AGUARDANDO_CONFIRMACAO` ou `NA_FILA` conforme configuracao em `settings`; o default mais seguro operacionalmente e exigir confirmacao humana antes de imprimir/cozinha.

---

## Uso obrigatorio do MCP Mercado Pago

Use o MCP do Mercado Pago durante a implementacao. Nao implemente com memoria ou exemplos antigos sem confirmar a documentacao atual.

Passos obrigatorios:

1. Chamar `application_list`.
2. Se nao houver aplicacao cadastrada, informar que e necessario criar uma aplicacao no DevPanel do Mercado Pago antes de configurar webhooks reais.
3. Consultar a documentacao com `search_documentation` para:
   - Checkout Transparente no Brasil (`siteId = MLB`)
   - Payment Brick no Brasil
   - Card Payment Brick no Brasil
   - Pix via Checkout Transparente
   - cartao de credito e debito
   - Google Pay
   - Apple Pay
   - Wallet Brick/Conta Mercado Pago quando aplicavel
   - Webhooks de pagamentos
   - Idempotencia (`X-Idempotency-Key`)
   - Bricks/SDK JS React se decidir usar Payment Brick ou Status Screen Brick
4. Usar `save_webhook` quando houver `application_id` e URLs publicas reais de sandbox/producao.
5. Usar `quality_checklist` antes de concluir a integracao.
6. Se houver pagamento de teste, usar `quality_evaluation` com o `payment_id`.

Estado ja observado no MCP nesta maquina:

- `application_list` retornou zero aplicacoes.
- `quality_checklist` informou que o usuario nao possui aplicacoes e deve criar uma aplicacao no DevPanel.

Nao invente credenciais. Nunca commite tokens. Use variaveis de ambiente.

---

## Mercado Pago: diretrizes tecnicas

Implementar Checkout Transparente com arquitetura multi-metodo e extensivel. Nesta fase, o unico provider/orquestrador de pagamento online deve ser o **Mercado Pago**. NuPay e outros providers/metodos devem ficar previstos por adaptadores/configuracao, mas nao implementados fora do Mercado Pago sem decisao futura explicita.

Requisitos conhecidos pela documentacao consultada via MCP:

- O **Payment Brick** e a base preferida para o fluxo publico porque permite habilitar varios metodos em uma unica experiencia e reduz manutencao futura.
- No Brasil, a documentacao do Payment Brick indica suporte a cartao de credito, cartao de debito virtual Caixa, Pix, boleto, Conta Mercado Pago e parcelamento sem cartao. Confirme novamente via MCP antes de implementar.
- O **Card Payment Brick** e aceitavel quando a decisao tecnica for separar explicitamente cartao de credito/debito da experiencia Pix/wallet.
- Cartoes devem ser tokenizados pelo SDK/Brick oficial. Nunca crie inputs proprios para numero do cartao, CVV ou validade fora dos componentes oficiais.
- Pix no Checkout Transparente pode exibir QR Code e codigo copia-e-cola no proprio checkout.
- Criacao de pagamento deve ocorrer no backend.
- Requisicoes de criacao de pagamento devem enviar `X-Idempotency-Key`.
- Resposta de Pix contem dados em `point_of_interaction.transaction_data`, incluindo QR Code base64, `qr_code` e `ticket_url`.
- Pix exige chave Pix cadastrada na conta Mercado Pago.
- Vencimento do Pix pode ser definido com `date_of_expiration`; respeitar limites oficiais vigentes consultados na documentacao MCP.

Metodos obrigatorios desejados:

- `CREDIT_CARD`: cartao de credito via Brick oficial.
- `DEBIT_CARD`: cartao de debito quando disponivel oficialmente para Brasil/conta/app Mercado Pago. Se a documentacao limitar a "debito virtual Caixa", refletir isso na UI e no plano tecnico.
- `PIX`: Pix Mercado Pago com QR Code/copia-e-cola.
- `GOOGLE_PAY`: Google Pay somente se houver suporte oficial do Mercado Pago para checkout online no Brasil nesta integracao. Nao integrar Google Pay direto nesta fase.
- `APPLE_PAY`: Apple Pay somente se houver suporte oficial do Mercado Pago para checkout online no Brasil nesta integracao. Nao integrar Apple Pay direto nesta fase.

Sobre Google Pay e Apple Pay:

- Diferencie tres cenarios:
  - Mercado Pago como emissor: o cliente pode cadastrar o cartao Mercado Pago em carteiras digitais quando o produto permitir. Isso nao significa que a loja consiga oferecer a carteira no checkout online.
  - Mercado Pago como adquirente fisico/Tap/Point Tap: pode aceitar carteiras por aproximacao no presencial. Isso nao significa suporte automatico no checkout web.
  - Mercado Pago Checkout Transparente/Bricks online: e este fluxo que importa para `/pedir`. So implemente Google Pay/Apple Pay se a documentacao oficial atual confirmar suporte nesse contexto.
- Nao assuma que Mercado Pago Brasil suporta Google Pay ou Apple Pay no Checkout Transparente apenas porque o usuario pediu ou porque Tap/Point Tap aceita carteiras no presencial. Confirme via MCP/documentacao oficial atual.
- Se o Mercado Pago nao oferecer suporte online direto, mantenha `GOOGLE_PAY` e `APPLE_PAY` no catalogo como `enabled = false`, `availability_reason = 'Aguardando suporte oficial Mercado Pago online'`, e registre a limitacao no entregavel.
- Nao implemente carteiras digitais com APIs nao oficiais, redirecionamentos inseguros ou coleta manual de dados de cartao.

Sobre NuPay/Nubank:

- Nao assuma suporte a NuPay pelo Mercado Pago sem confirmacao oficial via MCP/documentacao atual.
- "Pix do Nubank" nao precisa de integracao Nubank especifica: o cliente pode pagar o Pix Mercado Pago usando Nubank ou qualquer banco.
- Se o MCP/documentacao oficial confirmar NuPay como metodo disponivel para Checkout Transparente no Brasil, implemente como opcional e separado, com fallback para Pix.
- Se nao confirmar, documente: "NuPay direto nao foi implementado por falta de suporte/documentacao oficial confirmada; Pix funciona para pagamento pelo Nubank."

Arquitetura de metodos de pagamento:

- Nao codar `if metodo === pix` espalhado pelo app.
- Criar um catalogo/configuracao de metodos com codigo, label, provider, disponibilidade, requisitos de dados e componente/renderizacao.
- Criar adaptadores por provider/metodo, por exemplo:
  - `mercado_pago_payment_brick`
  - `mercado_pago_card_payment_brick`
  - `mercado_pago_pix`
  - `mercado_pago_wallet`
  - `mercado_pago_google_pay` somente se confirmado oficialmente para checkout online
  - `mercado_pago_apple_pay` somente se confirmado oficialmente para checkout online
  - `nupay` reservado para fase futura
- O frontend deve renderizar apenas metodos marcados como `enabled` e `available` para o ambiente/dispositivo.
- O backend deve aceitar apenas `payment_method_code` presente na configuracao permitida e ativa.
- O banco deve armazenar tanto o metodo interno de caixa quanto os detalhes do provider (`provider_payment_method_id`, `provider_payment_type_id`, `wallet_type`, `provider_status_detail`) para permitir conciliacao e novos metodos sem migration a cada variacao.

---

## Arquitetura alvo

Preferir Supabase Edge Functions para operacoes sensiveis, alinhado ao projeto existente.

Criar/alterar:

1. Frontend publico:
   - Refatorar `src/app/pedir/page.tsx` para usar cardapio real via `menuApi.getMenuData()`.
   - Reaproveitar padroes de `src/app/app/novo-pedido/page.tsx`, mas simplificar para cliente final.
   - Criar componentes publicos se necessario, por exemplo:
     - `src/components/public-order/PublicMenu.tsx`
     - `src/components/public-order/PublicProductCustomizer.tsx`
     - `src/components/public-order/PublicCheckout.tsx`
     - `src/components/public-order/PaymentMethodSelector.tsx`
     - `src/components/public-order/MercadoPagoPaymentBrick.tsx`
     - `src/components/public-order/PixPaymentPanel.tsx` somente se Pix precisar de exibicao propria fora do Brick.
   - Evitar depender de autenticacao.
   - Manter mobile-first e excelente em celular.

2. API cliente:
   - Adicionar metodos em `src/lib/api/pdv-api.ts` para:
     - criar pedido publico com pagamento
     - iniciar pagamento Mercado Pago
     - consultar status publico

3. Edge Functions:
   - Atualizar ou substituir `create-public-order` para criar pedido publico com estado correto.
   - Criar `create-provider-payment`/`create-mercado-pago-payment` ou integrar essa responsabilidade em uma funcao transacional bem delimitada.
   - Criar `mercado-pago-webhook` para receber notificacoes de pagamento.
   - Criar `get-public-order-payment-status` se necessario.

4. Banco/migrations:
   - Criar migration para armazenar identificadores do Mercado Pago/metodo escolhido sem quebrar o historico atual.
   - Opcoes aceitaveis:
     - adicionar campos em `payments`: `provider`, `provider_payment_id`, `provider_status`, `provider_status_detail`, `external_reference`, `idempotency_key`, `provider_payment_method_id`, `provider_payment_type_id`, `wallet_type`, `raw_provider_payload`.
     - ou criar tabela dedicada `payment_transactions`.
   - Recomendo tabela dedicada para separar tentativas/transacoes do historico financeiro consolidado.
   - Nao depender apenas do enum `payment_method` atual para todos os metodos futuros. Ele pode continuar como resumo operacional (`PIX`, `CREDIT_CARD`, `DEBIT_CARD`, etc.), mas a transacao precisa armazenar codigos livres/controlados por tabela para Google Pay, Apple Pay, Conta Mercado Pago, boleto, NuPay e futuros metodos.

Tabela opcional recomendada para configuracao:

```sql
CREATE TABLE payment_method_configs (
  code TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  internal_payment_method payment_method,
  enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  requires_email BOOLEAN NOT NULL DEFAULT false,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  requires_device_support BOOLEAN NOT NULL DEFAULT false,
  provider_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Tabela sugerida:

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('MERCADO_PAGO', 'NUPAY', 'OTHER')),
  provider_payment_id TEXT UNIQUE,
  external_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  internal_payment_method payment_method,
  payment_method_code TEXT NOT NULL,
  provider_payment_method_id TEXT,
  provider_payment_type_id TEXT,
  wallet_type TEXT,
  provider_status TEXT NOT NULL,
  provider_status_detail TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  expires_at TIMESTAMPTZ,
  raw_provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Habilitar RLS e permitir leitura publica apenas por Edge Function, nao diretamente pelo anon client, a menos que a policy valide `public_token` de forma robusta. O default mais seguro e manter acesso por Edge Function.

---

## Fluxo backend seguro

### Criacao do pedido publico

Payload do cliente deve conter apenas intencoes:

- `items[].product_id`
- `items[].quantity`
- `items[].removed_ingredient_ids`
- `items[].addons[].addon_id`
- `items[].addons[].quantity`
- `items[].notes`
- `customer_name`
- `customer_phone`
- `customer_email` se o Mercado Pago exigir ou melhorar antifraude
- `order_type`
- `notes`

O backend deve:

- Validar metodo HTTP.
- Validar `Content-Type`.
- Aplicar CORS restrito por ambiente, nao `*` em producao.
- Validar tamanho do payload.
- Validar schema dos dados.
- Sanitizar strings e limitar comprimento.
- Recalcular todos os precos a partir do banco.
- Verificar `active = true` para categorias/produtos/addons/ingredientes.
- Verificar vinculo produto-adicional e produto-ingrediente.
- Recalcular taxa de embalagem a partir de `settings`.
- Nunca confiar em total vindo do cliente.
- Criar pedido com `source = QR_CODE`, `payment_status = PENDING`, `payment_method = PENDING`, status inicial definido pela regra de negocio.
- Gerar/usar `public_token`.
- Criar uma chave de idempotencia por tentativa de pagamento.
- Validar `payment_method_code` contra `payment_method_configs` ou configuracao equivalente.
- Chamar Mercado Pago/provider com Access Token somente no servidor quando o metodo exigir backend.
- Salvar a transacao Mercado Pago/provider.
- Retornar ao cliente somente dados necessarios: `daily_number`, `public_token`, `order_id` se inevitavel, total oficial, status, metodo selecionado e dados seguros para renderizar o Brick/carteira/Pix.

### Criacao do pagamento provider/Mercado Pago

Requisitos:

- Usar `MERCADO_PAGO_ACCESS_TOKEN` somente em Edge Function.
- Usar `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` ou equivalente somente quando SDK client-side exigir public key.
- Enviar `X-Idempotency-Key`.
- Usar `external_reference` com identificador interno nao adivinhavel, preferencialmente `order.id` ou `payment_transactions.id`.
- Garantir que retries nao criem cobrancas duplicadas.
- Salvar `provider_payment_id`.
- Salvar `provider_status`, `status_detail`, metodo provider, tipo provider, carteira digital quando houver, QR Code/copia-e-cola/URL/expiracao quando o metodo retornar esses dados.
- Tratar timeouts do Mercado Pago sem duplicar pagamento.
- Para cartoes, receber no backend apenas token/dados gerados pelo Brick oficial, nunca PAN/CVV/validade crus.
- Para Google Pay/Apple Pay, seguir somente o fluxo oficial suportado pelo Mercado Pago nesta fase. Se o Mercado Pago nao suportar checkout online, nao processar por provider direto ainda; deixar preparado para fase futura.

### Webhook Mercado Pago

Requisitos:

- Endpoint publico, mas seguro.
- Validar assinatura/notificacao conforme documentacao atual do Mercado Pago consultada via MCP.
- Nao confiar no corpo do webhook sozinho.
- Ao receber notificacao, buscar o pagamento na API Mercado Pago pelo ID usando o Access Token.
- Comparar:
  - `external_reference`
  - valor pago versus `orders.total_amount`
  - moeda/ambiente quando aplicavel
  - status do provider
- Ser idempotente:
  - se pedido ja esta `PAID`, responder sucesso sem duplicar `payments`.
  - `provider_payment_id` unico.
  - evitar dupla insercao em `payments`.
- Em `approved`:
  - atualizar `orders.payment_status = PAID`
  - atualizar `orders.payment_method` com o resumo operacional correto: `PIX`, `CREDIT_CARD`, `DEBIT_CARD` ou outro valor adicionado por migration quando necessario.
  - manter o detalhe fino em `payment_transactions.payment_method_code`, `provider_payment_method_id`, `provider_payment_type_id` e `wallet_type`.
  - preencher `paid_at`
  - inserir registro em `payments` se ainda nao existir
  - inserir `audit_logs` com acao `PAYMENT_PROVIDER_APPROVED`
  - se a regra mandar ir para cozinha, chamar/refatorar logica compartilhada para criar `printer_jobs` exatamente uma vez.
- Em `pending`:
  - manter pendente.
- Em `rejected`, `cancelled`, `refunded`, `charged_back`:
  - mapear com cuidado para os enums existentes.
  - nao cancelar pedido automaticamente sem regra explicita, exceto expiracao de Pix se assim definido.

---

## UX obrigatoria

A tela publica deve parecer feita para cliente final, nao para operador interno.

Principios:

- Mobile-first.
- Sem tela de marketing; a primeira tela e o cardapio real.
- Produto, preco, descricao e disponibilidade claros.
- Carrinho fixo no rodape quando houver itens.
- Edicao de item facil.
- Feedback imediato ao adicionar/remover.
- Estados de loading, erro, vazio e sucesso.
- Nao quebrar layout em 360px de largura.
- Inputs com fonte minima de 16px em mobile.
- Touch targets de pelo menos 44px.
- Linguagem simples:
  - "Monte seu pedido"
  - "Para comer aqui" / "Para levar"
  - "Escolher pagamento"
  - "Cartao de credito"
  - "Cartao de debito"
  - "Google Pay"
  - "Apple Pay"
  - "Pix"
  - "Copiar codigo Pix" quando Pix for usado
  - "Aguardando pagamento"
  - "Pagamento aprovado"
- Na etapa de pagamento:
  - mostrar seletor de metodos configuraveis, com disponibilidade por dispositivo.
  - ocultar Apple Pay quando nao houver suporte do navegador/dispositivo ou dominio validado.
  - ocultar Google Pay quando nao houver suporte/merchant configurado.
  - renderizar Payment Brick/Card Payment Brick com minima customizacao possivel.
  - para Pix, mostrar QR Code grande e copia-e-cola se nao estiver usando Status Screen Brick.
- Apos iniciar pagamento:
  - mostrar total oficial
  - mostrar UI especifica do metodo escolhido
  - QR Code grande e legivel quando for Pix
  - botao copiar Pix copia-e-cola quando for Pix
  - botao abrir comprovante/link Mercado Pago se existir
  - expiracao quando o metodo tiver vencimento
  - polling leve ou realtime para status
  - instruir o cliente a nao fechar a tela ate confirmar, sem tom alarmista.

Nao exibir:

- IDs internos longos.
- Stack traces.
- Erros crus do Mercado Pago.
- Service role, access token, public token em logs do browser.

---

## Seguranca obrigatoria

Implemente estes controles:

- Server-side validation completa.
- Idempotencia em pedido e pagamento.
- CORS restrito em producao.
- Rate limiting ou protecao equivalente para Edge Functions publicas.
- Logs sem PII sensivel.
- Auditoria em `audit_logs`.
- Nao armazenar dados de cartao no banco.
- Nao coletar dados de cartao manualmente; usar SDK/Brick oficial quando cartao for implementado.
- Secrets somente em variaveis de ambiente Supabase/Vercel.
- RLS habilitado em novas tabelas.
- Public token nunca deve conceder acesso amplo; apenas status/resumo necessario.
- Mensagens publicas genericas para falhas de seguranca.
- Webhook idempotente e validado por consulta server-to-server ao Mercado Pago.
- Validar que valor aprovado no provider e igual ao total oficial do pedido.
- Nao confirmar pagamento apenas por callback do frontend.

---

## Criterios de aceitacao

- [ ] `/pedir` carrega cardapio real ativo.
- [ ] Cliente consegue adicionar/remover/editar produtos com adicionais e ingredientes removidos.
- [ ] Backend recalcula total oficial e rejeita payload adulterado.
- [ ] Pedido publico nasce pendente de pagamento.
- [ ] Seletor de pagamento suporta metodos configuraveis e extensao futura.
- [ ] Cartao de credito funciona via Brick oficial, sem coleta manual de dados sensiveis.
- [ ] Cartao de debito funciona via Brick oficial quando disponivel para a conta/app Brasil.
- [ ] Pix Mercado Pago e criado via backend/Brick com idempotencia.
- [ ] QR Code Pix e copia-e-cola aparecem na tela quando Pix for escolhido.
- [ ] Google Pay e Apple Pay sao implementados somente com suporte oficial confirmado; se nao houver suporte direto no Mercado Pago, ficam modelados como adaptadores futuros e documentados como pendentes.
- [ ] Webhook confirma pagamento aprovado sem duplicar registros.
- [ ] Pedido pago aparece corretamente em `/app/pedidos`.
- [ ] Painel interno destaca pedidos com pagamento pendente.
- [ ] `payments` ou `payment_transactions` registra provider, IDs externos e status.
- [ ] Reprocessar webhook nao duplica `payments`, `audit_logs` criticos ou `printer_jobs`.
- [ ] Fluxo de Pix expirado/recusado e tratado.
- [ ] Pagamento recusado de cartao/carteira volta para escolha de metodo sem duplicar pedido.
- [ ] NuPay nao e implementado sem confirmacao oficial via MCP.
- [ ] Sem secrets no frontend ou no git.
- [ ] `npm run lint` passa.
- [ ] `npm run build` passa.
- [ ] Teste manual documentado em sandbox Mercado Pago.
- [ ] `quality_checklist` do MCP Mercado Pago foi consultado antes da entrega.

---

## Testes esperados

Adicionar cobertura proporcional ao projeto. Se nao houver framework de testes configurado, documentar cenarios manuais e criar pelo menos scripts/verificacoes de fluxo quando possivel.

Cenarios obrigatorios:

- Carrinho vazio nao cria pedido.
- Produto inativo nao pode ser comprado.
- Addon nao vinculado ao produto e rejeitado.
- Total adulterado no cliente nao afeta total oficial.
- Duplo clique em "Pagar" nao cria cobranca duplicada.
- Retry da Edge Function usa idempotencia.
- Webhook repetido nao duplica pagamento.
- Webhook com valor divergente nao marca pedido como pago.
- Cartao recusado nao marca pedido como pago.
- Token de cartao/carteira nunca e salvo em logs.
- Apple Pay/Google Pay so aparecem em ambiente/dispositivo suportado.
- Pedido pago aparece como `PAID`.
- Pedido pendente permanece `PENDING`.
- Pix expirado atualiza status conforme regra definida.

---

## Entregaveis

Ao finalizar, entregar:

1. Resumo do que foi implementado.
2. Lista dos arquivos alterados.
3. Variaveis de ambiente necessarias.
4. Como configurar a aplicacao Mercado Pago no DevPanel.
5. URL de webhook sandbox/producao a cadastrar pelo MCP.
6. Resultado de `npm run lint` e `npm run build`.
7. Checklist de testes manuais feitos.
8. Limites conhecidos, especialmente sobre Google Pay, Apple Pay, NuPay/Nubank e disponibilidade real por conta/app Mercado Pago.

---

## Proibicoes

- Nao usar Access Token do Mercado Pago no cliente.
- Nao confiar em preco/total vindo do navegador.
- Nao aceitar webhook sem validacao server-side.
- Nao criar pagamentos duplicados em retries.
- Nao salvar dados sensiveis de cartao.
- Nao expor stack trace para o cliente.
- Nao trocar o schema sem migration.
- Nao desabilitar RLS para "facilitar".
- Nao quebrar o fluxo interno existente de `/app/novo-pedido`, `/app/pedidos` e caixa.
- Nao assumir suporte a Google Pay ou Apple Pay no Mercado Pago Brasil sem confirmacao oficial atual.
- Nao implementar Google Pay/Apple Pay com APIs nao oficiais, dominio nao validado, ambiente sem HTTPS ou fallback que colete dados de cartao manualmente.
- Nao assumir que NuPay existe no Mercado Pago sem confirmacao oficial atual.

---

## Primeiro passo recomendado

Antes de codar, produza um plano tecnico curto contendo:

1. Decisao sobre estados do pedido antes/depois do pagamento.
2. Desenho da tabela/campos de transacao Mercado Pago.
3. Lista de Edge Functions novas/alteradas.
4. Contrato dos payloads.
5. Plano de webhook e idempotencia.
6. Como sera feita a configuracao MCP Mercado Pago, considerando que hoje nao ha aplicacao listada.

Depois implemente em incrementos pequenos, validando build/lint e o fluxo real em sandbox.
