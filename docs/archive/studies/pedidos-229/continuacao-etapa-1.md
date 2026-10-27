# #229 — revisão crítica e proposta incremental da etapa 1

Revisão: 2026-10-27. HEAD consultado: `71d848f` (estudo preservado).
Este complemento **não substitui** [estudo](estudo.md), [protótipo](prototipo.html)
ou [evidências](validacao.md). Pedido atual autoriza continuar a implementação,
mas exige apresentar migrations antes de alterar banco e proíbe executá-las sem
autorização. Nenhum SQL deste documento foi executado. Nenhuma migration de deploy
foi adicionada. Este é o pacote para o primeiro gate, não uma etapa funcional entregue.

## Correções ao contrato anterior

| Achado confirmado no código | Risco do estudo/protótipo | Decisão proposta |
| --- | --- | --- |
| `order_items.quantity` é INTEGER positivo no schema inicial | Expandir unidades em memória parece equivalente a persistência | Usar ordinal estável por item para repasse; não duplicar linhas financeiras |
| Status e pagamento são derivados por triggers de `order_items` | Segunda tabela de produção pode divergir e concluir pedido antes da hora | Etapa 1A não cria segunda fonte de status; 1B exige adaptar todos os escritores e agregação juntos |
| `update-order-item-status` lê status e depois atualiza só por ID | Dois operadores podem validar o mesmo estado e uma escrita posterior sobrescrever a outra | Não reutilizar endpoint como batch seguro; 1B deve centralizar CAS/locks no banco |
| Jobs de criação/reimpressão gravam texto sem cobertura normalizada | `PRINTED` do pedido não comprova repasse de item acrescido | Persistir cobertura por revisão/unidade no mesmo commit de criação do job |
| `production_sector` já é snapshot no item | Consultar setor atual do produto pode mover pendência antiga | Derivar setor do item; itens NONE não exigem comanda de produção |
| Auditoria atual do endpoint é posterior à escrita e erro não é verificado | UI pode mostrar sucesso sem trilha completa | Novo comando de repasse grava estado, resultado idempotente e evento na mesma transação |
| O HTML tem espelho na mesma memória e ignora autorização | Simulação pode mascarar RLS, atraso e conflito | QA da aplicação com fixtures + integração separada em banco descartável; não alegar teste real com duas sessões só por screenshot |

Fontes: [schema](../../../../supabase/migrations/20260502232400_init_pdv_schema.sql),
[ciclo e agregação](../../../../supabase/migrations/20260516000100_per_item_lifecycle.sql),
[endpoint por item](../../../../supabase/functions/update-order-item-status/index.ts),
[reimpressão](../../../../supabase/functions/reprint-order/index.ts),
[criação](../../../../supabase/functions/create-attendant-order/index.ts).
A revisão local não prova quais migrations estão aplicadas remotamente.

## Sequência de entregas e gates

| Entrega | Mudança e aceite observável | Banco/financeiro e autorização |
| --- | --- | --- |
| 1A · Quadro + repasse | Nome primeiro; três eixos; confirma 1/3 unidades; autoria/hora; jobs com cobertura; acréscimos independentes; duas sessões veem a confirmação | M1–M3 abaixo, aditivas, dependem deste gate. Nenhuma mudança financeira |
| 1B · Produção e entrega parcial | Ações no cartão independentes de PRONTO_PARCIAL; unidades e lote atômico; só READY entrega; delivery conserva despacho | Nova proposta de migration para unidade/compatibilidade; novo gate antes de escrever schema |
| 2A · Checkout | Nome antes do telefone, sugestão sem sobrescrita, resumo/CTA e viagem todos/nenhum/individual | Reusar cotação/contrato atuais; não alterar caixa ou split_bill |
| 2B · Viagem tardia | Embalar elegíveis, inclusive pago/pronto; isenção explicitamente auditada; aviso suplementar | Proposta própria de RPC/migration; preserva receita/valores quitados e ENTREGA; novo gate |
| 3 · Recebimentos | Integral curto; parcelas por valor/método; centavos, saldo e estorno consistentes | Auditoria do caixa e proposta contábil próprias, com aprovação antes de alterar contratos |

