'use client';

import { useCallback, useEffect, useState } from 'react';
import { Branch, BranchType } from '@/types/pdv';
import { branchesAdminApi, BranchInput } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import {
  Building2, Edit3, Plus, Power, Loader2, Save, X,
  Printer, MessageSquare, Clock, ChevronDown, ChevronUp, Check,
} from 'lucide-react';

const TYPE_OPTIONS: { value: BranchType; label: string; desc: string }[] = [
  { value: 'STORE', label: 'Loja fixa', desc: 'Aberta todo dia, endereço fixo' },
  { value: 'POPUP', label: 'Pop-up', desc: 'Temporária, sem endereço fixo' },
  { value: 'FAIR',  label: 'Feira', desc: 'Recorrente, endereço variável' },
];

const WA_EVENTS = [
  { key: 'order_received',      label: 'Pedido recebido',     hint: 'Dispara quando o pedido entra na fila' },
  { key: 'order_partial_ready', label: 'Primeiro item pronto', hint: 'Dispara quando PRONTO_PARCIAL (1ª vez)' },
  { key: 'order_ready',         label: 'Pedido completo',      hint: 'Dispara quando todos os itens ficam prontos' },
] as const;

const PRINTER_SECTORS = [
  { key: 'kitchen',  label: 'Cozinha (Kreps)',   sector: 'KITCHEN' },
  { key: 'juice',    label: 'Sucos / Batata',    sector: 'JUICE_POTATO' },
  { key: 'customer', label: 'Via do Cliente',    sector: 'CUSTOMER' },
] as const;

type PrinterConfig = { [key: string]: { ip?: string; port?: number; enabled?: boolean } };
type WaTemplates = { [key: string]: { template_name?: string; language?: string; enabled?: boolean } };

function parseConfig(raw?: Record<string, unknown> | null): PrinterConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as PrinterConfig;
}

function parseTemplates(raw?: Record<string, { template_name?: string; language?: string; enabled?: boolean }> | null): WaTemplates {
  if (!raw || typeof raw !== 'object') return {};
  return raw as WaTemplates;
}

const EMPTY: BranchInput = {
  code: '', slug: '', name: '', type: 'STORE', active: true,
  packing_fee: 0, ordering_enabled: true, whatsapp_enabled: true,
};

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

