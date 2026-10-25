import type { Order, OrderItem } from "@/types/pdv";
export const DELIVERY_PAYMENT_LABELS = {
  CASH: "Dinheiro", DEBIT_CARD: "Débito na maquininha", CREDIT_CARD: "Crédito na maquininha", PIX: "Pix na entrega",
} as const;
export type DeliveryPaymentMethod = keyof typeof DELIVERY_PAYMENT_LABELS;
export function isDeliveryPaymentMethod(value: unknown): value is DeliveryPaymentMethod {
  return typeof value === "string" && Object.hasOwn(DELIVERY_PAYMENT_LABELS, value);
}

/** Prévia de parcela; SQL continua autoritativo e fecha o saldo na última baixa. */
export function getCodSelectionAmount(order: Order, items: OrderItem[], selectedIds: ReadonlySet<string>) {
  const active=items.filter(item=>item.status!=="CANCELLED");
  const unpaid=active.filter(item=>!["PAID","COURTESY"].includes(item.payment_status));
  const selected=unpaid.filter(item=>selectedIds.has(item.id));
  if(!selected.length)return 0;
  if(selected.length===unpaid.length)return Math.max(0,Math.round((Number(order.total_amount)-Number(order.cod_received_amount??0))*100))/100;
  const cents=(item:OrderItem)=>Math.round(Number(item.total_price)*100);
  const gross=active.reduce((sum,item)=>sum+cents(item),0);
  const target=selected.reduce((sum,item)=>sum+cents(item),0);
  const discount=Math.round(Number(order.discount_amount??0)*100);
  return Math.max(0,target-Math.round(discount*target/(gross||1)))/100;
}
