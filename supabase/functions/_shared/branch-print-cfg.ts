// Helper compartilhado: resolve se um setor deve imprimir, combinando
// settings GLOBAL com o override por filial (branches.printer_config).
//
// Regra: se a filial marcou `<setor>.enabled === false` no printer_config,
// aquele setor NÃO imprime — mesmo que o global esteja ligado.
// Quando ausente/undefined, segue o global.

export type SectorKey = 'kitchen' | 'juice' | 'customer';

export interface BranchPrinterSlot {
  ip?: string;
  port?: number;
  enabled?: boolean;
}

export type BranchPrinterConfig = Partial<Record<SectorKey, BranchPrinterSlot>>;

/** Recebe o JSONB lido de branches.printer_config (ou null/undefined). */
export function parseBranchPrinterConfig(raw: unknown): BranchPrinterConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as BranchPrinterConfig;
}

/** True se o setor está liberado para imprimir nesta filial. */
export function sectorEnabledOnBranch(cfg: BranchPrinterConfig, sector: SectorKey): boolean {
  return cfg?.[sector]?.enabled !== false;
}

/** Combina o flag global com o override da filial. */
export function shouldPrint(
  globalEnabled: boolean,
  branchCfg: BranchPrinterConfig,
  sector: SectorKey,
): boolean {
  return globalEnabled && sectorEnabledOnBranch(branchCfg, sector);
}
