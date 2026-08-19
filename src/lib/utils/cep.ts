// Máscara e validação de formato de CEP no frontend — a busca de verdade
// (ViaCEP) acontece via pdvApi.lookupCep, e é sempre revalidada no servidor
// na criação do pedido.

const CEP_DIGITS = /\D/g;

export function onlyCepDigits(value: string): string {
  return value.replace(CEP_DIGITS, "").slice(0, 8);
}

export function formatCep(value: string): string {
  const digits = onlyCepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidCepFormat(value: string): boolean {
  return onlyCepDigits(value).length === 8;
}
