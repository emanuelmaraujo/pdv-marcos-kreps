import { describe, expect, it } from "vitest";
import type { Order } from "@/types/pdv";
import {
  deliveryDirectionsUrl,
  deliveryNumberLabel,
  formatDeliveryPostalCode,
  fullDeliveryAddress,
  getDeliveryCoordinates,
} from "./order-delivery";

function deliveryOrder(overrides: Partial<Order> = {}) {
  return {
    type: "ENTREGA",
    delivery_street: "Rua das Flores",
    delivery_number: "123",
    delivery_neighborhood: "Centro",
    delivery_city: "Brasília",
    delivery_state: "DF",
    delivery_postal_code: "70000000",
    ...overrides,
  } as Order;
}

describe("order delivery presentation", () => {
  it("mantém rua, número, localidade e CEP no endereço copiável", () => {
    expect(fullDeliveryAddress(deliveryOrder())).toBe(
      "Rua das Flores, 123, Centro, Brasília - DF, CEP 70000-000",
    );
  });

  it("sinaliza quando o número não foi informado", () => {
    expect(deliveryNumberLabel(deliveryOrder({ delivery_number: "" }))).toBe("Sem número");
  });

  it("formata somente CEPs brasileiros completos", () => {
    expect(formatDeliveryPostalCode("70.000-000")).toBe("70000-000");
    expect(formatDeliveryPostalCode("7000")).toBe("7000");
  });

  it("prioriza coordenadas válidas na rota", () => {
    const order = deliveryOrder({ delivery_latitude: -15.793889, delivery_longitude: -47.882778 });
    expect(getDeliveryCoordinates(order)).toEqual({ latitude: -15.793889, longitude: -47.882778 });
    expect(deliveryDirectionsUrl(order)).toContain("destination=-15.793889%2C-47.882778");
  });

  it("usa o endereço quando não há coordenadas", () => {
    expect(deliveryDirectionsUrl(deliveryOrder())).toContain("destination=Rua+das+Flores%2C+123");
  });
});
