"use client";

import { useEffect, useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { codPolicyApi } from "@/lib/api/branches-admin-api";
import { COD_METHOD_OPTIONS, codPolicyToForm, validateCodPolicyForm, type CodPolicy, type CodPolicyForm } from "@/lib/checkout/cod-policy";
import { DELIVERY_PAYMENT_LABELS } from "@/lib/checkout/delivery-payment";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { Field, FieldGroup, Toggle } from "./FormPrimitives";
import { INPUT_CLS } from "../utils";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/**
 * Pagamento na entrega por filial. Salva à parte do formulário da filial porque
 * é uma decisão operacional com aprovação própria, registrada no servidor.
 */
export function CodPolicyCard({ branchId, deliveryEnabled }: { branchId: string; deliveryEnabled: boolean }) {
  const [policy, setPolicy] = useState<CodPolicy | null>(null);
  const [form, setForm] = useState<CodPolicyForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    codPolicyApi.get(branchId).then((loaded) => {
      if (cancelled) return;
      setPolicy(loaded);
      setForm(codPolicyToForm(loaded));
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(getFriendlyErrorMessage(error, "Não conseguimos carregar o pagamento na entrega."));
    });
    return () => { cancelled = true; };
  }, [branchId]);

  const update = (patch: Partial<CodPolicyForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setMessage(null);
  };

  async function handleSave() {
    if (!form) return;
    const { error, payload } = validateCodPolicyForm(form, deliveryEnabled);
    if (error) { setMessage({ tone: "error", text: error }); return; }
    if (payload.enabled && !window.confirm(
      "Ativar pagamento na entrega? Os pedidos chegarão sem pagamento e só entram em produção depois que a equipe confirmar contato e endereço. A baixa exige conferir o valor recebido.",
    )) return;
    setSaving(true);
    try {
      const saved = await codPolicyApi.save(branchId, payload);
      setPolicy(saved);
      setForm(codPolicyToForm(saved));
      setMessage({ tone: "success", text: saved.enabled ? "Pagamento na entrega ativo nesta filial." : "Pagamento na entrega desligado nesta filial." });
    } catch (error: unknown) {
      setMessage({ tone: "error", text: getFriendlyErrorMessage(error, "Não conseguimos salvar o pagamento na entrega.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <FieldGroup title="Pagamento na entrega" description="Cliente paga ao receber; a equipe confirma antes do preparo" icon={HandCoins}
      iconBg="bg-[var(--status-warning-bg)]" iconColor="text-[var(--status-warning)]">
      {loadError && <p className="text-xs font-semibold text-[var(--status-danger)]">{loadError}</p>}
      {!form && !loadError && (
        <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
      )}
      {form && policy && (
        <div className="space-y-4">
          <Toggle
            label="Aceitar pagamento na entrega no pedido online"
            desc={policy.enabled && policy.operational_approved_at
              ? `Ativo. Última aprovação: ${dateTime.format(new Date(policy.operational_approved_at))}.`
              : "Desligado: o checkout público oferece só Pix e cartão online."}
            checked={form.enabled}
            onChange={(enabled) => update({ enabled })}
          />
          <fieldset>
            <legend className="mb-1.5 text-[10.5px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Formas aceitas pelo motoboy</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {COD_METHOD_OPTIONS.map((method) => (
                <label key={method} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.methods.includes(method)}
                    onChange={(event) => update({ methods: event.target.checked ? [...form.methods, method] : form.methods.filter((m) => m !== method) })}
                  />
                  {DELIVERY_PAYMENT_LABELS[method]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Valor máximo (R$)" hint="por pedido">
              <input inputMode="decimal" value={form.maxAmount} onChange={(e) => update({ maxAmount: e.target.value })} placeholder="Ex.: 150,00" className={INPUT_CLS} />
            </Field>
            <Field label="Aguardando confirmação" hint="máx. ao mesmo tempo">
              <input type="number" min={1} max={200} value={form.maxPending} onChange={(e) => update({ maxPending: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Prazo para confirmar" hint="minutos">
              <input type="number" min={5} max={120} value={form.confirmationMinutes} onChange={(e) => update({ confirmationMinutes: e.target.value })} className={INPUT_CLS} />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            Pedidos acima do valor máximo ou além do limite em espera são recusados no envio, com orientação para pagar online. Sem confirmação no prazo, o pedido expira sem produção.
            {policy.pending_confirmation > 0 && ` Agora: ${policy.pending_confirmation} aguardando confirmação.`}
          </p>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Esta seção tem salvamento próprio: “Salvar alterações” da filial não altera o pagamento na entrega.</p>
          {message && (
            <p role={message.tone === "error" ? "alert" : "status"} className={`text-xs font-semibold ${message.tone === "error" ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`}>
              {message.text}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar pagamento na entrega
          </button>
        </div>
      )}
    </FieldGroup>
  );
}
