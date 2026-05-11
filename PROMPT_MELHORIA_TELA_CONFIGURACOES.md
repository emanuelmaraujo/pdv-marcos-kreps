# Prompt mestre: melhoria da tela de configuracoes

Voce e um agente senior no projeto `D:\Dev\pdv`, um PDV em Next.js 16 + Supabase. Antes de alterar codigo, leia `AGENTS.md` e a documentacao aplicavel em `node_modules/next/dist/docs/`, pois esta versao do Next.js usa `proxy.ts` e pode divergir de APIs antigas.

## Objetivo

Melhorar a tela `/app/configuracoes` para ficar organizada, operacional e confiavel, sem quebrar nenhuma configuracao existente.

Prioridade absoluta: a tela precisa ser excelente no celular, porque o administrador pode ajustar abertura do site, horario, impressao e WhatsApp durante a operacao. Mobile nao pode ser apenas o desktop empilhado.

## Problema atual

A tela concentra muitas configuracoes em blocos soltos, com hierarquia visual fraca. O administrador precisa entender rapidamente:

- se o pedido pelo site esta aberto ou pausado;
- qual horario do pedido online;
- se impressao esta ativa;
- quais vias sao impressas;
- se WhatsApp esta ativo;
- onde testar impressora, WhatsApp e fila;
- onde gerenciar biometria.

## Requisitos funcionais obrigatorios

Preservar todos os settings existentes:

- `public_ordering_enabled`
- `public_ordering_start_time`
- `public_ordering_end_time`
- `packaging_fee`
- `apply_packaging_fee_for_takeout`
- `printing_enabled`
- `printer_host`
- `printer_port`
- `printer_type`
- `printer_paper_width`
- `print_customer_copy`
- `print_kitchen_copy`
- `print_juice_potato_copy`
- `whatsapp_enabled`
- `whatsapp_template_ready`
- `whatsapp_template_language`
- `whatsapp_test_phone`

Preservar tambem as acoes:

- salvar configuracoes;
- testar impressora;
- enviar teste de WhatsApp;
- processar fila de WhatsApp;
- carregar estatisticas de WhatsApp;
- gerenciar biometria via `BiometricManager`.

## Regra critica de dados

A tabela `settings.value` e `JSONB`. Portanto:

- strings devem ser salvas como strings JSON validas pelo client Supabase;
- booleanos devem ser booleanos;
- numeros devem ser numeros;
- horarios como `17:00` e `23:30` nao podem ser enviados em SQL como texto cru sem aspas JSON.

No frontend, use uma API central para converter valores carregados de JSONB em strings de input, e salve valores como primitivos JSON.

## UX esperada

- Layout de ferramenta operacional, nao landing page.
- Resumo no topo com os principais estados: pedido online, impressao e WhatsApp.
- Navegacao lateral por grupos no desktop.
- No celular, usar navegacao horizontal por abas/chips e mostrar somente a secao ativa para evitar uma pagina longa e confusa.
- Botao de salvar visivel no topo e fixo no rodape.
- Labels curtos e descricoes apenas onde ajudam.
- Inputs de horario com `type="time"`.
- Toggles para opcoes binarias.
- Botoes de teste claramente separados de salvar.
- Nao esconder configuracoes importantes em accordions confusos no desktop.

## Regra da taxa para viagem

A taxa configurada em `packaging_fee` e controlada por `apply_packaging_fee_for_takeout` deve aparecer e ser somada no checkout publico quando o cliente selecionar `Para levar`.

O frontend deve mostrar:

- subtotal dos itens;
- taxa para viagem, quando aplicavel;
- total estimado.

O backend continua sendo a fonte oficial do valor e deve recalcular a taxa em `create-public-order`. O frontend apenas antecipa a informacao para o cliente nao ser surpreendido no pagamento.

## Testes obrigatorios

Antes de finalizar:

1. `npx tsc --noEmit`
2. `npx eslint src\app\app\configuracoes\page.tsx src\lib\api\settings-api.ts`
3. `npm run build`
4. Abrir `/app/configuracoes` no navegador local quando houver sessao disponivel.
5. Conferir que inputs de horario aceitam `17:00` e `23:30`.
6. Conferir que a serializacao de `settingsApi.saveSettings` nao quebra JSONB.
7. Conferir no checkout publico que a taxa para viagem aparece e entra no total estimado quando `Para levar` esta selecionado.

## Cuidado operacional

Nao acione testes reais de impressora ou WhatsApp automaticamente sem necessidade. O teste visual e de build pode validar que os botoes existem e que os handlers compilam; testes reais devem ser feitos conscientemente pelo administrador.
