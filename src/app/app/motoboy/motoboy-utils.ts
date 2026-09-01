import type { Order } from "@/types/pdv";

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

function formatPostalCode(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 8) return value?.trim() ?? "";
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function fullAddress(order: Order) {
  const streetLine = [order.delivery_street, order.delivery_number].filter(Boolean).join(", ");
  const cityLine = [order.delivery_city, order.delivery_state].filter(Boolean).join(" - ");
  const postalCode = formatPostalCode(order.delivery_postal_code);

  return [
    streetLine,
    order.delivery_complement,
    order.delivery_neighborhood,
    cityLine,
    postalCode ? `CEP ${postalCode}` : "",
  ].filter(Boolean).join(", ");
}

export type ExactCoordinates = { latitude: number; longitude: number };

export function getExactCoordinates(order: Order): ExactCoordinates | null {
  if (order.delivery_latitude == null || order.delivery_longitude == null) return null;

  const latitude = Number(order.delivery_latitude);
  const longitude = Number(order.delivery_longitude);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

/**
 * Abre o Google Maps já no modo de rota. Sem `origin`, o Maps usa a
 * localização atual do aparelho do motoboy quando ela está disponível.
 */
export function mapsDirectionsUrlForOrder(order: Order): string | null {
  const coordinates = getExactCoordinates(order);
  const destination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : fullAddress(order);

  if (!destination) return null;

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
