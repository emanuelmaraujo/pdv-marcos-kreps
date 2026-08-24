# Convenção de branches — PDV

Este projeto acumulou dezenas de branches de sessões de trabalho (muitas do
Claude/Codex) sem um padrão claro, o que dificultava saber o que ainda era
relevante. Este documento define o padrão daqui pra frente.

## Nomenclatura

Prefixo obrigatório por tipo de trabalho:

- `feat/<escopo-curto>` — nova funcionalidade
- `fix/<escopo-curto>` — correção de bug
- `chore/<escopo-curto>` — manutenção, config, dependências, docs
- `security/<escopo-curto>` — correções de segurança (sempre revisão prioritária)

Use nomes curtos e descritivos em kebab-case, sem sufixos aleatórios
(`-38c972`, `-f44fbc` etc. gerados automaticamente devem ser evitados —
prefira renomear a branch antes de abrir o PR: `git branch -m novo-nome`).

Não crie uma branch nova por sessão/iteração do mesmo trabalho. Se você está
continuando algo que já tem uma branch aberta (mesmo tema, mesmo PR ainda não
mergeado), **reaproveite a branch existente** com commits novos ou
`git commit --amend` / `git rebase`, em vez de abrir `feat/x-continuacao`,
`feat/x-v2`, `feat/x-fase-2` etc. Isso é a causa principal do acúmulo atual.

## Ciclo de vida

1. Toda branch nasce a partir de `main` atualizada.
2. Um PR é aberto assim que há algo revisável — não é preciso esperar o
   trabalho estar 100% pronto (PRs em rascunho/`Draft` são bem-vindos).
3. Ao mergear, a branch é **excluída imediatamente** (local e remoto). O
   GitHub já faz isso automaticamente no merge do PR se a opção
   "Automatically delete head branches" estiver ativa no repositório —
   confirmar que está ativa em Settings → General.
4. Branches sem commit novo há mais de **2 semanas** e sem PR aberto são
   consideradas abandonadas e devem ser excluídas (ou re-abertas do zero se o
   trabalho ainda for necessário).

## Limite prático

Regra prática: se ao abrir uma branch nova o repositório já tem 4+ branches
de trabalho ativas (fora `main`), pare e resolva/feche uma delas primeiro
(merge, fechar PR obsoleto ou excluir). Isso evita o cenário atual de ~40
branches nunca finalizadas.

## Trabalho em conjunto (múltiplas sessões/agentes no mesmo branch)

Quando mais de uma pessoa ou sessão de agente trabalha na mesma feature:

- Combine previamente o nome da branch e **reutilizem a mesma branch** —
  não crie uma branch espelho por sessão. Antes de começar,
  `git fetch && git rebase origin/<branch>` para não divergir.
- Se o trabalho precisa ser paralelizado em subtarefas independentes, use
  sub-branches curtas a partir da branch de feature
  (`feat/delivery-fase4` → `feat/delivery-fase4-motoboy-gps`) e faça merge de
  volta na branch de feature assim que a subtarefa terminar — não direto em
  `main`.
- Evite manter duas branches divergentes fazendo a mesma coisa (ex.:
  `claude/filiais-bugfixes-and-restyle` e
  `claude/redesenho-usuarios-filiais-config-f44fbc` com o mesmo commit) —
  isso obriga quem revisa a adivinhar qual é a "boa".

## Antes de excluir uma branch

`git branch -r --merged origin/main` mostra o que já foi incorporado e é
seguro excluir. Para o que não está mergeado, confira
`git diff origin/main...origin/<branch> --stat` antes de excluir — se o
conteúdo for real e ainda não estiver em `main`, ou vire PR ou salve o
trabalho (não delete sem revisar).
