# Plano de Ação de Correção — Diagnóstico Operacional do PDV

Este documento consolida o plano de ação para corrigir os riscos identificados no diagnóstico operacional do PDV Marcos Krep's. O foco é elevar a confiabilidade de caixa, pedidos, pagamentos, impressão, segurança pública e experiência de uso em operação real de balcão, cozinha e delivery.

## Objetivos

1. Eliminar inconsistências financeiras e operacionais em pedidos, pagamentos parciais e fechamento de caixa.
2. Fortalecer o isolamento multi-filial, permissões por papel e endpoints públicos.
3. Reduzir risco de pedidos/jobs parcialmente criados por falhas intermediárias.
4. Melhorar performance percebida da operação em dias de alto volume.
5. Padronizar feedback visual e resiliência para ambiente com rede instável.
6. Preparar o sistema para operação offline-first e maior escala.

## Priorização geral

| Prioridade | Prazo sugerido | Tema | Resultado esperado |
|---|---:|---|---|
| P0 | 1–3 dias | Transações financeiras e impressão | Evitar pagamento duplicado, pedido parcial e impressão duplicada. |
| P1 | 3–7 dias | Segurança pública/RLS | Reduzir exposição por endpoints públicos e permissões amplas. |
| P2 | 1–2 semanas | Performance/UX operacional | Melhorar resposta do board, feedback visual e ergonomia. |
| P3 | 2–6 semanas | Offline-first/observabilidade | Sustentar operação em rede instável e facilitar suporte. |

## P0 — Correções críticas imediatas

### 1. Tornar pagamento parcial/integral transacional

**Problema:** a Edge Function `mark-payment` lê itens, calcula total, atualiza itens e insere histórico em etapas separadas. Dois operadores ou retries simultâneos podem causar corrida entre a checagem de itens elegíveis e a escrita do pagamento.

**Ação recomendada:** criar RPC PostgreSQL transacional com `SELECT ... FOR UPDATE` no pedido e nos itens alvo. A Edge Function deve apenas autenticar, validar autorização por filial e chamar a RPC.

**Critérios de aceite:**

- Dois pagamentos simultâneos sobre o mesmo item não podem gerar dois registros pagos.
- Pagamento parcial deve atualizar somente os itens escolhidos.
- Pagamento integral deve incluir taxas de embalagem/entrega somente quando quitar o restante do pedido.
- Estorno deve ser restrito a `ADMIN` e auditado com motivo.
- Deve haver testes de concorrência com duas chamadas paralelas.

**Exemplo de desenho da RPC:**

```sql
create or replace function pay_order_items_transactional(
  p_order_id uuid,
  p_item_ids uuid[],
  p_payment_method payment_method,
  p_payment_status payment_status,
  p_amount numeric,
  p_user_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total numeric;
  v_already_paid int;
begin
  perform 1
    from orders
   where id = p_order_id
   for update;

  select count(*)
    into v_already_paid
    from order_items
   where order_id = p_order_id
     and id = any(p_item_ids)
     and payment_status in ('PAID', 'COURTESY')
   for update;

  if v_already_paid > 0 then
    raise exception 'Um ou mais itens ja foram pagos.';
  end if;

  select coalesce(sum(total_price), 0)
    into v_total
    from order_items
   where order_id = p_order_id
     and id = any(p_item_ids)
     and status <> 'CANCELLED';

  if p_payment_status = 'PAID' and round(v_total * 100) <> round(p_amount * 100) then
    raise exception 'Valor difere do total dos itens.';
  end if;

  update order_items
     set payment_status = p_payment_status,
         payment_method = p_payment_method,
         paid_at = case when p_payment_status in ('PAID', 'COURTESY') then now() else null end
   where order_id = p_order_id
     and id = any(p_item_ids);

  insert into payments(order_id, amount, payment_method, payment_status, received_by, notes, order_item_ids)
  values (p_order_id, v_total, p_payment_method, p_payment_status, p_user_id, p_notes, p_item_ids);

  return jsonb_build_object('success', true, 'amount', v_total);
end;
$$;
```

### 2. Tornar criação de pedidos atômica

**Problema:** `create-attendant-order` e `create-public-order` criam pedido, itens, adicionais, removidos, pagamentos, descontos e jobs em operações separadas. Falhas intermediárias podem deixar pedido sem itens, sem pagamento histórico ou sem jobs de impressão.

