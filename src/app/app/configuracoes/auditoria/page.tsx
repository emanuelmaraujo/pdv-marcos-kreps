"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileClock,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import {
  auditLogsApi,
  type AuditArea,
  type AuditEvent,
} from "@/lib/api/audit-logs-api";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

const areaOptions: Array<{ value: AuditArea; label: string }> = [
  { value: "all", label: "Todas as áreas" },
  { value: "profiles", label: "Usuários e acessos" },
  { value: "branches", label: "Filiais" },
  { value: "branch_payment_fee_rules", label: "Taxas de pagamento" },
  { value: "settings", label: "Configurações gerais" },
];

const actionLabels: Record<string, string> = {
  USER_CREATED: "Usuário criado",
  USER_UPDATED: "Usuário atualizado",
  USER_DELETED: "Usuário removido",
  BRANCH_CREATED: "Filial criada",
  BRANCH_UPDATED: "Filial atualizada",
  BRANCH_DELETED: "Filial removida",
  PAYMENT_FEE_RULE_CREATED: "Regra de taxa criada",
  PAYMENT_FEE_RULE_UPDATED: "Regra de taxa atualizada",
  PAYMENT_FEE_RULE_DELETED: "Regra de taxa removida",
  SETTING_CREATED: "Configuração criada",
  SETTING_UPDATED: "Configuração atualizada",
  SETTING_DELETED: "Configuração removida",
};

const auditDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function AuditHistoryPage() {
  const { branches, currentBranchId, isLoading: branchesLoading } = useBranch();
  const { isGlobalAdmin } = useUser();
  const { toasts, addToast, removeToast } = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<AuditArea>("all");
  const [globalBranchFilter, setGlobalBranchFilter] = useState("all");
  const branchFilter = isGlobalAdmin ? globalBranchFilter : currentBranchId ?? "all";

  const loadEvents = useCallback(async () => {
    if (branchesLoading) return;
    setLoading(true);
    try {
      const result = await auditLogsApi.list({
        page,
        area,
        branchId: branchFilter === "all" ? undefined : branchFilter,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (error) {
      addToast("error", getFriendlyErrorMessage(error, "Não foi possível carregar o histórico."));
    } finally {
      setLoading(false);
    }
  }, [addToast, area, branchFilter, branchesLoading, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);

  const totalPages = Math.max(1, Math.ceil(total / auditLogsApi.pageSize));
  const rangeLabel = useMemo(() => {
    if (!total) return "Nenhum registro";
    const first = page * auditLogsApi.pageSize + 1;
    const last = Math.min(total, first + auditLogsApi.pageSize - 1);
    return `${first}–${last} de ${total}`;
  }, [page, total]);

  function changeArea(value: string) {
    setArea(value as AuditArea);
    setPage(0);
  }

  function changeBranch(value: string) {
    setGlobalBranchFilter(value);
    setPage(0);
  }

  return (
    <main className="min-h-full bg-[var(--bg-subtle)]/50 px-4 py-5 pb-28 sm:px-6 md:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-red">Governança</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">Histórico de alterações</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                Consulte quem alterou acessos, filiais, taxas e configurações. O conteúdo sensível anterior e posterior não é enviado para esta tela.
              </p>
            </div>
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 sm:flex">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-muted)]">
              Área
              <Select value={area} onChange={(event) => changeArea(event.target.value)} className="min-h-11">
                {areaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-muted)]">
              Filial
              <Select value={branchFilter} onChange={(event) => changeBranch(event.target.value)} disabled={!isGlobalAdmin} className="min-h-11">
                {isGlobalAdmin && <option value="all">Todas, inclusive global</option>}
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </label>
            <Button type="button" variant="outline" onClick={() => void loadEvents()} disabled={loading} className="min-h-11 self-end">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </section>

        {loading ? (
          <LoadingState message="Carregando auditoria..." />
        ) : events.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
            <FileClock className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <h2 className="mt-3 font-black text-[var(--text-primary)]">Nenhuma alteração encontrada</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Ajuste os filtros ou faça uma atualização para gerar o primeiro registro.</p>
          </section>
        ) : (
          <section aria-label="Eventos de auditoria" className="space-y-3">
            {events.map((event) => <AuditEventCard key={event.id} event={event} />)}
          </section>
        )}

        <nav aria-label="Paginação do histórico" className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 shadow-sm">
          <Button type="button" variant="ghost" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={loading || page === 0} className="min-h-11 px-3">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs font-bold text-[var(--text-muted)]">{rangeLabel}</span>
          <Button type="button" variant="ghost" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={loading || page >= totalPages - 1} className="min-h-11 px-3">
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  );
}

function AuditEventCard({ event }: { event: AuditEvent }) {
  const title = actionLabels[event.action] ?? humanizeAction(event.action);

  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-brand-red">
        <AreaIcon tableName={event.table_name} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h2 className="font-black text-[var(--text-primary)]">{title}</h2>
          <time dateTime={event.created_at} className="text-xs font-bold text-[var(--text-muted)]">{formatDate(event.created_at)}</time>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Por <strong className="text-[var(--text-primary)]">{event.actor_name ?? (event.user_id ? "Usuário protegido" : "Sistema")}</strong>
          {event.branch_name ? <> em <strong className="text-[var(--text-primary)]">{event.branch_name}</strong></> : " no escopo global"}
        </p>
        {event.record_id && <p className="mt-2 truncate font-mono text-[11px] text-[var(--text-muted)]">Registro {event.record_id}</p>}
      </div>
    </article>
  );
}

function AreaIcon({ tableName }: { tableName: string | null }) {
  const className = "h-[18px] w-[18px]";
  if (tableName === "profiles") return <UserRoundCog className={className} />;
  if (tableName === "branches") return <Building2 className={className} />;
  if (tableName === "branch_payment_fee_rules") return <CreditCard className={className} />;
  if (tableName === "settings") return <Settings2 className={className} />;
  return <FileClock className={className} />;
}

function humanizeAction(action: string): string {
  return action.toLowerCase().split("_").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

function formatDate(value: string): string {
  return auditDateFormatter.format(new Date(value));
}
