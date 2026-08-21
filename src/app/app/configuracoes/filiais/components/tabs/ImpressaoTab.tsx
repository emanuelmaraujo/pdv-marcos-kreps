import { InheritedFieldIndicator } from "@/components/ui/InheritedFieldIndicator";
import { resolveEffectivePrinterSector, type SectorKey } from "@/lib/config/effective-branch-config";
import { Field, Toggle } from "../FormPrimitives";
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
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-secondary)]">
        IP e porta de cada impressora térmica desta filial. O print-worker local lê essa configuração. Porta padrão: <strong className="text-[var(--text-primary)]">9100</strong>.
        Um setor sem customização usa o padrão global de Configurações.
      </p>
      {PRINTER_SECTORS.map((s) => {
        const effective = resolveEffectivePrinterSector(globalSettings, { printer_config: printerCfg }, s.key as SectorKey);
        return (
          <div key={s.key} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <Toggle
                label={s.label}
                desc={`Setor: ${s.sector}`}
                checked={printerCfg[s.key]?.enabled !== false}
                onChange={(v) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], enabled: v } }))}
                small
              />
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
            </div>
            {printerCfg[s.key]?.enabled !== false && (
              <div className="grid grid-cols-3 gap-2">
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
          </div>
        );
      })}
    </div>
  );
}
