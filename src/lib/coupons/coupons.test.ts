import { describe, expect, it } from "vitest";
import { evaluateCoupon, normalizeCouponCode, type CouponRecord } from "../../../supabase/functions/_shared/coupons";

const baseCoupon: CouponRecord = {
  id: "coupon-1",
  code: "SEGUNDA10",
  discount_type: "PERCENT",
  discount_value: 10,
  min_subtotal: 0,
  active: true,
  valid_from: "2026-09-28T03:00:00.000Z",
  valid_until: "2026-09-29T03:00:00.000Z",
};

describe("coupon validation", () => {
  it("normalizes a valid coupon code", () => {
    expect(normalizeCouponCode(" segunda10 ")).toBe("SEGUNDA10");
    expect(normalizeCouponCode("cupom inválido")).toBeNull();
  });

  it("applies a percentage only over the eligible subtotal", () => {
    expect(evaluateCoupon(baseCoupon, 57.9, new Date("2026-09-28T20:00:00.000Z"))).toEqual({
      valid: true,
      discountAmount: 5.79,
      discountPercentage: 10,
    });
  });

  it("caps a fixed discount at the subtotal", () => {
    const coupon = { ...baseCoupon, discount_type: "AMOUNT" as const, discount_value: 50 };
    expect(evaluateCoupon(coupon, 20, new Date("2026-09-28T20:00:00.000Z"))).toEqual({
      valid: true,
      discountAmount: 20,
      discountPercentage: 0,
    });
  });

  it("rejects expired or inactive coupons", () => {
    expect(evaluateCoupon(baseCoupon, 50, new Date("2026-09-29T03:00:00.000Z")).valid).toBe(false);
    expect(evaluateCoupon({ ...baseCoupon, active: false }, 50, new Date("2026-09-28T20:00:00.000Z")).valid).toBe(false);
  });

  it("enforces the minimum subtotal", () => {
    const result = evaluateCoupon(
      { ...baseCoupon, min_subtotal: 60 },
      50,
      new Date("2026-09-28T20:00:00.000Z"),
    );
    expect(result.valid).toBe(false);
  });
});
