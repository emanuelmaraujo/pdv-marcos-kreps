import type { Order } from "@/types/pdv";

export function formatDeliveryPostalCode(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 8) return value?.trim() ?? "";
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function deliveryStreetName(order: Order) {
  return order.delivery_street?.trim() || "Endereço a confirmar";
}

export function deliveryNumberLabel(order: Order) {
  return order.delivery_number?.trim() ? `Nº ${order.delivery_number.trim()}` : "Sem número";
}

export function fullDeliveryAddress(order: Order) {
  const street = order.delivery_street?.trim() ?? "";
  const number = order.delivery_number?.trim() ?? "";
  const streetLine = [street, number].filter(Boolean).join(", ");
  const cityLine = [order.delivery_city, order.delivery_state].filter(Boolean).join(" - ");
  const postalCode = formatDeliveryPostalCode(order.delivery_postal_code);

  return [
    streetLine,
    order.delivery_complement,
    order.delivery_neighborhood,
    cityLine,
    postalCode ? `CEP ${postalCode}` : "",
  ].filter(Boolean).join(", ");
}

export type DeliveryCoordinates = { latitude: number; longitude: number };

export function getDeliveryCoordinates(order: Order): DeliveryCoordinates | null {
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
 * Link universal de rota. Coordenadas do checkout têm prioridade; na ausência
 * delas, o Maps recebe o endereço completo digitado pelo cliente.
 */
export function deliveryDirectionsUrl(order: Order): string | null {
  const coordinates = getDeliveryCoordinates(order);
  const destination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : fullDeliveryAddress(order);

  if (!destination) return null;

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
