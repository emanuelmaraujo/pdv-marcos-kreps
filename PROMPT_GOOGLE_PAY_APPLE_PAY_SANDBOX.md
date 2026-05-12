# Prompt: Google Pay e Apple Pay via Mercado Pago — Sandbox

---

## Papel

Voce e um engenheiro senior full-stack trabalhando no **PDV Marcos Krep's**, um PWA de ponto de venda para creperia. Sua tarefa e ativar e implementar Google Pay e Apple Pay como metodos de pagamento via Mercado Pago, **exclusivamente em ambiente sandbox**, preservando toda a seguranca e consistencia financeira ja implementada no projeto.

Antes de alterar qualquer arquivo Next.js, leia obrigatoriamente:

- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
- `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`

Pontos criticos do Next.js 16 que se aplicam aqui:

- `params` e `searchParams` sao **async** em Server Components, layouts e Route Handlers.
- Route Handlers em `/app` sao superficie de ataque publica; trate-os como tal.
- Nao exponha segredos, stack traces ou dados internos para o cliente.

---

## Contexto do projeto

Stack:

- **Next.js 16.2.4** — App Router
- **React 19.2.4**
- **TypeScript + Tailwind CSS v4**
- **Supabase** — banco, auth, RLS, Edge Functions (Deno)
- **Zustand** — carrinho em `src/features/cart/useCart.ts`
- PWA mobile-first

Arquivos relevantes existentes:

| Caminho | Descricao |
|---|---|
| `src/app/pedir/page.tsx` | Vitrine publica + checkout do cliente |
| `src/app/pedido/[dailyNumber]/page.tsx` | Acompanhamento e pagamento publico |
| `src/types/pdv.ts` | Tipos alinhados ao schema Supabase |
| `src/lib/api/pdv-api.ts` | Wrapper para Edge Functions |
| `supabase/functions/create-mercado-pago-payment/index.ts` | Cria pagamentos no Mercado Pago (PIX, cartao) |
| `supabase/functions/mercado-pago-webhook/index.ts` | Webhook de confirmacao do Mercado Pago |
| `supabase/migrations/20260511000000_public_checkout_mercado_pago.sql` | Schema de `payment_method_configs` e `payment_transactions` |

### Estado atual dos metodos de carteira digital

A tabela `payment_method_configs` ja tem as entradas abaixo, mas **ambas estao desabilitadas**:

```
code          | enabled | requires_device_support | provider_config
--------------+---------+------------------------+----------------------------
GOOGLE_PAY    | false   | true                   | {"wallet": "google_pay"}
APPLE_PAY     | false   | true                   | {"wallet": "apple_pay"}
```

A tabela `payment_transactions` ja possui a coluna `wallet_type TEXT` para registrar o tipo de carteira.

A Edge Function `create-mercado-pago-payment` ainda **nao mapeia** os codigos `GOOGLE_PAY` ou `APPLE_PAY` para a API do Mercado Pago.

---

## Objetivo

Habilitar Google Pay e Apple Pay em sandbox de ponta a ponta:

1. **Migration** ativa os metodos somente em sandbox, com metadados corretos.
2. **Edge Function** mapeia os codigos `GOOGLE_PAY` e `APPLE_PAY` para os parametros corretos da API de pagamentos do Mercado Pago, salva `wallet_type` e trata respostas.
3. **Frontend** detecta suporte do dispositivo/navegador antes de exibir cada opcao e renderiza o fluxo correto (Payment Brick com wallet habilitado ou Wallet Brick, conforme o metodo recomendado pelo MCP na data de implementacao).
4. **Apple Pay** tem o endpoint de verificacao de dominio implementado para o dominio sandbox.
5. **Webhook** ja e idempotente; confirmar que `wallet_type` e preenchido corretamente ao processar aprovacoes de carteira.
6. **Testes manuais** documentados no sandbox do Mercado Pago.

---

## Uso obrigatorio do MCP Mercado Pago

Antes de escrever qualquer codigo de integracao, consulte o MCP:

1. **`application_list`** — confirmar que ha uma aplicacao configurada.
2. **`payment_methods`** ou equivalente — verificar se `google_pay` e `apple_pay` estao disponiveis na conta/app para o Brasil em sandbox.
3. **Documentacao do Payment Brick** — confirmar o parametro que ativa wallets digitais (ex.: `customization.paymentMethods.wallets`) e a versao atual do SDK MercadoPago.js.
4. **Documentacao do Apple Pay** — confirmar o fluxo de verificacao de dominio exigido pelo Mercado Pago (arquivo `apple-developer-merchantid-domain-association`).
5. **Documentacao do Google Pay** — confirmar se requer `merchantId` separado ou se e gerenciado pela conta Mercado Pago.
6. **`quality_checklist`** — executar antes da entrega final.

