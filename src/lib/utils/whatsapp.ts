/** Link direto pro WhatsApp de um número em E.164 (+5561999998888) — abre o app com a conversa pronta. */
export function whatsappUrlForPhone(phoneE164: string, text?: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}
