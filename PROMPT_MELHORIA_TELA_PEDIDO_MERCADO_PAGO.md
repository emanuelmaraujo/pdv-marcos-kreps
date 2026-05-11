# Prompt mestre: vitrine publica, checkout e Mercado Pago

Voce e um agente senior trabalhando no projeto `D:\Dev\pdv`, um PDV Next.js 16 + Supabase do Marcos Krep's. Siga estritamente `AGENTS.md`: esta versao do Next.js tem mudancas importantes, entao leia a documentacao em `node_modules/next/dist/docs/` antes de alterar codigo.

## Objetivo

Evoluir a pagina publica `/pedir` para parecer uma experiencia real de compra de restaurante, nao uma tela interna de PDV. O cliente deve entender rapidamente o que vem em cada krep, filtrar por tipo de recheio/base, montar o pedido com confianca e pagar pelo Mercado Pago com seguranca.

## Contexto do negocio

- O cardapio do Marcos Krep's usa nomes tematicos de carros, mas para o cliente apenas o numero/nome interno nao explica o recheio.
- Kreps salgados sao organizados principalmente por proteina: presunto, calabresa, frango, atum, peito de peru, carne de sol, vegetariano e especial.
- Kreps doces devem ser filtraveis por base/sabor: banana, morango, nutella, chocolate, doce de leite, goiabada etc.
- Bebidas devem ter filtros como geladas, sucos, polpas, cremes/acai e soda.
- A composicao real ja existe no banco por `product_ingredients`, entao a UI deve preferir dados estruturados em vez de texto duplicado.
- O estilo visual deve ser tematico de krep: quente, artesanal, apetitoso, com tons de chapa/massa/recheio, sem parecer landing page generica.

## UX esperada

1. Primeiro impacto:
   - Abrir direto no cardapio funcional.
   - Mostrar marca Marcos Krep's e uma chamada curta orientada a pedido.
   - Nao exigir login.
   - Evitar textos longos de explicacao.

2. Cards de produto:
   - Mostrar o numero como apoio, nao como informacao principal.
   - Dar destaque ao nome do krep e ao tipo principal de recheio.
   - Mostrar composicao: ingredientes vindos de `product_ingredients`.
   - Dar enfase visual para proteina/base em chips.
   - Preco deve ser claro e sempre visivel.

3. Filtros:
   - Manter filtros principais por categoria.
   - Em `Kreps Salgados`, adicionar filtros por proteina.
   - Em `Kreps Doces`, adicionar filtros por base/sabor.
   - Em `Bebidas / Combustiveis`, adicionar filtros por tipo de bebida.
   - O filtro deve ser derivado dos dados do produto sempre que possivel.

4. Personalizacao:
   - Ao abrir um produto, mostrar primeiro a composicao do krep.
   - Permitir remover ingredientes.
   - Permitir adicionais pagos.
   - Deixar quantidade e subtotal sempre claros.

5. Checkout:
   - Antes de abrir Mercado Pago, mostrar resumo do pedido, dados do cliente e estado "pendente ate pagamento aprovado".
   - Criar pedido sempre como `AGUARDANDO_PAGAMENTO` e `payment_status = PENDING`.
   - Nunca marcar como pago antes da confirmacao real do provedor.

6. Tela de pagamento:
   - Usar Mercado Pago Payment Brick para Checkout Transparente.
   - Nao customizar demais o Brick, pois a documentacao do Mercado Pago recomenda preservar a experiencia padrao para conversao e seguranca.
   - Customizar a area ao redor do Brick: resumo, seguranca, valor, numero do pedido e meios aceitos.
   - Suportar cartao de credito, debito, Pix/bank transfer e meios disponiveis pela conta Mercado Pago.
   - Google Pay e Apple Pay so devem ser habilitados se a documentacao/conta Mercado Pago confirmar suporte para checkout online no Brasil.
   - NuPay deve ficar modelado como metodo futuro, sem habilitar ate haver integracao oficial.

## Seguranca obrigatoria

- Nunca confiar em preco enviado pelo navegador.
- Recalcular produtos, adicionais, taxa de embalagem e total no backend.
- Usar `public_token` para acesso publico do pedido.
- Usar `X-Idempotency-Key` em chamadas de pagamento.
- Salvar transacoes em `payment_transactions`.
- Usar webhook Mercado Pago para reconciliar status.
- Validar valor recebido antes de marcar pedido como pago.
- Nao expor `MERCADO_PAGO_ACCESS_TOKEN` no frontend.
- Frontend usa apenas `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`.
- `MERCADO_PAGO_ACCESS_TOKEN` fica somente em Edge Function.
- CORS deve ser restrito por `PUBLIC_CHECKOUT_ALLOWED_ORIGINS` em producao.

## Integração Mercado Pago

Use o MCP do Mercado Pago sempre que possivel para:

1. Listar aplicacoes disponiveis.
2. Confirmar documentacao atual de Payment Brick/Checkout Transparente para Brasil.
3. Configurar webhook com topico `payment` quando existir uma aplicacao Mercado Pago.
4. Executar checklist de qualidade/homologacao.

Se `application_list` retornar zero aplicacoes, nao invente configuracao. Informe que e necessario criar uma aplicacao no DevPanel do Mercado Pago e continue deixando o codigo preparado.

## Criterios de aceite

- `/pedir` abre sem login.
- Cardapio real carrega.
- Cliente entende os ingredientes de cada krep sem abrir PDF.
- Filtros funcionam por categoria e por tipo.
- Produto pode ser personalizado e adicionado ao carrinho.
- Checkout valida e-mail antes do pagamento.
- Build passa com `npm run build`.
- TypeScript passa com `npx tsc --noEmit`.
- ESLint focado nos arquivos alterados passa.
- A integracao Mercado Pago nao deve criar cobranca duplicada em retry.
