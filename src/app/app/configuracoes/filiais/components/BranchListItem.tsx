import Link from "next/link";
import { Bike, Check, ChevronRight, CreditCard, MessageSquare, Power } from "lucide-react";
import { Branch } from "@/types/pdv";
import { TYPE_OPTIONS, avatarStyleFor } from "../utils";

export function BranchListItem({
  branch,
  isCurrent,
  onToggleActive,
}: {
  branch: Branch;
  isCurrent: boolean;
  onToggleActive: () => void;
}) {
  const avatar = avatarStyleFor(branch.id, branch.code);
  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-[var(--bg-surface)] shadow-[var(--elevation-1)] transition hover:-translate-y-0.5 hover:shadow-[var(--elevation-2)] ${
        isCurrent
          ? 'border-[var(--status-info)]/30 ring-1 ring-[var(--status-info)]/15'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]'
      }`}
    >
      <Link
        href={`/app/configuracoes/filiais/${branch.id}`}
        className="flex min-h-28 items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red/40"
      >
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white" style={{ backgroundColor: avatar.bg }}>
          <span className="text-sm font-bold leading-none">{branch.code}</span>
          <span className="mt-1 text-[9px] font-medium leading-none opacity-80">{TYPE_OPTIONS.find((t) => t.value === branch.type)?.label.split(' ')[0]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-bold text-[var(--text-primary)]">{branch.name}</span>
            {isCurrent ? <span className="flex items-center gap-1 rounded-full bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-info)]"><Check className="h-2.5 w-2.5" /> Sessão atual</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${branch.active ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'}`}>{branch.active ? 'Ativa' : 'Inativa'}</span>
          </span>
          <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">/pedir/{branch.slug}{branch.ordering_start_time && branch.ordering_end_time ? ` · ${branch.ordering_start_time}–${branch.ordering_end_time}` : ''}</span>
          <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            <span className={`flex items-center gap-1 text-[11px] font-medium ${branch.delivery_enabled ? 'text-[var(--status-info)]' : 'text-[var(--text-muted)]'}`}><Bike className="h-3.5 w-3.5" />{branch.delivery_enabled ? 'Entrega ativa' : 'Sem entrega'}</span>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${branch.whatsapp_enabled ? 'text-[var(--status-success)]' : 'text-[var(--text-muted)]'}`}><MessageSquare className="h-3.5 w-3.5" />{branch.whatsapp_enabled ? 'WhatsApp ativo' : 'WhatsApp inativo'}</span>
          </span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)]/60 px-4 py-2.5">
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {branch.ordering_enabled ? 'Aceitando pedidos' : 'Pedidos pausados'}
        </span>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/configuracoes/pagamentos?branch=${branch.id}`}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-brand-red"
            aria-label={`Configurar taxas de ${branch.name}`}
          >
            <CreditCard className="h-3.5 w-3.5" /> Taxas
          </Link>
          <button
            type="button"
            onClick={onToggleActive}
            className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${branch.active ? 'text-[var(--status-success)] hover:bg-[var(--status-success-bg)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'}`}
            aria-label={branch.active ? `Desativar ${branch.name}` : `Reativar ${branch.name}`}
          >
            <Power className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{branch.active ? 'Desativar' : 'Reativar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
