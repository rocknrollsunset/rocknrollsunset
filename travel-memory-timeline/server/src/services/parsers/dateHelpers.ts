import * as chrono from "chrono-node";

export function extractDateRange(text: string, referenceDate: Date): { start?: Date; end?: Date } {
  const results = chrono.parse(text, referenceDate, { forwardDate: false });
  if (results.length === 0) return {};

  const dates = results
    .map((r) => r.start?.date())
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return {};
  if (dates.length === 1) return { start: dates[0], end: dates[0] };
  return { start: dates[0], end: dates[dates.length - 1] };
}
