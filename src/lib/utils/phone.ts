/** Normaliza telefone brasileiro para E.164 (+55DDDNUMERO). */
export function normalizeBrazilPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  // So trata 55 como codigo do pais quando o tamanho tambem confirma isso.
  // Um celular nacional com DDD 55 possui 11 digitos e deve ser preservado.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;

  return `+55${digits}`;
}

export function formatWhatsAppInput(value: string): string {
  const normalized = normalizeBrazilPhone(value);
  const digits = (
    normalized
      ? normalized.replace(/^\+55/, "")
      : value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")
  ).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
