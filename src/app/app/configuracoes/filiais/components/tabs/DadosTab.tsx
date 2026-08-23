import { Building2, Check, Landmark, Phone, Store, Tent, Wallet } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { Field, FieldGroup, Toggle } from "../FormPrimitives";
import { INPUT_CLS, TYPE_OPTIONS, slugify, validateBranchCode, validateBranchSlug } from "../../utils";

const TYPE_ICONS = { STORE: Store, POPUP: Tent, FAIR: Landmark } as const;

export function DadosTab({
  editing,
  setField,
}: {
  editing: BranchInput;
  setField: <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => void;
}) {
  const codeValid = validateBranchCode(editing.code);
  const slugValid = validateBranchSlug(editing.slug);

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <FieldGroup title="Identificação" icon={Building2} iconBg="bg-blue-100" iconColor="text-blue-600">
        <Field label="Nome da filial" required>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => {
              const name = e.target.value;
              setField("name", name);
              if (!editing.slug) setField("slug", slugify(name));
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

        {editing.slug && slugValid && (
          <p className="rounded-lg bg-[var(--bg-subtle)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
            URL pública: <span className="font-bold text-[var(--text-primary)]">marcoskreps.com.br/pedir/{editing.slug}</span>
          </p>
        )}

        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-3">
          {TYPE_OPTIONS.map((t) => {
            const Icon = TYPE_ICONS[t.value];
            const active = editing.type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setField('type', t.value)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all sm:block sm:gap-0 ${
                  active
                    ? 'border-brand-red bg-[var(--status-danger-bg)] text-brand-red shadow-sm'
                    : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-red-100' : 'bg-[var(--bg-base)]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-red-600' : 'text-[var(--text-muted)]'}`} />
                </span>
                <div className="min-w-0 flex-1 sm:mt-2 sm:flex-none">
                  <p className="text-xs font-black">{t.label}</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug opacity-80">{t.desc}</p>
                </div>
                {active && <Check className="h-4 w-4 shrink-0 text-brand-red sm:hidden" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <div className="space-y-4">
        <FieldGroup title="Contato" icon={Phone} iconBg="bg-amber-100" iconColor="text-amber-600">
          <Field label="Telefone">
            <input
              type="tel"
              value={editing.phone ?? ''}
              onChange={(e) => setField('phone', e.target.value)}
              className={INPUT_CLS}
              placeholder="(61) 99999-9999"
            />
          </Field>

          <Field label="Endereço">
            <input
              type="text"
              value={editing.address ?? ''}
              onChange={(e) => setField('address', e.target.value)}
              className={INPUT_CLS}
              placeholder="Rua X, nº Y — Asa Norte"
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Taxas e metas" icon={Wallet} iconBg="bg-emerald-100" iconColor="text-emerald-600">
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Meta mensal (R$)" hint="opcional">
              <input
                type="number"
                step="0.01"
                min="0"
                value={editing.monthly_revenue_goal ?? ''}
                onChange={(e) => setField('monthly_revenue_goal', e.target.value === '' ? null : Number(e.target.value))}
                className={INPUT_CLS}
                placeholder="Sem meta"
              />
            </Field>
          </div>
        </FieldGroup>

        <div className="flex flex-col gap-2">
          <Toggle
            label="Ativa"
            desc="Filial inativa some do seletor de filiais e do checkout público"
            checked={editing.active !== false}
            onChange={(v) => setField('active', v)}
          />
          <Toggle
            label="Aceitar pedidos online"
            desc="Clientes podem abrir /pedir/slug e montar o pedido"
            checked={editing.ordering_enabled !== false}
            onChange={(v) => setField('ordering_enabled', v)}
          />
        </div>
      </div>
    </div>
  );
}
