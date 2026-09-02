// Shared helper: fire-and-forget calls to loyalty-accrue / loyalty-revoke.
// Nunca lança — loyalty é melhoria, falha aqui não pode travar o caixa.

async function fireLoyaltyFunction(
  slug: "loyalty-accrue" | "loyalty-revoke",
  orderId: string | null | undefined,
  orderItemIds?: string[] | null,
): Promise<void> {
  const tag = `[${slug}-fire]`;
  try {
    if (!orderId) return;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secret = Deno.env.get("LOYALTY_INTERNAL_SECRET");
    if (!supabaseUrl || !secret) {
      console.log(`${tag} SKIP: SUPABASE_URL/LOYALTY_INTERNAL_SECRET ausentes`);
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({
        order_id: orderId,
        ...(orderItemIds && orderItemIds.length > 0 ? { order_item_ids: orderItemIds } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(`${tag} order=${orderId} status=${res.status} body=${body.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`${tag} order=${orderId} EXCEPTION: ${e?.message ?? "unknown"}`);
  }
}

export async function fireLoyaltyAccrue(orderId: string | null | undefined, orderItemIds?: string[] | null): Promise<void> {
  await fireLoyaltyFunction("loyalty-accrue", orderId, orderItemIds);
}

export async function fireLoyaltyRevoke(orderId: string | null | undefined, orderItemIds?: string[] | null): Promise<void> {
  await fireLoyaltyFunction("loyalty-revoke", orderId, orderItemIds);
}