Se `application_list` retornar zero aplicacoes, **nao invente credenciais**. Informe o que e necessario criar no DevPanel e continue deixando o codigo preparado.

---

## O que o Mercado Pago suporta (base para implementacao)

> Confirme via MCP antes de implementar. O descrito abaixo e o comportamento esperado com base na documentacao atual, mas o MCP e a fonte de verdade.

### Google Pay

- Disponivel via Payment Brick quando `customization.paymentMethods.wallets` inclui `'googlePay'` (ou similar conforme documentacao atual).
- O Brick renderiza o botao Google Pay automaticamente quando:
  - o navegador e Chrome (desktop ou Android) ou outro que suporte a API `PaymentRequest`/`google.payments.api`
  - o usuario tem Google Pay configurado
- O Brick gera um token de pagamento opaco; o backend recebe esse token e chama a API de pagamentos do Mercado Pago exatamente como faz para cartao de credito.
- A resposta da API inclui `payment_method_id` identificando o metodo (ex.: `visa`, `master`) e `payment_type_id` como `credit_card` ou `debit_card`, mais `additional_info.authentication_code` ou campo de wallet quando disponivel.
- `wallet_type` na `payment_transactions` deve ser `'google_pay'`.

### Apple Pay

- Disponivel via Payment Brick quando `customization.paymentMethods.wallets` inclui `'applePay'` (ou similar).
- O Brick renderiza o botao Apple Pay automaticamente quando:
  - o navegador e Safari em iOS 16+ ou macOS 13+ (ou versao suportada conforme Apple Pay JS API)
  - o usuario tem Apple Pay configurado
  - o dominio esta **verificado** junto ao Mercado Pago (arquivo de associacao de dominio servido via HTTPS)
- O fluxo de token e identico ao Google Pay: Brick -> token -> backend -> API Mercado Pago.
- `wallet_type` na `payment_transactions` deve ser `'apple_pay'`.
- **Obrigatorio em sandbox**: configurar o endpoint de verificacao de dominio mesmo que o dominio seja `localhost` com HTTPS via proxy ou um dominio sandbox declarado no DevPanel.

---

## Tarefas de implementacao

### 1. Consulta MCP

Antes de qualquer codigo, executar os passos do MCP listados acima e documentar as descobertas em comentario no topo da migration e da Edge Function alterada.

### 2. Migration SQL

Criar arquivo `supabase/migrations/20260512000000_enable_wallet_payments_sandbox.sql`.

Conteudo obrigatorio:

```sql
-- Habilita Google Pay e Apple Pay somente em sandbox.
-- Producao requer validacao adicional de dominio e configuracao de conta.
-- Confirmar suporte via MCP antes de habilitar em producao.

UPDATE payment_method_configs
SET
  enabled = TRUE,
  availability_reason = 'Habilitado em sandbox. Requer validacao de dominio e conta para producao.',
  provider_config = provider_config || '{"sandbox_only": true}'::jsonb,
  updated_at = NOW()
WHERE code IN ('GOOGLE_PAY', 'APPLE_PAY');
```

Adicionar `requires_email = TRUE` e `requires_document = FALSE` se os valores atuais estiverem incorretos para o fluxo de wallet (confirmar via MCP o que o Mercado Pago exige para wallets).

Se o MCP confirmar que o Mercado Pago nao suporta Google Pay ou Apple Pay para checkout online no Brasil, **nao habilitar**. Criar a migration com um comentario explicativo e documentar o bloqueio nos entregaveis.

### 3. Edge Function `create-mercado-pago-payment`

Modificar `supabase/functions/create-mercado-pago-payment/index.ts` para suportar os novos codigos.

Regras:

- Identificar o `payment_method_code` recebido: `GOOGLE_PAY` ou `APPLE_PAY`.
- Para ambos, o payload que chega do frontend ja contem um `token` gerado pelo Brick (identico ao fluxo de cartao).
- Mapear para a chamada da API do Mercado Pago:
  - `payment_method_id`: usar o metodo retornado pelo token (ex.: `visa`, `master`) — nao hardcodar.
  - `payment_type_id`: `credit_card` ou conforme retorno do token — nao hardcodar.
  - `wallet`: incluir objeto `{ id: 'GOOGLE_PAY' }` ou `{ id: 'APPLE_PAY' }` quando a API do Mercado Pago exigir (confirmar via MCP).
