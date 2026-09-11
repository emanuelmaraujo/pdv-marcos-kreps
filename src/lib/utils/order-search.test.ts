import { describe, expect, it } from "vitest";
import type { Order } from "@/types/pdv";
import { orderMatchesSearch } from "./order-search";

const order = {
  daily_number: 42,
  customer_name: "João da Silva",
  customer_phone: "+55 (61) 99999-1234",
  delivery_street: "Avenida Central",
  delivery_number: "108",
  delivery_neighborhood: "Águas Claras",
  delivery_city: "Brasília",
} as Order;

describe("orderMatchesSearch", () => {
  it("busca por número e nome sem depender de acentos", () => {
    expect(orderMatchesSearch(order, "42")).toBe(true);
    expect(orderMatchesSearch(order, "#42")).toBe(true);
    expect(orderMatchesSearch(order, "joao")).toBe(true);
  });

  it("busca por telefone mesmo com formatação diferente", () => {
    expect(orderMatchesSearch(order, "999991234")).toBe(true);
  });

  it("busca por rua, número e bairro", () => {
    expect(orderMatchesSearch(order, "central")).toBe(true);
    expect(orderMatchesSearch(order, "108")).toBe(true);
    expect(orderMatchesSearch(order, "aguas claras")).toBe(true);
  });

  it("rejeita termos sem correspondência", () => {
    expect(orderMatchesSearch(order, "asa norte")).toBe(false);
  });
});
