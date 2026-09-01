# P0 — Estabilidade de pedidos e consulta de cliente

Atualizado em 2026-08-31.

## Objetivo

Corrigir dois problemas operacionais prioritários nas telas usadas pelos atendentes:

1. manter o quadro de pedidos atualizado sem reiniciar o pedido que está aberto;
2. fazer a consulta de cliente por telefone distinguir corretamente cliente inexistente de falha técnica.

O trabalho preserva o fluxo atual e evita mudanças amplas de interface ou banco de dados nesta etapa.

## Escopo analisado

- `/app/pedidos`: quadro, atualização automática e detalhe do pedido;
- modal/sheet de pagamento por itens;
- resumo do novo pedido e identificação do cliente;
- cliente de API das Edge Functions;
- Edge Function `get-customer-profile`;
- normalização de telefone brasileiro.

## P0.1 — Pedido aberto não deve reiniciar durante atualização automática

### Problema observado

O quadro recebe atualizações por três caminhos:

- eventos Realtime do Supabase;
- polling de segurança a cada 15 segundos;
- atualização ao retornar para a aba.

Antes da correção, cada atualização substituía também o objeto do pedido aberto. O componente de pagamento por itens interpreta a mudança de `order.items` como um novo contexto e reinicia seleções, etapa, forma de pagamento e mensagens internas. Isso podia acontecer enquanto o atendente informava quanto cada pessoa pagou.

### Solução aplicada

- a lista de pedidos continua recebendo todas as atualizações automáticas;
- o pedido aberto fica congelado durante Realtime, polling e retorno à aba;
- o pedido aberto só é sincronizado depois de uma ação explícita concluída, como pagamento ou alteração de status;
- a regra foi extraída para uma função pura e recebeu testes próprios.

### Critérios de aceite

- [x] o quadro continua atualizando automaticamente;
- [x] atualização automática não fornece um novo objeto para o pedido aberto;
- [x] uma ação explícita pode sincronizar o pedido aberto com a resposta mais recente;
- [x] pedido inexistente na nova lista não é aberto ou fechado implicitamente;
- [ ] confirmar o fluxo completo com um usuário atendente autenticado e pedidos reais de teste.

## P0.2 — Consulta do cliente por telefone

### Problemas encontrados

1. A Edge Function usava `req` fora do escopo no helper de resposta JSON.
2. Erros da Edge Function eram convertidos no frontend em `found: false`, fazendo uma falha técnica aparecer como “Cliente novo”.
3. A normalização removia todo prefixo `55`, inclusive quando `55` era o DDD de um número nacional.
4. A interface não oferecia uma mensagem clara nem uma ação de nova tentativa quando a consulta falhava.

### Solução aplicada

- corrigido o escopo de `req` em todas as respostas da Edge Function;
- falhas de banco ou infraestrutura agora retornam erro, sem fingir que o cliente não existe;
- o cliente da API propaga falhas de invocação;
- a interface separa os estados `consultando`, `encontrado`, `não encontrado` e `erro`;
- falhas exibem mensagem visível e botão **Tentar novamente**;
- a normalização reconhece `+55`/`0055` como código do país, preservando o DDD 55 em números nacionais;
- foram adicionados testes para formatos válidos e inválidos.

### Critérios de aceite

- [x] telefone nacional e internacional é normalizado para E.164;
- [x] DDD 55 não é removido indevidamente;
- [x] falha técnica não aparece como cliente novo;
- [x] atendente pode tentar a consulta novamente;
- [x] erro de sessão recebe mensagem específica;
- [x] executar a Edge Function por HTTP contra Supabase local;
- [ ] publicar `get-customer-profile` e confirmar o comportamento no ambiente de produção.

## Arquivos alterados

| Arquivo | Responsabilidade |
|---|---|
| `src/app/app/pedidos/page.tsx` | separação entre atualização do quadro e sincronização do pedido aberto |
| `src/lib/utils/order-refresh.ts` | regra testável de sincronização explícita |
| `src/lib/utils/order-refresh.test.ts` | testes da estabilidade do pedido aberto |
| `src/components/checkout/OrderSummarySheet.tsx` | estados de consulta, erro e nova tentativa |
| `src/lib/api/pdv-api.ts` | propagação correta de falhas da Edge Function |
| `src/lib/utils/phone.ts` | normalização e formatação centralizadas |
| `src/lib/utils/phone.test.ts` | testes de telefone, incluindo DDD 55 |
| `supabase/functions/get-customer-profile/index.ts` | correção de resposta, status HTTP e normalização no servidor |