export default function FiliaisPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<BranchInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printerCfg, setPrinterCfg] = useState<PrinterConfig>({});
  const [waCfg, setWaCfg] = useState<WaTemplates>({});
  const [openSection, setOpenSection] = useState<'basic' | 'hours' | 'printer' | 'whatsapp'>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { currentBranchId, refresh: refreshCtx } = useBranch();
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBranches(await branchesAdminApi.listAll());
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar filiais.');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function openCreate() {
    setEditing({ ...EMPTY });
    setEditingId(null);
    setPrinterCfg({});
    setWaCfg({});
    setOpenSection('basic');
  }

  function openEdit(b: Branch) {
    setEditing({
      code: b.code, slug: b.slug, name: b.name, type: b.type, active: b.active,
      address: b.address, phone: b.phone,
      packing_fee: Number(b.packing_fee ?? 0),
      ordering_enabled: b.ordering_enabled,
      ordering_start_time: b.ordering_start_time,
      ordering_end_time: b.ordering_end_time,
      whatsapp_enabled: b.whatsapp_enabled,
    });
    setEditingId(b.id);
    setPrinterCfg(parseConfig(b.printer_config as Record<string, unknown>));
    setWaCfg(parseTemplates(b.whatsapp_templates));
    setOpenSection('basic');
  }

  function setField<K extends keyof BranchInput>(k: K, v: BranchInput[K]) {
    setEditing((prev) => prev ? { ...prev, [k]: v } : prev);
  }

  async function save() {
    if (!editing) return;
    const payload: BranchInput = {
      ...editing,
      printer_config: Object.keys(printerCfg).length ? printerCfg : undefined,
      whatsapp_templates: Object.keys(waCfg).length ? waCfg : undefined,
    };
    setSaving(true);
    try {
      if (editingId) {
        await branchesAdminApi.update(editingId, payload);
        addToast('success', 'Filial atualizada!');
      } else {
        await branchesAdminApi.create(payload);
        addToast('success', 'Filial criada!');
      }
      setEditing(null);
      setEditingId(null);
      await Promise.all([load(), refreshCtx()]);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao salvar filial.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Branch) {
    try {
      await branchesAdminApi.update(b.id, { active: !b.active });
      addToast('success', b.active ? 'Filial desativada.' : 'Filial reativada!');
      await Promise.all([load(), refreshCtx()]);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao alterar status.');
    }
  }

  const codeValid  = !editing?.code  || /^[A-Z0-9]{1,3}$/.test(editing.code);
  const slugValid  = !editing?.slug  || /^[a-z0-9-]{2,32}$/.test(editing.slug);
  const canSave = !saving && !!editing?.name && !!editing?.code && codeValid && !!editing?.slug && slugValid;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 md:px-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-tight text-zinc-900">Filiais</h1>
          <p className="text-xs text-zinc-500">
            Cada filial tem cardápio, impressoras e numeração próprios.
            Senha exibida como <strong className="text-zinc-700">P-042-1</strong>.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova filial
        </Button>
      </header>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando filiais...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          Nenhuma filial cadastrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition-all ${
                b.id === currentBranchId ? 'border-brand-red/40 ring-2 ring-brand-red/10' : 'border-zinc-200'
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-charcoal text-white">
                <span className="text-xs font-black leading-none">{b.code}</span>
                <span className="text-[9px] font-medium leading-none text-zinc-400 mt-0.5">
                  {TYPE_OPTIONS.find((t) => t.value === b.type)?.label.split(' ')[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate text-sm font-black text-zinc-900">{b.name}</p>
                  {b.id === currentBranchId && (
                    <span className="flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-black text-brand-red">
                      <Check className="h-2.5 w-2.5" /> Ativa
                    </span>
                  )}
                  {!b.active && (
                    <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">Inativa</span>
                  )}
                </div>
                <p className="truncate text-[11px] text-zinc-400 mt-0.5">
                  /pedir/<span className="font-bold text-zinc-600">{b.slug}</span>
                  {b.ordering_start_time && b.ordering_end_time && (
                    <span className="ml-2">· {b.ordering_start_time}–{b.ordering_end_time}</span>
                  )}
                  {!b.ordering_enabled && <span className="ml-2 text-amber-600">· pedidos offline</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(b)}
                className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-[10px] font-black uppercase shrink-0 ${
                  b.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                <Power className="h-3 w-3" /> {b.active ? 'Ativa' : 'Inativa'}
              </button>
              <button
                type="button"
                onClick={() => openEdit(b)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 sm:items-center sm:justify-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 shrink-0">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <Building2 className="h-4 w-4" />
                {editingId ? `Editar — ${editing.name || 'filial'}` : 'Nova filial'}
              </h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="overflow-y-auto flex-1">
              <Section
                id="basic"
                label="Informações básicas"
                icon={<Building2 className="h-3.5 w-3.5" />}
                open={openSection === 'basic'}
                onToggle={() => setOpenSection(openSection === 'basic' ? 'hours' : 'basic')}
              >
                <Field label="Nome da filial" required>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setEditing((prev) => prev ? {
                        ...prev,
                        name,
                        slug: prev.slug || slugify(name),
                      } : prev);
                    }}
                    className="input"
                    placeholder="Loja Principal · Feira da Vila · Pop-up Shopping"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Código"
                    required
                    hint="Prefixo na senha: P-042-1"
                    error={!codeValid ? 'Só letras maiúsculas ou dígitos (máx 3)' : undefined}
                  >
                    <input
                      type="text"
                      value={editing.code}
                      onChange={(e) => setField('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
                      maxLength={3}
                      className={`input font-black uppercase tracking-widest ${!codeValid ? 'border-red-400' : ''}`}
                      placeholder="P, F, M2..."
                    />
                  </Field>
                  <Field
                    label="Slug (URL)"
                    required
                    hint="marcoskreps.com.br/pedir/slug"
                    error={!slugValid ? 'Mín 2 chars, só letras minúsculas, números e hífen' : undefined}
                  >
                    <input
                      type="text"
                      value={editing.slug}
                      onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
                      className={`input ${!slugValid ? 'border-red-400' : ''}`}
                      placeholder="principal, feira-norte..."
                    />
                  </Field>
                </div>

                {/* Preview URL */}
                {editing.slug && slugValid && (
                  <p className="text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-1.5">
                    URL pública: <span className="font-bold text-zinc-700">marcoskreps.com.br/pedir/{editing.slug}</span>
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setField('type', t.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                        editing.type === t.value
                          ? 'border-brand-red bg-red-50 text-brand-red'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <p className="text-xs font-black">{t.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <input
                      type="tel"
                      value={editing.phone ?? ''}
                      onChange={(e) => setField('phone', e.target.value)}
                      className="input"
                      placeholder="(61) 99999-9999"
                    />
                  </Field>
                  <Field label="Taxa de embalagem (R$)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editing.packing_fee ?? 0}
                      onChange={(e) => setField('packing_fee', Number(e.target.value))}
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="Endereço">
                  <input
                    type="text"
                    value={editing.address ?? ''}
                    onChange={(e) => setField('address', e.target.value)}
                    className="input"
                    placeholder="Rua X, nº Y — Asa Norte"
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <Toggle
                    label="Aceitar pedidos online"
                    desc="Clientes podem abrir /pedir/slug e montar o pedido"
                    checked={editing.ordering_enabled !== false}
                    onChange={(v) => setField('ordering_enabled', v)}
                  />
                  <Toggle
                    label="Ativa"
                    desc="Filial inativa some do seletor de filiais e do checkout público"
                    checked={editing.active !== false}
                    onChange={(v) => setField('active', v)}
                  />
                </div>
              </Section>

              <Section
                id="hours"
                label="Horários de atendimento"
                icon={<Clock className="h-3.5 w-3.5" />}
                open={openSection === 'hours'}
                onToggle={() => setOpenSection(openSection === 'hours' ? 'basic' : 'hours')}
              >
                <p className="text-[11px] text-zinc-500">
                  Deixe em branco para usar o horário global configurado em Configurações. Quando preenchido, tem prioridade.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Abre às">
                    <input
                      type="time"
                      value={editing.ordering_start_time ?? ''}
                      onChange={(e) => setField('ordering_start_time', e.target.value || undefined)}
                      className="input"
                    />
                  </Field>
                  <Field label="Fecha às">
                    <input
                      type="time"
                      value={editing.ordering_end_time ?? ''}
                      onChange={(e) => setField('ordering_end_time', e.target.value || undefined)}
                      className="input"
                    />
                  </Field>
                </div>
                {editing.ordering_start_time && editing.ordering_end_time && (
                  <p className="text-[11px] bg-blue-50 text-blue-700 rounded-lg px-3 py-2">
                    Aceita pedidos das <strong>{editing.ordering_start_time}</strong> às <strong>{editing.ordering_end_time}</strong>
                  </p>
                )}
              </Section>

              <Section
                id="printer"
                label="Impressoras"
                icon={<Printer className="h-3.5 w-3.5" />}
                open={openSection === 'printer'}
                onToggle={() => setOpenSection(openSection === 'printer' ? 'basic' : 'printer')}
              >
                <p className="text-[11px] text-zinc-500">
                  IP e porta de cada impressora térmica desta filial. O print-worker local lê essa configuração. Porta padrão: <strong>9100</strong>.
                </p>
                {PRINTER_SECTORS.map((s) => (
                  <div key={s.key} className="rounded-xl border border-zinc-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Toggle
                        label={s.label}
                        desc={`Setor: ${s.sector}`}
                        checked={printerCfg[s.key]?.enabled !== false}
                        onChange={(v) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], enabled: v } }))}
                        small
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
                              className="input font-mono"
                              placeholder="192.168.1.100"
                            />
                          </Field>
                        </div>
                        <Field label="Porta">
                          <input
                            type="number"
                            value={printerCfg[s.key]?.port ?? 9100}
                            onChange={(e) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], port: Number(e.target.value) } }))}
                            className="input font-mono"
                            placeholder="9100"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </Section>

              <Section
                id="whatsapp"
                label="WhatsApp — Templates"
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                open={openSection === 'whatsapp'}
                onToggle={() => setOpenSection(openSection === 'whatsapp' ? 'basic' : 'whatsapp')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Toggle
                    label="WhatsApp ativo nesta filial"
                    desc="Quando desligado, nenhuma mensagem é enviada mesmo que o global esteja ativo"
                    checked={editing.whatsapp_enabled !== false}
                    onChange={(v) => setField('whatsapp_enabled', v)}
                  />
                </div>

                {editing.whatsapp_enabled !== false && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-500">
                      Deixe o nome do template em branco para usar o template global padrão. O template deve estar aprovado na Meta.
                    </p>
                    {WA_EVENTS.map((ev) => (
                      <div key={ev.key} className="rounded-xl border border-zinc-200 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-zinc-800">{ev.label}</p>
                            <p className="text-[10px] text-zinc-500">{ev.hint}</p>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={waCfg[ev.key]?.enabled !== false}
                              onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], enabled: e.target.checked } }))}
                              className="h-3.5 w-3.5 accent-brand-red"
                            />
                            <span className="text-[10px] font-bold text-zinc-600">Ativo</span>
                          </label>
                        </div>
                        {waCfg[ev.key]?.enabled !== false && (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <Field label="Nome do template">
                                <input
                                  type="text"
                                  value={waCfg[ev.key]?.template_name ?? ''}
                                  onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], template_name: e.target.value } }))}
                                  className="input font-mono text-xs"
                                  placeholder="ex: pedido_pronto_feira"
                                />
                              </Field>
                            </div>
                            <Field label="Idioma">
                              <input
                                type="text"
                                value={waCfg[ev.key]?.language ?? 'pt_BR'}
                                onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], language: e.target.value } }))}
                                className="input font-mono text-xs"
                                placeholder="pt_BR"
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3 shrink-0">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <Button onClick={save} disabled={!canSave} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar filial'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  id, label, icon, open, onToggle, children,
}: {
  id: string; label: string; icon: React.ReactNode;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-600">
          {icon}
          {label}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

function Field({
  label, hint, required, error, children,
}: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="font-medium normal-case text-[10px] text-zinc-400">— {hint}</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-[10px] font-bold text-red-600">{error}</p>}
    </label>
  );
}

function Toggle({
  label, desc, checked, onChange, small = false,
}: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all ${
      checked ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'
    } ${small ? '' : 'w-full'}`}>
      <div className="min-w-0">
        <p className={`font-bold text-zinc-800 ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
        {desc && <p className="text-[10px] text-zinc-500 leading-tight">{desc}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-brand-red"
      />
    </label>
  );
}
