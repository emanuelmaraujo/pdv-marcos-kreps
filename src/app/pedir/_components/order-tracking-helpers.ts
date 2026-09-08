/**
 * Parsing do que o cliente digita no campo "acompanhar pedido".
 *
 * Fica fora do componente porque é lógica pura — dá pra testar sem React
 * (o vitest deste projeto roda em `environment: "node"`).
 */

/**
 * Extrai o token público do que o cliente colou. Aceita a URL completa
 * (https://marcoskreps.com.br/pedido/{token}), o caminho relativo
 * (/pedido/{token}) ou só o token — que é sempre 32 hex, vindo do
 * `encode(gen_random_bytes(16), 'hex')` da coluna orders.public_token.
 */
export function extractOrderToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Suporta /pedido/{token}, pedido/{token} ou só o token
  const match = trimmed.match(/(?:pedido\/)?([a-f0-9]{32})/i);
  return match ? match[1] : null;
}

/** Detecta se o input é um número de telefone (apenas dígitos + parens/espaços/hífen/+). */
export function looksLikePhone(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  // Se tem apenas dígitos e separadores comuns, é telefone
  return /^[\d\s()+-]+$/.test(trimmed);
}
