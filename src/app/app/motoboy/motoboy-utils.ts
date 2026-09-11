export {
  fullDeliveryAddress as fullAddress,
  getDeliveryCoordinates as getExactCoordinates,
  deliveryDirectionsUrl as mapsDirectionsUrlForOrder,
} from "@/lib/utils/order-delivery";

const DISPLAY_TIME_ZONE = "America/Sao_Paulo";

export function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
}
