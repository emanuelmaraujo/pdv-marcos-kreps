# Desenvolvimento local

Revisado em 2026-10-24 a partir dos manifests e da documentação do Next instalada.

## Requisitos

- Git, Node.js 22 (linha usada em `.nvmrc` e no CI) e npm. O mínimo técnico
  do Next.js instalado é 20.9; use a mesma linha de Node da equipe para trabalhar.
- Credenciais de um ambiente de desenvolvimento Supabase, separadas de produção.
- Docker somente se for trabalhar com o backend Supabase local.

O projeto usa Next.js 16, React 19, TypeScript, Tailwind CSS 4 e Vitest.
`package.json` descreve as faixas; `package-lock.json` registra as versões resolvidas.
Existem dois projetos npm independentes: raiz e `print-worker/`.

## Primeira instalação

Na raiz do repositório:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Preencha `.env.local` com URL e chave pública do seu ambiente de desenvolvimento.
Não sobrescreva um arquivo de ambiente existente. O exemplo contém somente placeholders.
Não coloque chaves de serviço em variáveis `NEXT_PUBLIC_*`.

```powershell
npm run dev
```

Abra `http://localhost:3000`. O servidor local pode acessar o banco configurado;
usar localhost no navegador não torna o backend local.

## Usar o Supabase local

Com Docker Desktop executando:

```powershell
npx supabase start
npx supabase status
```

O primeiro comando pode aplicar migrations ao preparar um banco novo. Preserve
volumes existentes e confirme o destino antes de qualquer reset. Use a URL da API
local e somente a chave `anon`/pública mostrada pelo status em `.env.local`.
Não copie a chave `service_role` para o frontend. Credenciais do ambiente local
não devem ser copiadas para exemplos versionados ou para o GitHub.

O histórico também contém migrations de catálogo que pressupõem dados operacionais
da NB e uma instalação com `pg_cron`. Em uma instância vazia, esses pré-requisitos
precisam ser preparados. Para verificar todo o histórico de forma reproduzível,
use `npm run test:database`: ele cria uma instância descartável em portas 554xx,
habilita a extensão, insere um catálogo sintético e remove só a instância que criou.
O ambiente de desenvolvimento existente não é resetado. O log fica no diretório
Git local, sem entrar no repositório; não compartilhe logs brutos com credenciais.

## Comandos da raiz

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor Next de desenvolvimento |
| `npm run typecheck` | TypeScript sem gerar build |
| `npm run lint` | ESLint |
| `npm test` | Testes Vitest locais |
| `npm run test:database` | Replay completo e testes SQL em instância Docker descartável |
| `npm test -- src/lib/utils/order-refresh.test.ts` | Teste específico |
| `npm run docs:check` | Links locais de documentos Markdown |
| `npm run supabase:check` | Cobertura de funções, política JWT explícita e versões de migrations |
| `npm run check` | Documentação, configuração do Supabase, tipos, lint e testes; interrompe na primeira falha |
| `npm run build` | Build de produção; verificação separada |
| `npm run start` | Executar o build existente |
| `npm run update:check` | Buscar referências e comparar com `origin/main` |
| `npm run update:local` | Atualizar a branch atual por fast-forward |

`npm run build` também precisa de `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` definidos para o ambiente de teste: algumas páginas
instanciam o cliente durante o prerender. Sem essas variáveis, a compilação pode
passar e a geração das páginas falhar. Não substitua credenciais ausentes por
credenciais de produção para apenas concluir a verificação.
O CI usa uma URL loopback e uma chave identificada como exclusiva de build;
isso verifica compilação/prerender sem autenticar nem acessar um serviço externo.
Esse build não substitui testes de integração com o backend local.

## Worker de impressão

O worker usa outro lockfile e outro ambiente. Consulte o [guia do serviço](../../print-worker/README.md).
Para preparar dependências e validar sem iniciar a impressão:

```powershell
npm ci --prefix print-worker
npm run typecheck --prefix print-worker
npm run build --prefix print-worker
```

Iniciar o worker com credenciais e impressora configuradas pode consumir a fila real.
Validação de tipos/build não exige iniciar o serviço.

## Backend e testes de integração

Consulte [supabase/AGENTS.md](../../supabase/AGENTS.md) antes de alterar o backend.
Scripts `scripts/test-*` podem criar usuários, pedidos ou pagamentos: leia-os e
confirme o ambiente antes de executar. Eles não fazem parte de `npm run check`.
O [checklist operacional](../operations/mvp-operational-test.md) exige ambiente e
dados de teste preparados; não é um teste unitário automático.
