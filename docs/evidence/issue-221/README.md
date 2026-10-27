# Evidências locais — issue #221

Capturas de 25/10/2026. Aplicativo de referência: commit `7e60054`
(código de produto igual a `a69253b`). Fixtures totalmente sintéticas, sem
consulta de catálogo, analytics ou pagamentos reais. Nenhuma imagem de produto
foi inventada: o cenário usa o fallback sem foto.

- [Relatório e limitações](../../archive/studies/auditoria-pedir-issue-221.md).
- [Protótipo navegável](proposta.html): discussão de direção, não aplicação publicada.
- [Proposta mobile](proposta-checkout-390.png) e [desktop](proposta-checkout-1440.png).
- [Aplicativo: dados de VIAGEM em 360 px](antes-dados-viagem-360.png).

Só um subconjunto curado das capturas fica versionado (360/390 px e as de COD e
do painel). Os roteiros abaixo regeneram o conjunto completo de larguras localmente;
os arquivos extras não devem ser commitados.

`antes-*` são capturas do aplicativo existente, nas larguras indicadas no nome;
`depois-*` registram as correções pontuais do aplicativo;
`proposta-*` são capturas do HTML ilustrativo e não representam implementação.
`depois-resumo-final-*` mostra o resumo após rolagem, em captura do viewport. A altura configurada é 900 px; as imagens usam página
completa, inclusive eventual overflow. O indicador de desenvolvimento do Next e
avisos transitórios podem aparecer; não são componentes do produto publicado.

## Reprodução isolada

Requer dependências do projeto e Playwright com Chromium disponível. Playwright
não foi adicionado ao manifest do produto. Se já existir em outro diretório, use
`PLAYWRIGHT_MODULE` com caminho absoluto de seu `index.mjs`.

Para impedir busca de fontes externas pelo Next, crie fora do repositório um
arquivo CommonJS de mock e passe seu caminho em `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`:

```js
module.exports = new Proxy({}, {
  get: (_target, url) => `@font-face {
    font-family: '${String(url).includes('Plus') ? 'Plus Jakarta Sans' : 'Inter'}';
    src: local('Arial'); font-weight: 100 900;
  }`,
});
```

As capturas usam esse substituto local: não comprovam a aparência da fonte web real.
Inicie o servidor em um terminal com variáveis **apenas de fixture**; não copie `.env`:

```bash
NODE_ENV=development \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-not-a-real-key \
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/caminho/absoluto/fontes-mock.cjs \
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3221
```

Em outro terminal, execute na raiz:

```bash
node docs/evidence/issue-221/auditoria-local.mjs
AUDIT_PHASE=after node docs/evidence/issue-221/auditoria-local.mjs
node docs/evidence/issue-221/capturar-proposta.mjs
```

O primeiro script intercepta o Supabase fictício no navegador, responde com
fixtures e aborta destinos externos. Só encaminha HTTP ao servidor Next local
na porta 3221. Não envia criação de pedido, pagamento, impressão ou WhatsApp.
O segundo abre somente o arquivo HTML local. Nenhum deles valida gateway real,
Edge Functions publicadas, RLS ou migrations.

Os comandos sobrescrevem as próprias capturas. O JSON de auditoria registra
largura da página e texto sintético do resumo, sem tokens ou dados de clientes.
Feche o servidor local depois da execução.

## QA do pagamento na entrega

`qa-cod.mjs` roda contra o build local (`npm run build` com
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e chave fictícia, depois
`npx next start -H 127.0.0.1 -p 3221`). Simula configuração, CEP, criação e
acompanhamento do pedido no navegador, aborta qualquer outro destino e grava
`qa-cod.json` e as capturas `qa-cod-*`. `auditoria-local.mjs` aceita as portas
fictícias 9 e 54321. Nenhum pedido, pagamento, impressão ou mensagem real é criado.

## QA do painel e fluxo COD nas Edge Functions

`npm run test:cod-e2e` sobe a instância Supabase descartável de `test:database`,
roda os testes pgTAP e `scripts/cod-e2e-flow.mjs`, que chama as Edge Functions
locais com usuários sintéticos: política pelo painel, criação concorrente, confirmação,
impressão, cancelamento de item, despacho, entrega, baixa, caixa, rejeição, expiração,
WhatsApp (só fila local) e funil. Com `-- --admin-qa` e `PLAYWRIGHT_MODULE`,
`qa-admin-cod.mjs` faz login real no painel em `next dev` e configura o COD em 390 e
1440 px (`qa-admin-cod-*.png`). O endereço vem de cadastro salvo: o ViaCEP não é chamado.
