type AttemptStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const TTL_MS = 24 * 60 * 60 * 1000;
const storageKey = (branch: string) => `pdv-public-attempt:${branch}`;

export function publicOrderAttemptPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const normalized = { ...payload } as Record<string, unknown>;
  delete normalized.analytics_consent; delete normalized.analytics_context;
  return normalized;
}

/** Mantém a mesma tentativa após falha de rede/reload, sem persistir o corpo do pedido. */
export async function resolvePublicOrderAttempt(storage: AttemptStorage, branch: string, payload: unknown, now = Date.now()) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(publicOrderAttemptPayload(payload))));
  const fingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  try {
    const saved = JSON.parse(storage.getItem(storageKey(branch)) ?? "null");
    if (saved?.fingerprint === fingerprint && typeof saved.key === "string"
      && /^[0-9a-f-]{36}$/i.test(saved.key) && saved.expires > now) return saved.key as string;
  } catch { /* Armazenamento indisponível não impede o pedido. */ }
  const key = crypto.randomUUID();
  try { storage.setItem(storageKey(branch), JSON.stringify({ key, fingerprint, expires: now + TTL_MS })); } catch { /* O ref da tela ainda protege retries na mesma montagem. */ }
  return key;
}
export function clearPublicOrderAttempt(storage: AttemptStorage, branch: string) {
  try { storage.removeItem(storageKey(branch)); } catch { /* Navegação continua disponível. */ }
}
