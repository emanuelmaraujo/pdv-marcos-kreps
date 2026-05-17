import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Printer,
  User,
} from "lucide-react";
import { pdvApi } from "@/lib/api/pdv-api";
import { PrinterJob } from "@/types/pdv";
import { PrintStatusBadge } from "./PrintStatusBadge";

interface Props {
  job: PrinterJob;
  onJobUpdated: () => void;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const SECTOR_LABEL: Record<PrinterJob["sector"], string> = {
  KITCHEN:     "Kreps",
  JUICE_POTATO:"Cozinha",
  CUSTOMER:    "Cliente",
};

/* Cores do badge por setor — mantidas como identidade do setor (não status).
   Kreps = brand red (a marca), Cozinha = info, Cliente = neutral. */
const SECTOR_COLOR: Record<PrinterJob["sector"], string> = {
  KITCHEN:     "bg-brand-red/10 text-brand-red",
  JUICE_POTATO:"bg-[var(--status-info-bg)] text-[var(--status-info)]",
  CUSTOMER:    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
};

function fmt(date?: string) {
  if (!date) return "--:--";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PrinterJobCard({ job, onJobUpdated }: Props) {
  const [isReprinting, setIsReprinting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleReprint = async () => {
    setIsReprinting(true);
    setFeedback("");
    try {
      await pdvApi.reprintOrder({ orderId: job.order_id, copies: [job.sector] });
      setFeedback("Reimpressão solicitada.");
      onJobUpdated();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Erro ao reimprimir");
    } finally {
      setIsReprinting(false);
    }
  };

  const isFailed  = job.status === "FAILED";
  const isPending = job.status === "PENDING";
  const isPrinted = job.status === "PRINTED";

  const cardBg = isFailed
    ? "bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30"
    : isPending
    ? "bg-[var(--status-warning-bg)]/60 border-[var(--status-warning)]/30"
    : "bg-[var(--bg-surface)] border-[var(--border)]";

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-[var(--shadow-sm)] ${cardBg}`}>
      {/* ── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isFailed  ? "bg-[var(--status-danger)]/15 text-[var(--status-danger)]"
          : isPending ? "bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
          : "bg-[var(--status-success)]/15 text-[var(--status-success)]"
        }`}>
          {isFailed  ? <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          : isPrinted ? <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
          : <Printer className="h-4 w-4" strokeWidth={1.75} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
              #{job.order?.daily_number ?? "--"}
            </span>
            <PrintStatusBadge status={job.status} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SECTOR_COLOR[job.sector]}`}>
              {SECTOR_LABEL[job.sector]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" strokeWidth={1.75} />
              {job.order?.customer_name || "Sem identificação"}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" strokeWidth={1.75} />
              {fmt(isPrinted ? (job.printed_at || job.created_at) : job.created_at)}
            </span>
          </div>
        </div>

        <span className="shrink-0 text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          {currency.format(job.order?.total_amount || 0)}
        </span>
      </div>

      {/* ── Error message ───────────────────────────────────────── */}
      {isFailed && job.error_message && (
        <div className="mx-4 mb-3 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--status-danger)]">
          {job.error_message}
        </div>
      )}

      {/* ── Feedback ────────────────────────────────────────────── */}
      {feedback && (
        <div className={`mx-4 mb-3 rounded-xl px-3 py-2 text-xs font-semibold ${
          feedback.toLowerCase().includes("erro")
            ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
            : "bg-[var(--status-success-bg)] text-[var(--status-success)]"
        }`}>
          {feedback}
        </div>
      )}

      {/* ── Action bar ─────────────────────────────────────────── */}
      <div className="border-t border-[var(--border)] px-4 py-2.5">
        <button
          onClick={handleReprint}
          disabled={isReprinting}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold active:scale-[0.98] disabled:opacity-50 ${
            isFailed
              ? "bg-[var(--status-danger)] text-white hover:opacity-90"
              : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          }`}
        >
          {isReprinting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
          {isReprinting ? "Solicitando..." : "Reimprimir"}
        </button>
      </div>
    </div>
  );
}
