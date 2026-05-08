# Checklist de Implantação (Deployment Checklist) - MVP

Este guia contém os passos necessários para subir o MVP do PDV Marcos Krep's em um novo ambiente Supabase.

## 1. Banco de Dados e Infraestrutura
- [ ] Criar novo projeto no Supabase Cloud.
- [ ] Aplicar todas as migrations na ordem correta:
  - `20260502232400_init_pdv_schema.sql`
  - `20260503120000_add_whatsapp_logs.sql`
  - `20260507150000_add_product_addons_constraint.sql`
  - `20260508100000_fix_daily_number_trigger.sql`
- [ ] Executar o `seed.sql` para popular o cardápio real.
- [ ] Configurar os segredos (Secrets) nas Edge Functions:
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_VERIFY_TOKEN`

## 2. Edge Functions
- [ ] Fazer deploy de todas as funções:
  - `add-items-to-order`
  - `cash-report`
  - `confirm-order`
  - `create-attendant-order`
  - `create-public-order`
  - `get-public-order-status`
  - `manage-users`
  - `mark-payment`
  - `reprint-order`
  - `update-order-status`
- [ ] Testar uma chamada `OPTIONS` em cada função para garantir que o CORS está OK.

## 3. Frontend (Vercel/Netlify)
- [ ] Configurar variáveis de ambiente:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Rodar `npm run build` para garantir que não há erros de tipagem ou lint.
- [ ] Validar o redirecionamento do Middleware (se houver) ou do fluxo de login.

## 4. Hardware e Integrações Locais
- [ ] Configurar o `print-worker` na máquina local do PDV.
- [ ] Garantir que a impressora térmica está no IP correto (porta 9100).
- [ ] Configurar o Webhook do WhatsApp no Meta for Developers apontando para a URL da Edge Function correspondente.

## 5. Testes Finais de Homologação
- [ ] Criar o primeiro usuário `ADMIN` manualmente via SQL ou Dashboard.
- [ ] Logar e criar um `ATTENDANT`.
- [ ] Realizar a bateria de testes completa definida em `docs/mvp-operational-test.md`.
