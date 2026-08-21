import { getBusinessDayRange } from "./business-day";

export type Period = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom" | "range";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje", yesterday: "Ontem", last7: "7 dias", last30: "30 dias", thisMonth: "Este mês", custom: "Data", range: "Intervalo",
};

export interface DateRange {
  start: Date;
  end: Date;
}

/** Converte um "YYYY-MM-DD" (de um <input type="date">) num Date ao meio-dia local. */
export function labelToDate(label: string): Date {
  const [y, m, d] = label.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function computeDates(period: Period, customDate?: string, rangeStart?: string, rangeEnd?: string): DateRange {
  const now = new Date();
  // "Hoje", "Ontem" e "Data" usam o mesmo dia comercial do caixa (03h–02:59h Brasília)
  // para que ambas as telas mostrem os mesmos pedidos.
  if (period === "today") {
    const bd = getBusinessDayRange(now);
    return { start: bd.start, end: bd.end };
  }
  if (period === "yesterday") {
    // Dia comercial anterior = start do dia de hoje - 24h
    const todayBd = getBusinessDayRange(now);
    const yesterdayStart = new Date(todayBd.start.getTime() - 24 * 60 * 60 * 1000);
    return { start: yesterdayStart, end: todayBd.start };
  }
  if (period === "custom" && customDate) {
    const bd = getBusinessDayRange(labelToDate(customDate));
    return { start: bd.start, end: bd.end };
  }
  if (period === "range" && rangeStart && rangeEnd) {
    // Range fecha por dia comercial inclusive: start do dia inicial até end do dia final.
    const startBd = getBusinessDayRange(labelToDate(rangeStart));
    const endBd = getBusinessDayRange(labelToDate(rangeEnd));
    return { start: startBd.start, end: endBd.end };
  }

  const start = new Date();
  const end = new Date();
  switch (period) {
    case "last7":
      start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last30":
      start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisMonth":
      start.setDate(1); start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

export function computePrevDates(period: Period, customDate?: string, rangeStart?: string, rangeEnd?: string): DateRange {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  if (period === "range" && rangeStart && rangeEnd) {
    // Mesma duração imediatamente antes do range escolhido.
    const cur = computeDates("range", undefined, rangeStart, rangeEnd);
    const ms = cur.end.getTime() - cur.start.getTime();
    end.setTime(cur.start.getTime());
    start.setTime(cur.start.getTime() - ms);
    return { start, end };
  }
  switch (period) {
    case "today": {
      // Período anterior = dia comercial de ontem
      const todayBd = getBusinessDayRange(now);
      const ystStart = new Date(todayBd.start.getTime() - 24 * 60 * 60 * 1000);
      start.setTime(ystStart.getTime());
      end.setTime(todayBd.start.getTime());
      break;
    }
    case "custom": {
      // Dia comercial anterior à data escolhida
      const ref = customDate ? labelToDate(customDate) : now;
      const curBd = getBusinessDayRange(ref);
      const prevStart = new Date(curBd.start.getTime() - 24 * 60 * 60 * 1000);
      start.setTime(prevStart.getTime());
      end.setTime(curBd.start.getTime());
      break;
    }
    case "yesterday":
      start.setDate(now.getDate() - 2); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 2);   end.setHours(23, 59, 59, 999);
      break;
    case "last7":
      start.setDate(now.getDate() - 14); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 7);    end.setHours(23, 59, 59, 999);
      break;
    case "last30":
      start.setDate(now.getDate() - 60); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 30);   end.setHours(23, 59, 59, 999);
      break;
    case "thisMonth":
      start.setDate(1); start.setMonth(now.getMonth() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(0); end.setHours(23, 59, 59, 999);
      break;
  }
  return { start, end };
}

export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * Um range de datas está "fechado" quando não pode mais mudar — ou seja,
 * termina antes do dia comercial em curso. Períodos abertos (hoje, ou um
 * range/mês que inclui hoje) nunca devem ser cacheados entre sessões.
 */
export function isClosedRange(range: DateRange, now: Date = new Date()): boolean {
  const todayBd = getBusinessDayRange(now);
  return range.end.getTime() <= todayBd.start.getTime();
}
