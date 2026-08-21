// Espelha no frontend a mesma regra de herança global→filial que já roda nas
// Edge Functions (supabase/functions/_shared/branch-print-cfg.ts e
// whatsapp-enqueue.ts) — usado só para EXIBIÇÃO na UI (indicar "herdado do
// padrão" vs "customizado nesta filial"). A decisão que efetivamente vale
// para imprimir/disparar mensagem continua sendo resolvida no servidor; se
// as duas implementações divergirem, a do servidor é a fonte da verdade.
import { Branch } from "@/types/pdv";

export type SectorKey = "kitchen" | "juice" | "customer";

export interface BranchPrinterSlot {
  ip?: string;
  port?: number;
  enabled?: boolean;
}

export type ConfigSource = "global" | "branch";

export interface EffectivePrinterSector {
  sector: SectorKey;
  enabled: boolean;
  ip?: string;
  port?: number;
  source: ConfigSource;
}

export type WhatsAppEventType =
  | "order_received"
  | "order_ready"
  | "order_partial_ready"
  | "order_out_for_delivery";

const SETTING_TEMPLATE: Record<WhatsAppEventType, string> = {
  order_received: "whatsapp_template_received",
  order_ready: "whatsapp_template_ready",
  order_partial_ready: "whatsapp_template_partial_ready",
  order_out_for_delivery: "whatsapp_template_out_for_delivery",
};

const DEFAULT_TEMPLATE: Record<WhatsAppEventType, string> = {
  order_received: "novo_pedido",
  order_ready: "pedido_pronto",
  order_partial_ready: "pedido_parcial_pronto",
  order_out_for_delivery: "pedido_saiu_entrega",
};

function parseBoolSetting(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

/** globalSettings vem de settingsApi.getSettings() — Record<string, string>. */
export function resolveEffectivePrinterSector(
  globalSettings: Record<string, string>,
  branch: Pick<Branch, "printer_config">,
  sector: SectorKey,
): EffectivePrinterSector {
  const globalEnabled = parseBoolSetting(globalSettings.printing_enabled, false);
  const cfg = (branch.printer_config ?? {}) as Partial<Record<SectorKey, BranchPrinterSlot>>;
  const slot = cfg[sector];

  const hasOverride = slot?.enabled !== undefined || !!slot?.ip || !!slot?.port;
  const enabled = globalEnabled && slot?.enabled !== false;

  return {
    sector,
    enabled,
    ip: slot?.ip ?? globalSettings.printer_host,
    port: slot?.port ?? (globalSettings.printer_port ? Number(globalSettings.printer_port) : undefined),
    source: hasOverride ? "branch" : "global",
  };
}

export interface EffectiveWhatsAppTemplate {
  eventType: WhatsAppEventType;
  enabled: boolean;
  templateName: string;
  source: ConfigSource;
}

export function resolveEffectiveWhatsAppTemplate(
  globalSettings: Record<string, string>,
  branch: Pick<Branch, "whatsapp_enabled" | "whatsapp_templates">,
  eventType: WhatsAppEventType,
): EffectiveWhatsAppTemplate {
  const globalEnabled = parseBoolSetting(globalSettings.whatsapp_enabled, false);
  const globalTemplate = globalSettings[SETTING_TEMPLATE[eventType]] || DEFAULT_TEMPLATE[eventType];

  const override = branch.whatsapp_templates?.[eventType];
  // Espelha o backend: nome em branco (ou só espaços) não conta como override.
  const overrideTemplateName = override?.template_name?.trim() || undefined;
  const enabled = globalEnabled && branch.whatsapp_enabled !== false && override?.enabled !== false;

  return {
    eventType,
    enabled,
    templateName: overrideTemplateName || globalTemplate,
    source: overrideTemplateName ? "branch" : "global",
  };
}

export const SECTOR_LABELS: Record<SectorKey, string> = {
  kitchen: "Cozinha",
  juice: "Sucos/Batatas",
  customer: "Cliente",
};

export const WHATSAPP_EVENT_LABELS: Record<WhatsAppEventType, string> = {
  order_received: "Pedido recebido",
  order_ready: "Pedido pronto",
  order_partial_ready: "Pedido parcialmente pronto",
  order_out_for_delivery: "Pedido saiu para entrega",
};
