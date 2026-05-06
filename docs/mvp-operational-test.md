# Plano de Teste Operacional do MVP - PDV Marcos Krep's

Este documento contém um roteiro de teste manual para validar o fluxo completo do MVP do sistema PDV Marcos Krep's usando as telas reais. Este roteiro é guiado para o uso do Atendente e não abrange impressão física real, envio real de WhatsApp, Mercado Pago ou alterações de infraestrutura.

---

## Cenários de Teste

### 1. Login
- **Objetivo**: Garantir que o acesso ao sistema requer autenticação válida e direciona corretamente.
- **Passos**:
  1. Acessar a rota `/login` no navegador ou PWA.
  2. Entrar com e-mail e senha de um usuário com role `ATTENDANT`.
- **Resultado Esperado**: O sistema autentica o usuário com sucesso e redireciona automaticamente para a rota `/app` (ou dashboard/novo-pedido).
- **Verificação no Banco**: Acesso bem-sucedido pode ser visto indiretamente se as requisições autenticadas subsequentes funcionarem.
- **Possíveis Falhas**: Credenciais inválidas (deve mostrar erro). Erro de RLS caso não carregue nada no `/app`.

### 2. Criar pedido balcão simples
- **Objetivo**: Validar a criação completa de um pedido simples consumido no local.
- **Passos**:
  1. Acessar `/app/novo-pedido`.
  2. Selecionar o tipo `BALCAO`.
  3. Adicionar 1 Krep (qualquer sabor).
  4. Na personalização (bottom sheet), remover 1 ingrediente padrão.
  5. Adicionar 1 adicional (addon).
  6. Revisar o carrinho e subtotal estimado.
  7. Finalizar escolhendo a forma de pagamento `PIX`.
