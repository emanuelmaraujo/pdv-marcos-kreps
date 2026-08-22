import { Printer } from "lucide-react";
import { InheritedFieldIndicator } from "@/components/ui/InheritedFieldIndicator";
import { resolveEffectivePrinterSector, type SectorKey } from "@/lib/config/effective-branch-config";
import { Field, FieldGroup, SwitchKnob } from "../FormPrimitives";
import { INPUT_CLS, PRINTER_SECTORS, type PrinterConfig } from "../../utils";

export function ImpressaoTab({
  printerCfg,
  setPrinterCfg,
  globalSettings,
}: {
  printerCfg: PrinterConfig;
  setPrinterCfg: (updater: (prev: PrinterConfig) => PrinterConfig) => void;
  globalSettings: Record<string, string>;
}) {
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      {PRINTER_SECTORS.map((s) => {
        const effective = resolveEffectivePrinterSector(globalSettings, { printer_config: printerCfg }, s.key as SectorKey);
        const enabled = printerCfg[s.key]?.enabled !== false;
        return (
          <FieldGroup key={s.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                  <Printer className="h-4 w-4 text-violet-600" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-[var(--text-primary)]">{s.label}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{s.sector}</p>
                </div>
              </div>
              <SwitchKnob
                checked={enabled}
                onChange={(v) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], enabled: v } }))}
              />
            </div>

            <InheritedFieldIndicator
              source={effective.source}
              onReset={effective.source === "branch" ? () => {
                setPrinterCfg((p) => {
                  const next = { ...p };
                  delete next[s.key];
                  return next;
                });
              } : undefined}
            />

            {enabled && (
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                <div className="col-span-2">
                  <Field label="IP da impressora">
                    <input
                      type="text"
                      value={printerCfg[s.key]?.ip ?? ''}
                      onChange={(e) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], ip: e.target.value } }))}
                      className={`${INPUT_CLS} font-mono`}
                      placeholder={`Padrão: ${effective.ip ?? "não definido"}`}
                    />
                  </Field>
                </div>
                <Field label="Porta">
                  <input
                    type="number"
                    value={printerCfg[s.key]?.port ?? ''}
                    onChange={(e) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], port: Number(e.target.value) } }))}
                    className={`${INPUT_CLS} font-mono`}
                    placeholder={String(effective.port ?? 9100)}
                  />
                </Field>
              </div>
            )}
          </FieldGroup>
        );
      })}
    </div>
  );
}
