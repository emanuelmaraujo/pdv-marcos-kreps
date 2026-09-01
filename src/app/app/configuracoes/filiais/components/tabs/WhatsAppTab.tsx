import { MessageSquare } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { InheritedFieldIndicator } from "@/components/ui/InheritedFieldIndicator";
import { resolveEffectiveWhatsAppTemplate, type WhatsAppEventType } from "@/lib/config/effective-branch-config";
import { Field, FieldGroup, SwitchKnob, Toggle } from "../FormPrimitives";
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
    <div className="space-y-4">
      <Toggle
        label="WhatsApp ativo nesta filial"
        desc="Quando desligado, nenhuma mensagem é enviada mesmo que o global esteja ativo"
        checked={editing.whatsapp_enabled !== false}
        onChange={(v) => setField('whatsapp_enabled', v)}
      />

      {editing.whatsapp_enabled !== false && (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Deixe o nome do template em branco para usar o template global padrão. O template deve estar aprovado na Meta.
          </p>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {WA_EVENTS.map((ev) => {
            const effective = resolveEffectiveWhatsAppTemplate(
              globalSettings,
              { whatsapp_enabled: editing.whatsapp_enabled !== false, whatsapp_templates: waCfg },
              ev.key as WhatsAppEventType,
            );
            const enabled = waCfg[ev.key]?.enabled !== false;
            return (
              <FieldGroup
                key={ev.key}
                title={ev.label}
                description={ev.hint}
                icon={MessageSquare}
                iconBg="bg-teal-100"
                iconColor="text-teal-600"
                action={
                  <SwitchKnob
                    checked={enabled}
                    onChange={(v) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], enabled: v } }))}
                  />
                }
              >
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

                {enabled && (
                  <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
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
              </FieldGroup>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
