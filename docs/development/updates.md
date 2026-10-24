# Atualizar a cópia local

## Rotina rápida

Na raiz do projeto, confira a branch e o trabalho pendente:

```powershell
git status -sb
npm run update:local -- --check
npm run update:local
npm ci
npm run check
```

O atualizador busca `origin` e incorpora `origin/main` na **branch atual** apenas
por fast-forward. Ele não troca para `main`, não publica commits e não atualiza
automaticamente outras branches locais. `--check` atualiza apenas as referências
remotas e mostra a comparação; não altera os arquivos versionados.
Ambos os modos exigem árvore limpa, incluindo arquivos não rastreados.
Branches com commits exclusivos dos dois lados exigem decisão manual.

`npm ci` reproduz o lockfile e reinstala `node_modules`; execute após atualizar o
código. Isso não troca as versões declaradas por versões mais recentes do registro.
Atualizações de dependências devem ser tarefas separadas, com revisão do lockfile,
guia de migração da versão instalada e validação do comportamento afetado.

## Se houver trabalho pendente

Prefira um commit na branch da tarefa. Para guardar temporariamente, use um nome
identificável e confira a referência retornada:

```powershell
git stash push --include-untracked -m "antes-de-atualizar-descricao-da-tarefa"
git stash list
```

O stash inclui arquivos não rastreados, mas não arquivos ignorados, como `.env.local`.
Não use `stash pop` automaticamente depois da atualização: mudanças recentes podem
alterar os mesmos fluxos. Para retomar sobre a base original, com árvore limpa,
use `git stash branch <nova-branch> <referencia-do-stash>`; ou aplique o stash numa
branch revisada com `git stash apply <referencia-do-stash>`. Com `stash branch`,
uma referência no formato `stash@{...}` é removida da lista após restauração bem-sucedida.
Confira o diff antes de testar/continuar.

## Validação e entrega

1. Leia o diff, os `AGENTS.md` da área e os guias relevantes do Next instalado.
2. Execute `npm run check`. Se falhar, registre a causa e diferencie falhas anteriores
   das introduzidas pela tarefa; não declare a validação concluída.
3. Execute `npm run build` quando houver mudança de código, dependências ou configuração
   do frontend. Verifique a interface e o fluxo afetado em ambiente de teste.
4. Ao alterar documentação, execute `npm run docs:check` e atualize o índice.
5. Abra a revisão com problema, solução, testes executados e limitações conhecidas.

## Atualizar o worker na máquina da loja

Após revisão e autorização para atualizar o serviço operacional, em checkout limpo:

```powershell
npm run update:local
npm ci --prefix print-worker
npm run typecheck --prefix print-worker
npm run build --prefix print-worker
```

O PM2 executa `print-worker/dist/index.js`: trazer o código sem recompilar mantém
o serviço antigo. Reinicie e confira os logs conforme o [runbook do worker](../../print-worker/README.md).
Se a configuração do PM2 mudou, siga o procedimento específico do runbook.
O atualizador nunca reinicia o worker nem dispara uma impressão.

## Publicação e banco

Atualizar arquivos locais não aplica migrations nem publica Edge Functions.
O workflow [deploy-functions.yml](../../.github/workflows/deploy-functions.yml)
valida o projeto, aplica migrations pendentes e publica todas as funções versionadas
quando caminhos de backend ou o próprio workflow mudam em `main`.
Leia o [runbook de deploy do Supabase](../operations/supabase-deploy.md) para
secrets, autenticação das funções e recuperação de falhas.
O workflow pontual do FERIADOU está [arquivado](../archive/workflows/deploy-feriadou-20261012.yml).
O [CI](../../.github/workflows/ci.yml) verifica documentação, configuração do Supabase,
tipos, lint, testes e builds; a publicação só prossegue se essas verificações passarem.
Alterações apenas nesta documentação não constituem deploy verificado.
