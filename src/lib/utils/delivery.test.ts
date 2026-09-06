import { describe, expect, it } from "vitest";
import {
  isOrderTypeAvailableForBranch,
  resolveAvailableOrderType,
  type PublicOrderType,
} from "./delivery";

const entrega = { branchConfigLoaded: true, deliveryEnabled: true };
const semEntrega = { branchConfigLoaded: true, deliveryEnabled: false };
const carregando = { branchConfigLoaded: false, deliveryEnabled: false };

describe("isOrderTypeAvailableForBranch", () => {
  it.each<PublicOrderType>(["BALCAO", "VIAGEM"])("%s vale em qualquer filial", (tipo) => {
    expect(isOrderTypeAvailableForBranch(tipo, entrega)).toBe(true);
    expect(isOrderTypeAvailableForBranch(tipo, semEntrega)).toBe(true);
    expect(isOrderTypeAvailableForBranch(tipo, carregando)).toBe(true);
  });

  it("ENTREGA vale na filial que entrega", () => {
    expect(isOrderTypeAvailableForBranch("ENTREGA", entrega)).toBe(true);
  });

  it("ENTREGA não vale na filial que não entrega", () => {
    expect(isOrderTypeAvailableForBranch("ENTREGA", semEntrega)).toBe(false);
  });

  it("não bloqueia ENTREGA antes da config responder", () => {
    // deliveryEnabled nasce false; bloquear aqui derrubaria a escolha de quem
    // já tinha selecionado Entrega numa filial que de fato entrega.
    expect(isOrderTypeAvailableForBranch("ENTREGA", carregando)).toBe(true);
  });
});

describe("resolveAvailableOrderType", () => {
  it("troca ENTREGA por VIAGEM na filial que não entrega", () => {
    expect(resolveAvailableOrderType("ENTREGA", semEntrega)).toBe("VIAGEM");
  });

  it("preserva ENTREGA na filial que entrega", () => {
    expect(resolveAvailableOrderType("ENTREGA", entrega)).toBe("ENTREGA");
  });

  it("preserva ENTREGA enquanto a config não respondeu", () => {
    expect(resolveAvailableOrderType("ENTREGA", carregando)).toBe("ENTREGA");
  });

  it.each<PublicOrderType>(["BALCAO", "VIAGEM"])("nunca mexe em %s", (tipo) => {
    expect(resolveAvailableOrderType(tipo, semEntrega)).toBe(tipo);
    expect(resolveAvailableOrderType(tipo, entrega)).toBe(tipo);
  });

  it("é idempotente: aplicar de novo não muda mais nada", () => {
    const uma = resolveAvailableOrderType("ENTREGA", semEntrega);
    expect(resolveAvailableOrderType(uma, semEntrega)).toBe(uma);
  });
});
