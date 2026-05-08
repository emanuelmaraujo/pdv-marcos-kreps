# Walkthrough do PDV Marcos Krep's

## Página de Pedidos (Operacional)

A tela de pedidos do atendimento (`src/app/app/pedidos/page.tsx`) foi criada seguindo uma abordagem mobile-first, permitindo a gestão fácil do fluxo do estabelecimento.

### 1. Como os pedidos são carregados
Os pedidos do dia são obtidos através de uma consulta direta ao Supabase via cliente (`src/lib/api/orders-api.ts`), utilizando a data atual a partir das 00:00 (local time). O retorno inclui os relacionamentos de `order_items`, produtos, adicionais (`order_item_addons`), e ingredientes removidos (`order_item_removed_ingredients`).
A atualização dos pedidos ocorre ao abrir a tela (via `fetchOrders`) e também toda vez que uma ação é executada e finalizada com sucesso.

### 2. Como funcionam as ações
As ações acontecem no `OrderDetailsSheet.tsx` (um Bottom Sheet para UX nativa em mobile).
- **Aguardando Confirmação:** O atendente pode confirmar ou cancelar o pedido exigindo um motivo de cancelamento.
- **Na Fila:** Pode marcar como pronto, reimprimir vias ou cancelar o pedido.
- **Pronto:** Pode entregar (validando antes se o pagamento ainda está pendente com um prompt), marcar pagamento e reimprimir.
- **Pagamento Pendente:** Uma opção prioritária aparece no menu permitindo registrar o método (Pix, Dinheiro, Débito, Crédito ou Cortesia) modificando o status no backend.

Ao selecionar uma ação, a UI bloqueia repetições mostrando "Carregando..." e só depois atualiza os dados locais e fecha a tela com um toast de sucesso.

### 3. Edge Functions Chamadas
Todas as mutações e regras de negócio passam por **Edge Functions** via `pdv-api.ts`.
- `confirmOrder`: Chamada para confirmar um pedido `AGUARDANDO_CONFIRMACAO` -> `NA_FILA`.
- `updateOrderStatus`: Usada para alterar status para `PRONTO`, `ENTREGUE` ou `CANCELADO`. Para `CANCELADO`, envia um motivo obrigatório. Para entrega de pedidos `PENDING`, a UI alerta antes para evitar que a função bloqueie indevidamente e cause surpresa.
- `markPayment`: Utilizada para definir como o pedido foi pago e atualizar a quantia final.
### 4. Impressão Térmica (Print Bridge Local)
Foi elaborada uma arquitetura com separação clara de responsabilidades onde o PWA móvel nunca interage com o hardware diretamente. Todo o processo de impressão ocorre através de um projeto autônomo (na pasta `/print-worker`) construído em Node.js. 

Essa estratégia funciona da seguinte forma:
- O PWA ou a própria rotina do backend (Edge Functions) insere _jobs_ na tabela `printer_jobs` com status `PENDING`.
- O **Print Worker** local (Node.js) monitora a tabela utilizando uma abordagem híbrida:
    - **Supabase Realtime**: Captura instantaneamente novos inserts para impressão imediata.
    - **Polling (3s)**: Executa checagem periódica como contingência em caso de queda na conexão do socket.
- O Worker transforma os dados crus contidos no `printer_jobs.content` em comandos nativos `ESC/POS` via TCP e dispara a impressão física na impressora térmica de rede (Porta 9100).
- Após o processamento, o Worker atualiza o job com:
    - `status`: `PRINTED` ou `FAILED`.
    - `printed_at`: Timestamp exato da impressão bem-sucedida.
    - `error_message`: Motivo técnico caso a impressão falhe (ex: impressora offline).

Para monitoramento desse fluxo, foi criada a tela **Fila de Impressão** (`/app/app/impressao`), acessível no menu inferior. Nela, o atendimento consegue visualizar de forma agrupada (`PENDING`, `FAILED`, `PRINTED`) todas as vias de impressão do dia. É possível analisar o status individual, a mensagem de erro detalhada e executar a ação de **Reimprimir** (que gera um novo job na fila via Edge Function). O componente implementa _auto-refresh_ nativo a cada 10 segundos.

Isso evita sobrecarga em dispositivos móveis e garante liberdade para os garçons circularem pela loja criando pedidos a qualquer momento, sem depender de janelas de impressão do navegador ou cabos.

Para validação técnica sem hardware, existe um script em `scratch/test-printing.ts` que simula o ciclo de vida completo de um job (criação, falha simulada, sucesso simulado e reimpressão).

### 5. Testes e Validação do MVP
Um plano de testes detalhado foi documentado em [`docs/mvp-operational-test.md`](docs/mvp-operational-test.md). Esse documento funciona como um roteiro de checklist para os atendentes cobrindo desde a confecção básica de pedidos (balcão e viagem) até o tratamento de cancelamentos, re-impressão e auditoria de pagamentos pendentes e segurança da API.

