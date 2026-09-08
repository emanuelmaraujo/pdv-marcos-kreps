import { describe, expect, it } from "vitest";
import { calculatePaymentFees } from "./payment-fees";

describe("calculatePaymentFees", () => {
  it("calcula taxa percentual, fixa e antecipação com arredondamento monetário", () => {
    expect(calculatePaymentFees({ amount: 100, feePercent: 2.49, feeFixed: 0.3, anticipationPercent: 1.2 })).toEqual({
      processingFee: 2.79,
      anticipationFee: 1.2,
      netAmount: 96.01,
    });
  });

  it("não aceita custos negativos", () => {
    expect(calculatePaymentFees({ amount: 50, feePercent: -2, feeFixed: -1, anticipationPercent: -3 }).netAmount).toBe(50);
  });
});
