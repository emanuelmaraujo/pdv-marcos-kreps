// Marcos Krep's business day runs from 03:00 to 02:59:59 in America/Sao_Paulo.
// Orders created between 00:00 and 02:59 count toward the previous calendar day.

const TZ = "America/Sao_Paulo";
const BUSINESS_DAY_START_HOUR = 3;
const SP_OFFSET = "-03:00"; // Brazil has not observed DST since 2019

interface SpParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function spParts(date: Date): SpParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface BusinessDayRange {
  start: Date;
  end: Date;
  label: string;
}

export function getBusinessDayRange(reference: Date = new Date()): BusinessDayRange {
  const sp = spParts(reference);
  let year = sp.year;
  let month = sp.month;
  let day = sp.day;

  if (sp.hour < BUSINESS_DAY_START_HOUR) {
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }

  const label = `${year}-${pad(month)}-${pad(day)}`;
  const start = new Date(`${label}T03:00:00${SP_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, label };
}

// Hour 0–23 in America/Sao_Paulo of an arbitrary instant.
export function getSpHour(date: Date): number {
  return spParts(date).hour;
}