### 6. Integração com WhatsApp (Notificação de Pedido Pronto)
Foi estabelecida a estratégia de uso da **WhatsApp Cloud API oficial** da Meta para envio de alertas automáticos quando o pedido estiver `PRONTO`.
O fluxo é orientado a eventos:
- O garçom marca como Pronto e uma linha é inserida na tabela `whatsapp_messages` com status `PENDING`.
- Um _Database Webhook_ (nativo do Supabase) captura esse insert e aciona a Edge Function `send-whatsapp`.
- A Edge Function (que age como Worker) dispara para a Cloud API oficial da Meta e grava se obteve sucesso (`SENT`) ou falha (`FAILED`).

A configuração detalhada da API da Meta e o setup das variáveis de ambiente estão documentados em [`docs/whatsapp-cloud-setup.md`](docs/whatsapp-cloud-setup.md).

### 7. Gestão do Cardápio (`/app/cardapio`)
A tela de gestão do cardápio permite que o administrador visualize, edite e controle a disponibilidade de todos os produtos e adicionais do sistema.

**Funcionalidades:**
- **Tabs por Categoria:** Navegação horizontal por tabs (Kreps, Sucos, Batatas, etc.) + aba dedicada de Adicionais.
- **Edição Inline de Nome (ADMIN):** Tocar no ícone de edição ao lado do nome abre um campo inline. Enter ou blur salva; Escape cancela.
- **Edição Inline de Preço (ADMIN):** Mesmo mecanismo para preço, com validação numérica e suporte a vírgula/ponto.
- **Toggle Disponível/Indisponível:** ADMIN pode marcar produto ou addon como indisponível (campo `active` no banco).
- **Ingredientes:** Cada card de produto mostra os ingredientes padrão vinculados.
- **Toast Feedback:** Todas as ações exibem toast visual de sucesso ou erro (sem `alert()` nativo).
- **Addons:** Listagem com edição inline de preço e toggle ativo/inativo para o ADMIN.

**Permissões por Role (RLS):**
- **ADMIN:** Vê todos os produtos (ativos e inativos) e pode editar nome, preço, disponibilidade e vínculos. A RLS policy `Admin control products` com `FOR ALL` garante acesso completo. Pode vincular adicionais específicos a cada produto e gerenciar ingredientes removíveis.
- **ATTENDANT:** A RLS possui apenas uma policy pública `FOR SELECT`. Isso significa que o atendente **não consegue fazer atualizações**, apenas visualizar. A tela exibe um banner claro e os botões de ação administrativa ficam ocultos. Tentativas de escrita via console são bloqueadas diretamente pelo banco (RLS).
- **Vínculo de Adicionais:** Implementado via tabela `product_addons`. O administrador define quais adicionais aparecem para cada produto, evitando que adicionais de krep apareçam em sucos, por exemplo.
- **Vínculo de Ingredientes:** Implementado via tabela `product_ingredients`. Define quais itens podem ser removidos do produto original.
- O frontend **não** tenta contornar a RLS nem usa service role.

> **Simplificação temporária (MVP):** O schema atual não possui campo `is_sold_out` separado. No MVP, usamos `active = false` como equivalente a "Esgotado/Indisponível" na interface. Na prática, quando o ADMIN marca um produto como indisponível, ele desativa o campo `active`, o que também remove o produto da tela de novo pedido.
>
> Futuramente o ideal será separar:
> - `active` (BOOLEAN): controle administrativo — se o produto existe no cardápio.
> - `is_sold_out` (BOOLEAN): controle operacional — se o produto está temporariamente esgotado mas ainda consta no cardápio.
>
> Isso exigirá uma migration adicionando a coluna, ajuste nas Edge Functions e na tela de pedidos.

O backend usa `menuApi.updateProduct()` e `menuApi.updateAddon()` (em `src/lib/api/menu-api.ts`) para fazer updates diretos na tabela via Supabase client, respeitando RLS.

### 8. Caixa / Fechamento do Dia (`/app/caixa`)
A tela de caixa foi implementada como um resumo operacional simples do dia, sem Mercado Pago, Pix automático, abertura/fechamento formal de sessão, relatórios avançados ou exportação.

**Tabelas usadas:**
- `orders`: fonte principal para totais, status, forma de pagamento, descontos, taxa de embalagem e pedidos pendentes.
- `order_items`: usada apenas para agrupar os produtos mais vendidos do dia por `product_name_snapshot`.

**Regra de período:**
- A consulta considera pedidos com `created_at` maior ou igual ao início do dia atual no horário local do navegador.

