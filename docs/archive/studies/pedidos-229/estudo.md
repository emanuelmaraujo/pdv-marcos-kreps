# Operação de pedidos #229 — estudo e protótipo local

Data: 2026-10-27. Referência: [issue #229](https://github.com/emanuelmaraujo/pdv-marcos-kreps/issues/229).
Base consultada: `e17dfec103e917cf3ea40d06ba9461f4fc3a5767`, branch da tarefa `cez/74b5ea0d`.
**Proposta para revisão; nenhum comportamento de produção foi alterado.** Escopo
aprovado nesta sessão: preparar estudo e protótipo local. Não autoriza alterações
financeiras, auth, migrations, dados reais, impressão física, merge ou deploy.

## Abrir e avaliar

Abra [o protótipo HTML](prototipo.html) diretamente no navegador. Funciona sem
servidor, dependências ou conexão. Não usa fetch, armazenamento, Supabase, fontes
externas nem impressora. Recarregar limpa todos os dados. A CSP bloqueia conexões.
As ações financeiras são demonstrações em memória, sem valor contábil.

Use “Antes (esquemático)” para comparar a hierarquia atual representada a partir do
código com “Quadro proposto” e “Checkout proposto”. O antes **não é screenshot do
aplicativo**. Não foi aberto o app autenticado nem carregada configuração real.
O espelho “Segunda pessoa” usa a mesma memória: demonstra a informação necessária,
mas **não comprova Realtime, duas sessões, RLS ou concorrência**.

## Inventário verificado

| Área / fonte no checkout | Estado do código | Consequência |
| --- | --- | --- |
| [OrderCard](../../../../src/app/app/pedidos/components/OrderCard.tsx) | Número recebe bloco próprio; até 4 linhas resumidas; PRONTO_PARCIAL abre detalhes | Priorizar nome e manter controles por unidade acessíveis no quadro |
| [OrderItemsControl](../../../../src/app/app/pedidos/components/OrderItemsControl.tsx) | Ciclo por linha e entrega sequencial dos prontos no detalhe | Reutilizar semântica; não tratar loop como transação |
| [Página do quadro](../../../../src/app/app/pedidos/page.tsx) | Realtime, reconciliação, foco, polling e seleção por pedido | Preservar drafts e identidade; acrescentar eventos novos sem reordenar sob toque |
| [OrderSummarySheet](../../../../src/components/checkout/OrderSummarySheet.tsx) | Itens → Cliente → Pagamento; telefone antes do nome; estimativa de embalagem | Reordenar identificação sem alterar regras de cadastro; cotar no servidor |
| [Criação interna](../../../../supabase/functions/create-attendant-order/index.ts) | split_bill cria aguardando pagamento e posterga impressão; calcula embalagem por filial/configuração | Produção antes de quitação é decisão de negócio ainda não aprovada |
| [Edição de item](../../../../supabase/functions/edit-order-item/index.ts) | Só NA_FILA, item não pago; bloqueia ON_DELIVERY | Não reutilizar para viagem tardia |
| [RPC de pagamento](../../../../supabase/migrations/20260817060000_pay_order_items_transactional.sql) | Seleção de linhas inteiras, transação e lançamento financeiro | Valor por parcela exige contrato novo, não reaproveitar entrada de troco |
| [PrinterJob](../../../../src/types/pdv.ts) e [card de impressão](../../../../src/app/app/impressao/components/PrinterJobCard.tsx) | PENDING/PROCESSING/PRINTED/FAILED/SKIPPED; content genérico; setor e pedido | Job não fornece sozinho cobertura normalizada por unidade/lote |

Leitura estática, não auditoria completa de caixa. Não atesta banco publicado,
configuração de filial, entrega física do papel ou reconciliação financeira real.
Mesmo PRINTED é evidência do worker, não prova física adicional de repasse humano.

## Jornada dos dois operadores

| Momento | Maria: atendimento/caixa | João: anotação/produção | Informação compartilhada necessária |
| --- | --- | --- | --- |
| Registrar | Nome primeiro, telefone conforme regras; conferir total e viagem | Continua itens anteriores | Identidade estável do pedido e lote |
| Repassar manual | Não assume que criação já repassou | Escreve e entrega, só depois confirma unidades | Autor, hora, setor e quantidade confirmada |
| Impressora | Vê pendência/falha sem supor impressão | Confere saída; recuperação manual explícita se falhar | Job e cobertura; falha preservada no histórico |
| Preparo parcial | Recebe parcelas sem esconder itens | Marca uma unidade pronta, segue as outras | Eixos de produção e financeiro separados |
| Entregar | Entrega somente READY no balcão/viagem | Continua pendentes; delivery aguarda despacho próprio | Contagem de prontos inclui entregues; contagem de entregues separada |
| Acréscimo | Novo lote, novo saldo e cotação | Novo lote volta a exigir repasse | Não resetar confirmações do lote anterior |
| Viagem tardia | Seleciona elegíveis, vê política de taxa | Vê EMBALAR, inclusive após pronto | Evento suplementar, sem reimpressão integral silenciosa |

## Desenho visual e comportamento proposto

Nome grande primeiro, número/filial secundários legíveis; setores/lotes e IDs
continuam rastreáveis. Cards não duplicam entre colunas financeiras. Itens mantêm
posição enquanto há foco/seleção; atualização concorrente não troca alvo do toque.
Busca/filtros futuros: aguardando repasse, pronto para entregar, saldo pendente.

Precedência da superfície por unidade: repasse pendente/falha em vermelho; se
repassado, em preparo/aguardando em âmbar, pronto em azul, entregue em verde.
Produção concluída pode usar verde no resumo, mas impressão usa ícone/texto neutros
e pagamento usa símbolo/valor próprio. Falha de job continua explícita mesmo com
recuperação manual. Texto e ícone acompanham cor; sem animações ou reorder automático.

Contagem é de **unidades ativas**, não de linhas: 1/3 repassados na linha quantity=3.
Prontos = READY + DELIVERED; entregues = DELIVERED; cancelados ficam no histórico,
fora dos denominadores. Falta de cobertura histórica significa “repasse desconhecido”,
nunca “impresso”. O protótipo expande cada unidade; UI final pode recolher grupos
sem perder indicador ou seleção por unidade. Quantidades não inteiras precisam de
análise antes da expansão: não criar unidades físicas artificiais para produtos pesados.

Seleção mantém IDs + versões. Ação em lote mostra quantidade elegível antes de envio;
feedback deve identificar erro e reconciliação, sem prometer sucesso parcial como total.
Sem conexão: ler cache sinalizado, bloquear confirmação/recebimento; não enfileirar
cobranças offline. Erro/reconexão preserva formulário e reconsulta estado autoritativo.

Checkout proposto mantém resumo/total e confirmação próximos, nome antes do telefone,
seleção explícita de todos/nenhum/individual e cotação de embalagens antes de salvar.
Busca de cliente oferece aplicar sugestão, nunca sobrescreve nome digitado. Telefone
vazio continua permitido somente nos casos já admitidos; delivery mantém exigências.
O protótipo mostra uma composição única para avaliação; não implementa cadastro,
fidelidade, entrega, adicionais, descontos ou cálculo real de taxas.

## Matriz de transições e contrato proposto

| Eixo | Ação e pré-condição | Resultado permitido | Proibições |
| --- | --- | --- | --- |
| Repasse manual | Confirmar IDs de unidades e versões após repasse físico | Evento MANUAL com ator e hora do servidor | Nunca READY/DELIVERED implícito |
| Impressão | Worker confirma job da cobertura exata | PRINTED somente para unidades cobertas | PENDING/PROCESSING/SKIPPED não confirmam |
| Recuperação | Operador confirma motivo e repasse manual | Evento MANUAL_RECOVERY vinculado ao job | Não apagar FAILED nem duplicar confirmação |
| Correção | Papel autorizado, motivo obrigatório, versão atual | Evento de reversão vinculado ao anterior | Sem reset silencioso ou alteração de auditoria |
| Preparo | PENDING → IN_PREPARATION; PENDING ou IN_PREPARATION → READY | Só unidades selecionadas | Não depender do agregado PRONTO_PARCIAL |
| Entrega balcão/viagem | READY → DELIVERED | Só elegíveis | Não entregar pendentes; delivery segue despacho/motoboy |
| Cancelar/corrigir | Autorização e motivo; validar impacto de item pago | Histórico e recomputação autoritativa | Sem estorno implícito via controle operacional |
| Embalagem tardia | Unidade não cancelada/entregue; cotação válida | Evento de embalagem e aviso suplementar | Não editar adicionais ou valor quitado |
| Recebimento | Saldo positivo, centavos e chave idempotente | Parcela e saldo derivados atomicamente | Sem saldo negativo, dupla baixa ou troco como receita |

### Dados, concorrência e migração — desenho, não implementação

Propor camada operacional por unidade mantendo `order_items` compatível: identidade
estável `(branch_id, order_item_id, unit_no)`, `addition_batch_no`, setor, versão,
status e embalagem. Histórico append-only de repasse/embalagem com ator autenticado,
hora do servidor, origem, motivo, pedido e chave idempotente. Não confiar em ator,
filial, preço ou setor enviados pelo navegador. RLS deve derivar acesso do vínculo
do usuário à filial; FK composta deve impedir referências cruzadas entre filiais.

Cobertura normalizada de impressão relaciona job → item → lote → unidades → revisão
do conteúdo. Reimpressão acrescenta tentativa, não confirma duas vezes nem apaga
repasse anterior; impressão antiga não cobre acréscimo/alteração posterior. Job sem
cobertura legada não é promovido automaticamente. Configuração por filial/setor usa
modo MANUAL ou PRINTER, com recuperação manual explícita e histórico da mudança.
Modo híbrido é a combinação por setor, sem inferir modo a partir da saúde do worker.

Comandos propostos (nomes indicativos): `confirm_production_handoff`,
`transition_order_units`, `quote_takeout_change`, `apply_takeout_change`,
`receive_order_amount`. Envelope comum: command_id, order_id, expected_version,
unit_ids e payload validado. Resposta: estado autoritativo e versão. Mesmo comando
repetido retorna o resultado original; mesma chave com payload diferente é conflito.

RPC batch proposta é **atômica**: bloquear pedido e unidades em ordem estável,
validar autorização, versões e todas as transições antes de escrever. Se uma unidade
ficou inelegível por ação concorrente, nada muda, responder conflito e reconsultar;
a UI oferece revisar a seleção. Sem loop de requisições ou retry com nova chave.
Recomputar agregado somente após a mutação; não concluir pedido com unidades ativas
pendentes. Implementar caminho de compatibilidade para clientes antigos antes do rollout.

Realtime/publicação futura cobre eventos operacionais + versões; polling/foco
reconcilia lacunas e descarta respostas antigas, preservando draft/seleção elegível.
Duas sessões disputando a mesma versão: uma confirma; outra recebe conflito, sem
confirmação otimista persistente. Não confiar na chegada ordenada de eventos.

Lista de migrações/RPCs para revisão posterior: unidades operacionais e backfill;
eventos imutáveis; cobertura de jobs e revisão; configuração por setor; batch
transacional; ledger/alocação de parcelas e cotação de embalagem. **Nenhum SQL foi
criado nesta etapa:** o escopo exclui migrations. SQL executável depende da aprovação
deste contrato e da auditoria do schema/caixa completo; não é seguro escolher um
schema financeiro somente com leitura da RPC existente.

Backfill proposto preserva totais e IDs existentes, marca repasse legado como
UNKNOWN, não inventa autoria/horário. Testar rollback e compatibilidade; liberar
por filial após validação isolada. Não publicar enquanto clientes antigos puderem
sobrescrever estados por unidade com estado agregado obsoleto.

## Contrato financeiro para revisão humana

Proposta: ledger imutável de parcelas em centavos, método, ator, chave, pedido,
filial e alocações. Estorno referencia a parcela original e limita saldo estornável.
Bloqueio do pedido serializa recebimentos e mudanças de composição. Saldo e
payment_status são derivados, nunca entrada do cliente. Conversão e arredondamento
no limite servidor; não usar floats de reais para soma. Compatibilizar relatórios,
caixa, descontos, taxa de entrega/embalagem, iFood, cortesias e reembolso antes de
substituir a RPC atual. Parcela por valor não pode marcar itens ficticiamente pagos.

Exemplos de aceite: R$ 90,00 → dinheiro 30 + Pix 40 + cartão 20, três registros e
saldo zero; só dinheiro 30 → saldo 60. Espécie entregue 50 para quitar 30 → receita
30, troco 20, saldo 60. Dividir 100,00 por três → 33,34 + 33,33 + 33,33. Lançamentos
simultâneos de 60 e 60 em saldo 90 não podem somar 120. Retry não duplica parcela.

Por item atualmente significa linha inteira. Nova alocação por unidade/valor deve
definir como quitar taxas/descontos e refletir item parcialmente pago sem mentir.
Proposta para `split_bill`: preservar a postergação atual até decisão explícita
sobre permitir produção antes da quitação; a tela deve exibir essa consequência.

Viagem tardia paga: **proposta padrão do protótipo é isenção auditada**, sujeita a
aprovação de negócio e permissão do operador. Alternativa: cotação gera encargo
novo separado, comunicado e recebido explicitamente; não reescreve receita quitada.
Pedido delivery continua ENTREGA; derivação balcão/viagem considera só unidades
ativas. Mudança gera aviso suplementar somente para unidades afetadas.

## Plano de validação e entregas futuras

| Cenário obrigatório | Cobertura nesta etapa | Gate para implementação |
| --- | --- | --- |
| 1, 3 crepes e quantity=3 | Cenários do protótipo com confirmação por unidade | Integração com persistência e contagens legadas |
| Impressora/manual/híbrido, acréscimo | Jobs simulados; falha e repasse independentes | Worker e cobertura de jobs em banco isolado |
| Parcial, seleção e entrega | Controles no cartão, delivery sem entrega direta | Batch atômico e conflitos concorrentes |
| Nome, viagem todos/individual | Checkout demonstrativo, R$ 2/un ilustrativos | Cotação de servidor e regras de cadastro |
| Viagem pronta/paga | Aviso EMBALAR com isenção simulada | Aprovação da política, autorização e auditoria |
| 90 = 30 + 40 + 20; saldo; centavos | Simulação local | Auditoria de caixa e testes de transação |
| Duas pessoas, reconexão e RLS | Espelho e offline visuais | Dois browsers, duas sessões e filiais sintéticas |
| Escuro/claro e 360/390/tablet/desktop | Capturas e checks de layout, ver relatório | Teclado virtual real, leitor de tela e observação no balcão |

Medição de toques proposta (hipótese, não benchmark observado):

| Rotina | Antes pela estrutura do código | Meta proposta | Como medir com operadores |
| --- | --- | --- | --- |
| Confirmar repasse de 1 unidade | Não existe ação equivalente | 1 após escrever/entregar | Do papel entregue ao feedback |
| Marcar pendente pronto em parcial | Abrir detalhe + ação (≥2) | 1 no cartão | Mesma unidade e cenário |
| Entregar 1 pronto em parcial | Abrir detalhe + entregar (≥2) | 1 no cartão | Sem contar entrega física |
| Viagem todos no fim | Sem ação em massa equivalente | 1 + revisar cotação | Registrar número de unidades |
| Recebimento integral | Abrir recebimento + fluxo atual (não medido) | Abrir + confirmar (2) | Incluir método/troco quando necessário |

Não extrapolar protótipo para ganho de tempo real; observar erros, retrabalho e
latência com duas pessoas, sem dados de clientes. Entregas futuras, após aprovação:
repasse/cobertura visual; unidade/batch; checkout/embalagem; financeiro. Cada uma
exige diff revisável, testes locais e integração isolada; produção continua fora.

## Decisões pendentes do gate

1. Aprovar representação por unidade e tratamento de quantidades não inteiras;
   compatibilidade, backfill UNKNOWN e cobertura de jobs legados.
2. Aprovar autorização para confirmar/corrigir repasse e isentar embalagem;
   decidir isenção versus novo encargo na viagem paga.
3. Decidir produção antes da quitação em split_bill, mantendo padrão atual até lá.
4. Aprovar contrato contábil/alocações e migrações propostas em etapa posterior,
   com auditoria de caixa independente antes de qualquer alteração financeira.

Este documento e o protótipo concluem somente o estudo local. Não resolvem a issue
integralmente. Aprovação visual não autoriza migrations ou mudança financeira.

Evidências executadas e limitações: [relatório de validação](validacao.md).
