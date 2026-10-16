import type { Order } from "@/types/pdv";
import { normalizeBrazilPhone } from "@/lib/utils/phone";
import { whatsappUrlForPhone } from "@/lib/utils/whatsapp";

/**
 * Gera um link para enviar MANUALMENTE o aviso de pedido pronto.
 * A ação fica disponível em todas as etapas; a interface alerta se não estiver pronto.
 * Não dispara mensagens nem altera o status do pedido.
 */
export function orderReadyWhatsAppUrl(
  order: Pick<Order, "customer_phone" | "customer_name" | "daily_number">,
): string | null {
  const phone = normalizeBrazilPhone(order.customer_phone ?? "");
  if (!phone || !Number.isFinite(order.daily_number)) return null;

  const name = order.customer_name?.trim();
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  const number = String(order.daily_number).padStart(2, "0");
  const message = `${greeting}\nSeu pedido #${number} está pronto!\nObrigado pela preferência!`;

  return whatsappUrlForPhone(phone, message);
}
