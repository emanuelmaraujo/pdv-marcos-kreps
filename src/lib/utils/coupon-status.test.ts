import { describe, expect, it } from "vitest";
import { getCouponStatus } from "./coupon-status";

const coupon = {
  active: true,
  valid_from: "2026-10-24T12:00:00Z",
  valid_until: "2026-10-24T13:00:00Z",
};

describe("validade exibida de cupons", () => {
  it.each([
    ["2026-10-24T11:59:59.999Z", "Agendado"],
    ["2026-10-24T12:00:00Z", "Ativo"],
    ["2026-10-24T12:59:59.999Z", "Ativo"],
    ["2026-10-24T13:00:00Z", "Expirado"],
  ])("classifica corretamente o instante %s", (instant, expected) => {
    expect(getCouponStatus(coupon, Date.parse(instant))).toBe(expected);
  });

  it("mantém cupom desativado inativo mesmo dentro da validade", () => {
    expect(getCouponStatus({ ...coupon, active: false }, Date.parse(coupon.valid_from))).toBe("Inativo");
  });

  it("não mostra cupom com validade inválida como ativo", () => {
    expect(getCouponStatus({ ...coupon, valid_until: "invalid" }, Date.parse(coupon.valid_from))).toBe("Expirado");
  });
});
