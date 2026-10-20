const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const TEXT_DATE =
  /\b(?:(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:,?\s+(\d{4})(?!\d))?/gi;
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?!\d)/g;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

export function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return dateToDay(new Date(dayToDate(day).getTime() + n * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToDate(to).getTime() - dayToDate(from).getTime()) / DAY_MS);
}

function toDay(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = dayToDate(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return dateToDay(date) === iso ? iso : undefined;
}

// Booking emails describe upcoming dates, so a date without a year ("Fri, Jan 12") resolves to
// its next occurrence after the email was sent; a weekday picks between candidate years.
export function resolveYear(month: number, day: number, reference: Date, weekday?: number): string | undefined {
  const earliest = addDays(dateToDay(reference), -2);
  const year = reference.getUTCFullYear();
  const candidates = [year, year + 1]
    .map((y) => toDay(y, month, day))
    .filter((d): d is string => d !== undefined && d >= earliest);
  if (weekday !== undefined) {
    const match = candidates.find((d) => dayToDate(d).getUTCDay() === weekday);
    if (match) return match;
  }
  return candidates[0];
}

// Every date in the text, in the order it appears.
export function findDates(text: string, reference: Date): string[] {
  const found: { index: number; day: string }[] = [];

  for (const m of text.matchAll(TEXT_DATE)) {
    const month = MONTHS[m[2].toLowerCase()];
    const weekday = m[1] ? WEEKDAYS[m[1].toLowerCase()] : undefined;
    const day = m[4] ? toDay(Number(m[4]), month, Number(m[3])) : resolveYear(month, Number(m[3]), reference, weekday);
    if (day) found.push({ index: m.index ?? 0, day });
  }

  for (const m of text.matchAll(NUMERIC_DATE)) {
    const year = m[3] ? Number(m[3]) : undefined;
    const day = year
      ? toDay(year < 100 ? 2000 + year : year, Number(m[1]), Number(m[2]))
      : resolveYear(Number(m[1]), Number(m[2]), reference);
    if (day) found.push({ index: m.index ?? 0, day });
  }

  for (const m of text.matchAll(ISO_DATE)) {
    const day = toDay(Number(m[1]), Number(m[2]), Number(m[3]));
    if (day) found.push({ index: m.index ?? 0, day });
  }

  return found.sort((a, b) => a.index - b.index).map((f) => f.day);
}

export function findDate(text: string, reference: Date): string | undefined {
  return findDates(text, reference)[0];
}
