import Link from "next/link";
import { Bike, Check, ChevronRight, MessageSquare, Power } from "lucide-react";
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
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)] transition-all hover:shadow-md ${
        isCurrent
          ? 'border-[var(--status-info)]/30 ring-1 ring-[var(--status-info)]/15'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]'
      }`}
    >
      <Link
        href={`/app/configuracoes/filiais/${branch.id}`}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`Editar ${branch.name}`}
      />

      <div
        className="relative z-[1] flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white pointer-events-none"
        style={{ backgroundColor: avatar.bg }}
      >
        <span className="text-xs font-semibold leading-none">{branch.code}</span>
        <span className="text-[9px] font-medium leading-none opacity-80 mt-0.5">
          {TYPE_OPTIONS.find((t) => t.value === branch.type)?.label.split(' ')[0]}
        </span>
      </div>
      <div className="relative z-[1] min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{branch.name}</p>
          {isCurrent && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-info)]">
              <Check className="h-2.5 w-2.5" strokeWidth={2} /> Sessão atual
            </span>
          )}
          {branch.active ? (
            <span className="rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-success)]">Ativa</span>
          ) : (
            <span className="rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-neutral)]">Inativa</span>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          /pedir/<span className="font-semibold text-[var(--text-secondary)]">{branch.slug}</span>
          {branch.ordering_start_time && branch.ordering_end_time && (
            <span className="ml-2">· {branch.ordering_start_time}–{branch.ordering_end_time}</span>
          )}
          {!branch.ordering_enabled && <span className="ml-2 text-[var(--status-warning)]">· pedidos offline</span>}
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${branch.delivery_enabled ? 'text-[var(--status-info)]' : 'text-[var(--text-muted)]'}`}>
            <Bike className="h-3 w-3" strokeWidth={2} /> {branch.delivery_enabled ? 'Entrega ligada' : 'Sem entrega'}
          </span>
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${branch.whatsapp_enabled ? 'text-[var(--status-success)]' : 'text-[var(--text-muted)]'}`}>
            <MessageSquare className="h-3 w-3" strokeWidth={2} /> {branch.whatsapp_enabled ? 'WhatsApp ligado' : 'WhatsApp desligado'}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleActive}
        className={`relative z-[1] flex h-10 items-center gap-1 rounded-full px-3 text-xs font-semibold shrink-0 ${
          branch.active
            ? 'bg-[var(--status-success-bg)] text-[var(--status-success)] hover:opacity-90'
            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
        }`}
        aria-label={branch.active ? 'Desativar filial' : 'Reativar filial'}
      >
        <Power className="h-3 w-3" strokeWidth={1.75} /> {branch.active ? 'Ativa' : 'Inativa'}
      </button>
      <ChevronRight className="relative z-[1] h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 pointer-events-none" strokeWidth={1.75} />
    </div>
  );
}
