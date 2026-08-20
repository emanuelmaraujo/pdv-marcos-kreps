"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useBranch } from "@/contexts/BranchContext";
import { reportsApi, CourierDeliveryReportRow } from "@/lib/api/reports-api";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";

function startOfDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)} min`;
}

export default function CourierDeliveryReportPage() {
  const { isLoading: userLoading, isAdmin } = useUser();
  const { currentBranchId } = useBranch();
  const router = useRouter();

  const [rows, setRows] = useState<CourierDeliveryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userLoading && !isAdmin) router.replace("/app");
  }, [userLoading, isAdmin, router]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await reportsApi.getCourierDeliveryReport({
        start_date: startOfDaysAgo(30),
        end_date: new Date().toISOString(),
        branch_id: currentBranchId,
      });
      setRows(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório.");
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loadReport]);

  if (userLoading || !isAdmin) {
    return <LoadingState message="Carregando..." />;
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <button
          onClick={() => router.push("/app/configuracoes/filiais")}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          <Bike className="h-6 w-6 text-brand-red" />
          Métricas de entrega por motoboy
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Últimos 30 dias — tempo médio de despacho até entrega, por entregador/filial/dia.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState message="Calculando métricas..." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Sem entregas confirmadas no período"
          description="As métricas aparecem depois que pedidos de entrega são confirmados."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Dia</th>
                  <th className="px-4 py-3">Entregador</th>
                  <th className="px-4 py-3">Filial</th>
                  <th className="px-4 py-3 text-right">Entregas</th>
                  <th className="px-4 py-3 text-right">Pronto → Despacho</th>
                  <th className="px-4 py-3 text-right">Despacho → Entrega</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.courier_id ?? "avulso"}::${row.branch_id}::${row.day}`}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{row.day}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.courier_name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{row.branch_name}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-primary)]">{row.deliveries}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                      {formatMinutes(row.avg_ready_to_dispatch_minutes)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                      {formatMinutes(row.avg_dispatch_to_delivered_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
