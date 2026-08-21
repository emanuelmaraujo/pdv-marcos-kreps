'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Branch, BranchType, Courier, DeliveryZone } from '@/types/pdv';
import { branchesAdminApi, BranchInput, couriersApi, deliveryZonesApi } from '@/lib/api/branches-admin-api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import {
  Building2, Edit3, Plus, Power, Loader2, Save, X,
  Printer, MessageSquare, Clock, ChevronDown, ChevronUp, Check, Bike, Trash2,
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
  delivery_enabled: false, default_delivery_fee: 0,
};

// Classe de input tematizada (light/dark/warm) — substitui o `.input` global.
const INPUT_CLS =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] ' +
  'px-3 py-2.5 text-sm text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-muted)] ' +
  'focus:border-brand-red/50 focus:outline-none focus:ring-2 focus:ring-brand-red/15 ' +
  'transition-colors';

/* Cor estável de avatar derivada do id da filial — mesma filial sempre
   recebe a mesma cor, sem usar preto. Paleta calma (não brand) para não
   competir com os CTAs vermelhos. */
const AVATAR_PALETTE = [
  "#2563EB", "#0891B2", "#0F766E", "#16A34A", "#65A30D",
  "#CA8A04", "#EA580C", "#DC2626", "#DB2777", "#9333EA",
  "#6366F1", "#0D9488",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarStyleFor(id: string, code: string) {
  const idx = hashString(id || code) % AVATAR_PALETTE.length;
  return { bg: AVATAR_PALETTE[idx] };
}

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
  const [openSection, setOpenSection] = useState<'basic' | 'hours' | 'delivery' | 'printer' | 'whatsapp'>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [newZone, setNewZone] = useState({ neighborhood: '', fee: '' });
  const [savingZone, setSavingZone] = useState(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(false);
  const [newCourier, setNewCourier] = useState({ name: '', phone: '' });
  const [savingCourier, setSavingCourier] = useState(false);
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

  const loadZones = useCallback(async (branchId: string) => {
    setZonesLoading(true);
    try {
      setZones(await deliveryZonesApi.listByBranch(branchId));
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar zonas de entrega.');
    } finally {
      setZonesLoading(false);
    }
  }, [addToast]);

  const loadCouriers = useCallback(async (branchId: string) => {
    setCouriersLoading(true);
    try {
      setCouriers(await couriersApi.listByBranch(branchId));
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar entregadores.');
    } finally {
      setCouriersLoading(false);
    }
  }, [addToast]);

  function openCreate() {
    setEditing({ ...EMPTY });
    setEditingId(null);
    setPrinterCfg({});
    setWaCfg({});
    setZones([]);
    setNewZone({ neighborhood: '', fee: '' });
    setCouriers([]);
    setNewCourier({ name: '', phone: '' });
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
      delivery_enabled: b.delivery_enabled,
      default_delivery_fee: Number(b.default_delivery_fee ?? 0),
    });
    setEditingId(b.id);
    setPrinterCfg(parseConfig(b.printer_config as Record<string, unknown>));
    setWaCfg(parseTemplates(b.whatsapp_templates));
    setZones([]);
    setNewZone({ neighborhood: '', fee: '' });
    setCouriers([]);
    setNewCourier({ name: '', phone: '' });
    setOpenSection('basic');
    void loadZones(b.id);
    void loadCouriers(b.id);
  }

  async function addZone() {
    if (!editingId || !newZone.neighborhood.trim()) return;
    const fee = Number(newZone.fee.replace(',', '.'));
    if (!Number.isFinite(fee) || fee < 0) {
      addToast('error', 'Informe uma taxa válida para o bairro.');
      return;
    }
    setSavingZone(true);
    try {
      await deliveryZonesApi.create(editingId, { neighborhood: newZone.neighborhood.trim(), fee });
      setNewZone({ neighborhood: '', fee: '' });
      await loadZones(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao adicionar bairro.');
    } finally {
      setSavingZone(false);
    }
  }

  async function toggleZoneActive(zone: DeliveryZone) {
    if (!editingId) return;
    try {
      await deliveryZonesApi.update(zone.id, { active: !zone.active });
      await loadZones(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao atualizar bairro.');
    }
  }

  async function removeZone(zone: DeliveryZone) {
    if (!editingId) return;
    try {
      await deliveryZonesApi.remove(zone.id);
      await loadZones(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao remover bairro.');
    }
  }

  async function addCourier() {
    if (!editingId || !newCourier.name.trim()) return;
    setSavingCourier(true);
    try {
      await couriersApi.create(editingId, { name: newCourier.name.trim(), phone: newCourier.phone.trim() || undefined });
      setNewCourier({ name: '', phone: '' });
      await loadCouriers(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao adicionar entregador.');
    } finally {
      setSavingCourier(false);
    }
  }

  async function toggleCourierActive(courier: Courier) {
    if (!editingId) return;
    try {
      await couriersApi.update(courier.id, { active: !courier.active });
      await loadCouriers(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao atualizar entregador.');
    }
  }

  async function removeCourier(courier: Courier) {
    if (!editingId) return;
    try {
      await couriersApi.remove(courier.id);
      await loadCouriers(editingId);
    } catch (e: unknown) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao remover entregador.');
    }
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
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Filiais</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Cada filial tem cardápio, impressoras e numeração próprios.
            Senha exibida como <strong className="text-[var(--text-primary)]">P-042-1</strong>.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" strokeWidth={2} /> Nova filial
        </Button>
      </header>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando filiais...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-secondary)]">
          Nenhuma filial cadastrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => {
            const isCurrent = b.id === currentBranchId;
            const avatar = avatarStyleFor(b.id, b.code);
            return (
              <div
                key={b.id}
                className={`flex items-center gap-3 rounded-2xl border bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)] ${
                  isCurrent
                    ? 'border-[var(--status-info)]/30 ring-1 ring-[var(--status-info)]/15'
                    : 'border-[var(--border)]'
                }`}
              >
                {/* Avatar com cor gerada consistente por filial */}
                <div
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: avatar.bg }}
                >
                  <span className="text-xs font-semibold leading-none">{b.code}</span>
                  <span className="text-[9px] font-medium leading-none opacity-80 mt-0.5">
                    {TYPE_OPTIONS.find((t) => t.value === b.type)?.label.split(' ')[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{b.name}</p>
                    {isCurrent && (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-info)]">
                        <Check className="h-2.5 w-2.5" strokeWidth={2} /> Sessão atual
                      </span>
                    )}
                    {b.active ? (
                      <span className="rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-success)]">Ativa</span>
                    ) : (
                      <span className="rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-neutral)]">Inativa</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    /pedir/<span className="font-semibold text-[var(--text-secondary)]">{b.slug}</span>
                    {b.ordering_start_time && b.ordering_end_time && (
                      <span className="ml-2">· {b.ordering_start_time}–{b.ordering_end_time}</span>
                    )}
                    {!b.ordering_enabled && <span className="ml-2 text-[var(--status-warning)]">· pedidos offline</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(b)}
                  className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold shrink-0 ${
                    b.active
                      ? 'bg-[var(--status-success-bg)] text-[var(--status-success)] hover:opacity-90'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                  }`}
                  aria-label={b.active ? 'Desativar filial' : 'Reativar filial'}
                >
                  <Power className="h-3 w-3" strokeWidth={1.75} /> {b.active ? 'Ativa' : 'Inativa'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  aria-label="Editar filial"
                >
                  <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl flex flex-col max-h-[100dvh] sm:max-h-[92vh]">
            {/* Header — também atalho de salvar para mobile */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shrink-0">
              <h2 className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)] min-w-0">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {editingId ? `Editar — ${editing.name || 'filial'}` : 'Nova filial'}
                </span>
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="flex items-center gap-1 rounded-lg bg-brand-red px-2.5 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 sm:hidden"
                  aria-label="Salvar filial"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
                    className={INPUT_CLS}
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
                      className={`${INPUT_CLS} font-black uppercase tracking-widest ${!codeValid ? '!border-[var(--status-danger)]' : ''}`}
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
                      className={`${INPUT_CLS} ${!slugValid ? '!border-[var(--status-danger)]' : ''}`}
                      placeholder="principal, feira-norte..."
                    />
                  </Field>
                </div>

                {/* Preview URL */}
                {editing.slug && slugValid && (
                  <p className="rounded-lg bg-[var(--bg-subtle)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                    URL pública: <span className="font-bold text-[var(--text-primary)]">marcoskreps.com.br/pedir/{editing.slug}</span>
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setField('type', t.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        editing.type === t.value
                          ? 'border-brand-red bg-[var(--status-danger-bg)] text-brand-red'
                          : 'border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <p className="text-xs font-black">{t.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{t.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <input
                      type="tel"
                      value={editing.phone ?? ''}
                      onChange={(e) => setField('phone', e.target.value)}
                      className={INPUT_CLS}
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
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                <Field label="Endereço">
                  <input
                    type="text"
                    value={editing.address ?? ''}
                    onChange={(e) => setField('address', e.target.value)}
                    className={INPUT_CLS}
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
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Deixe em branco para usar o horário global configurado em Configurações. Quando preenchido, tem prioridade.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Abre às">
                    <input
                      type="time"
                      value={editing.ordering_start_time ?? ''}
                      onChange={(e) => setField('ordering_start_time', e.target.value || undefined)}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Fecha às">
                    <input
                      type="time"
                      value={editing.ordering_end_time ?? ''}
                      onChange={(e) => setField('ordering_end_time', e.target.value || undefined)}
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
                {editing.ordering_start_time && editing.ordering_end_time && (
                  <p className="rounded-lg bg-[var(--status-info-bg)] px-3 py-2 text-[11px] text-[var(--status-info)]">
                    Aceita pedidos das <strong>{editing.ordering_start_time}</strong> às <strong>{editing.ordering_end_time}</strong>
                  </p>
                )}
              </Section>

              <Section
                id="delivery"
                label="Entrega"
                icon={<Bike className="h-3.5 w-3.5" />}
                open={openSection === 'delivery'}
                onToggle={() => setOpenSection(openSection === 'delivery' ? 'basic' : 'delivery')}
              >
                <Toggle
                  label="Aceitar pedidos de entrega"
                  desc="Habilita a opção Entrega no atendente e no checkout público desta filial"
                  checked={editing.delivery_enabled === true}
                  onChange={(v) => setField('delivery_enabled', v)}
                />

                {!editing.delivery_enabled && (
                  <p className="rounded-lg bg-[var(--status-info-bg)] px-3 py-2 text-[11px] text-[var(--status-info)]">
                    Ligue a opção acima para definir a taxa padrão e cadastrar os bairros atendidos (com a taxa de cada um).
                  </p>
                )}

                {editing.delivery_enabled && (
                  <>
                    <Field
                      label="Taxa padrão (R$)"
                      hint="Usada enquanto nenhum bairro estiver cadastrado abaixo"
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editing.default_delivery_fee ?? 0}
                        onChange={(e) => setField('default_delivery_fee', Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </Field>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {zones.length > 0
                          ? 'Assim que há bairros cadastrados, entregas fora da lista são bloqueadas — o cliente vê que não atendemos aquele endereço.'
                          : 'Nenhum bairro cadastrado ainda: toda entrega usa a taxa padrão acima.'}
                      </p>

                      {!editingId ? (
                        <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                          Salve a filial primeiro para cadastrar bairros.
                        </p>
                      ) : (
                        <>
                          {zonesLoading ? (
                            <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando bairros...
                            </div>
                          ) : zones.length > 0 ? (
                            <div className="space-y-1.5">
                              {zones.map((zone) => (
                                <div
                                  key={zone.id}
                                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleZoneActive(zone)}
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      zone.active
                                        ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                                        : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                                    }`}
                                  >
                                    {zone.active ? 'Ativo' : 'Inativo'}
                                  </button>
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">
                                    {zone.neighborhood}
                                  </span>
                                  <span className="shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                                    R$ {Number(zone.fee).toFixed(2).replace('.', ',')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeZone(zone)}
                                    className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                                    aria-label={`Remover ${zone.neighborhood}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newZone.neighborhood}
                              onChange={(e) => setNewZone((p) => ({ ...p, neighborhood: e.target.value }))}
                              placeholder="Bairro (ex: Águas Claras)"
                              className={`${INPUT_CLS} flex-1`}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newZone.fee}
                              onChange={(e) => setNewZone((p) => ({ ...p, fee: e.target.value }))}
                              placeholder="Taxa"
                              className={`${INPUT_CLS} w-24`}
                            />
                            <button
                              type="button"
                              onClick={addZone}
                              disabled={savingZone || !newZone.neighborhood.trim()}
                              className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-3 text-white disabled:opacity-40"
                              aria-label="Adicionar bairro"
                            >
                              {savingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                        Entregadores cadastrados
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Opcional — o despacho sempre permite digitar um entregador avulso também.
                      </p>
                      <Link
                        href="/app/relatorios/entregadores"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-red hover:underline"
                      >
                        <Bike className="h-3.5 w-3.5" />
                        Ver métricas de entrega por motoboy
                      </Link>

                      {!editingId ? (
                        <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                          Salve a filial primeiro para cadastrar entregadores.
                        </p>
                      ) : (
                        <>
                          {couriersLoading ? (
                            <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando entregadores...
                            </div>
                          ) : couriers.length > 0 ? (
                            <div className="space-y-1.5">
                              {couriers.map((courier) => (
                                <div
                                  key={courier.id}
                                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleCourierActive(courier)}
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      courier.active
                                        ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                                        : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                                    }`}
                                  >
                                    {courier.active ? 'Ativo' : 'Inativo'}
                                  </button>
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">
                                    {courier.name}
                                  </span>
                                  {courier.phone && (
                                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{courier.phone}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeCourier(courier)}
                                    className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                                    aria-label={`Remover ${courier.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newCourier.name}
                              onChange={(e) => setNewCourier((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Nome do entregador"
                              className={`${INPUT_CLS} flex-1`}
                            />
                            <input
                              type="text"
                              value={newCourier.phone}
                              onChange={(e) => setNewCourier((p) => ({ ...p, phone: e.target.value }))}
                              placeholder="Telefone"
                              className={`${INPUT_CLS} w-32`}
                            />
                            <button
                              type="button"
                              onClick={addCourier}
                              disabled={savingCourier || !newCourier.name.trim()}
                              className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-3 text-white disabled:opacity-40"
                              aria-label="Adicionar entregador"
                            >
                              {savingCourier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </Section>

              <Section
                id="printer"
                label="Impressoras"
                icon={<Printer className="h-3.5 w-3.5" />}
                open={openSection === 'printer'}
                onToggle={() => setOpenSection(openSection === 'printer' ? 'basic' : 'printer')}
              >
                <p className="text-[11px] text-[var(--text-secondary)]">
                  IP e porta de cada impressora térmica desta filial. O print-worker local lê essa configuração. Porta padrão: <strong className="text-[var(--text-primary)]">9100</strong>.
                </p>
                {PRINTER_SECTORS.map((s) => (
                  <div key={s.key} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3">
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
                              className={`${INPUT_CLS} font-mono`}
                              placeholder="192.168.1.100"
                            />
                          </Field>
                        </div>
                        <Field label="Porta">
                          <input
                            type="number"
                            value={printerCfg[s.key]?.port ?? 9100}
                            onChange={(e) => setPrinterCfg((p) => ({ ...p, [s.key]: { ...p[s.key], port: Number(e.target.value) } }))}
                            className={`${INPUT_CLS} font-mono`}
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
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Deixe o nome do template em branco para usar o template global padrão. O template deve estar aprovado na Meta.
                    </p>
                    {WA_EVENTS.map((ev) => (
                      <div key={ev.key} className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-[var(--text-primary)]">{ev.label}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{ev.hint}</p>
                          </div>
                          <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={waCfg[ev.key]?.enabled !== false}
                              onChange={(e) => setWaCfg((p) => ({ ...p, [ev.key]: { ...p[ev.key], enabled: e.target.checked } }))}
                              className="h-3.5 w-3.5 accent-brand-red"
                            />
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">Ativo</span>
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
                                  className={`${INPUT_CLS} font-mono text-xs`}
                                  placeholder="ex: pedido_pronto_feira"
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
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* Footer — sticky, respeita a barra inferior do iOS (safe-area) */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
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
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-[var(--bg-subtle)]/60"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {icon}
          {label}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
          : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
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
      <span className="mb-1 flex items-baseline gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-[var(--status-danger)]">*</span>}
        {hint && <span className="text-[10px] font-medium normal-case text-[var(--text-muted)]">— {hint}</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-[10px] font-bold text-[var(--status-danger)]">{error}</p>}
    </label>
  );
}

function Toggle({
  label, desc, checked, onChange, small = false,
}: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        checked
          ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)]'
          : 'border-[var(--border)] bg-[var(--bg-subtle)]'
      } ${small ? '' : 'w-full'}`}
    >
      <div className="min-w-0">
        <p className={`font-bold text-[var(--text-primary)] ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
        {desc && <p className="text-[10px] leading-tight text-[var(--text-secondary)]">{desc}</p>}
      </div>
      <SwitchKnob checked={checked} onChange={onChange} />
    </label>
  );
}

/** Switch estilizado tipo iOS — substitui o checkbox cru por algo moderno. */
function SwitchKnob({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] ${
        checked ? 'bg-[var(--status-success)]' : 'bg-[var(--border-strong)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
