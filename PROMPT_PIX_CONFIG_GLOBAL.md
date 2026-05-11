# Prompt Mestre - Pix Copia e Cola, Webhook e Configuracoes Globais

## Contexto

Projeto Marcos Krep's em Next.js + Supabase + Mercado Pago. A tela publica de pedido fica em `/pedir`, cria pedidos pendentes de pagamento e deve permitir Pix copia e cola com validacao por webhook. Configuracoes de horario de atendimento, WhatsApp e impressora sao globais: existe uma unica linha por chave na tabela `settings`, visivel para todos conforme permissao, e o admin deve sempre editar o valor real usado pelo sistema.

Sempre que o MCP Server do Mercado Pago estiver disponivel, use-o para consultar documentacao oficial, configurar/validar webhooks e conferir requisitos da API. Se o MCP nao estiver disponivel na sessao, use apenas documentacao oficial do Mercado Pago Developers.

## Objetivo

Implementar e validar um fluxo confiavel de pedido pelo app:

- Criar pedido com `orders.source = "APP"`.
- Criar pagamento Pix via Mercado Pago no backend, sem depender do Payment Brick.
- Exibir QR Code, Pix copia e cola, botao copiar, contador de espera e polling de status.
- Receber webhook `payment` do Mercado Pago, validar assinatura, buscar pagamento na API oficial e consolidar o pedido como pago.
- Garantir que horario, impressora e WhatsApp sejam configuracoes globais, nao por usuario.
- Garantir que alterar horario no admin afete imediatamente a tela publica e a criacao do pedido.

## Regras Tecnicas

1. Nunca expor access token, webhook secret ou service role no frontend.
2. Ler configuracoes publicas por Edge Function com service role e retorno sanitizado.
3. No backend, tratar valores JSONB de `settings` como boolean, number ou string.
4. Validar horario em `America/Sao_Paulo` no frontend publico e obrigatoriamente no backend.
5. Nao confiar no total enviado pelo cliente: recalcular itens, adicionais e taxa no backend.
6. Para Pix, usar `payment_method_id = "pix"` na API `/v1/payments` do Mercado Pago.
7. Salvar transacao em `payment_transactions` com `external_reference`, `idempotency_key`, QR Code, copia e cola, status e expiracao.
8. Reaproveitar Pix pendente recente do mesmo pedido para evitar cobrancas duplicadas.
9. Webhook deve validar `x-signature` usando `data.id` da query quando presente, `x-request-id` e `ts`.
10. Pedido so vira pago quando o Mercado Pago retornar status `approved` e o valor aprovado bater com `orders.total_amount`.

## Validacao Obrigatoria

- `npx tsc --noEmit`
- `npx eslint` nos arquivos alterados
- `npm run build`
- Deploy das Edge Functions alteradas
- Aplicacao das migrations no Supabase
- Teste manual de `/pedir` com pedidos abertos e fechados
- Teste de Pix real ou sandbox com webhook confirmando `payment_status = PAID`

## Criterio de Aceite

O cliente consegue criar pedido pelo app, gerar Pix copia e cola, pagar, e o sistema atualiza o pedido automaticamente via webhook. O admin altera horario/WhatsApp/impressora uma vez, e todos os usuarios e a tela publica passam a ver o mesmo valor global.
