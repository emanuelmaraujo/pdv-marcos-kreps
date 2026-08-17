// Normalização de bairro para matching de zonas de entrega. Espelha
// supabase/functions/_shared/delivery.ts — mesma regra dos dois lados
// (frontend cadastra/mostra, backend recalcula com autoridade).
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeNeighborhood(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
