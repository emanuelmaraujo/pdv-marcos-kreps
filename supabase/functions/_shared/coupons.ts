export type CouponRecord = {
  id: string;
  code: string;
  description?: string | null;
  discount_type: "PERCENT" | "AMOUNT";
  discount_value: number | string;
  min_subtotal: number | string;
  active: boolean;
  valid_from: string;
  valid_until: string;
};

export type CouponEvaluation =
  | { valid: true; discountAmount: number; discountPercentage: number }
  | { valid: false; error: string };

export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,40}$/.test(normalized) ? normalized : null;
}

function money(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function evaluateCoupon(
  coupon: CouponRecord | null | undefined,
  subtotal: number,
  now = new Date(),
): CouponEvaluation {
  if (!coupon || !coupon.active) return { valid: false, error: "Cupom inválido ou expirado." };

  const from = new Date(coupon.valid_from).getTime();
  const until = new Date(coupon.valid_until).getTime();
  const current = now.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until) || current < from || current >= until) {
    return { valid: false, error: "Cupom inválido ou expirado." };
  }

  const safeSubtotal = money(subtotal);
  const minSubtotal = money(coupon.min_subtotal);
  if (safeSubtotal < minSubtotal) {
    return { valid: false, error: `Este cupom exige subtotal mínimo de ${formatBRL(minSubtotal)}.` };
  }

  const value = money(coupon.discount_value);
  if (value <= 0) return { valid: false, error: "Cupom inválido ou expirado." };

  if (coupon.discount_type === "PERCENT") {
    const percentage = Math.min(100, value);
    return {
      valid: true,
      discountAmount: Math.round((safeSubtotal * percentage / 100) * 100) / 100,
      discountPercentage: percentage,
    };
  }

  return {
    valid: true,
    discountAmount: Math.round(Math.min(safeSubtotal, value) * 100) / 100,
    discountPercentage: 0,
  };
}
