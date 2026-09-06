import { describe, expect, it } from "vitest";
import { mapMercadoPagoStatus } from "./payment-helpers";

describe("mapMercadoPagoStatus", () => {
  it.each(["approved", "authorized", "APPROVED"])("trata %s como aprovado", (status) => {
    expect(mapMercadoPagoStatus(status).kind).toBe("approved");
  });

  it.each(["pending", "in_process", "in_mediation"])("trata %s como em análise", (status) => {
    const result = mapMercadoPagoStatus(status);
    expect(result.kind).toBe("pending");
    expect(result.message).toMatch(/análise/i);
  });

  it.each(["rejected", "cancelled", "refunded", "charged_back", "", "algo_novo"])(
    "trata %s como recusado",
    (status) => {
      expect(mapMercadoPagoStatus(status).kind).toBe("rejected");
    },
  );

  it("trata status ausente como recusado", () => {
    expect(mapMercadoPagoStatus(undefined).kind).toBe("rejected");
    expect(mapMercadoPagoStatus(null).kind).toBe("rejected");
  });

  it.each([
    ["cc_rejected_bad_filled_security_code", /CVV/i],
    ["cc_rejected_bad_filled_card_number", /número do cartão/i],
    ["cc_rejected_bad_filled_date", /validade/i],
    ["cc_rejected_insufficient_amount", /saldo ou limite/i],
    ["cc_rejected_call_for_authorize", /banco/i],
    ["cc_rejected_max_attempts", /tentativas/i],
    ["cc_rejected_invalid_installments", /parcelas/i],
  ])("dá mensagem específica para %s", (detail, pattern) => {
    expect(mapMercadoPagoStatus("rejected", detail).message).toMatch(pattern);
  });

  it("usa mensagem genérica para status_detail desconhecido", () => {
    const unknown = mapMercadoPagoStatus("rejected", "cc_rejected_motivo_que_nao_existe");
    expect(unknown.message).toBe(mapMercadoPagoStatus("rejected").message);
  });

  it("nunca vaza o código do provedor na mensagem", () => {
    const details = [
      "cc_rejected_blacklist",
      "cc_rejected_high_risk",
      "cc_rejected_other_reason",
      "cc_rejected_card_disabled",
      "codigo_desconhecido",
      undefined,
    ];
    for (const detail of details) {
      expect(mapMercadoPagoStatus("rejected", detail).message).not.toMatch(/cc_rejected|_/);
    }
  });

  it("não confunde fraude com erro de digitação", () => {
    // Ambos são recusa, mas a de risco não pode sugerir 'confira os dados'.
    expect(mapMercadoPagoStatus("rejected", "cc_rejected_high_risk").message).not.toMatch(/confira/i);
  });
});
