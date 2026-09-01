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
          <FieldGroup
            key={s.key}
            title={s.label}
            subtitle={s.sector}
            icon={Printer}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            action={
              <SwitchKnob
                checked={enabled}
                onChange={(v) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], enabled: v } }))}
              />
            }
          >
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