Na 1A, `quantity=3` permite repasse 1/3, mas preparo/entrega continuam por **linha
inteira** até 1B: indicar essa limitação na aplicação e no relatório. Não desenhar
três botões de produção que mutam a mesma linha. Seleção de produção em lote só
entra com 1B. Não considerar 1A como aceite completo de P0.B.

Não mudar a liberação de produção de `split_bill`. Pedido pré-fila mantém ações de
produção bloqueadas. COD mantém aceite/total e entrega via motoboy. Esta sequência
não exige alterar autenticação ou conceder novos papéis.

## Migrations propostas para 1A

Nomes abaixo são objetivos, **não timestamps definitivos**. Após aprovação, gerar
arquivos pelo CLI local; não modificar migrations anteriores. Não incluir SQL de
estudo em `supabase/migrations` antes do gate para evitar aplicação pelo deploy.

### M1 — configuração, revisão, unidades de repasse e comandos

A configuração por filial/setor tem ativação explícita; ausência de configuração
significa **não configurado**, nunca confirmação automática ou modo manual inferido
por impressora offline. Inicialização deve consultar o contrato atual de impressão
por filial e exigir conferência do responsável. Estado da impressora não muda modo.

SQL estrutural proposto (revisável, **não é migration completa executável**):

```sql
-- Relações compostas para impedir mistura de item/pedido/filial.
ALTER TABLE public.orders ADD CONSTRAINT orders_handoff_scope UNIQUE (id, branch_id);
ALTER TABLE public.order_items ADD CONSTRAINT items_handoff_scope UNIQUE (id, order_id);
ALTER TABLE public.order_items ADD COLUMN handoff_revision bigint NOT NULL DEFAULT 1
  CHECK (handoff_revision > 0);

CREATE TABLE public.production_handoff_config (
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  sector text NOT NULL CHECK (sector IN ('KITCHEN','JUICE_POTATO')),
  mode text NOT NULL CHECK (mode IN ('MANUAL','PRINTER')),
  enabled boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, sector)
);
CREATE TABLE public.production_handoff_commands (
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  command_id uuid NOT NULL,
  order_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, command_id),
  FOREIGN KEY (order_id, branch_id) REFERENCES public.orders(id, branch_id)
);
CREATE TABLE public.production_handoff_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  unit_no integer NOT NULL CHECK (unit_no > 0),
  revision bigint NOT NULL CHECK (revision > 0),
  batch_no smallint NOT NULL CHECK (batch_no > 0),
  sector text NOT NULL CHECK (sector IN ('KITCHEN','JUICE_POTATO')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  state text NOT NULL CHECK (state IN ('UNKNOWN','PENDING','CONFIRMED','SUPERSEDED')),
  confirmed_by uuid REFERENCES public.profiles(id),
  confirmed_at timestamptz,
  UNIQUE (order_item_id, revision, unit_no),
  UNIQUE (id, order_id, branch_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES public.order_items(id, order_id),
  FOREIGN KEY (order_id, branch_id) REFERENCES public.orders(id, branch_id)
);
CREATE INDEX handoff_units_order ON public.production_handoff_units(branch_id,order_id);
```

O comando deve validar `unit_no <= quantity`, revisão e setor com locks; não basta
CHECK local. Estado CONFIRMED exige origem persistida em evento; confirmação manual
exige confirmed_by; impressão tem ator do worker/job, sem inventar usuário humano.
Não usar o mesmo campo humano para atribuir impressão automática. O campo de estado
é projeção, o histórico abaixo é imutável. Migration final acrescentará constraints
coerentes com cada origem e testes, sem usar JSON de cliente como autoridade.

Trigger de INSERT cria unidades PENDING apenas de pedidos novos com configuração
ativa; legado é UNKNOWN. NONE fica fora. Configuração desativada não apaga histórico.
Backfill com generate_series(1,quantity) preserva IDs e totais; não inventa autoria,
horário ou impresso. Ativar exige dimensionar linhas geradas em catálogo sintético.
Alteração de conteúdo/quantidade/setor/observação/adicionais exige incrementar
revisão e preservar a anterior SUPERSEDED; triggers nas tabelas de adicionais e
remoções também invalidam a cobertura. Edição de um mesmo item nunca reutiliza
confirmação antiga. Atualizações de status/pagamento isoladas não invalidam repasse.

