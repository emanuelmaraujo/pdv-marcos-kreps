/**
 * URLs de imagem são cadastradas por usuários administrativos. Só links web
 * absolutos podem ser exibidos ou abertos pela interface; isso evita que um
 * valor inválido ou um esquema executável vire `href`.
 */
export function getSafeProductImageUrl(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
