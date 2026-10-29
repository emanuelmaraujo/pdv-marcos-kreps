# Repasse à produção no quadro de pedidos — etapa 1A

Implementação local da issue #229, revisada em 2026-10-27. Não comprova migration
aplicada, função publicada ou impressão física. A ativação em produção exige
aprovação própria. [Estudo e limites por etapa](../archive/studies/pedidos-229/continuacao-etapa-1.md).

## Como operar

No quadro, o nome identifica o cliente; número e filial continuam visíveis para
rastreabilidade. Cada linha mostra preparo, observações, adicionais e repasse por
unidade, independentemente do status agregado. Em quantity=3, confirmar uma unidade
não confirma as outras duas. Itens sem setor de produção não exigem repasse.

ADMIN da filial configura em **Repasse por setor**: anotação manual ou evidência de
impressão, de forma independente para Kreps e cozinha/sucos. Confira a configuração
de impressão existente: este controle não liga/desliga impressoras nem muda cópias.
Não há ativação automática após a migration. Falta de configuração é sinalizada,
e não é interpretada como item anotado. Configuração tem versão e auditoria.

No manual, só pressione **Anotado e repassado** depois de escrever e entregar a
comanda. O registro usa o usuário e horário do servidor e aparece no outro
atendimento por Realtime, com reconciliação por polling/foco caso haja lacuna.

Na impressora, pendente e imprimindo não significam impresso. Somente confirmação
do job pelo worker, com cobertura exata da revisão/unidade, comprova impressão.
Jobs antigos sem cobertura permanecem desconhecidos. Reimpressão cria tentativa
nova sem apagar histórico ou confirmar duas vezes a mesma unidade. A tela de
impressão existente continua responsável por solicitar reimpressões.

Quando for necessário repassar à mão em setor configurado com impressora,
informe o motivo e use **Confirmar recuperação manual**. A falha do job continua
visível. Em **Histórico e correção**, ADMIN pode corrigir confirmação manual com
motivo obrigatório; não pode apagar evidência de impressão por esse botão.

Ao editar conteúdo, observação, embalagem, quantidade, adicionais ou removidos,
a revisão muda e exige novo repasse. Histórico anterior fica preservado; job antigo
não cobre o conteúdo novo. Acréscimos são identificados por lote e não resetam o
repasse dos itens existentes. Preparar, pagar ou entregar não equivale a repassar.

## Concorrência e recuperação

As confirmações são transações: autorização por filial, revisão/versão esperada,
estado, evento e resultado idempotente são validados juntos. Duas pessoas que
confirmam a mesma versão não geram dois eventos: a segunda recebe conflito ou
resultado já registrado e precisa atualizar. Comando repetido conserva a chave;
mesma chave com outro conteúdo é rejeitada. A interface conserva a chave se o
resultado de rede for incerto e oferece verificar novamente a mesma operação.

Sem conexão, os novos botões de repasse ficam bloqueados. O quadro mantém os
últimos pedidos carregados, identificados como desatualizados se uma consulta
falhar. Reconecte e atualize. Se a consulta de repasse
falhar, o restante do quadro continua acessível e o repasse aparece indisponível,
sem presumir sucesso. Erros de autorização ou conflito não deixam confirmação
parcial. Atualização do repasse também é detectada quando o updated_at do pedido
não muda, preservando os mecanismos de refresh existentes.

## Limites desta entrega

Preparo e entrega continuam pelos contratos existentes, **por linha inteira**,
inclusive quando quantity>1. O cartão informa essa limitação. Produção por unidade
e ações em lote atômicas pertencem à 1B; esta entrega não resolve esses aceites.
Delivery continua dependendo do fluxo de motoboy. Pedidos pré-fila, cancelados,
expirados ou concluídos não recebem confirmação manual. Itens entregues/cancelados
não podem ser confirmados. Não houve mudança na liberação de split_bill, regras
financeiras, COD, valores, taxas, caixa ou contratos de pagamento.

Os produtores de comandas foram adaptados somente para incluir metadados de
cobertura e ler o mesmo snapshot persistido que alimenta o texto. Migration e
funções precisam ser disponibilizadas de forma coordenada antes da ativação.
O worker continua consumindo `content.text`; não houve alteração do protocolo.
Snapshots obsoletos não recebem cobertura; a impressão existente é preservada e
a UI exige conferência em vez de inventar confirmação.

## Verificação local

`npm run test:database` cria banco descartável e remove somente essa instância.
O roteiro `npm run test:database -- --handoff-qa` acrescenta duas sessões de teste,
concorrência por HTTP e navegador na aplicação real, com usuários/dados sintéticos
exclusivos das portas 554xx. Requer Docker, Playwright e Chromium já disponíveis.
Variáveis PDV_QA_PLAYWRIGHT e PDV_QA_CHROMIUM apontam somente para ferramentas
locais; não use `.env` nem chaves de serviço reais. TMPDIR=/tmp evita limite de
caminho de socket em worktrees longos.

[Evidências e resultados da etapa 1A](../evidence/pedidos-229/etapa-1a/relatorio.md).

## Disponibilização e reversão (somente com autorização de operação)

Ordem necessária para futura disponibilização: migration aditiva com configuração
desativada; funções que incluem metadados de cobertura; frontend; conferência e
ativação por filial/setor. Publicar funções que selecionam handoff_revision antes
do schema pode interromper consultas de comanda. Esta tarefa não executa essa
sequência em nenhum ambiente real.

Reversão operacional: desativar repasse e retornar ao frontend anterior, preservando
tabelas/eventos. Não apagar histórico nem executar down destrutivo como rollback.
A revisão de produção por unidade da 1B permanece separada e não pode criar uma
segunda fonte de status concorrendo com os escritores atuais.
