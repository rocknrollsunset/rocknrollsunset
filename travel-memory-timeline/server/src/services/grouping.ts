import { addDays } from "./dates.js";

export interface AnchorInput {
  id: string;
  kind: string;
  summary: string;
  startDay: string;
  endDay: string;
  locationLabel?: string | null;
}

// Checking out of one hotel and into the next the same or following day is one trip.
export function groupAnchors<T extends AnchorInput>(anchors: T[]): T[][] {
  const sorted = [...anchors].sort((a, b) => a.startDay.localeCompare(b.startDay));
  const groups: T[][] = [];
  let groupEnd = "";

  for (const anchor of sorted) {
    const current = groups[groups.length - 1];
    if (current && anchor.startDay <= addDays(groupEnd, 1)) {
      current.push(anchor);
      if (anchor.endDay > groupEnd) groupEnd = anchor.endDay;
    } else {
      groups.push([anchor]);
      groupEnd = anchor.endDay;
    }
  }
  return groups;
}

// Keeps the most specific of near-duplicate names ("Example Lodge" vs "Grand Example Lodge").
function distinct(values: string[]): string[] {
  const kept: string[] = [];
  for (const value of values) {
    const lower = value.toLowerCase();
    const existing = kept.findIndex((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
    if (existing === -1) kept.push(value);
    else if (value.length > kept[existing].length) kept[existing] = value;
  }
  return kept;
}

export function tripTitle(group: AnchorInput[]): string {
  const lodging = group.filter((a) => a.kind === "lodging");
  const names = distinct((lodging.length > 0 ? lodging : group).map((a) => a.summary.trim()).filter(Boolean));
  return names.slice(0, 3).join(" → ") || "Trip";
}

export function tripLocation(group: AnchorInput[]): string | undefined {
  const labels = distinct(group.map((a) => a.locationLabel ?? "").filter(Boolean));
  return labels.length > 0 ? labels.join(" → ") : undefined;
}

export function findTripForDay<T extends { startDay: string; endDay: string }>(
  trips: T[],
  day: string,
  slackDays: number
): T | undefined {
  return trips.find((t) => day >= addDays(t.startDay, -slackDays) && day <= addDays(t.endDay, slackDays));
}