**Ação recomendada:** migrar a persistência para RPCs transacionais:

- `create_attendant_order_transactional(payload jsonb, actor uuid)`
- `create_public_order_transactional(payload jsonb)`
- `enqueue_order_print_jobs_transactional(order_id uuid, options jsonb)`

**Critérios de aceite:**

- Se qualquer item/adicional/ingrediente falhar, nenhum pedido deve permanecer no banco.
- Pedido pago no ato deve criar itens, pagamento, auditoria e jobs na mesma transação.
- Pedido público deve criar pedido e itens de forma indivisível.
- Devem existir testes com payload inválido no segundo item confirmando rollback total.

### 3. Evitar impressão duplicada no print-worker

**Problema:** o worker busca jobs `PENDING` sem claim atômico. Se duas instâncias rodarem por engano, ambas podem imprimir o mesmo job.

**Ação recomendada:** adicionar estado `PROCESSING`, campos `locked_by`, `locked_at`, `attempt_count` e RPC `claim_printer_jobs` com `FOR UPDATE SKIP LOCKED`.

**Critérios de aceite:**

- Dois workers simultâneos não processam o mesmo job.
- Job travado em `PROCESSING` por timeout deve voltar para `PENDING` ou `FAILED` conforme tentativas.
- Status `SKIPPED` deve substituir `PRINTED` quando impressão for pulada por configuração.

**Exemplo de claim:**

```sql
create or replace function claim_printer_jobs(p_worker_id text, p_limit int default 5)
returns setof printer_jobs
language sql
security definer
as $$
  with claimed as (
    select id
      from printer_jobs
     where status = 'PENDING'
     order by created_at
     limit p_limit
     for update skip locked
  )
  update printer_jobs pj
     set status = 'PROCESSING',
         locked_by = p_worker_id,
         locked_at = now(),
         attempt_count = coalesce(attempt_count, 0) + 1,
         updated_at = now()
    from claimed
   where pj.id = claimed.id
  returning pj.*;
$$;
```

## P1 — Segurança, RLS e privacidade

### 4. Endurecer RLS multi-filial

**Ações recomendadas:**

- Remover permissões legadas baseadas em `branch_id IS NULL` quando a base já estiver totalmente migrada.
- Revisar `discounts` para garantir escrita apenas por `ADMIN`, inclusive via RLS.
- Criar testes SQL de RLS para `ADMIN`, `ATTENDANT` com filial autorizada, `ATTENDANT` sem filial e usuário anônimo.
- Garantir que todas as funções `SECURITY DEFINER` tenham `SET search_path = public` ou search path mínimo explícito.

**Critérios de aceite:**

- Atendente sem vínculo com filial não lê pedidos, pagamentos, jobs ou caixa da filial.
- Atendente não cria/altera desconto diretamente por Supabase client.
- Usuário anônimo só acessa cardápio público ativo e endpoints públicos necessários.

### 5. Proteger endpoints públicos

**Ações recomendadas:**

- Configurar `PUBLIC_CHECKOUT_ALLOWED_ORIGINS` obrigatório em produção, sem default `*`.
- Adicionar rate limit por IP + telefone em `lookup-orders-by-phone`.
- Avaliar OTP WhatsApp para revelar tokens de acompanhamento por telefone.
- Retornar mensagens genéricas em falhas públicas para evitar enumeração.

**Critérios de aceite:**

- Consulta por telefone deve bloquear abuso por janela deslizante.
- Token público não deve expor UUID interno de pedido/item.
- Ambientes de preview devem ter allowlist explícita, não qualquer domínio `.vercel.app`.

### 6. Reforçar WebAuthn

**Ações recomendadas:**

- Restringir origem WebAuthn em produção a domínio oficial e previews aprovados.
- Registrar `signCount`, device name e último uso com auditoria.
- Criar testes manuais documentados para Android Chrome, iOS Safari e desktop Chrome/Edge.
- Considerar biblioteca validada para WebAuthn se a compatibilidade crescer.

## P2 — Performance e UX operacional

### 7. Otimizar board de pedidos

**Ações recomendadas:**

- Separar consulta leve do board e consulta detalhada do pedido.
- No board, buscar apenas campos necessários para cards e contadores.
- Carregar itens/adicionais somente ao abrir modal/sheet.
- Debounce em atualizações realtime para evitar bursts.
- Usar índices compostos por `branch_id`, `status`, `created_at`, `payment_status` e campos de dia comercial.

