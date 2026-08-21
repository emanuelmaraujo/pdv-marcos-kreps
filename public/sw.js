// Service worker mínimo — só existe pra receber Web Push de "pedido pronto"
// (complementa o WhatsApp e o polling da tela de acompanhamento, ver
// src/app/pedido/[publicToken]/PedidoStatusClient.tsx). Sem cache/offline de
// propósito: o /pedir depende de dados sempre atualizados do servidor
// (cardápio, horário, preço), então um service worker de cache criaria mais
// risco (conteúdo velho) do que benefício aqui.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "Marcos Krep's";
  const options = {
    body: payload.body || "",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: { url: payload.url || "/pedir" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/pedir";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
