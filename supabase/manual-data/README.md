# Operações manuais de catálogo

Scripts pontuais dependentes de uma filial, catálogo e autorização de negócio.
Estes arquivos **não são executados pelo deploy automático**. O histórico
de `supabase_migrations` não deve ser manipulado para forçar sua execução.

- [Preços da NB conforme referência de 21/10](20261022213000_nucleo_bandeirante_novos_precos.sql)
- [Água com gás com preço igual ao da água da NB](20261022214500_nb_agua_com_gas.sql)

Os scripts preservam validações que abortam em caso de dados divergentes.
O catálogo atual já tem nomes diferentes da referência do script de preços;
revise a operação pretendida antes de executar ou produzir um novo ajuste datado.
Não remova os guards para apenas fazer o script passar.

`npm run test:database` aplica estes scripts duas vezes sobre catálogo sintético
em uma instância descartável. Isso valida comportamento e idempotência, sem
autorizar execução em uma loja real.

Procedimento geral: [deploy e operação do Supabase](../../docs/operations/supabase-deploy.md).
