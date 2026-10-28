# Preparo e entrega por unidade no quadro de pedidos — etapa 1B

Implementação local da continuação da issue #229, em branch própria (`cez/74b5ea0d-etapa-1b`).
Não comprova migration aplicada em banco remoto nem deploy em produção. A ativação em produção exige
aprovação própria.

---

## 1. Como operar no quadro operacional (`/app/pedidos`)

### Ciclo por unidade
Para pedidos com múltiplos itens ou quantidades maiores que 1 (`quantity > 1`, ex: 3 crepes):
- Cada unidade física possui seu próprio controle de preparo (`PENDING` → `IN_PREPARATION` → `READY` → `DELIVERED`).
- Avançar uma unidade para `READY` ou `DELIVERED` **não altera** as unidades irmãs.
- O recálculo automático do banco deriva o status do item e do pedido:
  - Se 1 de 3 unidades estiver pronta, o pedido entra em `PRONTO_PARCIAL`.
  - Se todas as unidades ativas estiverem prontas, o pedido entra em `PRONTO`.
  - Se todas as unidades ativas forem entregues, o pedido entra em `ENTREGUE`.

### Visibilidade permanente dos itens
- **Nenhum item ou unidade desaparece:** mesmo quando uma unidade atinge `DELIVERED`, ela permanece visível com estilo suave (opacidade atenuada, ícone de check verde e horário de entrega `HH:MM`).
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

## 2. Garantias Transacionais e Concorrência

1. **RPC Atômica `public.batch_update_production_status`:**
   - Executada em transação PostgreSQL com `SECURITY DEFINER`.
   - Lock pessimista determinístico:
     - `SELECT ... FROM public.orders WHERE id = p_order_id FOR UPDATE;`
     - `SELECT ... FROM public.order_items WHERE id = ANY(...) FOR UPDATE;` (ordenados por ID).
     - `SELECT ... FROM public.production_handoff_units WHERE id = ANY(...) FOR UPDATE;` (ordenados por ID).
   - Previne deadlocks e condições de corrida entre dois operadores concorrentes.
2. **Prevenção de loops de trigger:**
   - O gatilho de sincronização detecta profundidade recursiva (`pg_trigger_depth() > 1`) para evitar que a sincronização da unidade para o item reverta ou sobrescreva as demais unidades irmãs.
3. **Preservação de regras financeiras e COD (#221):**
   - A tabela `order_items` não é duplicada nem fracionada. `order_items.quantity`, `order_items.total_price`, pagamentos e divisões de conta permanecem 100% íntegros.
   - Cancelamentos parciais de itens em pedidos `ON_DELIVERY` (COD) continuam estritamente bloqueados.
   - Pedidos `ENTREGA` não permitem marcação de entregue pelo balcão.

---

## 3. Verificação e Testes

- **Testes de Banco descartável:** `npm run test:database` executa a suite de testes pgTAP (`supabase/tests/database/production_unit_lifecycle.test.sql`) validando isolamento de unidades, transições permitidas, recálculo de status e proteção contra deadlocks.
- **Testes de Componentes:** `npm test -- src/app/app/pedidos/components/OrderCard.test.tsx` valida as ações unitárias, botões em lote e persistência visual dos itens entregues.
- **Build de Produção:** Validado com Next.js Turbopack e 30 rotas estáticas pré-renderizadas sem erros.
- [Evidências e resultados da etapa 1B](../evidence/pedidos-229/etapa-1b/relatorio.md).
