import { BranchInput } from "@/lib/api/branches-admin-api";
import { Field, Toggle } from "../FormPrimitives";
import { INPUT_CLS, TYPE_OPTIONS, slugify, validateBranchCode, validateBranchSlug } from "../../utils";

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
    <div className="space-y-3">
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

      <Field label="Meta mensal de faturamento (R$)">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editing.monthly_revenue_goal ?? ''}
          onChange={(e) => setField('monthly_revenue_goal', e.target.value === '' ? null : Number(e.target.value))}
          className={INPUT_CLS}
          placeholder="Deixe em branco pra não acompanhar meta"
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
    </div>
  );
}