### M2 — eventos, cobertura e comandos transacionais

```sql
CREATE TABLE public.production_handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  order_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  command_id uuid NOT NULL,
  origin text NOT NULL CHECK (origin IN ('MANUAL','PRINT','MANUAL_RECOVERY','REVOKE')),
  actor_id uuid REFERENCES public.profiles(id),
  printer_job_id uuid REFERENCES public.printer_jobs(id),
  reverses_event_id uuid REFERENCES public.production_handoff_events(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (unit_id, order_id, branch_id)
    REFERENCES public.production_handoff_units(id, order_id, branch_id),
  FOREIGN KEY (branch_id, command_id)
    REFERENCES public.production_handoff_commands(branch_id, command_id)
);
ALTER TABLE public.printer_jobs ADD CONSTRAINT jobs_handoff_scope
  UNIQUE (id, order_id, branch_id);
CREATE TABLE public.production_print_coverage (
  printer_job_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  order_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  PRIMARY KEY (printer_job_id, unit_id),
  FOREIGN KEY (printer_job_id, order_id, branch_id)
    REFERENCES public.printer_jobs(id, order_id, branch_id),
  FOREIGN KEY (unit_id, order_id, branch_id)
    REFERENCES public.production_handoff_units(id, order_id, branch_id)
);
```

Na migration final: vínculos de reversão/job devem validar mesma unidade/filial,
origens exigem campos coerentes, comandos e eventos não aceitam escrita direta,
e eventos não podem ser editados/deletados por usuários da aplicação. Retenção e
exclusão física administrativa devem respeitar esse histórico, sem CASCADE que o
apague silenciosamente. Auditoria inclui configuração e correção, não só confirmação.

RPC proposta `confirm_production_handoff(command_id, order_id, targets, source,
job_id, reason)`, com targets = lista limitada de (unit_id, revision, version).
Autor/filial/hora são derivados no banco de auth.uid(), pedido e perfil ativo.
ATTENDANT/ADMIN com acesso atual à filial podem confirmar; somente ADMIN que possa
gerir a filial corrige/revoga ou muda modo, com motivo. Não mudar auth ou papéis.

Fluxo transacional obrigatório:

1. Validar perfil ativo, papel e acesso, inclusive antes de retornar replay.
2. Bloquear pedido e unidades em ordem estável. Validar target sem duplicatas,
   limites de tamanho, filiação, revisão, estado e quantidade.
3. Procurar chave (filial, command_id); payload canônico inclui ator e ação.
   Mesmo payload/ator devolve resultado; chave reutilizada diferente é conflito.
4. Confirmar todas ou nenhuma. Duas sessões na mesma versão: uma vence; outra
   recebe conflito e reconsulta. Confirmação repetida com chave nova não cria
   evento duplicado: responder já confirmado, sem atribuir a outro operador.
5. Persistir comando/resultado, projeção e eventos em uma transação; falha de
   auditoria cancela tudo. Retry conserva chave até resultado autoritativo.

A função será restrita a authenticated com validação de perfil e filial; se
SECURITY DEFINER for necessário para impedir DML direto, usar schema privado,
search_path vazio, wrapper invoker restrito, revogar PUBLIC/anon e testar negações.
Não adicionar definer apenas para contornar uma política inadequada.

### M3 — permissões, Realtime e cobertura na geração de jobs

Todas as tabelas novas em public terão RLS. Exemplo a completar para cada tabela:

```sql
ALTER TABLE public.production_handoff_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_handoff_units FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.production_handoff_units TO authenticated;
CREATE POLICY handoff_units_read ON public.production_handoff_units
  FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.active
      AND p.role IN ('ADMIN','ATTENDANT')
  ));
```

