# Guia de voz — 1 página

Referência rápida de tom por área do sistema. Ver diagnóstico completo em `docs/plano-acao-ux-ui.md`, seção 1.

## Os três públicos

| Área | Público | Tom |
|---|---|---|
| `/pedir` | Cliente final | Caloroso, direto, tranquilizador. Fala como o atendente falaria pessoalmente. |
| `/app/pedidos`, `/app/novo-pedido`, `/app/caixa` | Atendente/operação | Claro, curto o bastante para ler em 1 segundo sob pressão de balcão. Nunca expõe erro técnico. |
| `/app/configuracoes`, `/app/usuarios`, `/app/configuracoes/filiais` | Admin/dono | Linguagem de negócio em primeiro plano; detalhe técnico (IP, worker) é secundário, nunca o texto principal. |

## Regras

1. **Erro nunca aparece cru.** Todo `catch` usa `getFriendlyErrorMessage(error, fallback)` (`src/lib/errors/messages.ts`), nunca `error.message` direto na tela.
2. **Toda espera explica o que está acontecendo.** Não um spinner sozinho — uma frase dizendo o que está sendo feito e, se relevante, o que fazer enquanto isso (padrão de referência já existente: `PixResult.tsx`, "Copie o código Pix... Mantenha esta tela aberta enquanto conferimos a aprovação").
3. **Efeito colateral externo fica visível perto do controle que o dispara.** Se uma ação envia WhatsApp, imprime ou notifica alguém, isso não pode ser descoberto só depois.
4. **Ação em lote explica escopo antes do clique**, não só o resultado depois.

## Termos banidos → substituição

| Nunca escrever | Escrever |
|---|---|
| worker | sistema de impressão / sistema de envio |
| heartbeat | sinal / conexão |
| token, JWT, payload | (não aparece em texto de usuário) |
| null, undefined | (não aparece em texto de usuário) |
| erro de banco (constraint, duplicate key, etc.) | descrição do que fazer, nunca o nome técnico do erro |
| "Erro ao processar" (genérico demais) | o que aconteceu + o que fazer (ex: "Não conseguimos confirmar seu pagamento. Tente novamente ou fale com a loja.") |
