/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared helper: envia Web Push pra quem se inscreveu no acompanhamento de um
// pedido (complementa o WhatsApp — ver whatsapp-enqueue.ts).
//
// Design:
//   * Non-blocking: nunca lança. Caller não deve depender do retorno.
//   * Best-effort, sem fila/retry (diferente do WhatsApp) — push é efêmero por
//     natureza; se falhar, o cliente ainda tem o WhatsApp e o polling da tela.
//   * Inscrições mortas (404/410 — o navegador descartou a subscription) são
//     removidas automaticamente na primeira tentativa que falhar assim.

import webpush from "npm:web-push@3.6.7";

export interface OrderReadyPushPayload {
  orderId: string;
  dailyNumber: number | string | null | undefined;
  partial?: boolean;
}

function vapidConfigured(): boolean {
  return !!(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY"));
}

export async function sendOrderReadyPush(
  supabaseAdmin: any,
  payload: OrderReadyPushPayload,
): Promise<{ sent: number; failed: number }> {
  const tag = `[push-enqueue order=${payload.orderId}]`;
  if (!vapidConfigured()) {
    console.log(`${tag} SKIP: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configurados`);
    return { sent: 0, failed: 0 };
  }

  try {
    const [{ data: subscriptions, error }, { data: order }] = await Promise.all([
      supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("order_id", payload.orderId),
      supabaseAdmin
        .from("orders")
        .select("public_token")
        .eq("id", payload.orderId)
        .maybeSingle(),
    ]);

    if (error) {
      console.error(`${tag} erro ao buscar inscrições:`, error.message);
      return { sent: 0, failed: 0 };
    }
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@marcoskreps.com.br",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    const orderNum = payload.dailyNumber != null ? String(payload.dailyNumber).padStart(3, "0") : "---";
    const notificationPayload = JSON.stringify({
      title: payload.partial ? `Parte do pedido #${orderNum} está pronta` : `Pedido #${orderNum} está pronto!`,
      body: payload.partial
        ? "Um ou mais itens já saíram — o resto vem em seguida."
        : "Pode retirar no balcão. Bom apetite!",
      url: order?.public_token ? `/pedido/${order.public_token}` : "/pedir",
    });

    let sent = 0;
    let failed = 0;
    const deadSubscriptionIds: string[] = [];

    await Promise.all(subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload,
        );
        sent += 1;
      } catch (err: any) {
        failed += 1;
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadSubscriptionIds.push(sub.id);
        } else {
          console.error(`${tag} falha ao enviar (endpoint=${sub.endpoint.slice(0, 40)}...):`, err?.message ?? statusCode);
        }
      }
    }));

    if (deadSubscriptionIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }

    console.log(`${tag} enviado=${sent} falhou=${failed} removidas=${deadSubscriptionIds.length}`);
    return { sent, failed };
  } catch (e: any) {
    console.error(`${tag} EXCEPTION:`, e?.message ?? "unknown");
    return { sent: 0, failed: 0 };
  }
}
