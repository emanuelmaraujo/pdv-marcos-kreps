// Rate limit por janela deslizante, backed pela RPC check_rate_limit
// (tabela rate_limit_hits) — ver supabase/migrations/20260817120000_rate_limit.sql.
//
// Usado pra endpoints públicos sensíveis a enumeração (ex: lookup-orders-by-phone).

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Retorna true se a chamada está dentro do limite (permitida), false se
 * estourou. Em caso de erro de infra na checagem, falha aberto (permite) —
 * um bug no rate limiter não deve derrubar o endpoint inteiro.
 */
// deno-lint-ignore no-explicit-any
export async function checkRateLimit(
  supabaseAdmin: any,
  key: string,
  maxHits: number,
  windowSeconds = 900,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: key,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] checagem falhou, liberando por padrão:", error.message);
    return true;
  }
  return data === true;
}