Reusar helpers existentes de filial, sem redefini-los. Eventos/unidades/config e
cobertura permitem leitura operacional por filial; comandos/resultados não devem
expor payload de outros operadores: leitura somente por RPC autorizada ou dono
atual com acesso à filial. Nenhuma nova tabela é acessível publicamente. Revisão
final deve testar também perfis inativos, COURIER, admin de outra filial e anon.
[Referência de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Publicar apenas projeção operacional necessária no Realtime, com RLS; eventos
podem ser buscados sob demanda. Não transmitir ledger ou payload completo de
comandos. Eventos são invalidação; reconsulta reconcilia estado, não aplica delta
cego. Preservar refresh concorrente, foco, polling e drafts atuais.

Job e cobertura devem nascer atomicamente, com a mesma revisão usada no texto.
Inventariar/adaptar **todos** os produtores (criação interna/pública, acréscimos,
quitação, confirmação COD e reimpressão), inclusive SQL que insere jobs. Não mudar
condições de liberação, conteúdo ESC/POS, número de cópias ou split_bill. Propor
RPC interna de inserção do job+coverage com transação; job sem coverage permanece
legado/desconhecido. O worker continua responsável pelo status real do job.

Projeção de impresso exige job PRINTED + cobertura da revisão corrente. PENDING,
PROCESSING, FAILED e SKIPPED nunca confirmam. Se existir impressão válida anterior,
falha de reimpressão é alerta independente, sem apagar o sucesso anterior. Recuperação
manual mantém falha visível e origem MANUAL_RECOVERY. Nenhuma confirmação de job
altera preparo/pagamento. Entrega física de papel não é garantida pelo ACK do worker.

## Experiência e diferença obrigatória frente ao protótipo

O protótipo ajuda a testar hierarquia; não será copiado como app final. Seletores
de cenários, sessão fictícia e espelho desaparecem. Reutilizar tokens/componentes
reais, nome prioritário, IDs secundários, ícones/texto/fundos legíveis e alvos de
44px. Levar controles por item ao cartão sem truncar modificadores importantes.

Na 1A, mostrar contagem de repasse por unidade, autor e horário reais do servidor;
o preparo ainda será por linha. Dados não carregados mostram desconhecido/loading,
não zero ou confirmado. Sem conexão bloqueia mutação com mensagem; reconexão
reconcilia. Não deslocar cartão sob seleção/interação. Não multiplicar cards por
pendência financeira nem recalcular saldo com uma nova fórmula de UI.

## Testes e evidências por entrega

Workflow com-revisao: implementar → testes locais → revisão independente → correções
→ aprovação humana. Nenhum autoaceite de segurança/caixa substitui revisão. Não
alterar YAML para pular gates. Sem merge/deploy automático.

1A exigirá unitários de cobertura/contagens, regressão dos adaptadores/refresh e
SQL em banco **descartável autorizado**: duas conexões concorrentes, replay,
conflito, correção, autoria, RLS multfilial, revisão/acréscimos e rollback de evento.
Testar job pendente/falha/legado/reimpressão e confirmação manual simultânea.
Preservar regressões COD/split_bill; não chamar serviço, WhatsApp ou impressora real.

Capturas futuras devem vir dos componentes reais da aplicação com fixtures
locais (360/390/tablet/desktop, claro/escuro), claramente identificadas como dados
sintéticos. Screenshots com API interceptada não provam persistência nem Realtime;
provar essas partes separadamente no banco isolado e com duas sessões. Se não for
possível executar, marcar BLOCKED, nunca usar HTML como prova do aplicativo.

## Estado desta revisão

Somente documento novo e link no índice do estudo. Estudo, HTML e 24 imagens
anteriores preservados. Sem alteração de banco, contratos financeiros, app,
funções, migrations ou worker. Sem capturas novas de aplicação: nenhuma entrega
funcional foi concluída neste gate.

Validação deste complemento: docs:check e diff --check. Não repetir testes do
protótipo como se validassem banco novo. SQL acima é estrutural e não foi testado;
funções/triggers/constraints finais fazem parte da implementação após aprovação.
Aprovação solicitada é para implementar e testar a **1A localmente**, não para
publicar ou autorizar pagamentos fracionados/1B/viagem tardia no banco.
