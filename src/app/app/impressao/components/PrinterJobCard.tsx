import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Printer,
  ReceiptText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { pdvApi } from "@/lib/api/pdv-api";
import { PrinterJob } from "@/types/pdv";
import { PrintStatusBadge } from "./PrintStatusBadge";

interface Props {
  job: PrinterJob;
  onJobUpdated: () => void;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function PrinterJobCard({ job, onJobUpdated }: Props) {
  const [isReprinting, setIsReprinting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleReprint = async () => {
    setIsReprinting(true);
    setFeedback("");
    try {
      await pdvApi.reprintOrder({
        orderId: job.order_id,
        copies: [job.sector],
      });
      setFeedback("Reimpressão solicitada.");
      onJobUpdated();
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : "Erro ao reimprimir");
    } finally {
      setIsReprinting(false);
    }
  };

  const isFailed = job.status === "FAILED";
  const isPending = job.status === "PENDING";
  const isPrinted = job.status === "PRINTED";

  return (
    <Card
      className={`overflow-hidden border-zinc-200 ${
        isFailed
          ? "border-red-200 bg-red-50/50"
          : isPending
            ? "border-amber-200 bg-amber-50/40"
            : "bg-white"
      }`}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isFailed
                  ? "bg-red-100 text-red-600"
                  : isPending
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isFailed ? (
                <AlertTriangle className="h-5 w-5" />
              ) : isPrinted ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black leading-tight text-brand-charcoal">
                  Pedido #{job.order?.daily_number ?? "--"}
                </h3>
                <PrintStatusBadge status={job.status} />
              </div>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                {sectorLabel(job.sector)} · {createdTime(job.created_at)}
              </p>
            </div>
          </div>

          <span className="rounded-xl bg-white/80 px-2.5 py-1 text-xs font-black text-brand-charcoal shadow-sm">
            {currency.format(job.order?.total_amount || 0)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoPill
            icon={User}
            label="Cliente"
            value={job.order?.customer_name || "Sem identificação"}
          />
          <InfoPill
            icon={Clock}
            label={isPrinted ? "Impresso" : "Criado"}
            value={createdTime(job.printed_at || job.created_at)}
          />
        </div>

        {isFailed && job.error_message && (
          <div className="rounded-xl border border-red-200 bg-white p-3 text-sm font-semibold text-red-700">
            {job.error_message}
          </div>
        )}

        <div className="rounded-xl border border-zinc-100 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-zinc-400">
            <ReceiptText className="h-3.5 w-3.5" />
            Prévia da comanda
          </div>
          <pre className="max-h-20 overflow-hidden whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-500">
            {formatContentPreview(job.content)}
          </pre>
        </div>

        {feedback && (
          <p
            className={`rounded-xl px-3 py-2 text-xs font-bold ${
              feedback.includes("Erro") || feedback.includes("error")
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {feedback}
          </p>
        )}

        <Button
          variant={isFailed ? "default" : "outline"}
          className="w-full gap-2"
          onClick={handleReprint}
          disabled={isReprinting}
        >
          {isReprinting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {isReprinting ? "Solicitando..." : "Reimprimir via"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-brand-charcoal">{value}</p>
      </div>
    </div>
  );
}

function sectorLabel(sector: PrinterJob["sector"]) {
  const labels: Record<PrinterJob["sector"], string> = {
    KITCHEN: "Cozinha",
    JUICE_POTATO: "Sucos/Batata",
    CUSTOMER: "Cliente",
  };
  return labels[sector] ?? sector;
}

function createdTime(date?: string) {
  if (!date) return "--:--";
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatContentPreview(content: Record<string, unknown>) {
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return "Conteúdo da comanda indisponível.";
  }
}
