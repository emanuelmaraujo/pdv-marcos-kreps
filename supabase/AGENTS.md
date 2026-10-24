# Backend Supabase

Leia as regras da raiz e o código da função/política afetada antes de editar.

- Valide identidade, autorização por filial e parâmetros no servidor. Preserve
  RLS e os limites entre endpoints públicos e autenticados.
- Nunca exponha `service_role` no frontend, em logs ou exemplos. Não remova
  validações de preço, pagamento, concorrência ou proteção contra duplicidade.
- Migrations aplicadas são histórico: adicione uma migration para evoluções;
  não reescreva arquivos antigos. Confira dependências e políticas de acesso.
- Scripts SQL e de integração exigem instância local/ambiente de teste explícito.
  Confirme destino e impacto antes de executar; não use dados reais como fixtures.
- Testes Vitest da raiz não comprovam migrations ou Edge Functions publicadas.
  Registre separadamente o que foi validado no banco e o que não foi executado.
- `npm run test:database` prepara uma instância descartável com `pg_cron` e
  `fixtures/nb-catalog.sql`, aplica o histórico e executa os testes SQL. O fixture
  nunca deve ser executado em produção nem em dados operacionais existentes.
- O workflow de deploy aplica migrations em `main`. Não dispare workflows,
  `db push`, deploy de funções ou reparo de histórico como validação local.
- Toda função deve declarar `verify_jwt` em `config.toml`. O deploy publica todas
  as funções locais usando essa configuração; `npm run supabase:check` previne
  omissões e versões duplicadas de migrations.
- Em divergência de histórico, compare versões e SQL com o destino. Restaure
  arquivos históricos ausentes; não faça reparo remoto automático nem reaplique
  migrations de catálogo apenas porque o Git usa outro timestamp.

Referências: [arquitetura](../docs/architecture/overview.md) e
[atualizações](../docs/development/updates.md).
