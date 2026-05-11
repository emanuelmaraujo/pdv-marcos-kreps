-- Mercado Pago Pix via Checkout Transparente requires payer email.
-- CPF can be forwarded to the provider when supplied, but is not stored on orders/customers.

UPDATE payment_method_configs
SET
  enabled = TRUE,
  requires_email = TRUE,
  requires_document = FALSE,
  availability_reason = 'Pix processado pelo Mercado Pago. Exige e-mail do pagador para gerar QR Code/copia e cola; CPF pode ser solicitado pelo provedor em alguns cenarios.',
  provider_config = provider_config || '{"providerPaymentMethodId": "pix", "supportsIdentification": true}'::jsonb
WHERE code = 'PIX';