- Salvar `wallet_type = 'google_pay'` ou `wallet_type = 'apple_pay'` na linha de `payment_transactions`.
- Registrar `provider_payment_method_id` e `provider_payment_type_id` a partir da resposta da API.
- Nao duplicar logica existente de idempotencia, CORS, auditoria e tratamento de erro — reutilizar o que ja existe.
- Nao salvar o token de wallet no banco.

### 4. Webhook `mercado-pago-webhook`

Revisar `supabase/functions/mercado-pago-webhook/index.ts`:

- Confirmar que ao processar um pagamento aprovado via wallet, o campo `wallet_type` da `payment_transactions` e atualizado se ainda nao estiver preenchido.
- Confirmar que `internal_payment_method` fica correto: `CREDIT_CARD` para Google Pay e Apple Pay quando o token for de cartao de credito, ou o valor adequado para debito.
- Nao alterar a logica de idempotencia existente.

### 5. Verificacao de dominio Apple Pay

Criar Route Handler em `src/app/.well-known/apple-developer-merchantid-domain-association/route.ts`.

```typescript
import { NextResponse } from 'next/server';

// Arquivo exigido pelo Apple Pay para validar o dominio.
// O conteudo deve ser obtido no DevPanel do Mercado Pago ou diretamente na Apple.
// Em sandbox, usar o arquivo sandbox fornecido pelo Mercado Pago.
export async function GET() {
  const fileContent = process.env.APPLE_PAY_DOMAIN_ASSOCIATION_FILE ?? '';
  if (!fileContent) {
    return new NextResponse('Not configured', { status: 404 });
  }
  return new NextResponse(fileContent, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

Adicionar `APPLE_PAY_DOMAIN_ASSOCIATION_FILE` como variavel de ambiente.

Se o Mercado Pago nao fornecer esse arquivo para sandbox, documentar nos entregaveis e deixar o endpoint pronto para quando o arquivo for obtido.

### 6. Frontend — deteccao de suporte e exibicao

Em `src/app/pedir/page.tsx` (ou no componente de selecao de metodo de pagamento dentro dele):

#### Deteccao de Google Pay

```typescript
async function isGooglePayAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PaymentRequest) return false;
  try {
    const request = new PaymentRequest(
      [{ supportedMethods: 'https://google.com/pay', data: { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [] } }],
      { total: { label: 'Test', amount: { currency: 'BRL', value: '0' } } }
    );
    return await request.canMakePayment() ?? false;
  } catch {
    return false;
  }
}
```

Ou, se o Payment Brick gerenciar isso internamente, **nao reimplementar** a deteccao manualmente — confiar no Brick e ocultar a opcao de selecao custom caso o Brick ja renderize o botao de forma nativa.

#### Deteccao de Apple Pay

```typescript
function isApplePayAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ApplePaySession' in window &&
    typeof (window as unknown as { ApplePaySession: { canMakePayments: () => boolean } }).ApplePaySession.canMakePayments === 'function' &&
    (window as unknown as { ApplePaySession: { canMakePayments: () => boolean } }).ApplePaySession.canMakePayments()
  );
}
```

#### Regras de exibicao

- Executar as verificacoes apenas no cliente (`useEffect` ou flag `mounted`), nunca no servidor.
- Nao exibir o botao/opcao Google Pay se `isGooglePayAvailable()` retornar `false`.
- Nao exibir o botao/opcao Apple Pay se `isApplePayAvailable()` retornar `false`.
- Exibir mensagem discreta "Google Pay / Apple Pay disponiveis apenas em dispositivos e navegadores suportados" se nenhum dos dois for suportado e o usuario nao tiver outros metodos disponiveis — ou simplesmente nao mostrar as opcoes (preferivel).
- Nao mostrar ambos simultaneamente se o dispositivo suportar apenas um.
- Em sandbox, adicionar `data-testid="google-pay-option"` e `data-testid="apple-pay-option"` para facilitar testes.

#### Fluxo no Payment Brick

Ao inicializar o Payment Brick para Google Pay ou Apple Pay, passar a customizacao correta conforme documentacao MCP:

```typescript
// Exemplo — confirmar parametros reais via MCP antes de usar
const brickSettings = {
  initialization: { amount: totalAmount },
  customization: {
    paymentMethods: {
      wallets: 'all', // ou array especifico: ['googlePay', 'applePay']
      creditCard: 'all',
      debitCard: 'all',
    },
  },
  callbacks: {
    onReady: () => { /* ... */ },
    onSubmit: async ({ formData }: { formData: unknown }) => {
      // formData contem o token gerado pelo Brick
      // Chamar create-mercado-pago-payment com payment_method_code correto
    },
    onError: (error: unknown) => { /* tratar erro */ },
  },
};
```

Se o Brick nao suportar wallets direto, usar o **Wallet Brick** separado conforme documentacao MCP.

### 7. Variaveis de ambiente

Adicionar ao `.env.local` (desenvolvimento) e documentar para producao Supabase/Vercel:

```
# Ja existente:
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-...
MERCADO_PAGO_ACCESS_TOKEN=TEST-...
PUBLIC_CHECKOUT_ALLOWED_ORIGINS=http://localhost:3000

