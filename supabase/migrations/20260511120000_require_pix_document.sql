-- Mercado Pago Pix via Checkout Transparente requires payer email and document data.
-- Keep CPF collection limited to the payment attempt; it is not stored on orders/customers.

UPDATE payment_method_configs
SET
  enabled = TRUE,
  requires_email = TRUE,
  requires_document = TRUE,
  availability_reason = 'Pix processado pelo Mercado Pago. Exige e-mail e CPF do pagador para gerar QR Code/copia e cola.',
  provider_config = provider_config || '{"providerPaymentMethodId": "pix", "requiresIdentification": true}'::jsonb
WHERE code = 'PIX';