**Cálculos principais:**
- `totalBruto`: soma de `total_amount` dos pedidos com `status != CANCELADO`.
- `totalRecebido`: soma de `total_amount` dos pedidos com `payment_status = PAID` e não cancelados.
- `totalPendente`: soma de `total_amount` dos pedidos com `payment_status = PENDING` e não cancelados.
- `totalCortesia`: soma de `total_amount` dos pedidos com `payment_status = COURTESY` e não cancelados.
- `totalCancelado`: soma de `total_amount` dos pedidos com `status = CANCELADO`.
- `ticketMedio`: `totalRecebido / quantidade de pedidos pagos`.
- Descontos e taxa de embalagem consideram apenas pedidos não cancelados.

**Forma de pagamento:**
- PIX, Dinheiro, Débito e Crédito contam apenas pedidos pagos (`payment_status = PAID`) com o respectivo `payment_method`.
- Cortesia e Pendente aparecem separados e não são tratados como faturamento recebido.

**Limitações atuais:**
- A tela usa `orders` como fonte principal. Ela não cruza com `payments`, então não audita múltiplos pagamentos, estornos parciais ou divergências entre pedido e pagamento.
- O schema real usa a coluna `packing_fee`; a interface apresenta esse valor como taxa de embalagem. Não foi criada migration para renomear a coluna.
- O schema atual não possui `subtotal_amount` em `orders`; por isso o resumo usa `total_amount` conforme a regra do MVP.
- A visibilidade depende da RLS do usuário logado. O frontend não usa service role.

**Próximos passos específicos do caixa:**
- Avaliar uso da tabela `payments` para auditoria quando houver fluxo financeiro mais completo.
- Criar sessões reais de caixa (`cash_sessions`) somente quando a regra operacional de abertura/fechamento estiver definida.
- Adicionar exportação e relatórios depois do piloto.

### 9. Segurança Backend (Trust-no-client)
Para garantir a integridade total do sistema, o backend (Edge Functions) revalida cada centavo e cada regra de negócio:
- **Cálculo de Preço:** O preço final é recalculado no servidor buscando os valores atuais das tabelas `products` e `addons`. O payload do cliente pode enviar preços, mas eles são ignorados para a persistência final.
- **Validação de Adicionais:** As funções `create-attendant-order`, `add-items-to-order` e `create-public-order` verificam se cada `addon_id` enviado está vinculado ao `product_id` na tabela `product_addons`. Se um cliente tentar burlar a UI e enviar um adicional não permitido, a requisição é rejeitada com erro 400.
- **Validação de Ingredientes:** Verifica se o ingrediente a ser removido realmente faz parte da composição do produto via `product_ingredients`.
- **Permissões de Role:** As Edge Functions administrativas validam o JWT e consultam o perfil do usuário para garantir que apenas `ADMIN` ou `ATTENDANT` (conforme o caso) executem ações.

### 10. Gestão de Usuários (`/app/usuarios`)
A tela de gestão de usuários permite que administradores criem novos membros da equipe, editem papéis (`ADMIN` vs `ATTENDANT`) e desativem acessos.
- **Segurança:** Bloqueia desativação do próprio usuário se ele for o único admin ativo.
- **Design:** Interface premium com avatares dinâmicos, estatísticas de equipe e glassmorphism.
- **Backend:** Todas as operações via Edge Function `manage-users` com auditoria completa.

### 11. Auditoria e Estabilidade (Release Candidate)
O sistema passou por um processo de auditoria abrangente para o lançamento do MVP:
- **Consistência de Configurações:** Unificação das chaves de sistema (`apply_packaging_fee_for_takeout`) entre frontend, backend e sementes (seeds).
- **Tratamento de Erros:** Implementação de um extrator de erros robusto no `pdv-api.ts` para depuração facilitada de Edge Functions.
- **Segurança de Acesso:** Verificação sistêmica da obrigatoriedade do campo `profiles.active` em todas as mutações de dados.
- **Qualidade de Código:** Validação de build bem-sucedida e tipagem TypeScript rigorosa em componentes compartilhados (ex: `PageHeader`).

### 12. Maturidade do MVP
O sistema atinge o status de **Release Candidate (RC)** pronto para homologação operacional:
- [x] **Segurança:** RLS e Trust-no-client 100% ativos.
- [x] **Financeiro:** Cálculos de total, descontos e taxas centralizados no servidor.
- [x] **Operacional:** Fluxo de pedidos, produção e entrega validado e documentado.
- [x] **Comunicação:** WhatsApp e Impressão integrados via filas assíncronas.
- [x] **Administração:** Controle total de cardápio e equipe via painel logado.

### 13. Próximos Passos (Go-Live)
1. **Implantação em Produção:** Seguir o [`docs/deployment-checklist.md`](docs/deployment-checklist.md).
2. **Homologação Local:** Executar a bateria de testes em [`docs/mvp-operational-test.md`](docs/mvp-operational-test.md) com hardware real.
3. **Treinamento:** Apresentar o fluxo de "Adição à Comanda" e "Reimpressão" para a equipe.
4. **Monitoramento:** Acompanhar `audit_logs` nos primeiros dias de operação real.
