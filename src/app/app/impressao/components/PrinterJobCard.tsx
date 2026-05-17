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

const SECTOR_COLOR: Record<PrinterJob["sector"], string> = {
  KITCHEN:     "bg-brand-red/10 text-brand-red",
  JUICE_POTATO:"bg-violet-100 text-violet-700",
  CUSTOMER:    "bg-blue-100 text-blue-700",
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
    ? "bg-red-50 border-red-200"
    : isPending
    ? "bg-amber-50/60 border-amber-200"
    : "bg-white border-zinc-200";

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm ${cardBg}`}>
      {/* ── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isFailed  ? "bg-red-100 text-red-600"
          : isPending ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
        }`}>
          {isFailed  ? <AlertTriangle className="h-4 w-4" />
          : isPrinted ? <CheckCircle2 className="h-4 w-4" />
          : <Printer className="h-4 w-4" />}
        </span>

        {/* Order info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-zinc-900">
              #{job.order?.daily_number ?? "--"}
            </span>
            <PrintStatusBadge status={job.status} />
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${SECTOR_COLOR[job.sector]}`}>
              {SECTOR_LABEL[job.sector]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {job.order?.customer_name || "Sem identificação"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmt(isPrinted ? (job.printed_at || job.created_at) : job.created_at)}
            </span>
          </div>
        </div>

        {/* Value */}
        <span className="shrink-0 text-sm font-black text-zinc-700">
          {currency.format(job.order?.total_amount || 0)}
        </span>
      </div>

      {/* ── Error message ───────────────────────────────────────── */}
      {isFailed && job.error_message && (
        <div className="mx-4 mb-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">
          {job.error_message}
        </div>
      )}

      {/* ── Feedback ────────────────────────────────────────────── */}
      {feedback && (
        <div className={`mx-4 mb-3 rounded-xl px-3 py-2 text-xs font-bold ${
          feedback.toLowerCase().includes("erro")
            ? "bg-red-100 text-red-700"
            : "bg-emerald-100 text-emerald-700"
        }`}>
          {feedback}
        </div>
      )}

      {/* ── Action bar ─────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 px-4 py-2.5">
        <button
          onClick={handleReprint}
          disabled={isReprinting}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
            isFailed
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {isReprinting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Copy className="h-3.5 w-3.5" />}
          {isReprinting ? "Solicitando..." : "Reimprimir"}
        </button>
      </div>
    </div>
  );
}
