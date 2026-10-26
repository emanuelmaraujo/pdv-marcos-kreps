import { describe, expect, it } from "vitest";
import { codPolicyToForm, parseCodPolicy, validateCodPolicyForm, type CodPolicyForm } from "./cod-policy";

const form = (patch: Partial<CodPolicyForm> = {}): CodPolicyForm => ({
  enabled: true, methods: ["PIX", "CASH"], maxAmount: "150,00", maxPending: "10", confirmationMinutes: "30", ...patch,
});

describe("configuração de pagamento na entrega no painel", () => {
  it("sem registro, mostra desligado com padrões do servidor", () => {
    const policy = parseCodPolicy({ enabled: false, methods: [], max_amount: null, max_pending: 20, confirmation_minutes: 30 });
    expect(codPolicyToForm(policy)).toEqual({ enabled: false, methods: [], maxAmount: "", maxPending: "20", confirmationMinutes: "30" });
  });
  it("mostra o valor máximo com centavos", () => {
    expect(codPolicyToForm(parseCodPolicy({ max_amount: 220.5 })).maxAmount).toBe("220,50");
  });
  it("ignora formas desconhecidas vindas do servidor", () => {
    expect(parseCodPolicy({ methods: ["CASH", "BOLETO"] }).methods).toEqual(["CASH"]);
  });
  it("aceita valor em reais com vírgula e ordena formas", () => {
    expect(validateCodPolicyForm(form({ maxAmount: "1.250,50" }), true)).toEqual({
      error: null, payload: { enabled: true, methods: ["CASH", "PIX"], maxAmount: 1250.5, maxPending: 10, confirmationMinutes: 30 },
    });
  });
  it("aceita ponto como separador decimal", () => {
    expect(validateCodPolicyForm(form({ maxAmount: "150.50" }), true).payload.maxAmount).toBe(150.5);
  });
  it("bloqueia ativação sem entrega, forma ou limite", () => {
    expect(validateCodPolicyForm(form(), false).error).toMatch(/entrega desta filial/);
    expect(validateCodPolicyForm(form({ methods: [] }), true).error).toMatch(/ao menos uma forma/);
    expect(validateCodPolicyForm(form({ maxAmount: "" }), true).error).toMatch(/valor máximo/);
  });
  it("desligar não exige limites nem entrega", () => {
    expect(validateCodPolicyForm(form({ enabled: false, methods: [], maxAmount: "" }), false).error).toBeNull();
  });
  it("respeita as faixas do servidor", () => {
    expect(validateCodPolicyForm(form({ maxPending: "0" }), true).error).toMatch(/entre 1 e 200/);
    expect(validateCodPolicyForm(form({ confirmationMinutes: "121" }), true).error).toMatch(/5 e 120/);
    expect(validateCodPolicyForm(form({ maxAmount: "-1" }), true).error).toMatch(/valor máximo entre/);
  });
});
