import { describe, expect, it } from "vitest";
import { calculatePackagingEstimate } from "./packaging-fee";

const estimate = (items: { quantity: number; is_takeout?: boolean }[], overrides: {
  isDelivery?: boolean; enabled?: boolean; feePerItem?: number;
} = {}) => calculatePackagingEstimate({
  items, isDelivery: overrides.isDelivery ?? false,
  enabled: overrides.enabled ?? true,
  feePerItem: overrides.feePerItem ?? 1,
});

describe("prévia da embalagem de viagem no PDV", () => {
  it("não cobra embalagem de itens para comer no local", () => {
    expect(estimate([{ quantity: 2, is_takeout: false }])).toEqual({ quantity: 0, fee: 0 });
  });
  it("mostra a taxa por unidade antes da confirmação", () => {
    expect(estimate([{ quantity: 3, is_takeout: true }])).toEqual({ quantity: 3, fee: 3 });
  });
  it("não cobra os itens para consumir no local em pedidos mistos", () => {
    expect(estimate([{ quantity: 2, is_takeout: false }, { quantity: 2, is_takeout: true }])).toEqual({ quantity: 2, fee: 2 });
  });
  it("respeita a tarifa própria da feira", () => {
    expect(estimate([{ quantity: 3, is_takeout: true }], { feePerItem: 0.5 })).toEqual({ quantity: 3, fee: 1.5 });
  });
  it("entrega embala todos os itens mesmo sem marcação individual", () => {
    expect(estimate([{ quantity: 2, is_takeout: false }, { quantity: 1 }], { isDelivery: true })).toEqual({ quantity: 3, fee: 3 });
  });
  it("nunca cobra com a regra desativada ou tarifa inválida", () => {
    expect(estimate([{ quantity: 2, is_takeout: true }], { enabled: false })).toEqual({ quantity: 2, fee: 0 });
    expect(estimate([{ quantity: 2, is_takeout: true }], { feePerItem: -2 })).toEqual({ quantity: 2, fee: 0 });
  });
});
