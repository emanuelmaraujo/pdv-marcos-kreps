# Preparo e entrega por unidade no quadro de pedidos — etapa 1B

Implementação local da continuação da issue #229, em branch própria (`cez/74b5ea0d-etapa-1b`).
Não comprova migration aplicada em banco remoto nem deploy em produção. A ativação em produção exige
aprovação própria.

---

## 1. Como operar no quadro operacional (`/app/pedidos`)

### Ciclo por unidade
Para itens com quantidade maior que 1 (ex.: 3 crepes):
- Cada unidade física tem seu próprio controle de preparo (`PENDING` → `IN_PREPARATION` → `READY` → `DELIVERED`).
  `PENDING` pode ir direto a `READY`; só unidades `READY` podem ser entregues.
- Pelo quadro, unidades **só avançam**. Não há retorno de etapa nem cancelamento por unidade:
  cancelar altera o valor cobrado e continua sendo feito pela linha inteira ou pelo pedido,
  com as regras atuais de COD (#221).
- Clique repetido ou de outro operador sobre unidade que já chegou (ou passou) da etapa é
  ignorado sem erro e sem auditoria duplicada. Seleção inválida (unidade de outro pedido,
  inexistente ou de item editado) rejeita a operação inteira e pede atualização.
- Avançar uma unidade **não altera** as unidades irmãs. O banco deriva o status do item e do pedido:
  - 1 de 3 unidades pronta: pedido em `PRONTO_PARCIAL`.
  - Todas as unidades ativas prontas: `PRONTO`.
  - Todas entregues: `ENTREGUE`.
- WhatsApp/Push de “parte pronta” e “pedido pronto” saem uma vez, quando o pedido entra nesse
  estado pelo quadro. O pedido de aviso é gravado na mesma transação (`production_notification_outbox`);
  se a função cair antes de enviar, repetir a ação envia o aviso pendente (se cair no meio do envio,
  o próximo comando no pedido após 30 s reenvia; o WhatsApp não duplica, o Push pode duplicar nesse caso
  raro). Falha transitória ao enfileirar o WhatsApp devolve o aviso à fila. Entrega parcial não gera
  aviso novo; pedido já encerrado não recebe aviso tardio.

### Leitura do cartão
- Progresso “x/y unidades prontas” conta unidades de todos os setores (itens sem repasse, como
  bebidas, contam pela quantidade) e ignora linhas e unidades canceladas.
- Unidades entregues ficam recolhidas num resumo (“Todas as 3 entregues · 19:33”); ao abrir, cada
  unidade mostra horário de entrega e histórico de repasse.
- Entregar tudo o que está pronto fica só no rodapé (“Entregar prontos”). O lote por item aparece
  apenas quando há prontas em mais de um item; “Todas prontas” só quando há mais de uma unidade a avançar.
- Pedido despachado (`SAIU_PARA_ENTREGA`) não mostra ações de preparo nem de repasse.
- Falha de conexão ou resposta não confirmada mostra “Repetir a última ação de preparo”: repetir é
  seguro, o que já foi registrado não muda de novo. Erro do servidor (4xx) é definitivo e nada mudou.

### Visibilidade permanente dos itens
- **Nenhum item ou unidade desaparece:** unidades entregues ficam no resumo recolhido do item, com horário de entrega e histórico ao expandir.
- A comanda completa pode ser conferida a qualquer momento pelo operador do balcão ou da cozinha.

### Ações rápidas no cartão (Touch target ≥ 44 px)
1. **Controles individuais por unidade:**
   - `Aguardando preparo`: botões `Preparar` e `Marcar pronto`.
   - `Em preparo`: botão `Marcar pronto`.
   - `Pronto`:
     - Em `BALCAO` e `VIAGEM`: botão `Entregar unidade`.
     - Em `ENTREGA` (delivery): badge `Pronto p/ motoboy` (bloqueado para entrega de balcão, respeitando o despacho).
2. **Ações em lote no cabeçalho do item:**
   - `Todas prontas (N)`: marca todas as unidades não finalizadas daquele item como prontas em uma única transação atômica.
   - `Entregar prontas (N)`: entrega todas as unidades prontas daquele item com 1 clique.
3. **Ações em lote no rodapé do cartão:**
   - Em `PRONTO_PARCIAL`: botão rápido `Entregar prontos` entrega simultaneamente todos os itens e unidades prontos do pedido via RPC atômica, sem exigir navegação para o modal de detalhes.

---

## 2. Garantias transacionais e compatibilidade

1. **Comando único:** o quadro chama a Edge Function `update-order-item-status` em modo `batch`.
   Ela executa `public.batch_update_production_status` com o JWT do operador (filial, papel e
   transições validados no banco) e envia notificações conforme a transição devolvida.
2. **Atomicidade e concorrência:** pedido bloqueado com `FOR UPDATE`, depois itens e unidades em
   ordem de ID — a mesma ordem do pagamento por itens. O recálculo de item e pedido acontece uma
   única vez no fim do lote. Os comandos legados travam a linha antes do pedido; se coincidirem no
   mesmo item, o Postgres desfaz uma das transações (`40P01`) e a Edge Function repete o lote até
   3 vezes antes de pedir nova tentativa ao operador.
3. **Comandos legados:** `update-order-status` e `update-order-item-status` (por linha) continuam
   válidos. As unidades acompanham a linha sem regredir unidades já entregues; cancelamento do
   pedido guarda o estado de cada unidade, e a restauração (`restore-cancelled-order`) o devolve.
4. **Recálculo do pedido:** `recompute_order_status_from_items` mantém a semântica e o
   `SECURITY INVOKER` anteriores. Pedido `ENTREGUE` volta à operação ao receber acréscimo, e pedido
   restaurado sai de `CANCELADO`.
5. **Linha com unidade entregue não é cancelada:** a unidade consumida continua cobrável. Isso vale
   para “Cancelar item” (oculto no detalhe) e para o cancelamento do pedido inteiro, que é recusado
   com a mensagem. Hoje não há como retirar só as unidades restantes; isso depende da etapa de
   pagamentos fracionados e é decisão de negócio pendente
   ([proposta](../archive/studies/pedidos-229/proposta-cancelamento-parcial.md)).
6. **Financeiro e COD (#221):** `order_items` não é duplicado nem fracionado; quantidade, valores,
   pagamentos e divisão de conta não mudam. Delivery não é entregue pelo balcão.
7. **Implantação:** migration e Edge Function devem ser publicadas juntas. Com a função antiga, o
   quadro recebe erro (`order_item_id ausente`) e nada é gravado.

## 3. Verificação e Testes

- **Testes de Banco descartável:** `npm run test:database` executa a suite de testes pgTAP (`supabase/tests/database/production_unit_lifecycle.test.sql`) validando isolamento de unidades, transições, IDs inválidos, idempotência, comandos legados, restauração e acréscimo após entrega.
- **QA com dois operadores:** `node scripts/test-database.mjs --production-qa` (instância descartável, Edge Functions locais e navegador).
- **Testes de Componentes:** `npm test -- src/app/app/pedidos/components/OrderCard.test.tsx` valida as ações unitárias, botões em lote e persistência visual dos itens entregues.
- **Build de Produção:** Validado com Next.js Turbopack e 30 rotas estáticas pré-renderizadas sem erros.
- [Evidências e resultados da etapa 1B](../evidence/pedidos-229/etapa-1b/relatorio.md).
