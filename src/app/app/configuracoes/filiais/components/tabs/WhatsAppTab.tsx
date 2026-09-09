import { MessageSquare } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { InheritedFieldIndicator } from "@/components/ui/InheritedFieldIndicator";
import { resolveEffectiveWhatsAppTemplate, type WhatsAppEventType } from "@/lib/config/effective-branch-config";
import { Field, FieldGroup, SwitchKnob, Toggle } from "../FormPrimitives";
import { INPUT_CLS, ORDER_SOURCE_OPTIONS, ORDER_TYPE_OPTIONS, WA_EVENTS, type WaTemplates } from "../../utils";
import { OrderContextSelector } from "./OrderContextSelector";

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
            const orderTypes = waCfg[ev.key]?.order_types ?? ORDER_TYPE_OPTIONS.map((option) => option.value);
            const orderSources = waCfg[ev.key]?.order_sources ?? ORDER_SOURCE_OPTIONS.map((option) => option.value);
            return (
              <FieldGroup
                key={ev.key}
                title={ev.label}
                description={ev.hint}
                icon={MessageSquare}
                iconBg="bg-[var(--status-success-bg)]"
                iconColor="text-[var(--status-success)]"
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
                  <div className="space-y-3">
                    <OrderContextSelector
                      orderTypes={orderTypes}
                      orderSources={orderSources}
                      onOrderTypesChange={(next) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], order_types: next } }))}
                      onOrderSourcesChange={(next) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], order_sources: next } }))}
                    />
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
