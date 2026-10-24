type CouponValidity = { active: boolean; valid_from: string; valid_until: string };

export function getCouponStatus(coupon: CouponValidity, now: number) {
  if (!coupon.active) return "Inativo";
  const starts = new Date(coupon.valid_from).getTime();
  const ends = new Date(coupon.valid_until).getTime();
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts) return "Expirado";
  if (now < starts) return "Agendado";
  return now >= ends ? "Expirado" : "Ativo";
}
