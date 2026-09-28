"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Power, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { useBranch } from "@/contexts/BranchContext";
import { couponsApi, type Coupon, type CouponDiscountType, type CouponInput } from "@/lib/api/coupons-api";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { SettingsBadge, SettingsPageHeader } from "../components/SettingsPageHeader";

type FormState = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minSubtotal: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function defaultForm(): FormState {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const today = local.slice(0, 10);
  return {
    code: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "10",
    minSubtotal: "0",
    validFrom: local,
    validUntil: `${today}T23:59`,
    active: true,
  };
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

function decimal(value: string) {
  return Number(value.replace(",", "."));
}

function inputToIso(value: string) {
  return new Date(value).toISOString();
}

function isoToInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CouponsSettingsPage() {
  const { currentBranch, currentBranchId, isLoading: branchLoading } = useBranch();
  const { toasts, addToast, removeToast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const load = useCallback(async () => {
    if (!currentBranchId) {
      setCoupons([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setCoupons(await couponsApi.list(currentBranchId));
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível carregar os cupons."));
    } finally {
      setLoading(false);
    }
  }, [addToast, currentBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeNow = useMemo(() => {
    const now = Date.now();
    return coupons.filter((coupon) =>
      coupon.active &&
      new Date(coupon.valid_from).getTime() <= now &&
      now < new Date(coupon.valid_until).getTime()
    ).length;
  }, [coupons]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setFormOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      minSubtotal: String(coupon.min_subtotal),
      validFrom: isoToInput(coupon.valid_from),
      validUntil: isoToInput(coupon.valid_until),
      active: coupon.active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentBranchId) return;

    const code = normalizeCode(form.code);
    const discountValue = decimal(form.discountValue);
    const minSubtotal = decimal(form.minSubtotal || "0");

    if (code.length < 2) return addToast("error", "Informe um código com pelo menos 2 caracteres.");
    if (!Number.isFinite(discountValue) || discountValue <= 0) return addToast("error", "Informe um desconto válido.");
    if (form.discountType === "PERCENT" && discountValue > 100) return addToast("error", "O percentual não pode passar de 100%.");
    if (!Number.isFinite(minSubtotal) || minSubtotal < 0) return addToast("error", "Subtotal mínimo inválido.");

    const validFrom = inputToIso(form.validFrom);
    const validUntil = inputToIso(form.validUntil);
    if (new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
      return addToast("error", "O fim da validade deve ser posterior ao início.");
    }

    const input: CouponInput = {
      branch_id: currentBranchId,
      code,
      description: form.description.trim() || null,
      discount_type: form.discountType,
      discount_value: discountValue,
      min_subtotal: minSubtotal,
      active: form.active,
      valid_from: validFrom,
      valid_until: validUntil,
    };

    setSaving(true);
    try {
      if (editing) await couponsApi.update(editing, input);
      else await couponsApi.create(input);

      addToast("success", editing ? "Cupom atualizado." : "Cupom criado.");
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível salvar o cupom."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    try {
      await couponsApi.setActive(coupon, !coupon.active);
      addToast("success", coupon.active ? "Cupom desativado." : "Cupom ativado.");
      await load();
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível alterar o cupom."));
    }
  };

  const handleRemove = async (coupon: Coupon) => {
    if (!window.confirm(`Excluir o cupom ${coupon.code}?`)) return;
    try {
      await couponsApi.remove(coupon);
      addToast("success", "Cupom excluído.");
      await load();
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível excluir o cupom."));
    }
  };

  if (branchLoading || loading) {
    return <main className="mx-auto max-w-6xl"><p className="text-sm text-[var(--text-muted)]">Carregando cupons...</p></main>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SettingsPageHeader
        eyebrow="Promoções"
        title="Cupons de desconto"
        description="Crie campanhas por filial. O desconto vale sobre produtos e adicionais; entrega e embalagem permanecem integrais."
        icon={Tag}
        meta={
          <>
            <SettingsBadge tone="info">{currentBranch ? `${currentBranch.code} · ${currentBranch.name}` : "Selecione uma filial"}</SettingsBadge>
            <SettingsBadge>{activeNow} vigente(s) agora</SettingsBadge>
          </>
        }
        actions={<Button onClick={openCreate} disabled={!currentBranchId}><Plus className="mr-2 h-4 w-4" />Novo cupom</Button>}
      />

      {formOpen && (
        <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{editing ? `Editar ${editing.code}` : "Novo cupom"}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">A validação final acontece no servidor antes de criar o pedido.</p>
            </div>
            <button type="button" onClick={() => setFormOpen(false)} className="text-sm font-semibold text-[var(--text-muted)]">Fechar</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código">
              <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: normalizeCode(e.target.value) }))} placeholder="SEGUNDA10" required />
            </Field>
            <Field label="Tipo">
              <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as CouponDiscountType }))} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]">
                <option value="PERCENT">Percentual (%)</option>
                <option value="AMOUNT">Valor fixo (R$)</option>
              </select>
            </Field>
            <Field label={form.discountType === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}>
              <Input inputMode="decimal" value={form.discountValue} onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))} required />
            </Field>
            <Field label="Subtotal mínimo (R$)">
              <Input inputMode="decimal" value={form.minSubtotal} onChange={(e) => setForm((p) => ({ ...p, minSubtotal: e.target.value }))} />
            </Field>
            <Field label="Início">
              <Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} required />
            </Field>
            <Field label="Fim">
              <Input type="datetime-local" value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} required />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Descrição (opcional)">
                <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Ex.: 10% na segunda-feira" />
              </Field>
            </div>
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl bg-[var(--bg-subtle)] px-4 text-sm font-semibold text-[var(--text-primary)]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="h-4 w-4" />
            Cupom habilitado
          </label>

          <div className="mt-5 flex justify-end">
            <Button type="submit" loading={saving}>{editing ? "Salvar alterações" : "Criar cupom"}</Button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Cupons cadastrados</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Ative, desative ou ajuste validade sem alterar o checkout.</p>
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)]">{coupons.length} total</span>
        </div>

        {coupons.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center">
            <Tag className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 font-bold text-[var(--text-primary)]">Nenhum cupom cadastrado</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Crie um cupom para esta filial quando precisar rodar uma promoção.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {coupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} onEdit={() => openEdit(coupon)} onToggle={() => void handleToggle(coupon)} onRemove={() => void handleRemove(coupon)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CouponCard({ coupon, onEdit, onToggle, onRemove }: { coupon: Coupon; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const now = Date.now();
  const starts = new Date(coupon.valid_from).getTime();
  const ends = new Date(coupon.valid_until).getTime();
  const status = !coupon.active ? "Inativo" : now < starts ? "Agendado" : now >= ends ? "Expirado" : "Ativo";
  const live = status === "Ativo";
  const discount = coupon.discount_type === "PERCENT" ? `${coupon.discount_value}%` : currency.format(coupon.discount_value);

  return (
    <article className={`rounded-2xl border bg-[var(--bg-surface)] p-5 shadow-sm ${live ? "border-[var(--border)]" : "border-dashed border-[var(--border-strong)] opacity-80"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Cupom</p>
          <h3 className="mt-1 text-xl font-black tracking-wide text-[var(--text-primary)]">{coupon.code}</h3>
          {coupon.description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{coupon.description}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${live ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"}`}>{status}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Desconto" value={discount} />
        <Metric label="Mínimo" value={coupon.min_subtotal > 0 ? currency.format(coupon.min_subtotal) : "Sem mínimo"} />
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs text-[var(--text-muted)]">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{new Date(coupon.valid_from).toLocaleString("pt-BR")} até {new Date(coupon.valid_until).toLocaleString("pt-BR")}</span>
      </div>

      <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <button type="button" onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)]" aria-label="Editar cupom"><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--bg-subtle)] text-xs font-black text-[var(--text-secondary)]"><Power className="h-4 w-4" />{coupon.active ? "Desativar" : "Ativar"}</button>
        <button type="button" onClick={onRemove} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)]" aria-label="Excluir cupom"><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[var(--bg-subtle)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-black text-[var(--text-primary)]">{value}</p></div>;
}
