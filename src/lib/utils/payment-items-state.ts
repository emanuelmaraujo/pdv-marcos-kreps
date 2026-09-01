/**
 * O pagamento por itens é um rascunho local do atendente. Uma nova versão do
 * mesmo pedido pode chegar por polling, Realtime ou uma atualização explícita,
 * mas não deve apagar seleção, etapa ou forma de pagamento em andamento.
 *
 * Somente trocar de pedido inicia um novo rascunho.
 */
export function shouldResetPaymentItemsDraft(
  previousOrderId: string | null,
  nextOrderId: string,
) {
  return previousOrderId !== nextOrderId;
}
