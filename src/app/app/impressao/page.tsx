"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { printerApi } from "@/lib/api/printer-api";
import { PrinterJob } from "@/types/pdv";
import { PrinterJobCard } from "./components/PrinterJobCard";

type PrintStatusFilter = "PENDING" | "FAILED" | "PRINTED" | "TODOS";
type PrintSectorFilter = "ALL" | PrinterJob["sector"];

const statusFilters: { id: PrintStatusFilter; label: string }[] = [
  { id: "PENDING",  label: "Pendentes" },
  { id: "FAILED",   label: "Falhas" },
  { id: "PRINTED",  label: "Impressos" },
  { id: "TODOS",    label: "Todos" },
];

const sectorFilters: { id: PrintSectorFilter; label: string }[] = [
  { id: "ALL",          label: "Todos" },
  { id: "KITCHEN",      label: "Kreps" },
  { id: "JUICE_POTATO", label: "Cozinha" },
  { id: "CUSTOMER",     label: "Cliente" },
];

export default function ImpressaoPage() {
  const [jobs, setJobs] = useState<PrinterJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeStatus, setActiveStatus] = useState<PrintStatusFilter>("PENDING");
  const [activeSector, setActiveSector] = useState<PrintSectorFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchJobs = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    setError("");
    try {
      const data = await printerApi.getTodayJobs();
      setJobs(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fila");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => fetchJobs(), 0);
    const interval = window.setInterval(() => fetchJobs(), 10_000);
    return () => { window.clearTimeout(t); window.clearInterval(interval); };
  }, [fetchJobs]);

  const stats = useMemo(() => ({
    pending: jobs.filter((j) => j.status === "PENDING").length,
    failed:  jobs.filter((j) => j.status === "FAILED").length,
    printed: jobs.filter((j) => j.status === "PRINTED").length,
    latest:  jobs[0]?.created_at
      ? new Date(jobs[0].created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "--:--",
  }), [jobs]);

  const filteredJobs = jobs.filter((job) => {
    const matchStatus  = activeStatus === "TODOS" || job.status === activeStatus;
    const matchSector  = activeSector === "ALL"   || job.sector === activeSector;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch  = !q
      || String(job.order?.daily_number ?? "").includes(q)
      || job.order?.customer_name?.toLowerCase().includes(q);
    return matchStatus && matchSector && matchSearch;
  });

  const getCount = (s: PrintStatusFilter) =>
    s === "TODOS" ? jobs.length : jobs.filter((j) => j.status === s).length;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-sm">

        {/* Stats row — horizontal, compact */}
        <div className="flex items-center gap-0 border-b border-[var(--border)]">
          <StatPill
            label="Pendentes"
            count={stats.pending}
            icon={Clock}
            tone={stats.pending > 0 ? "warning" : "neutral"}
          />
          <div className="h-8 w-px bg-[var(--border)]" />
          <StatPill
            label="Falhas"
            count={stats.failed}
            icon={AlertTriangle}
            tone={stats.failed > 0 ? "danger" : "neutral"}
          />
          <div className="h-8 w-px bg-[var(--border)]" />
          <StatPill
            label="Impressos"
            count={stats.printed}
            icon={CheckCircle2}
            tone="success"
            detail={`Último ${stats.latest}`}
          />
          <div className="ml-auto border-l border-[var(--border)] px-3 py-2">
            <button
              onClick={() => fetchJobs(true)}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70 active:scale-95 disabled:opacity-50"
            >
              {isRefreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />}
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Search + Status filters on one line */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Pedido ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] pl-8 pr-3 text-xs font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-brand-red/40 focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-brand-red/10"
            />
          </div>

          {/* Status tabs */}
          <div className="flex gap-0.5 overflow-x-auto rounded-full bg-[var(--bg-subtle)] p-0.5 hide-scrollbar shrink-0">
            {statusFilters.map((f) => {
              const count = getCount(f.id);
              const active = activeStatus === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveStatus(f.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold ${
                    active ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${
                      active ? "bg-brand-red text-white" : "bg-[var(--border)] text-[var(--text-secondary)]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sector filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2 hide-scrollbar">
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
            <Filter className="h-3 w-3" strokeWidth={1.75} />
            Setor
          </span>
          {sectorFilters.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSector(s.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                activeSector === s.id
                  ? "bg-brand-charcoal text-white"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Job list ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
        {isLoading && jobs.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] p-4 text-center text-sm font-semibold text-[var(--status-danger)]">
            {error}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Printer}
              title="Nenhum job na fila"
              description="Ajuste os filtros ou aguarde novos pedidos."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 xl:grid-cols-3">
            {filteredJobs.map((job) => (
              <PrinterJobCard key={job.id} job={job} onJobUpdated={fetchJobs} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  detail?: string;
  icon: React.ElementType;
  tone: "warning" | "success" | "danger" | "neutral";
}) {
  const colors = {
    warning: { num: "text-[var(--status-warning)]", sub: "text-[var(--status-warning)] opacity-70", icon: "text-[var(--status-warning)]" },
    success: { num: "text-[var(--status-success)]", sub: "text-[var(--status-success)] opacity-70", icon: "text-[var(--status-success)]" },
    danger:  { num: "text-[var(--status-danger)]",  sub: "text-[var(--status-danger)] opacity-70",  icon: "text-[var(--status-danger)]"  },
    neutral: { num: "text-[var(--text-secondary)]", sub: "text-[var(--text-muted)]",                icon: "text-[var(--text-muted)]"     },
  }[tone];

  return (
    <div className="flex flex-1 items-center gap-2.5 px-4 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${colors.icon}`} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className={`text-xl font-semibold leading-none tabular-nums ${colors.num}`}>{count}</p>
          {detail && <p className={`hidden text-[11px] font-medium sm:block ${colors.sub}`}>{detail}</p>}
        </div>
      </div>
    </div>
  );
}
