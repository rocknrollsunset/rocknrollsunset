import { addDays, daysBetween } from "../dates.js";
import { cityFromAddress } from "../location.js";
import { DetectedSignal } from "./types.js";

const TRAVEL_TITLE = /\b(trip|vacation|getaway|cruise|honeymoon)\b/i;

interface EventTime {
  date?: string | null;
  dateTime?: string | null;
}

export interface CalendarEventLike {
  status?: string | null;
  eventType?: string | null;
  summary?: string | null;
  location?: string | null;
  recurringEventId?: string | null;
  start?: EventTime | null;
  end?: EventTime | null;
}

// Gmail turns hotel and flight confirmations into "Stay at ..." / "Flight to ..." events with
// exact dates, so those anchor trips. Other events with a location only attach to a trip.
export function calendarEventToSignal(event: CalendarEventLike): DetectedSignal | null {
  if (event.status === "cancelled" || event.recurringEventId) return null;

  const startRaw = event.start?.date ?? event.start?.dateTime;
  if (!startRaw) return null;
  const endRaw = event.end?.date ?? event.end?.dateTime;
  const allDay = Boolean(event.start?.date);

  // Taking the first 10 chars keeps the event's local calendar day ("...T19:45:00-06:00").
  const startDay = startRaw.slice(0, 10);
  let endDay = endRaw ? endRaw.slice(0, 10) : startDay;
  if (allDay && endRaw) endDay = addDays(endDay, -1); // all-day end dates are exclusive
  if (endDay < startDay) endDay = startDay;

  const summary = (event.summary ?? "").trim();
  const locationLabel = cityFromAddress(event.location);
  const base = { startDay, endDay, locationLabel };

  if (/^stay at\s+/i.test(summary)) {
    return { ...base, kind: "lodging", isAnchor: true, summary: summary.replace(/^stay at\s+/i, "") };
  }
  if (/^flight\b/i.test(summary)) {
    return { ...base, kind: "flight", isAnchor: true, summary };
  }
  // Gmail-created events are tickets and reservations (a show titled "... Vacation"), so
  // only events the user made themselves can mark a trip by title or length.
  const fromGmail = /^from_?gmail$/i.test(event.eventType ?? "");
  if (!fromGmail && ((allDay && daysBetween(startDay, endDay) >= 1) || TRAVEL_TITLE.test(summary))) {
    return { ...base, kind: "event", isAnchor: true, summary: summary || "Trip" };
  }

  const reservation = /^reservation at\s+/i.test(summary);
  if (!event.location && !reservation) return null;
  return { ...base, kind: reservation ? "reservation" : "event", isAnchor: false, summary: summary || event.location || "" };
}
