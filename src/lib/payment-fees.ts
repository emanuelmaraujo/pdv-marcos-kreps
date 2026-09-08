export type PaymentFeeInput = {
  amount: number;
  feePercent: number;
  feeFixed: number;
  anticipationPercent: number;
};

export function calculatePaymentFees(input: PaymentFeeInput) {
  const amount = Math.max(0, input.amount || 0);
  const processingFee = roundCurrency(amount * Math.max(0, input.feePercent || 0) / 100 + Math.max(0, input.feeFixed || 0));
  const anticipationFee = roundCurrency(amount * Math.max(0, input.anticipationPercent || 0) / 100);
  return {
    processingFee,
    anticipationFee,
    netAmount: roundCurrency(amount - processingFee - anticipationFee),
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