**Critérios de aceite:**

- Board deve carregar em menos de 1s em dia com alto volume local simulado.
- Evento realtime não deve disparar múltiplos fetches completos em sequência.
- Modal de detalhes pode carregar sob demanda com skeleton.

### 8. Padronizar feedback visual

**Ações recomendadas:**

- Substituir `window.alert` por Toast/Dialog acessível.
- Expandir Toast para `success`, `error`, `warning`, `info`, ações e duração configurável.
- Criar padrão para estados de erro de rede, falha de impressão e operação pendente.
- Adicionar mensagens persistentes para falhas críticas até confirmação do operador.

**Critérios de aceite:**

- Nenhum fluxo operacional crítico usa `window.alert`.
- Falhas de pagamento/impressão exibem ação clara de retry/reimpressão.
- Estados vazios/loading/erro são consistentes entre pedidos, caixa, cardápio e impressão.

### 9. Melhorar ergonomia de balcão

**Ações recomendadas:**

- Adicionar atalhos de repetição de item e favoritos.
- Criar fluxo rápido de pagamento com botões grandes e teclado numérico.
- Reduzir toques na seleção de adicionais frequentes.
- Mostrar divergência entre subtotal estimado no carrinho e total oficial retornado pelo servidor, quando ocorrer.

## P3 — Resiliência, offline-first e observabilidade

### 10. Criar modo offline-first para operação de balcão

**Ações recomendadas:**

- Persistir pedidos locais pendentes em IndexedDB.
- Assinar payload localmente com versão de cardápio/preço conhecido.
- Sincronizar ao voltar a rede, recalculando total no servidor.
- Exibir fila local com status `aguardando envio`, `sincronizado`, `erro`, `requer revisão`.

**Critérios de aceite:**

- Operador consegue montar pedido sem internet.
- Sistema não perde carrinho/pedido em refresh ou queda de rede.
- Sincronização aponta conflitos de preço/cardápio com ação do operador.

### 11. Implantar observabilidade operacional

**Ações recomendadas:**

- Criar tabela/evento de `operational_events` para falhas de Edge Functions, impressão, WhatsApp e pagamento.
- Adicionar correlation id por pedido e por job.
- Criar painel admin com erros recentes, retries e tempo médio por etapa.
- Alertar quando worker ficar sem heartbeat ou impressora falhar repetidamente.

### 12. Fortalecer auditoria financeira

**Ações recomendadas:**

- Exigir motivo para desconto, cortesia, cancelamento e estorno.
- Salvar snapshot antes/depois em `audit_logs` para operações financeiras.
- Relatório de caixa deve reconciliar `orders`, `order_items`, `payments` e transações Mercado Pago.
- Criar teste de fechamento com pagamento parcial, cortesia, iFood, cancelamento e entrega.

## Ordem sugerida de execução

1. Criar migrations de suporte: campos de lock em `printer_jobs`, status `PROCESSING/SKIPPED`, índices de pagamento/caixa e ajustes RLS.
2. Implementar RPC transacional de pagamento e adaptar `mark-payment`.
3. Implementar RPC transacional de criação de pedido do atendente.
4. Implementar RPC transacional de pedido público.
5. Refatorar `print-worker` para claim atômico.
6. Endurecer endpoints públicos e WebAuthn origins.
7. Otimizar board de pedidos com consulta leve + detalhe sob demanda.
8. Padronizar Toast/Dialog e remover alerts.
9. Adicionar testes automatizados e scripts de concorrência.
10. Planejar offline-first e observabilidade.

## Checklist de validação pós-correção

- [ ] Dois pagamentos concorrentes do mesmo item resultam em apenas um pagamento efetivo.
- [ ] Pedido com erro no segundo item não deixa registro parcial no banco.
- [ ] Dois workers simultâneos não imprimem o mesmo job.
- [ ] Job pulado por configuração não aparece como impresso com sucesso.
- [ ] Atendente sem filial não acessa pedido/caixa/job de outra filial.
- [ ] Atendente não cria desconto diretamente.
- [ ] Consulta por telefone tem rate limit ou OTP.
- [ ] Board de pedidos carrega consulta leve e detalhes sob demanda.
- [ ] Não há `window.alert` em fluxo operacional crítico.
- [ ] Relatório de caixa reconcilia pedidos, itens, pagamentos e transações externas.
