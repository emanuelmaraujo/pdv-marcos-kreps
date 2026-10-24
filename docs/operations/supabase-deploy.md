# Supabase no GitHub Actions

Revisado em 2026-10-24. Projeto deste repositório: `pdv-marcos-kreps`,
ref pública `feotsdzkwbikmcnzgsnh`. As credenciais permanecem nos secrets do GitHub.

## Fluxo automático

O workflow [Deploy Supabase Edge Functions](../../.github/workflows/deploy-functions.yml)
executa em pushes de `main` que alterem funções, migrations, `config.toml`, scripts
de validação do deploy ou o próprio workflow. Também admite execução manual em
`main`. O [CI reutilizável](../../.github/workflows/ci.yml) precisa passar antes
de qualquer atualização remota.

O CI também executa `npm run test:database`: replay das 81 migrations regulares,
catálogo sintético, teste de dois scripts manuais de preço/água e testes SQL de
permissões. A instância descartável usa portas 554xx e é removida ao concluir.

1. Conferir projeto e presença do token obrigatório; vincular a CLI ao destino esperado.
2. Mostrar migrations pendentes com `db push --dry-run`.
3. Aplicar pendências com `db push --linked --include-all --yes` usando credenciais temporárias da CLI.
4. Publicar todas as funções locais com `functions deploy --use-api`.
5. Registrar o commit no resumo da execução.

`--include-all` contempla migrations versionadas anteriores à última versão remota;
todo arquivo pendente continua sendo código a revisar antes de integrar o PR.
Não há reparo automático de histórico, execução de seed ou remoção de funções remotas.
O grupo de concorrência `supabase-production` evita dois deploys simultâneos.
Uma falha nas migrations impede a publicação das funções dessa execução.

## Ajustes pontuais de catálogo

Scripts de preço e catálogo dependentes de uma operação específica ficam em
[`supabase/manual-data/`](../../supabase/manual-data/README.md). Não são executados
por `db push` nem pelo deploy de funções. Exigem revisão dos nomes, preços e filial
atuais e autorização explícita para a operação. O CI verifica esses scripts somente
com dados sintéticos, inclusive reaplicação sem duplicação.

Na recuperação, o script de preços de 22/10 esperava dez bebidas antigas e encontrou
apenas seis nomes correspondentes: o catálogo atual contém variantes como Coca Lata
e Suco Laranja. Seus guards interromperam a transação antes de qualquer atualização
de preço. Os dois scripts de 22/10, marcados como manuais desde a elaboração e sem
registro aplicado no histórico remoto, foram separados do fluxo automático.
Nenhuma migration aplicada foi removida ou marcada como revertida.

## Secrets necessários

| Secret | Finalidade |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Autorização da CLI para publicar funções |
| `SUPABASE_PROJECT_ID` | Ref do projeto; precisa coincidir com o destino esperado |

O workflow vincula a CLI com `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_ID`,
usando o acesso temporário suportado pelo Supabase. Não depende de senha de banco
persistida no GitHub. O token precisa das permissões exigidas por `link`, migrations
e publicação de funções no projeto.

O secret legado `SUPABASE_DB_URL` foi encontrado com formato inválido e não é mais
consumido. A primeira execução interrompeu antes de qualquer alteração remota.
Não é necessário reparar o histórico nem substituir esse secret para o novo fluxo.
O validador também aceita URL direta opcional para outros chamadores e, nesse caso,
exige host direto ou pooler oficial correspondente ao mesmo projeto.

## Autenticação das funções

`supabase/config.toml` é a fonte única de `verify_jwt`. Endpoints públicos e
funções com autenticação interna mantêm `false`; endpoints autenticados mantêm
`true`. O comando de deploy não recebe `--no-verify-jwt` global.

Ao incluir uma função, declare sua política explicitamente e execute
`npm run supabase:check`. A validação exige entrypoint, cobertura no config e
versões únicas das migrations. As políticas foram comparadas com as 39 funções
publicadas na revisão de 2026-10-24; não houve mudança de autenticação nessa revisão.

## Recuperar falhas de histórico

Se a CLI indicar uma versão remota ausente, compare o histórico e o SQL aplicado
com os arquivos Git. Restaure a versão aplicada com o mesmo conteúdo, sem executar
SQL novamente apenas para acertar o timestamp. Não copie uma sugestão de
`migration repair` dos logs sem investigação e revisão do impacto.

Na recuperação de 2026-10-24:

- `20260929040039_bebidas_fotos_reais.sql` foi recuperada do histórico aplicado.
- O SQL de `20261016180000_condo_guara_menu.sql` era idêntico ao aplicado como
  `20261016205200`; o arquivo foi alinhado ao timestamp e nome remotos.
- O SQL de `20261016231000_condo_guara_coca_latas.sql` era idêntico ao aplicado como
  `20261016230924`; o arquivo também foi alinhado.

Esses ajustes restauram o histórico real e evitam repetir o seed de 21 crepes
depois que bebidas já foram adicionadas à filial. Nenhuma linha do histórico remoto
precisa ser apagada ou marcada como revertida para essa reconciliação.

A CLI do deploy é fixada na mesma versão do lockfile, conferida por
`npm run supabase:check`. As Actions oficiais são fixadas por commit e os jobs
usam Ubuntu 24.04 para evitar mudanças implícitas de runtime e imagem do runner.

O script manual `20261022214500` também teve sua compatibilidade corrigida:
`max(uuid)` foi substituído por extração via `array_agg`,
preservando a verificação de que existe exatamente uma água sem gás na filial.
Os testes antigos de acesso foram alinhados à regra vigente de funcionários com
múltiplas filiais, mantendo o bloqueio de funcionário sem vínculo e adicionando
verificações dos dois vínculos persistidos.

## Limites da validação

Build e testes unitários não comprovam deploy. Confira o resultado do Actions e
as versões publicadas após integrar mudanças. Para testes SQL, use uma instância
local isolada; não resete o banco de desenvolvimento existente nem produção para
testar migrations. O workflow antigo do FERIADOU está arquivado porque publicava
somente duas funções e verificava uma campanha específica já datada.

Referências oficiais: [deploy de funções](https://supabase.com/docs/guides/functions/deploy)
e [ambientes e migrations](https://supabase.com/docs/guides/deployment/managing-environments).
Autenticação: [acesso temporário](https://supabase.com/docs/guides/platform/temporary-access)
e [permissões dos tokens](https://supabase.com/docs/guides/platform/personal-access-tokens).
