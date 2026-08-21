import { BranchInput } from "@/lib/api/branches-admin-api";
import { InheritedFieldIndicator } from "@/components/ui/InheritedFieldIndicator";
import { resolveEffectiveWhatsAppTemplate, type WhatsAppEventType } from "@/lib/config/effective-branch-config";
import { Field, Toggle } from "../FormPrimitives";
import { INPUT_CLS, WA_EVENTS, type WaTemplates } from "../../utils";

export function WhatsAppTab({
  editing,
  setField,
  waCfg,
  setWaCfg,
  globalSettings,
}: {
  editing: BranchInput;
  setField: <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => void;
  waCfg: WaTemplates;
  setWaCfg: (updater: (prev: WaTemplates) => WaTemplates) => void;
  globalSettings: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <Toggle
        label="WhatsApp ativo nesta filial"
        desc="Quando desligado, nenhuma mensagem é enviada mesmo que o global esteja ativo"
        checked={editing.whatsapp_enabled !== false}
        onChange={(v) => setField('whatsapp_enabled', v)}
      />

      {editing.whatsapp_enabled !== false && (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Deixe o nome do template em branco para usar o template global padrão. O template deve estar aprovado na Meta.
          </p>
          {WA_EVENTS.map((ev) => {
            const effective = resolveEffectiveWhatsAppTemplate(
              globalSettings,
              { whatsapp_enabled: editing.whatsapp_enabled !== false, whatsapp_templates: waCfg },
              ev.key as WhatsAppEventType,
            );
            return (
              <div key={ev.key} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[var(--text-primary)]">{ev.label}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{ev.hint}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <InheritedFieldIndicator
                      source={effective.source}
                      onReset={effective.source === "branch" ? () => {
                        setWaCfg((p) => {
                          const next = { ...p };
                          delete next[ev.key];
                          return next;
                        });
                      } : undefined}
                    />
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={waCfg[ev.key]?.enabled !== false}
                        onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], enabled: e.target.checked } }))}
                        className="h-3.5 w-3.5 accent-brand-red"
                      />
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">Ativo</span>
                    </label>
                  </div>
                </div>
                {waCfg[ev.key]?.enabled !== false && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Field label="Nome do template">
                        <input
                          type="text"
                          value={waCfg[ev.key]?.template_name ?? ''}
                          onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], template_name: e.target.value } }))}
                          className={`${INPUT_CLS} font-mono text-xs`}
                          placeholder={`Padrão: ${effective.templateName}`}
                        />
                      </Field>
                    </div>
                    <Field label="Idioma">
                      <input
                        type="text"
                        value={waCfg[ev.key]?.language ?? 'pt_BR'}
                        onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], language: e.target.value } }))}
                        className={`${INPUT_CLS} font-mono text-xs`}
                        placeholder="pt_BR"
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
