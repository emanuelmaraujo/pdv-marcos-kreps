import { describe, it, expect, afterEach, vi } from "vitest";
import { computeDates, computePrevDates, isClosedRange, labelToDate } from "./report-periods";

// SP = America/Sao_Paulo, UTC-3 o ano todo (sem horário de verão desde 2019).
// Dia comercial: 03h00 SP → 02h59:59 SP do dia seguinte.
const spIso = (dateLabel: string, hour: string) => `${dateLabel}T${hour}-03:00`;

describe("report-periods", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("labelToDate", () => {
    it("interpreta YYYY-MM-DD como meio-dia local (evita virar o dia por fuso)", () => {
      const d = labelToDate("2026-08-15");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(7); // 0-indexed
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(12);
    });
  });

  describe("computeDates", () => {
    it("today: usa o dia comercial atual quando já passou das 03h em SP", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(spIso("2026-08-20", "15:00:00")));
      const { start, end } = computeDates("today");
      expect(start.toISOString()).toBe(new Date(spIso("2026-08-20", "03:00:00")).toISOString());
      expect(end.toISOString()).toBe(new Date(spIso("2026-08-21", "03:00:00")).toISOString());
    });

    it("today: antes das 03h em SP ainda conta como o dia comercial anterior", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(spIso("2026-08-20", "01:30:00")));
      const { start, end } = computeDates("today");
      expect(start.toISOString()).toBe(new Date(spIso("2026-08-19", "03:00:00")).toISOString());
      expect(end.toISOString()).toBe(new Date(spIso("2026-08-20", "03:00:00")).toISOString());
    });

    it("yesterday: dia comercial imediatamente anterior ao de hoje", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(spIso("2026-08-20", "15:00:00")));
      const { start, end } = computeDates("yesterday");
      expect(start.toISOString()).toBe(new Date(spIso("2026-08-19", "03:00:00")).toISOString());
      expect(end.toISOString()).toBe(new Date(spIso("2026-08-20", "03:00:00")).toISOString());
    });

    it("custom: dia comercial completo da data escolhida", () => {
      const { start, end } = computeDates("custom", "2026-08-15");
      expect(start.toISOString()).toBe(new Date(spIso("2026-08-15", "03:00:00")).toISOString());
      expect(end.toISOString()).toBe(new Date(spIso("2026-08-16", "03:00:00")).toISOString());
    });

    it("range: fecha por dia comercial inclusive (De até Até)", () => {
      const { start, end } = computeDates("range", undefined, "2026-08-10", "2026-08-12");
      expect(start.toISOString()).toBe(new Date(spIso("2026-08-10", "03:00:00")).toISOString());
      // inclusive: termina no fim do dia comercial de 12/08 (= início do dia 13/08)
      expect(end.toISOString()).toBe(new Date(spIso("2026-08-13", "03:00:00")).toISOString());
    });

    it("range: um único dia (De === Até) cobre exatamente 1 dia comercial", () => {
      const { start, end } = computeDates("range", undefined, "2026-08-10", "2026-08-10");
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("computePrevDates", () => {
    it("today: período anterior é o dia comercial de ontem", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(spIso("2026-08-20", "15:00:00")));
      const cur = computeDates("yesterday");
      const prev = computePrevDates("today");
      expect(prev.start.toISOString()).toBe(cur.start.toISOString());
      expect(prev.end.toISOString()).toBe(cur.end.toISOString());
    });

    it("range: mesma duração, imediatamente antes do range escolhido", () => {
      const cur = computeDates("range", undefined, "2026-08-10", "2026-08-12");
      const prev = computePrevDates("range", undefined, "2026-08-10", "2026-08-12");
      const durationMs = cur.end.getTime() - cur.start.getTime();
      expect(prev.end.toISOString()).toBe(cur.start.toISOString());
      expect(cur.start.getTime() - prev.start.getTime()).toBe(durationMs);
    });
  });

  describe("isClosedRange", () => {
    it("hoje é um período aberto (ainda pode mudar)", () => {
      const now = new Date(spIso("2026-08-20", "15:00:00"));
      // computeDates("today") não recebe "now" injetado — recalcula com o relógio real,
      // então travamos o relógio antes de chamar.
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const openRange = computeDates("today");
      expect(isClosedRange(openRange, now)).toBe(false);
    });

    it("ontem é um período fechado (não muda mais)", () => {
      const now = new Date(spIso("2026-08-20", "15:00:00"));
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const range = computeDates("yesterday");
      expect(isClosedRange(range, now)).toBe(true);
    });

    it("um range que termina no passado é fechado", () => {
      const now = new Date(spIso("2026-08-20", "15:00:00"));
      const range = computeDates("range", undefined, "2026-08-10", "2026-08-12");
      expect(isClosedRange(range, now)).toBe(true);
    });
  });
});
