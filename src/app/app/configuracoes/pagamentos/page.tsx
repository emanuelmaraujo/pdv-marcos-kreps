"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  Power,
  Pencil,
  Trash2,
} from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import {
  paymentFeesApi,
  type CardPaymentMethod,
  type CreatePaymentFeeRule,
  type PaymentFeeRule,
  type PaymentRuleOrderSource,
  type PaymentRuleOrderType,
} from "@/lib/api/payment-fees-api";
import { calculatePaymentFees } from "@/lib/payment-fees";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { SettingsBadge, SettingsPageHeader } from "../components/SettingsPageHeader";

type FeeForm = {
  provider: string;
  channel: "IN_PERSON" | "ONLINE";
  cardBrand: string;
  orderType: PaymentRuleOrderType;
  orderSource: PaymentRuleOrderSource;
  method: CardPaymentMethod;
  installmentsFrom: string;
  installmentsTo: string;
  percent: string;
  fixed: string;
  anticipation: string;
  settlementDays: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

const today = new Date().toISOString().slice(0, 10);
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentageFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const initialForm: FeeForm = {
  provider: "MANUAL",
  channel: "IN_PERSON",
  cardBrand: "ANY",
  orderType: "ANY",
  orderSource: "ANY",
  method: "DEBIT_CARD",
  installmentsFrom: "1",
  installmentsTo: "1",
  percent: "",
  fixed: "0",
  anticipation: "0",
  settlementDays: "1",
  effectiveFrom: today,
  effectiveTo: "",
  reason: "Configuração inicial da adquirente",
};

export default function PaymentFeesPage() {
  const { currentBranch, currentBranchId, isLoading: branchLoading, branches, setCurrentBranch } = useBranch();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();
  const [rules, setRules] = useState<PaymentFeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FeeForm>(initialForm);
  const [editingRule, setEditingRule] = useState<PaymentFeeRule | null>(null);
  const [simulationAmount, setSimulationAmount] = useState("100,00");

  useEffect(() => {
    const requestedBranch = searchParams.get("branch");
    if (requestedBranch && requestedBranch !== currentBranchId && branches.some((branch) => branch.id === requestedBranch)) {
      setCurrentBranch(requestedBranch);
    }
  }, [branches, currentBranchId, searchParams, setCurrentBranch]);

  const loadRules = useCallback(async () => {
    if (!currentBranchId) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRules(await paymentFeesApi.list(currentBranchId));
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível carregar as taxas."));
    } finally {
      setLoading(false);
    }
  }, [addToast, currentBranchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRules(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRules]);

  const activeRules = rules.filter((rule) => rule.active);
  const effectiveRules = activeRules.filter((rule) => rule.effective_from <= today && (!rule.effective_to || rule.effective_to >= today));
  const hasDefaultRule = (method: CardPaymentMethod, orderType: Exclude<PaymentRuleOrderType, "ANY">) => effectiveRules.some((rule) =>
    rule.provider_code === "MANUAL"
    && rule.channel === "IN_PERSON"
    && rule.card_brand === "ANY"
    && rule.payment_method === method
    && (rule.order_type === "ANY" || rule.order_type === orderType)
    && (rule.order_source === "ANY" || rule.order_source === "ATTENDANT")
  );
  const defaultCoverage = (["BALCAO", "VIAGEM", "ENTREGA"] as const).flatMap((orderType) => (["DEBIT_CARD", "CREDIT_CARD"] as const).map((method) => ({
    orderType,
    method,
    configured: hasDefaultRule(method, orderType),
  })));
  const defaultFlowComplete = defaultCoverage.every((item) => item.configured);

  const preview = useMemo(() => calculatePaymentFees({
    amount: parseDecimal(simulationAmount),
    feePercent: parseDecimal(form.percent),
    feeFixed: parseDecimal(form.fixed),
    anticipationPercent: parseDecimal(form.anticipation),
  }), [form.anticipation, form.fixed, form.percent, simulationAmount]);

  function setField<K extends keyof FeeForm>(key: K, value: FeeForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleBranchChange(branchId: string) {
    setShowForm(false);
    setEditingRule(null);
    setForm(initialForm);
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", branchId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!currentBranchId) return;
    const installmentsFrom = form.method === "DEBIT_CARD" ? 1 : Number(form.installmentsFrom);
    const installmentsTo = form.method === "DEBIT_CARD" ? 1 : Number(form.installmentsTo);
    if (!form.provider.trim() || !form.reason.trim()) {
      addToast("error", "Informe a adquirente e o motivo da alteração.");
      return;
    }
    if (normalizeCode(form.provider).length < 2 || normalizeCode(form.cardBrand || "ANY").length < 2) {
      addToast("error", "Adquirente e bandeira precisam ter ao menos dois caracteres.");
      return;
    }
    if (installmentsFrom < 1 || installmentsTo < installmentsFrom || installmentsTo > 24) {
      addToast("error", "A faixa de parcelas precisa estar entre 1 e 24.");
      return;
    }
    const feePercent = parseDecimal(form.percent);
    const feeFixed = parseDecimal(form.fixed);
    const anticipationPercent = parseDecimal(form.anticipation);
    const settlementDays = Number(form.settlementDays);
    if (![feePercent, feeFixed, anticipationPercent].every(Number.isFinite) || feePercent < 0 || feeFixed < 0 || anticipationPercent < 0) {
      addToast("error", "Informe taxas numéricas maiores ou iguais a zero.");
      return;
    }
    if (feePercent > 100 || anticipationPercent > 100 || feeFixed > 9_999_999_999.99) {
      addToast("error", "Revise os limites das taxas: percentuais até 100% e taxa fixa dentro do limite monetário.");
      return;
    }
    if (!hasAtMostDecimalPlaces(form.percent, 6) || !hasAtMostDecimalPlaces(form.anticipation, 6) || !hasAtMostDecimalPlaces(form.fixed, 2)) {
      addToast("error", "Use no máximo 6 casas nos percentuais e 2 casas na taxa fixa.");
      return;
    }
    if (!Number.isInteger(settlementDays) || settlementDays < 0 || settlementDays > 365) {
      addToast("error", "O prazo de recebimento deve ser um número inteiro entre 0 e 365 dias.");
      return;
    }
    if (!form.effectiveFrom || (form.effectiveTo && form.effectiveTo < form.effectiveFrom)) {
      addToast("error", "O fim da vigência não pode ser anterior ao início.");
      return;
    }

    const input: CreatePaymentFeeRule = {
      branch_id: currentBranchId,
      provider_code: normalizeCode(form.provider),
      channel: form.channel,
      payment_method: form.method,
      card_brand: normalizeCode(form.cardBrand || "ANY"),
      order_type: form.orderType,
      order_source: form.orderSource,
      installments_from: installmentsFrom,
      installments_to: installmentsTo,
      fee_percent: feePercent,
      fee_fixed: feeFixed,
      anticipation_percent: anticipationPercent,
      settlement_days: settlementDays,
      effective_from: form.effectiveFrom,
      effective_to: form.effectiveTo || null,
      active: editingRule?.active ?? true,
      change_reason: form.reason.trim(),
    };

    setSaving(true);
    try {
      if (editingRule) {
        await paymentFeesApi.update(editingRule, input);
      } else {
        await paymentFeesApi.create(input);
      }
      addToast("success", editingRule ? "Regra atualizada e versionada." : "Regra de taxa criada e registrada na auditoria.");
      setShowForm(false);
      setEditingRule(null);
      setForm(initialForm);
      await loadRules();
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível salvar. Verifique se a vigência se sobrepõe a outra regra."));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(rule: PaymentFeeRule) {
    setEditingRule(rule);
    setForm({
      provider: rule.provider_code,
      channel: rule.channel,
      cardBrand: rule.card_brand,
      orderType: rule.order_type,
      orderSource: rule.order_source,
      method: rule.payment_method,
      installmentsFrom: String(rule.installments_from),
      installmentsTo: String(rule.installments_to),
      percent: String(rule.fee_percent),
      fixed: String(rule.fee_fixed),
      anticipation: String(rule.anticipation_percent),
      settlementDays: String(rule.settlement_days),
      effectiveFrom: rule.effective_from,
      effectiveTo: rule.effective_to ?? "",
      reason: "Atualização de condição contratual",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleToggle(rule: PaymentFeeRule) {
    try {
      await paymentFeesApi.setActive(rule, !rule.active);
      await loadRules();
      addToast("success", rule.active ? "Regra desativada." : "Regra reativada.");
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível alterar a regra."));
    }
  }

  async function handleRemove(rule: PaymentFeeRule) {
    if (!window.confirm("Excluir esta regra de taxa? O histórico da alteração continuará na auditoria.")) return;
    try {
      await paymentFeesApi.remove(rule);
      await loadRules();
      addToast("success", "Regra excluída.");
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível excluir a regra."));
    }
  }

  if (loading || branchLoading) {
    return <div className="flex min-h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-red" /></div>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <SettingsPageHeader
        eyebrow="Custos financeiros"
        title="Pagamentos e taxas"
        description={currentBranch ? `Configure os custos internos de ${currentBranch.name}. Estas regras não representam acréscimos cobrados do cliente.` : "Selecione uma filial para revisar as regras financeiras."}
        icon={CreditCard}
        meta={
          <>
            <SettingsBadge tone={defaultFlowComplete ? "success" : "warning"}>{defaultFlowComplete ? "Cobertura completa" : "Revisão necessária"}</SettingsBadge>
            <SettingsBadge>{activeRules.length} regras ativas</SettingsBadge>
          </>
        }
        action={<Button disabled={!currentBranchId} onClick={() => {
            setShowForm((value) => !value);
            setEditingRule(null);
            setForm(initialForm);
          }} className="min-h-11 w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> {showForm ? "Fechar formulário" : "Nova regra"}
          </Button>}
      />

        <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--elevation-1)] sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-end" aria-labelledby="branch-scope-title">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info)]">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="branch-scope-title" className="text-sm font-bold text-[var(--text-primary)]">Filial destas taxas</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Toda regra pertence a uma única filial. Trocar a unidade atualiza a lista e fecha qualquer formulário em andamento.</p>
              <label className="mt-3 block">
                <span className="sr-only">Selecionar filial das taxas</span>
                <Select value={currentBranchId ?? ""} onChange={(event) => handleBranchChange(event.target.value)} className="min-h-11 bg-[var(--bg-subtle)] font-bold">
                  <option value="" disabled>Selecione uma filial</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                </Select>
              </label>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Vínculo atual</p>
            <p className="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{currentBranch ? `${currentBranch.code} · ${currentBranch.name}` : "Nenhuma filial selecionada"}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">As regras salvas aqui não afetam outras unidades.</p>
            {currentBranchId ? <Link href={`/app/configuracoes/filiais/${currentBranchId}`} className="mt-2 inline-flex text-xs font-bold text-brand-red hover:underline">Abrir configurações da filial →</Link> : null}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Cobertura das taxas do atendente e maquininha">
          {defaultCoverage.map((item) => (
            <StatusCard
              key={`${item.orderType}-${item.method}`}
              label={`${orderTypeLabel(item.orderType)} · ${item.method === "DEBIT_CARD" ? "Débito" : "Crédito"}`}
              configured={item.configured}
            />
          ))}
        </section>

        {!defaultFlowComplete ? (
          <div className="flex gap-3 rounded-2xl border border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-5"><strong>Fluxo padrão incompleto.</strong> Cadastre regras vigentes para MANUAL, presencial e bandeira ANY. Pagamentos sem correspondência serão marcados para revisão, sem inventar um custo.</p>
          </div>
        ) : null}

        {showForm && (
          <form onSubmit={handleCreate} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--elevation-1)] sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{editingRule ? "Editar regra contratual" : "Nova regra contratual"}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Defina o contexto, a condição financeira e a vigência. Regras equivalentes não podem se sobrepor.</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--status-info)]/20 bg-[var(--status-info-bg)] p-3.5 text-[var(--status-info)]">
                <Building2 className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-75">Regra vinculada à filial</p>
                  <p className="truncate text-sm font-bold">{currentBranch ? `${currentBranch.code} · ${currentBranch.name}` : "Selecione uma filial antes de continuar"}</p>
                </div>
              </div>
              <FormSection title="1. Contexto da venda" description="Onde e em qual situação esta taxa deve ser aplicada.">
                <Field label="Adquirente"><Input value={form.provider} onChange={(e) => setField("provider", e.target.value)} placeholder="Ex.: CIELO" /></Field>
                <Field label="Canal"><Select value={form.channel} onChange={(e) => setField("channel", e.target.value as FeeForm["channel"])}><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option></Select></Field>
                <Field label="Bandeira"><Input value={form.cardBrand} onChange={(e) => setField("cardBrand", e.target.value)} placeholder="ANY, VISA, ELO..." /></Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ChoiceGroup
                    label="Tipo do pedido"
                    description="Permite que viagem, entrega e consumo no local tenham taxas diferentes."
                    value={form.orderType}
                    options={[{ value: "ANY", label: "Todos" }, { value: "BALCAO", label: "No local" }, { value: "VIAGEM", label: "Viagem" }, { value: "ENTREGA", label: "Entrega" }]}
                    onChange={(value) => setField("orderType", value as PaymentRuleOrderType)}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ChoiceGroup
                    label="Origem da cobrança"
                    description="Escolha Atendente/maquininha quando a taxa física for diferente do pedido feito pelo cliente."
                    value={form.orderSource}
                    options={[{ value: "ANY", label: "Todas" }, { value: "ATTENDANT", label: "Atendente / maquininha" }, { value: "APP", label: "App / site" }, { value: "QR_CODE", label: "QR Code" }, { value: "WHATSAPP", label: "WhatsApp" }]}
                    onChange={(value) => setField("orderSource", value as PaymentRuleOrderSource)}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ChoiceGroup
                    label="Modalidade"
                    description="Débito usa uma parcela; crédito permite configurar a faixa de parcelas."
                    value={form.method}
                    options={[{ value: "DEBIT_CARD", label: "Débito" }, { value: "CREDIT_CARD", label: "Crédito" }]}
                    onChange={(value) => { const method = value as CardPaymentMethod; setForm((previous) => ({ ...previous, method, installmentsFrom: "1", installmentsTo: "1" })); }}
                  />
                </div>
              </FormSection>

              <FormSection title="2. Condição financeira" description="Informe exatamente o custo contratado com a adquirente.">
                <Field label="Parcela inicial"><Input type="number" min="1" max="24" disabled={form.method === "DEBIT_CARD"} value={form.installmentsFrom} onChange={(e) => setField("installmentsFrom", e.target.value)} /></Field>
                <Field label="Parcela final"><Input type="number" min="1" max="24" disabled={form.method === "DEBIT_CARD"} value={form.installmentsTo} onChange={(e) => setField("installmentsTo", e.target.value)} /></Field>
                <Field label="Taxa percentual (%)"><Input inputMode="decimal" required value={form.percent} onChange={(e) => setField("percent", e.target.value)} placeholder="2,49" /></Field>
                <Field label="Taxa fixa (R$)"><Input inputMode="decimal" value={form.fixed} onChange={(e) => setField("fixed", e.target.value)} /></Field>
                <Field label="Antecipação (%)"><Input inputMode="decimal" value={form.anticipation} onChange={(e) => setField("anticipation", e.target.value)} /></Field>
                <Field label="Recebimento (dias)"><Input type="number" min="0" max="365" required value={form.settlementDays} onChange={(e) => setField("settlementDays", e.target.value)} /></Field>
              </FormSection>

              <FormSection title="3. Vigência e auditoria" description="Defina quando a regra vale e documente o motivo da alteração.">
                <Field label="Início da vigência"><Input type="date" required value={form.effectiveFrom} onChange={(e) => setField("effectiveFrom", e.target.value)} /></Field>
                <Field label="Fim da vigência (opcional)"><Input type="date" min={form.effectiveFrom} value={form.effectiveTo} onChange={(e) => setField("effectiveTo", e.target.value)} /></Field>
                <div className="sm:col-span-2"><Field label="Motivo da alteração"><Input minLength={3} required value={form.reason} onChange={(e) => setField("reason", e.target.value)} /></Field></div>
              </FormSection>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl bg-[var(--bg-subtle)] p-4 sm:grid-cols-[1fr_2fr] sm:items-end">
              <Field label="Simular venda (R$)"><Input inputMode="decimal" value={simulationAmount} onChange={(e) => setSimulationAmount(e.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PreviewValue label="Processamento" value={preview.processingFee} />
                <PreviewValue label="Antecipação" value={preview.anticipationFee} />
                <PreviewValue label="Líquido" value={preview.netAmount} highlight />
              </div>
            </div>
            <div className="mt-5 flex justify-end"><Button type="submit" loading={saving} className="w-full sm:w-auto"><CreditCard className="mr-2 h-4 w-4" />{editingRule ? "Salvar nova versão" : "Salvar regra"}</Button></div>
          </form>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Regras cadastradas</h2>
            <span className="text-xs font-bold text-[var(--text-muted)]">{activeRules.length} ativa(s)</span>
          </div>
          {rules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center">
              <Calculator className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="mt-3 font-black text-[var(--text-primary)]">Nenhuma taxa cadastrada</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastre débito e crédito antes de conferir o resultado líquido.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rules.map((rule) => <RuleCard key={rule.id} rule={rule} onEdit={() => handleEdit(rule)} onToggle={() => void handleToggle(rule)} onRemove={() => void handleRemove(rule)} />)}
            </div>
          )}
        </section>
    </main>
  );
}

function StatusCard({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      {configured ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" /> : <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />}
      <div><p className="font-black text-[var(--text-primary)]">{label}</p><p className="text-xs text-[var(--text-muted)]">{configured ? "Fluxo padrão vigente" : "Taxa padrão pendente"}</p></div>
    </div>
  );
}

function RuleCard({ rule, onEdit, onToggle, onRemove }: { rule: PaymentFeeRule; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const installments = rule.installments_from === rule.installments_to ? `${rule.installments_from}x` : `${rule.installments_from}x–${rule.installments_to}x`;
  return (
    <article className={`rounded-2xl border bg-[var(--bg-surface)] p-5 shadow-sm ${rule.active ? "border-[var(--border)]" : "border-dashed border-[var(--border-strong)] opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-wide text-brand-red">{rule.payment_method === "DEBIT_CARD" ? "Débito" : "Crédito"} · {installments}</p><h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">{rule.provider_code}</h3></div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${rule.active ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"}`}>{rule.active ? "Ativa" : "Inativa"}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="Taxa" value={`${formatNumber(rule.fee_percent)}%`} />
        <Metric label="Fixa" value={formatCurrency(rule.fee_fixed)} />
        <Metric label="Recebe" value={`D+${rule.settlement_days}`} />
      </dl>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{rule.card_brand} · {rule.channel === "ONLINE" ? "Online" : "Presencial"} · {orderTypeLabel(rule.order_type)} · {orderSourceLabel(rule.order_source)} · {formatDate(rule.effective_from)}{rule.effective_to ? ` a ${formatDate(rule.effective_to)}` : " em diante"} · versão {rule.version}</p>
      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <button type="button" onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]" aria-label="Editar regra"><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--bg-subtle)] text-xs font-black text-[var(--text-secondary)]"><Power className="h-4 w-4" />{rule.active ? "Desativar" : "Reativar"}</button>
        <button type="button" onClick={onRemove} aria-label="Excluir regra" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)]"><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</span>{children}</label>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/55 p-4">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function ChoiceGroup({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</legend>
      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors ${selected
                ? "border-brand-red bg-brand-red/10 text-brand-red ring-1 ring-brand-red/15"
                : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PreviewValue({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return <div><p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{label}</p><p className={`mt-1 text-sm font-black ${highlight ? "text-[var(--status-success)]" : "text-[var(--text-primary)]"}`}>{formatCurrency(value)}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[var(--bg-subtle)] p-2"><dt className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{label}</dt><dd className="mt-1 text-sm font-black text-[var(--text-primary)]">{value}</dd></div>;
}

function parseDecimal(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  return normalized.trim() ? Number(normalized) : 0;
}

function hasAtMostDecimalPlaces(value: string, places: number) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const fraction = normalized.split(".")[1];
  return !fraction || fraction.length <= places;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 40);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return percentageFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function orderTypeLabel(value: PaymentRuleOrderType) {
  return ({ ANY: "Todos os tipos", BALCAO: "No local", VIAGEM: "Viagem", ENTREGA: "Entrega" })[value];
}

function orderSourceLabel(value: PaymentRuleOrderSource) {
  return ({ ANY: "Todas as origens", ATTENDANT: "Atendente/maquininha", APP: "App/site", QR_CODE: "QR Code", WHATSAPP: "WhatsApp" })[value];
}
