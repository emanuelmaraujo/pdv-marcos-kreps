import { BranchType } from "@/types/pdv";
import { BranchInput } from "@/lib/api/branches-admin-api";

export const TYPE_OPTIONS: { value: BranchType; label: string; desc: string }[] = [
  { value: 'STORE', label: 'Loja fixa', desc: 'Aberta todo dia, endereço fixo' },
  { value: 'POPUP', label: 'Pop-up', desc: 'Temporária, sem endereço fixo' },
  { value: 'FAIR',  label: 'Feira', desc: 'Recorrente, endereço variável' },
];

export const WA_EVENTS = [
  { key: 'order_received',      label: 'Pedido recebido',     hint: 'Dispara quando o pedido entra na fila' },
  { key: 'order_partial_ready', label: 'Primeiro item pronto', hint: 'Dispara quando PRONTO_PARCIAL (1ª vez)' },
  { key: 'order_ready',         label: 'Pedido completo',      hint: 'Dispara quando todos os itens ficam prontos' },
] as const;

export const PRINTER_SECTORS = [
  { key: 'kitchen',  label: 'Cozinha (Kreps)',   sector: 'KITCHEN' },
  { key: 'juice',    label: 'Sucos / Batata',    sector: 'JUICE_POTATO' },
  { key: 'customer', label: 'Via do Cliente',    sector: 'CUSTOMER' },
] as const;

export type PrinterConfig = { [key: string]: { ip?: string; port?: number; enabled?: boolean } };
export type WaTemplates = { [key: string]: { template_name?: string; language?: string; enabled?: boolean } };

export function parseConfig(raw?: Record<string, unknown> | null): PrinterConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as PrinterConfig;
}

export function parseTemplates(raw?: Record<string, { template_name?: string; language?: string; enabled?: boolean }> | null): WaTemplates {
  if (!raw || typeof raw !== 'object') return {};
  return raw as WaTemplates;
}

export const EMPTY_BRANCH: BranchInput = {
  code: '', slug: '', name: '', type: 'STORE', active: true,
  packing_fee: 0, ordering_enabled: true, whatsapp_enabled: true,
  delivery_enabled: false, default_delivery_fee: 0,
};

// Classe de input tematizada (light/dark/warm) — substitui o `.input` global.
export const INPUT_CLS =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] ' +
  'px-3 py-2.5 text-sm text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-muted)] ' +
  'focus:border-brand-red/50 focus:outline-none focus:ring-2 focus:ring-brand-red/15 ' +
  'transition-colors';

/* Cor estável de avatar derivada do id da filial — mesma filial sempre
   recebe a mesma cor, sem usar preto. Paleta calma (não brand) para não
   competir com os CTAs vermelhos. */
const AVATAR_PALETTE = [
  "#2563EB", "#0891B2", "#0F766E", "#16A34A", "#65A30D",
  "#CA8A04", "#EA580C", "#DC2626", "#DB2777", "#9333EA",
  "#6366F1", "#0D9488",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarStyleFor(id: string, code: string) {
  const idx = hashString(id || code) % AVATAR_PALETTE.length;
  return { bg: AVATAR_PALETTE[idx] };
}

export function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

export function validateBranchCode(code: string | undefined): boolean {
  return !code || /^[A-Z0-9]{1,3}$/.test(code);
}

export function validateBranchSlug(slug: string | undefined): boolean {
  return !slug || /^[a-z0-9-]{2,32}$/.test(slug);
}
