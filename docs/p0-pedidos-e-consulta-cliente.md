# P0 — Estabilidade de pedidos e consulta de cliente

Atualizado em 2026-09-01 após a validação do PR #156.

## Resultado executivo

O PR #156 foi integrado em `main` antes desta revisão (commit de merge
`2a2673d`). A produção do frontend está aprovada pelo deployment do commit,
e a Edge Function `get-customer-profile` está ativa na versão 14. A validação
autenticada local confirmou a estabilidade do pagamento por itens em polling e
Realtime, além dos fluxos de cliente existente, inexistente e DDD 55.

Não houve merge novo nesta etapa: o PR já estava merged. A correção de
hidratação da tela de login e o timeout da consulta encontrados durante a
validação seguem em uma alteração de acompanhamento, separada das mudanças do
PR já publicado.

## Escopo confirmado

- `/app/pedidos`: lista, polling de 15 s, Realtime, detalhe e pagamento por
  itens;
- `/app/novo-pedido`: identificação de cliente e checkout;
- `get-customer-profile`, cliente de API e normalização brasileira;
- limpeza integral dos registros criados exclusivamente para o teste.

## P0.1 — Pedido aberto não reinicia

O quadro continua a buscar pedidos por polling, Realtime e retorno à aba. A
regra em `src/lib/utils/order-refresh.ts` impede que esses caminhos
automáticos substituam o objeto do pedido aberto; a sincronização do detalhe é
reservada a uma ação explícita concluída.

### Aceite

- [x] quadro atualiza com polling de 15 segundos;
- [x] atualização Realtime em outro pedido atualiza o quadro;
- [x] pagamento por itens permanece no mesmo passo;
- [x] item marcado, total selecionado e forma de pagamento persistem;
- [x] ação explícita ainda pode pedir sincronização do detalhe.

## P0.2 — Consulta por telefone

O fluxo separa `checking`, `found`, `not_found` e `error`. A
normalização preserva o DDD 55 para número nacional e converte formatos
internacionais para E.164. Falhas de invocação não são convertidas em
“cliente novo”.

### Aceite

- [x] cliente existente preenche o nome;
- [x] cliente inexistente mostra “Cliente novo”;
- [x] `(55) 99998-7654` preserva o DDD e encontra o cadastro;
- [x] função ativa no projeto remoto;
- [ ] erro de servidor e clique em **Tentar novamente** validados no navegador:
  ao pausar a função local, a interface permaneceu em “procurando” sem timeout,
  portanto o estado de erro não foi alcançado de forma confiável. O timeout de
  8 s foi adicionado no PR #157 e ainda requer homologação manual.

## Validação executada

| Verificação | Resultado |
|---|---|
| Checks do PR #156 | Vercel Preview e deployment aprovados; nenhum comentário humano nem conflito pendente |
| Estado do PR | `MERGED` em 2026-09-01, commit `2a2673d` |
| Frontend | deployment Production do commit de merge com status `success` |
| Edge Function | `get-customer-profile` ACTIVE, versão 14, JWT habilitado |
| Testes Vitest | 74 testes em 7 arquivos aprovados |
| ESLint | aprovado |
| Build Next.js 16.3.1 | aprovado, TypeScript e 23 rotas |
| Quadro de pedidos | aprovado com dois pedidos sintéticos locais |
| Polling + Realtime | aprovado; estado do pagamento por itens preservado |
| Cliente existente / inexistente / DDD 55 | aprovado |
| Dados sintéticos | removidos; consulta final retornou zero pedidos, clientes, perfil e usuário de teste |

## Correções complementares

Em `src/app/login/page.tsx`, a disponibilidade de passkey era calculada na
inicialização do estado. Como ela só existe no navegador, o HTML do servidor e
do cliente podiam divergir e provocar erro de hidratação. A correção inicia o
estado como `false` e verifica a capacidade em `useEffect`.

Em `src/lib/api/pdv-api.ts`, a consulta autenticada de cliente agora usa
`AbortController` com limite de 8 segundos. Ao exceder o prazo, retorna uma
mensagem de retentativa em vez de manter o checkout em “procurando”.

## Limitações e achados

1. **Homologação pendente do timeout.** A indisponibilidade revelou que a
   interface ficava indefinidamente em `checking`. O PR #157 inclui abort em
   8 s para expor **Tentar novamente**, mas o teste de navegador contra uma
   função indisponível precisa ser repetido antes do merge.
2. **Configuração local insegura por padrão.** `.env.local` aponta para o
   projeto remoto; iniciar `npm run dev` sem sobrescrever as variáveis públicas
   pode testar contra dados remotos. A validação usou apenas Supabase local e
   variáveis temporárias de processo, já removidas.
3. **Janela operacional.** “Hoje” no quadro considera a virada de dia
   operacional às 03:00 (America/São_Paulo); pedidos criados antes disso não
   aparecem na consulta do dia seguinte, como esperado.

## Arquivos do P0

| Arquivo | Papel |
|---|---|
| `src/app/app/pedidos/page.tsx` | atualização do quadro sem substituir detalhe aberto |
| `src/lib/utils/order-refresh.ts` | decisão pura de sincronização |
| `src/app/app/pedidos/components/PayItemsModal.tsx` | pagamento por itens |
| `src/components/checkout/OrderSummarySheet.tsx` | estados da consulta de cliente |
| `src/lib/api/pdv-api.ts` | propagação de erro da função |
| `src/lib/utils/phone.ts` | normalização e máscara |
| `supabase/functions/get-customer-profile/index.ts` | resposta e lookup de perfil |

O estudo de usabilidade e plano sem implementação visual estão em
`docs/estudo-mobile-first-pedidos-e-consulta-cliente.md`.
