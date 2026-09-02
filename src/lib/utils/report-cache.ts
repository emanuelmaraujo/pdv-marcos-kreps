import { CashReportResponse, OrderRecord } from "@/lib/api/reports-api";

// Cache best-effort em sessionStorage para períodos "fechados" (que não podem
// mais mudar — ver isClosedRange em report-periods.ts). Evita reprocessar a
// mesma janela de dados toda vez que o usuário revisita um dia/intervalo
// passado durante a mesma sessão de navegador.
//
// Escopo deliberadamente pequeno: sem TTL, sem invalidação por escrita —
// se um pedido antigo for corrigido manualmente depois do fechamento do dia,
// o botão "Atualizar" (force: true em loadReport) ignora e re-grava o cache.

// v2 adiciona o histórico de preços por item; dados de sessões antigas não
// possuem esse campo e não devem mascarar a nova análise.
const PREFIX = "pdv:cash-report:v2:";

export interface CachedReportBundle {
  report: CashReportResponse;
  prevReport: CashReportResponse | null;
  orders: OrderRecord[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function buildReportCacheKey(params: {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  categoryId?: string;
  paymentMethod?: string;
  orderType?: string;
  weekday?: string;
  branchId?: string | null;
}): string {
  return PREFIX + [
    params.start,
    params.end,
    params.prevStart,
    params.prevEnd,
    params.categoryId ?? "ALL",
    params.paymentMethod ?? "ALL",
    params.orderType ?? "ALL",
    params.weekday ?? "ALL",
    params.branchId ?? "ALL",
  ].join("|");
}

export function readReportCache(key: string): CachedReportBundle | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedReportBundle;
  } catch {
    return null;
  }
}

export function writeReportCache(key: string, bundle: CachedReportBundle): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(bundle));
  } catch {
    // sessionStorage cheio ou indisponível (aba anônima) — cache é best-effort,
    // nunca deve quebrar o carregamento do relatório.
  }
}
