'use client';

import { useCallback, useEffect, useState } from 'react';
import { Branch, BranchType } from '@/types/pdv';
import { branchesAdminApi, BranchInput } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { Building2, Edit3, Plus, Power, Loader2, Save, X } from 'lucide-react';

const TYPE_OPTIONS: { value: BranchType; label: string }[] = [
  { value: 'STORE', label: 'Loja fixa' },
  { value: 'POPUP', label: 'Pop-up' },
  { value: 'FAIR',  label: 'Feira' },
];

const EMPTY: BranchInput = {
  code: '',
  slug: '',
  name: '',
  type: 'STORE',
  active: true,
  packing_fee: 0,
  ordering_enabled: true,
  whatsapp_enabled: true,
};

export default function FiliaisPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<BranchInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh: refreshBranchContext } = useBranch();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await branchesAdminApi.listAll();
      setBranches(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar filiais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openCreate = () => {
    setEditing({ ...EMPTY });
    setEditingId(null);
  };

  const openEdit = (b: Branch) => {
    setEditing({
      code: b.code, slug: b.slug, name: b.name, type: b.type, active: b.active,
      address: b.address, phone: b.phone,
      packing_fee: Number(b.packing_fee ?? 0),
      ordering_enabled: b.ordering_enabled,
      ordering_start_time: b.ordering_start_time, ordering_end_time: b.ordering_end_time,
      whatsapp_enabled: b.whatsapp_enabled,
      whatsapp_templates: b.whatsapp_templates,
    });
    setEditingId(b.id);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await branchesAdminApi.update(editingId, editing);
      } else {
        await branchesAdminApi.create(editing);
      }
      setEditing(null);
      setEditingId(null);
      await Promise.all([load(), refreshBranchContext()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Branch) => {
    try {
      await branchesAdminApi.update(b.id, { active: !b.active });
      await Promise.all([load(), refreshBranchContext()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar status.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 md:px-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight text-zinc-900">Filiais</h1>
          <p className="text-xs text-zinc-500">Cadastre lojas, pop-ups e feiras. Cada filial tem cardápio, impressora e numeração próprios.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova filial
        </Button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando filiais...
        </div>
      ) : (
        <div className="space-y-2">
          {branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Nenhuma filial cadastrada ainda.
            </div>
          ) : branches.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                <span className="text-xs font-black">{b.code}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black text-zinc-900">{b.name}</p>
                  {!b.active && <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">Inativa</span>}
                  {b.type !== 'STORE' && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-600">
                      {TYPE_OPTIONS.find((t) => t.value === b.type)?.label}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-zinc-500">
                  /{b.slug} · Senha {b.code}-NNN · {b.ordering_enabled ? 'Aceita pedidos online' : 'Pedidos online desligados'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(b)}
                className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-[10px] font-black uppercase ${
                  b.active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                }`}
                title={b.active ? 'Desativar filial' : 'Reativar filial'}
              >
                <Power className="h-3 w-3" /> {b.active ? 'Ativa' : 'Inativa'}
              </button>
              <button
                type="button"
                onClick={() => openEdit(b)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                aria-label="Editar"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form simplificado em painel inferior */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <Building2 className="h-4 w-4" /> {editingId ? 'Editar filial' : 'Nova filial'}
              </h2>
              <button onClick={() => setEditing(null)} aria-label="Fechar" className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4 max-h-[70vh] overflow-y-auto">
              <Field label="Nome" required>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="Loja Principal / Feira da Vila"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Código (prefixo)" required hint="1–3 letras/dígitos. Aparece em P-042">
                  <input
                    type="text"
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    maxLength={3}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-black uppercase"
                    placeholder="P, F, ..."
                  />
                </Field>
                <Field label="Slug (URL)" required hint="só letras minúsculas, números e hífen">
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="principal, feira-vila"
                  />
                </Field>
              </div>

              <Field label="Tipo">
                <select
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as BranchType })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone">
                  <input
                    type="text"
                    value={editing.phone ?? ''}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="(61) 99999-9999"
                  />
                </Field>
                <Field label="Taxa de embalagem">
                  <input
                    type="number" step="0.01"
                    value={editing.packing_fee ?? 0}
                    onChange={(e) => setEditing({ ...editing, packing_fee: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Endereço">
                <input
                  type="text"
                  value={editing.address ?? ''}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Abre às" hint="vazio = usa global">
                  <input
                    type="text" placeholder="17:00"
                    value={editing.ordering_start_time ?? ''}
                    onChange={(e) => setEditing({ ...editing, ordering_start_time: e.target.value || undefined })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Fecha às" hint="vazio = usa global">
                  <input
                    type="text" placeholder="23:30"
                    value={editing.ordering_end_time ?? ''}
                    onChange={(e) => setEditing({ ...editing, ordering_end_time: e.target.value || undefined })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Toggle
                  label="Aceitando pedidos"
                  checked={editing.ordering_enabled !== false}
                  onChange={(v) => setEditing({ ...editing, ordering_enabled: v })}
                />
                <Toggle
                  label="WhatsApp ativo"
                  checked={editing.whatsapp_enabled !== false}
                  onChange={(v) => setEditing({ ...editing, whatsapp_enabled: v })}
                />
              </div>

              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Templates por filial podem ser configurados depois via SQL (campo <code>whatsapp_templates</code> JSONB). Em breve teremos UI dedicada.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <Button onClick={save} disabled={saving || !editing.name || !editing.code || !editing.slug} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 font-medium normal-case text-[10px] text-zinc-400">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-red"
      />
    </label>
  );
}
