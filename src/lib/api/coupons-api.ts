import { createClient } from "@/lib/supabase/client";

export type CouponDiscountType = "PERCENT" | "AMOUNT";

export type Coupon = {
  id: string;
  branch_id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_subtotal: number;
  active: boolean;
  valid_from: string;
  valid_until: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CouponInput = Omit<Coupon, "id" | "version" | "created_at" | "updated_at">;

const columns = "id, branch_id, code, description, discount_type, discount_value, min_subtotal, active, valid_from, valid_until, version, created_at, updated_at";

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

export const couponsApi = {
  async list(branchId: string): Promise<Coupon[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("coupons")
      .select(columns)
      .eq("branch_id", branchId)
      .order("valid_from", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Coupon[];
  },

  async create(input: CouponInput): Promise<Coupon> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const { data, error } = await supabase
      .from("coupons")
      .insert({
        ...input,
        code: normalizeCode(input.code),
        created_by: user.id,
        updated_by: user.id,
      })
      .select(columns)
      .single();
    if (error) throw error;
    return data as Coupon;
  },

  async update(coupon: Coupon, input: CouponInput): Promise<Coupon> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const { data, error } = await supabase
      .from("coupons")
      .update({
        ...input,
        code: normalizeCode(input.code),
        updated_by: user.id,
      })
      .eq("id", coupon.id)
      .eq("version", coupon.version)
      .select(columns)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Este cupom foi alterado por outra pessoa. Atualize a tela.");
    return data as Coupon;
  },

  async setActive(coupon: Coupon, active: boolean): Promise<Coupon> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const { data, error } = await supabase
      .from("coupons")
      .update({ active, updated_by: user.id })
      .eq("id", coupon.id)
      .eq("version", coupon.version)
      .select(columns)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Este cupom foi alterado por outra pessoa. Atualize a tela.");
    return data as Coupon;
  },

  async remove(coupon: Coupon): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", coupon.id)
      .eq("version", coupon.version)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Este cupom foi alterado por outra pessoa. Atualize a tela.");
  },
};
