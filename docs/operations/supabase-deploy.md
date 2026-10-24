# Supabase no GitHub Actions

Revisado em 2026-10-24. Projeto deste repositório: `pdv-marcos-kreps`,
ref pública `feotsdzkwbikmcnzgsnh`. As credenciais permanecem nos secrets do GitHub.

## Fluxo automático

O workflow [Deploy Supabase Edge Functions](../../.github/workflows/deploy-functions.yml)
executa em pushes de `main` que alterem funções, migrations, `config.toml`, scripts
de validação do deploy ou o próprio workflow. Também admite execução manual em
`main`. O [CI reutilizável](../../.github/workflows/ci.yml) precisa passar antes
de qualquer atualização remota.

O CI também executa `npm run test:database`: replay das 83 migrations, catálogo
sintético, verificação de idempotência dos ajustes de preço/água e testes SQL de
permissões. A instância descartável usa portas 554xx e é removida ao concluir.

1. Conferir projeto, URL de banco e presença dos secrets obrigatórios.
2. Mostrar migrations pendentes com `db push --dry-run`.
3. Aplicar pendências com `db push --include-all --yes` usando `SUPABASE_DB_URL`.
4. Publicar todas as funções locais com `functions deploy --use-api`.
5. Registrar o commit no resumo da execução.

`--include-all` contempla migrations versionadas anteriores à última versão remota;
todo arquivo pendente continua sendo código a revisar antes de integrar o PR.
Não há reparo automático de histórico, execução de seed ou remoção de funções remotas.
O grupo de concorrência `supabase-production` evita dois deploys simultâneos.
Uma falha nas migrations impede a publicação das funções dessa execução.

## Secrets necessários

| Secret | Finalidade |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Autorização da CLI para publicar funções |
| `SUPABASE_PROJECT_ID` | Ref do projeto; precisa coincidir com o destino esperado |
| `SUPABASE_DB_URL` | Conexão Postgres completa, com credencial codificada corretamente |

A validação aceita host direto `db.<ref>.supabase.co` ou pooler oficial com usuário
`postgres.<ref>`. Não imprime a URL nem a senha. O workflow usa o secret de URL já
existente, em vez de depender de `SUPABASE_DB_PASSWORD`, ausente no repositório.

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

A migration pendente `20261022214500` também foi corrigida antes da primeira
aplicação registrada: `max(uuid)` foi substituído por extração via `array_agg`,
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