- **Resultado Esperado**: O frontend exibe uma mensagem de sucesso exibindo o número sequencial do dia (ex: Pedido #012) e limpa o carrinho.
- **Verificação no Banco**:
  - `orders`: verificar se foi criado com `total_amount` oficial gerado pelo backend, `status` = `NA_FILA`, `payment_status` = `PAID` e `payment_method` = `PIX`.
  - `order_items`: contém 1 krep, com `production_sector` preenchido.
  - `order_item_removed_ingredients` e `order_item_addons`: devem conter os vínculos das modificações feitas.
- **Possíveis Falhas**: Divergência de valores (frontend envia um e backend cobra outro por desatualização), erro na criação de itens.

### 3. Criar pedido viagem
- **Objetivo**: Garantir que a taxa de embalagem seja aplicada corretamente pelo backend para pedidos de viagem.
- **Passos**:
  1. Acessar `/app/novo-pedido`.
  2. Selecionar o tipo `VIAGEM`.
  3. Adicionar 1 Krep e 1 Suco.
  4. Finalizar o pedido utilizando `DEBIT_CARD` ou `CREDIT_CARD`.
- **Resultado Esperado**: Pedido criado com sucesso. O valor `total_amount` retornado deve incluir a taxa de viagem configurada no banco (ex: R$ 2,00 adicionais).
- **Verificação no Banco**:
  - `orders`: campo `packaging_fee` deve ser maior que 0. `total_amount` engloba itens + taxa.
  - `printer_jobs`: as vias impressas devem refletir `target_sector` divididos (`KITCHEN` e `JUICE_POTATO`).

### 4. Criar pedido pendente
- **Objetivo**: Testar o fluxo de pagamento adiado e as travas de segurança na entrega.
- **Passos**:
  1. Criar pedido (qualquer tipo) e finalizar com pagamento `PENDING`.
  2. Acessar `/app/pedidos`.
  3. Validar se o card do pedido recém-criado possui um destaque visual forte.
  4. Abrir os detalhes do pedido e tentar clicar na ação de `Entregar Pedido`.
  5. Deve aparecer um alerta/confirmação na UI. Confirmar a entrega forçada.
- **Resultado Esperado**: A função de entrega deve ser bloqueada pelo backend retornando um erro amigável na tela ("Atenção: O pagamento está PENDENTE..."), a menos que configurado um bypass explícito (se aplicável).
- **Passos cont.**:
  6. No mesmo painel, utilizar o botão "Marcar Pagamento" para registrar o pagamento via `PIX`.
  7. Confirmar o sucesso e tentar entregar o pedido novamente.
- **Verificação no Banco**:
  - Tabela `orders`: `payment_status` altera de `PENDING` para `PAID`.
  - Tabela `payments`: registro histórico do pagamento consolidado.

### 5. Fluxo de pedidos
- **Objetivo**: Validar a transição natural de status durante a operação da cozinha e balcão.
- **Passos**:
  1. Acessar `/app/pedidos` e encontrar um pedido ativo na aba "Na Fila".
  2. Abrir os detalhes e acionar "Marcar como Pronto".
  3. Validar que o pedido saiu de "Na Fila" e foi para a aba "Prontos".
  4. Acionar "Entregar Pedido".
  5. Validar mudança para a aba "Entregues".
- **Resultado Esperado**: O pedido flui entre as abas e o `status` atualiza em tempo real nas listas da página.
- **Verificação no Banco**: `orders.status` reflete as mudanças (`NA_FILA` -> `PRONTO` -> `ENTREGUE`). Campos timestamp (`ready_at`, `delivered_at`) recebem o tempo exato da transição.

### 6. Cancelamento
- **Objetivo**: Testar a anulação de um pedido e a obrigatoriedade de motivação.
- **Passos**:
  1. Criar um novo pedido rápido.
  2. Acessar `/app/pedidos`, encontrar o pedido, tentar cancelar e deixar o motivo em branco (frontend deve barrar).
  3. Preencher o motivo (Ex: "Cliente desistiu após longo tempo na fila").
  4. Confirmar o cancelamento.
- **Resultado Esperado**: O pedido é movido para a aba "Cancelados". Após cancelar, os botões de ação ("Pronto", "Entregar") não devem mais estar visíveis.
- **Verificação no Banco**:
  - `orders`: `status` = `CANCELADO`, `cancelled_at` preenchido.
  - `audit_logs`: Ação do usuário registrada na auditoria.

### 7. Reimpressão
- **Objetivo**: Testar a emissão de novos relatórios de impressão em um pedido já existente.
- **Passos**:
  1. Abrir os detalhes de um pedido finalizado (`ENTREGUE` ou `NA_FILA`).
  2. Clicar em "Reimprimir Vias".
  3. Selecionar uma opção (ex: apenas via cliente, ou todas).
- **Resultado Esperado**: Mensagem de "Reimpressão solicitada!" com sucesso. Visualmente não haverá papel na mão, mas o log sistêmico atuará.
- **Verificação no Banco**:
  - `printer_jobs`: Novos registros gerados com o `order_id` respectivo, todos com `status` = `PENDING` esperando pela pull local do worker de impressão.

### 8. Pedido QR Code
- **Objetivo**: Testar o fluxo de autoatendimento.
- **Passos**:
  1. Se a tela `/pedir` (QR Code público) estiver pronta, acessar sem estar logado, montar carrinho e emitir. *Caso não esteja pronta no momento deste teste, focar nos passos do atendente.*
  2. Pedido emitido via QR Code cai no painel `/app/pedidos` na aba especial "Aguardando".
  3. Atendente abre e executa "Confirmar Pedido".
- **Resultado Esperado**: O pedido via QR Code nasce como `AGUARDANDO_CONFIRMACAO` com payment `PENDING` e só segue o fluxo após conferência humana. Ao confirmar, ele transita para `NA_FILA`.
- **Verificação no Banco**:
  - Criação do pedido com campo `source` = `QR_CODE`.
  - Ao confirmar, geração instantânea de `printer_jobs`.

### 9. Comanda Aberta (Adicionar itens)
- **Objetivo**: Validar o acréscimo de itens a pedidos existentes sem duplicar o pedido ou comprometer o financeiro.
- **Passos**:
  1. Localizar um pedido com pagamento `PENDING` em `/app/pedidos`.
  2. Abrir os detalhes e clicar em "Adicionar à comanda".
  3. Adicionar novos produtos e observar o modo "Adicionar Itens" no cabeçalho.
  4. Finalizar no checkout simplificado clicando em "Confirmar adição".
- **Resultado Esperado**: O pedido original mantém o mesmo ID e número diário, mas o `total_amount` aumenta. Novos `printer_jobs` são criados apenas para os itens adicionados, com o cabeçalho "ADICIONAL DE COMANDA".
- **Verificação no Banco**:
  - `orders`: `total_amount` deve ser a soma exata dos itens antigos e novos.
  - `order_items`: contém os novos itens vinculados ao mesmo `order_id`.
  - `printer_jobs`: apenas os novos itens foram enviados para a fila de impressão.
  - `audit_logs`: deve haver um log de `ORDER_ITEMS_ADDED`.

### 10. Segurança básica
- **Objetivo**: Verificar que o ambiente está blindado contra acessos e manipulações indevidas.
- **Passos**:
  1. Abrir aba anônima e acessar `/app`.
  2. Tentar visualizar ou realizar ações na aplicação (chamando mutações com Postman, etc.).
- **Resultado Esperado**: Redirect para `/login`. Ações críticas da Edge Function só funcionam com um JWT Bearer Token válido passado no cabeçalho.
- **Verificação no Banco**: Monitoramento manual de logs no painel Supabase contra chamadas 401 Unauthorized. Nenhuma operação de banco acontece diretamente por cliente sem RLS cobrindo.

### 10. Conferências no Supabase Studio
- **Objetivo**: Validar a total integridade de tabelas ao término da bateria de testes.
- **Verificações Opcionais/Finais**:
  - `orders` e `order_items`: Quantidades, valores e foreign keys batem sem órfãos.
  - `order_item_addons` e `order_item_removed_ingredients`: Têm ligações perfeitamente mapeadas.
  - `payments`: Valores somam corretamente no consolidado.
  - `printer_jobs`: Formato da estrutura em JSON no campo payload está de acordo com o pedido.
  - `whatsapp_messages`: Caso a edge dispare triggers para esse destino no MVP, checar pendências lá.
  - `audit_logs`: Ações perigosas ou de cancelamento estão formalizadas aqui por user_id.

---

## Critérios para considerar o MVP operacional

O sistema atinge grau de maturidade (MVP) e está pronto para o uso cotidiano do PDV se:

- [ ] O atendente consegue criar um pedido padrão do zero em menos de 1 minuto na interface.
- [ ] O pedido aparece corretamente nas abas correspondentes em `/app/pedidos`.
- [ ] O visual de "pagamento pendente" fica extremamente evidente no grid para evitar que pedidos saiam de graça.
- [ ] A aplicação impede, seja local ou pelo backend, que um pedido `PENDING` passe para `ENTREGUE` sem consentimento.
- [ ] O status do pedido evolui de forma fluida da entrada até o término.
- [ ] A reimpressão gera efetivamente linhas de `printer_jobs` (indispensável antes da compra do hardware físico).
- [ ] A tabela de auditoria (`audit_logs`) engloba cancelamentos e estornos/alterações complexas.
- [ ] **Importante**: Todo total monetário oficial exibido para fechar a conta advém obrigatoriamente do response do backend, prevenindo alterações locais de carrinho (Trust-no-client).