## Validação local

### Automatizada

| Validação | Resultado |
|---|---|
| testes direcionados de atualização e telefone | 14 testes aprovados |
| suíte completa do Vitest | 74 testes aprovados em 7 arquivos |
| ESLint | aprovado, sem erros |
| build de produção do Next.js | aprovado, com TypeScript e 23 rotas geradas |
| Edge Function por HTTP no Supabase local | aprovado com usuário e cliente sintéticos |
| limpeza dos dados sintéticos | confirmada: nenhum usuário ou cliente de teste remanescente |

### Aplicação em execução

- `npm run dev` iniciou o Next.js 16.3.1 corretamente em `http://localhost:3000`;
- a rota `/app/pedidos` respondeu e redirecionou corretamente para `/login` sem sessão;
- não existem credenciais de atendente de teste documentadas no repositório;
- portanto, o teste visual autenticado dos dois fluxos continua pendente.

### Integração com Supabase local

O runtime local das Edge Functions foi iniciado com `supabase functions serve`. O teste de integração:

- confirmou CORS via `OPTIONS`;
- confirmou `401` para requisição sem autenticação;
- criou um usuário `ATTENDANT` e um cliente exclusivamente sintéticos;
- autenticou o usuário no Supabase local;
- consultou `(55) 99998-7654` e encontrou corretamente o cliente salvo como `+5555999987654`;
- confirmou nome, quantidade de pedidos e comportamento operacional independente de `remember_checkout_data`;
- confirmou que telefone inválido retorna `success: true` e `found: false`;
- removeu os registros sintéticos e verificou que nenhum permaneceu.

### Achado adicional fora do escopo

Durante o acesso local, a tela de login apresentou erro de hidratação porque `showBiometric` é inicializado com uma capacidade disponível somente no navegador. O servidor renderiza o botão de passkey ausente e o cliente pode renderizá-lo presente. O problema está em `src/app/login/page.tsx` e já existia antes destas alterações. Ele não foi corrigido neste P0 para evitar ampliar o escopo, mas deve entrar no backlog técnico.

## Validação manual pendente

Quando houver Supabase local e uma conta de atendente de teste:

1. entrar em `/app/pedidos`;
2. abrir um pedido com vários itens não pagos;
3. iniciar **Selecionar quanto cada um pagou** e marcar alguns itens;
4. aguardar mais de 15 segundos e, se possível, provocar um evento Realtime em outro pedido;
5. confirmar que as seleções, etapa e forma de pagamento permanecem intactas;
6. concluir o pagamento e confirmar que o pedido aberto é sincronizado;
7. criar um novo pedido e digitar um telefone de cliente existente;
8. confirmar o preenchimento do perfil;
9. consultar um número inexistente e confirmar a mensagem de cliente novo;
10. simular indisponibilidade da função e confirmar mensagem de erro com **Tentar novamente**.

## Publicação

Esta alteração ainda não foi publicada. Para o P0.2 funcionar integralmente fora do ambiente local, é necessário publicar tanto o frontend quanto a Edge Function `get-customer-profile`. O deploy deve ser seguido pelos casos manuais acima e pela verificação do workflow responsável pelas funções Supabase.

## Estudo mobile-first — próxima etapa, sem implementação neste P0

As melhorias de interface continuam recomendadas, mas foram mantidas fora desta correção para reduzir risco operacional:

- manter ações principais fixas na parte inferior do sheet;
- aumentar áreas de toque de itens e formas de pagamento;
- apresentar resumo persistente de selecionados e valor restante;
- reduzir troca de etapas para pagamentos divididos;
- preservar rascunho local ao fechar acidentalmente o sheet;
- exibir o estado de sincronização do quadro sem interromper a tarefa atual;
- posicionar busca de cliente, retorno da consulta e nova tentativa no mesmo bloco visual;
- validar primeiro em larguras de 360 px e 390 px, depois tablet e desktop.

Esses itens devem ser prototipados e testados com atendentes antes de alterar o fluxo produtivo.
