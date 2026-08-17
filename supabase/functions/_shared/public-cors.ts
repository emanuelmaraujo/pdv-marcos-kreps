// CORS compartilhado pelos endpoints públicos (checkout, status de pedido,
// lookup por telefone, etc).
//
// Antes, cada função tinha sua própria cópia deste helper com
// `Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*"` — se a env var não
// estivesse configurada, o fallback caía silenciosamente pra "*" (qualquer
// origem). Em produção essa env var já está configurada (allowlist real), mas
// esse fallback continuava sendo uma armadilha pra qualquer ambiente novo
// (preview, staging) que esquecesse de configurá-la.
//
// Agora só "*" explícito (PUBLIC_CHECKOUT_ALLOWED_ORIGINS="*") libera
// qualquer origem — pensado pra dev/local. Sem a env var configurada, nenhuma
// origem cross-origin é liberada (equivalente a allowlist vazia).

function allowedOriginsRaw(): string | undefined {
  return Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS");
}

function parseAllowlist(raw: string): string[] {
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

/** Resolve o valor pra Access-Control-Allow-Origin desta requisição. */
export function resolveAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const raw = allowedOriginsRaw();

  if (raw === "*") return origin || "*";
  if (!raw) return ""; // nada configurado -> nenhuma origem cross-origin liberada

  const allowed = parseAllowlist(raw);
  return allowed.includes(origin) ? origin : "";
}

/** Usado pra bloquear a requisição inteira (não só o header CORS) antes de processar. */
export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const raw = allowedOriginsRaw();

  if (raw === "*") return true;
  if (!origin) return true; // sem header Origin = não é uma chamada de browser cross-origin (curl, server-to-server)
  if (!raw) return false;

  return parseAllowlist(raw).includes(origin);
}

export function publicCorsHeaders(
  req: Request,
  opts: { methods?: string; cacheControl?: string; extraHeaders?: string } = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(req),
    "Access-Control-Allow-Headers": opts.extraHeaders
      ? `authorization, x-client-info, apikey, content-type, ${opts.extraHeaders}`
      : "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": opts.methods ?? "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (opts.cacheControl) headers["Cache-Control"] = opts.cacheControl;
  return headers;
}
