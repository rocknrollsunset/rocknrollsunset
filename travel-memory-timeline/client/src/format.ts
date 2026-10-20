// The server stores each day as noon UTC, so formatting in UTC shows the intended calendar day.
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRange(start: string, end: string): string {
  return start.slice(0, 10) === end.slice(0, 10) ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}
