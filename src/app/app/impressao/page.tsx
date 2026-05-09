"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { printerApi } from "@/lib/api/printer-api";
import { PrinterJob } from "@/types/pdv";
import { PrinterJobCard } from "./components/PrinterJobCard";

type PrintStatusFilter = "PENDING" | "FAILED" | "PRINTED" | "TODOS";
type PrintSectorFilter = "ALL" | PrinterJob["sector"];

const statusFilters: { id: PrintStatusFilter; label: string }[] = [
  { id: "PENDING", label: "Pendentes" },
  { id: "FAILED", label: "Falhas" },
  { id: "PRINTED", label: "Impressos" },
  { id: "TODOS", label: "Todos" },
];

const sectorFilters: { id: PrintSectorFilter; label: string }[] = [
  { id: "ALL", label: "Todos setores" },
  { id: "KITCHEN", label: "Cozinha" },
  { id: "JUICE_POTATO", label: "Sucos/Batata" },
  { id: "CUSTOMER", label: "Cliente" },
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
    if (showLoading) {
      setIsRefreshing(true);
    }
    setError("");
    try {
      const data = await printerApi.getTodayJobs();
      setJobs(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fila de impressão");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      fetchJobs();
    }, 0);

    const interval = window.setInterval(() => {
      fetchJobs();
    }, 10000);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(interval);
    };
  }, [fetchJobs]);

  const stats = useMemo(() => {
    const pending = jobs.filter((job) => job.status === "PENDING").length;
    const failed = jobs.filter((job) => job.status === "FAILED").length;
    const printed = jobs.filter((job) => job.status === "PRINTED").length;
    const latest = jobs[0]?.created_at
      ? new Date(jobs[0].created_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

    return { pending, failed, printed, latest };
  }, [jobs]);

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = activeStatus === "TODOS" || job.status === activeStatus;
    const matchesSector = activeSector === "ALL" || job.sector === activeSector;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      String(job.order?.daily_number ?? "").includes(query) ||
      job.order?.customer_name?.toLowerCase().includes(query);

    return matchesStatus && matchesSector && matchesSearch;
  });

  const getCount = (status: PrintStatusFilter) =>
    status === "TODOS" ? jobs.length : jobs.filter((job) => job.status === status).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <section className="border-b border-zinc-200 bg-background px-4 pt-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <PrintStatCard
              label="Pendentes"
              value={String(stats.pending)}
              detail="Aguardando impressora"
              icon={Clock}
              tone={stats.pending > 0 ? "amber" : "zinc"}
            />
            <PrintStatCard
              label="Falhas"
              value={String(stats.failed)}
              detail={stats.failed > 0 ? "Requer reimpressão" : "Sem falhas hoje"}
              icon={AlertTriangle}
              tone={stats.failed > 0 ? "red" : "emerald"}
            />
            <PrintStatCard
              label="Impressos"
              value={String(stats.printed)}
              detail={`Último job ${stats.latest}`}
              icon={CheckCircle2}
              tone="emerald"
            />
          </div>

          <div className="flex items-stretch rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm xl:min-w-64">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchJobs(true)}
              disabled={isLoading || isRefreshing}
              className="h-full w-full gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar fila
            </Button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por pedido ou cliente..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-100 bg-zinc-100 pl-10 pr-3 text-sm font-semibold text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-brand-red/40 focus:bg-white focus:ring-2 focus:ring-brand-red/20"
              />
            </div>

            <SegmentedFilters
              items={statusFilters.map((item) => ({
                ...item,
                count: getCount(item.id),
              }))}
              active={activeStatus}
              onChange={(value) => setActiveStatus(value as PrintStatusFilter)}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-zinc-400">
              <Filter className="h-3.5 w-3.5" />
              Setor
            </span>
            {sectorFilters.map((sector) => (
              <button
                key={sector.id}
                onClick={() => setActiveSector(sector.id)}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                  activeSector === sector.id
                    ? "border-brand-charcoal bg-brand-charcoal text-white"
                    : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {sector.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {isLoading && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-red" />
            <p className="text-sm font-bold uppercase tracking-widest">
              Carregando fila...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
            {error}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title="Nenhum job encontrado"
              description="Ajuste os filtros ou aguarde novos pedidos entrarem na fila."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-24 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredJobs.map((job) => (
              <PrinterJobCard key={job.id} job={job} onJobUpdated={fetchJobs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrintStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: "amber" | "emerald" | "red" | "zinc";
}) {
  const tones = {
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    red: "border-red-100 bg-red-50 text-red-700",
    zinc: "border-zinc-100 bg-white text-zinc-700",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wide opacity-75">
          {label}
        </p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-black text-brand-charcoal">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-80">{detail}</p>
    </div>
  );
}

function SegmentedFilters({
  items,
  active,
  onChange,
}: {
  items: { id: string; label: string; count: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl bg-zinc-100 p-1 hide-scrollbar">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black uppercase transition-all ${
            active === item.id
              ? "bg-white text-brand-charcoal shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          {item.label}
          <Badge variant={active === item.id ? "brand" : "secondary"} className="px-1.5 py-0 text-[10px]">
            {item.count}
          </Badge>
        </button>
      ))}
    </div>
  );
}