# Novo — Apple Pay:
APPLE_PAY_DOMAIN_ASSOCIATION_FILE=<conteudo do arquivo fornecido pelo Mercado Pago>
```

Nenhuma dessas variaveis deve aparecer em logs do navegador ou ser commitada no git.

---

## Sandbox: configuracao e credenciais de teste

### Google Pay em sandbox

- Usar as credenciais de sandbox do Mercado Pago (`TEST-...`).
- Configurar o ambiente do Brick como `sandbox` via `MercadoPago(publicKey, { locale: 'pt-BR' })`.
- Google Pay no sandbox usa dados de teste fornecidos pela propria API de teste do Google Pay — o Brick abstrai isso automaticamente se configurado corretamente.
- Documentar nos entregaveis qual cartao de teste do Mercado Pago foi usado para simular aprovacao/recusa.

### Apple Pay em sandbox

- Apple Pay requer HTTPS mesmo em sandbox. Em desenvolvimento local, usar:
  - `ngrok` ou `cloudflared` para criar um tunel HTTPS apontando para `localhost:3000`.
  - Ou configurar o Mercado Pago DevPanel com o dominio do tunel.
- O arquivo de verificacao de dominio deve ser servido corretamente pelo endpoint criado na tarefa 5.
- Testar que `/.well-known/apple-developer-merchantid-domain-association` retorna o arquivo com `Content-Type: text/plain` e status 200.
- Usar dispositivo ou simulador iOS/macOS com Apple Pay configurado (cartao de sandbox da Apple Pay Sandbox).

---

## Seguranca obrigatoria

Todos os controles existentes se aplicam. Adicionalmente:

- **Nunca salvar o token de wallet** (Google Pay token, Apple Pay payment token) no banco de dados ou logs.
- **Nao implementar Google Pay ou Apple Pay sem o SDK oficial** do Mercado Pago (MercadoPago.js / Brick). Nao usar APIs nao oficiais.
- **Apple Pay exige HTTPS**; nao permitir HTTP em producao. Em desenvolvimento, documentar o requisito de tunel.
- **Nao habilitar em producao** sem:
  1. Dominio HTTPS verificado junto ao Mercado Pago para Apple Pay.
  2. Conta Mercado Pago com suporte a wallets confirmado.
  3. Testes de aprovacao/recusa documentados em producao.
- **Validar `wallet_type`** no webhook antes de salvar — aceitar apenas `'google_pay'`, `'apple_pay'` ou `null`.
- **CORS** permanece restrito por `PUBLIC_CHECKOUT_ALLOWED_ORIGINS`.
- **Idempotencia** — nao criar cobrancas duplicadas em retry, identico ao fluxo de cartao existente.
- **Auditoria** — registrar `audit_logs` para pagamentos aprovados e recusados via wallet, igual ao fluxo existente.

---

## UX obrigatoria

- Botoes Google Pay e Apple Pay devem usar os **botoes oficiais** das respectivas plataformas (ou o botao renderizado pelo Brick) — nao criar botoes customizados com as marcas.
- Se o Brick renderiza os botoes nativamente, nao duplicar com UI propria.
- Mostrar indicador de carregamento enquanto o Brick inicializa.
- Em caso de recusa, exibir mensagem generica amigavel e permitir que o usuario tente outro metodo, sem duplicar o pedido.
- Manter as regras de UX do projeto: mobile-first, touch targets >= 44px, fonte >= 16px em inputs.

---

## Criterios de aceitacao

- [ ] Migration cria/atualiza `GOOGLE_PAY` e `APPLE_PAY` em `payment_method_configs` com `enabled = TRUE` (se o MCP confirmar suporte).
- [ ] Edge Function `create-mercado-pago-payment` processa tokens de Google Pay e Apple Pay sem erros.
- [ ] `payment_transactions.wallet_type` e preenchido com `'google_pay'` ou `'apple_pay'` apos pagamento aprovado.
- [ ] Frontend exibe Google Pay apenas em navegadores que suportam a API.
- [ ] Frontend exibe Apple Pay apenas em Safari com `ApplePaySession` disponivel.
- [ ] Endpoint `/.well-known/apple-developer-merchantid-domain-association` serve o arquivo corretamente.
- [ ] Webhook trata aprovacoes de wallet sem duplicar registros.
- [ ] Pagamento aprovado via Google Pay ou Apple Pay aparece como `PAID` em `/app/pedidos`.
- [ ] Pagamento recusado volta para selecao de metodo sem duplicar pedido.
- [ ] `npm run lint` passa sem erros.
- [ ] `npx tsc --noEmit` passa sem erros.
- [ ] `npm run build` passa.
- [ ] Token de wallet nao aparece em logs do navegador nem no banco.
- [ ] Nenhum segredo aparece no bundle do frontend.
- [ ] MCP `quality_checklist` foi consultado antes da entrega.

---

## Testes manuais esperados

Documentar resultado de cada cenario:

| Cenario | Resultado esperado | Resultado obtido |
|---|---|---|
| Acesso no Chrome Android com Google Pay configurado | Botao Google Pay aparece | ? |
| Acesso no Chrome desktop sem Google Pay | Botao Google Pay nao aparece | ? |
| Acesso no Safari iOS com Apple Pay configurado | Botao Apple Pay aparece | ? |
| Acesso no Chrome iOS (nao Safari) | Botao Apple Pay nao aparece | ? |
| Pagamento Google Pay aprovado (cartao sandbox) | `payment_status = PAID`, `wallet_type = 'google_pay'` | ? |
| Pagamento Apple Pay aprovado (sandbox) | `payment_status = PAID`, `wallet_type = 'apple_pay'` | ? |
| Pagamento Google Pay recusado | Mensagem generica, pode tentar outro metodo | ? |
| Duplo clique em confirmar | Apenas um pagamento criado | ? |
| Webhook repetido com mesmo `provider_payment_id` | Idempotente, sem duplicar `payments` | ? |
| `/.well-known/apple-developer-merchantid-domain-association` | Status 200, `Content-Type: text/plain` | ? |

---

## Entregaveis

Ao finalizar, entregar:

1. Lista dos arquivos criados e modificados.
2. Nome exato da migration criada.
3. Resultado de `npm run lint`, `npx tsc --noEmit` e `npm run build`.
4. Variaveis de ambiente necessarias e onde configura-las.
5. Como obter o arquivo de verificacao de dominio Apple Pay no DevPanel do Mercado Pago.
6. Como configurar HTTPS local para testar Apple Pay (tunel sugerido).
7. Tabela de testes manuais preenchida.
8. Resultado do MCP `quality_checklist`.
9. Limitacoes conhecidas: disponibilidade real de Google Pay e Apple Pay na conta Mercado Pago Brasil, restricoes de dominio, restricoes de ambiente.
10. Se o MCP confirmar que algum dos metodos nao esta disponivel no Brasil/sandbox: documentar claramente e manter o codigo preparado para quando estiver.

---

## Proibicoes

- Nao usar `MERCADO_PAGO_ACCESS_TOKEN` no frontend ou em variaveis publicas.
- Nao salvar token de wallet (Google Pay token, Apple Pay payment token) no banco ou logs.
- Nao implementar deteccao de dispositivo com `navigator.userAgent` — usar as APIs oficiais (`PaymentRequest`, `ApplePaySession`).
- Nao criar botoes customizados com logo Google Pay ou Apple Pay fora das diretrizes oficiais de marca.
- Nao habilitar em producao sem validacao de dominio Apple Pay e confirmacao de conta.
- Nao assumir que Google Pay ou Apple Pay estao disponiveis sem consulta ao MCP.
- Nao duplicar logica de idempotencia, CORS ou auditoria ja existente.
- Nao modificar o fluxo interno de `/app/novo-pedido`, `/app/pedidos` ou caixa.
- Nao trocar o schema sem migration versionada.
- Nao desabilitar RLS.
- Nao commitar segredos ou o arquivo de associacao de dominio Apple Pay no git.
- Nao implementar NuPay neste escopo.

---

## Primeiro passo recomendado

1. Executar `application_list` no MCP Mercado Pago.
2. Verificar se Google Pay e Apple Pay estao disponiveis para a conta/app no sandbox Brasil.
3. Ler a documentacao do Payment Brick sobre wallets no MCP.
4. Produzir um plano de 5 itens (o que vai mudar, o que vai ser criado, o que NAO vai ser feito e por que) antes de comecar a implementar.
5. Implementar em incrementos: migration → Edge Function → webhook → frontend → verificacao de dominio → testes.
