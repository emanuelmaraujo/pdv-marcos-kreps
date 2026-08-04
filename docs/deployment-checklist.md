# Checklist de Implantação (Deployment Checklist) - MVP

Este guia contém os passos necessários para subir o MVP do PDV Marcos Krep's em um novo ambiente Supabase.

## 1. Banco de Dados e Infraestrutura
- [ ] Criar novo projeto no Supabase Cloud.
- [ ] Aplicar todas as migrations: `supabase db push` aplica tudo que estiver em `supabase/migrations/` em ordem cronológica automaticamente — não é necessário (nem recomendado) listar arquivos manualmente aqui, essa lista desatualiza a cada nova migration.
- [ ] Executar o `seed.sql` para popular o cardápio real.
- [ ] Configurar os segredos (Secrets) nas Edge Functions (ver `.github/workflows/deploy-functions.yml` e `docs/whatsapp-cloud-setup.md` para a lista completa; no mínimo):
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_VERIFY_TOKEN`

## 2. Edge Functions
- [ ] Fazer deploy de todas as funções listadas em [`.github/workflows/deploy-functions.yml`](../.github/workflows/deploy-functions.yml) — esse workflow é a fonte da verdade da lista atual (é o que já roda em produção a cada push), então não duplicamos a lista aqui.
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
