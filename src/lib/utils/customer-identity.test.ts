import { describe, expect, it } from "vitest";
import {
  describeCustomerPhone,
  resolveNameAfterPhoneChange,
  resolveNameFromInput,
  resolveNameFromLookup,
  toSubmittablePhone,
  validateCustomerIdentity,
} from "./customer-identity";

describe("describeCustomerPhone", () => {
  it("classifica campo vazio sem acusar erro", () => {
    const state = describeCustomerPhone("");
    expect(state.status).toBe("EMPTY");
    expect(state.message).toBeNull();
    expect(state.e164).toBeNull();
  });

  it("trata máscara sem dígitos como vazio", () => {
    expect(describeCustomerPhone("() -").status).toBe("EMPTY");
  });

  it("acusa número digitado pela metade", () => {
    const state = describeCustomerPhone("(11) 9999");
    expect(state.status).toBe("INCOMPLETE");
    expect(state.message).toMatch(/incompleto/i);
    expect(state.digits).toBe("119999");
  });

  it("acusa DDD inexistente com 11 dígitos", () => {
    expect(describeCustomerPhone("(10) 99999-8888").status).toBe("INVALID");
  });

  it("acusa celular de 11 dígitos sem o 9", () => {
    expect(describeCustomerPhone("(11) 88888-7777").status).toBe("INVALID");
  });

  it("aceita celular e fixo válidos", () => {
    expect(describeCustomerPhone("(11) 99999-8888")).toMatchObject({ status: "VALID", e164: "+5511999998888" });
    expect(describeCustomerPhone("(11) 3333-4444")).toMatchObject({ status: "VALID", e164: "+551133334444" });
  });

  it("aceita número com código do país e conta só os dígitos nacionais", () => {
    const state = describeCustomerPhone("+55 (11) 99999-8888");
    expect(state.status).toBe("VALID");
    expect(state.digits).toBe("11999998888");
  });

  it("preserva DDD 55 como número nacional", () => {
    expect(describeCustomerPhone("(55) 99999-8888").e164).toBe("+5555999998888");
  });
});

describe("validateCustomerIdentity", () => {
  it("libera pedido sem telefone quando ele é opcional", () => {
    expect(validateCustomerIdentity("")).toBeNull();
  });

  it("bloqueia telefone pela metade mesmo sendo opcional", () => {
    expect(validateCustomerIdentity("(11) 9999")).toMatch(/incompleto/i);
  });

  it("usa a mensagem da modalidade quando o telefone é exigido", () => {
    expect(
      validateCustomerIdentity("", { requirePhone: true, requiredMessage: "Entrega precisa de WhatsApp." }),
    ).toBe("Entrega precisa de WhatsApp.");
  });

  it("cobra telefone quando a modalidade exige contato", () => {
    expect(validateCustomerIdentity("", { requirePhone: true })).toMatch(/WhatsApp/i);
    expect(validateCustomerIdentity("(11) 99999-8888", { requirePhone: true })).toBeNull();
  });
});

describe("toSubmittablePhone", () => {
  it("envia só E.164", () => {
    expect(toSubmittablePhone("(11) 99999-8888")).toBe("+5511999998888");
  });

  it("nunca envia texto cru de número inválido", () => {
    expect(toSubmittablePhone("(11) 9999")).toBeUndefined();
    expect(toSubmittablePhone("")).toBeUndefined();
  });
});

describe("resolveNameFromInput", () => {
  it("marca como manual o que foi digitado", () => {
    expect(resolveNameFromInput("Marcos")).toMatchObject({ name: "Marcos", source: "MANUAL" });
  });

  it("volta a NONE quando o campo é esvaziado", () => {
    expect(resolveNameFromInput("   ")).toMatchObject({ source: "NONE" });
  });
});

describe("resolveNameFromLookup", () => {
  it("preenche campo vazio com o nome do perfil", () => {
    expect(resolveNameFromLookup({ currentName: "", nameSource: "NONE", profileName: "Ana" }))
      .toMatchObject({ name: "Ana", source: "LOOKUP", suggestion: null });
  });

  it("substitui nome que a própria consulta preencheu antes", () => {
    expect(resolveNameFromLookup({ currentName: "Ana", nameSource: "LOOKUP", profileName: "Ana Maria" }))
      .toMatchObject({ name: "Ana Maria", source: "LOOKUP" });
  });

  it("preserva o nome digitado à mão e apenas sugere o do cadastro", () => {
    expect(resolveNameFromLookup({ currentName: "Ana da mesa 4", nameSource: "MANUAL", profileName: "Ana Maria" }))
      .toMatchObject({ name: "Ana da mesa 4", source: "MANUAL", suggestion: "Ana Maria" });
  });

  it("não sugere quando o nome digitado é o mesmo do cadastro", () => {
    expect(resolveNameFromLookup({ currentName: "  ana   maria ", nameSource: "MANUAL", profileName: "Ana Maria" }))
      .toMatchObject({ name: "Ana Maria", source: "LOOKUP", suggestion: null });
  });

  it("mantém o que está no campo quando o perfil não tem nome", () => {
    expect(resolveNameFromLookup({ currentName: "Ana", nameSource: "MANUAL", profileName: null }))
      .toMatchObject({ name: "Ana", source: "MANUAL", suggestion: null });
  });
});

describe("resolveNameAfterPhoneChange", () => {
  it("apaga só o nome que veio da consulta", () => {
    expect(resolveNameAfterPhoneChange({ currentName: "Ana", nameSource: "LOOKUP" }))
      .toMatchObject({ name: "", source: "NONE" });
  });

  it("preserva o nome digitado à mão quando o telefone é apagado", () => {
    expect(resolveNameAfterPhoneChange({ currentName: "Ana", nameSource: "MANUAL" }))
      .toMatchObject({ name: "Ana", source: "MANUAL" });
  });
});
