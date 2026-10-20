import { addDays, dateToDay, dayToDate, daysBetween, findDate, findDates } from "../dates.js";
import { cityFromAddress } from "../location.js";
import { DetectedSignal, EmailInput, EmailResult } from "./types.js";

const CHECK_IN = /\bcheck[- ]?in\b/gi;
const CHECK_OUT = /\bcheck[- ]?out\b/gi;
const BOOKING_HINT = /confirm|itinerary|reservation|booking|booked/i;
const OTHER_HINT = /confirm|itinerary|reservation|booking|check-?in|boarding pass|stay at|your stay|your trip/i;
const BOOKING_REF = /(?:[Ii]tinerary|[Cc]onfirmation|[Bb]ooking)\s*(?:#|[Nn]umber|[Nn]o\.)?\s*:?\s*([A-Z0-9]{6,})/g;

export function isFromDomain(from: string, domain: string): boolean {
  const sender = from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase() ?? "";
  return sender === domain || sender.endsWith(`.${domain}`);
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function titleCaseIfShouting(text: string): string {
  if (/[a-z]/.test(text)) return text;
  return text.toLowerCase().replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase());
}

function bookingRef(text: string): string | undefined {
  for (const m of text.matchAll(BOOKING_REF)) {
    if (/\d/.test(m[1])) return m[1];
  }
  return undefined;
}

function dateAfter(
  label: RegExp,
  text: string,
  reference: Date,
  accept: (day: string) => boolean = () => true
): string | undefined {
  for (const m of text.matchAll(label)) {
    const start = (m.index ?? 0) + m[0].length;
    const day = findDates(text.slice(start, start + 80), reference).find(accept);
    if (day) return day;
  }
  return undefined;
}

// Handles both "Check-in / date / Check-out / date" and side-by-side layouts
// ("Check-in / Check-out / Fri, Apr 5 / Sat, Apr 13") by taking the first date after check-in.
function stayFromBody(text: string, reference: Date): { startDay: string; endDay: string } | undefined {
  const startDay = dateAfter(CHECK_IN, text, reference);
  if (!startDay) return undefined;
  const endDay = dateAfter(CHECK_OUT, text, dayToDate(startDay), (day) => day > startDay);
  if (!endDay) return undefined;
  return daysBetween(startDay, endDay) <= 30 ? { startDay, endDay } : undefined;
}

function hotelName(subject: string, body: string): string | undefined {
  const fromItinerary = body.match(/([^\n]+?)\s*\n\s*(?:Hotels\.com|Expedia) itinerary/i)?.[1];
  const fromContact = body.match(/reserved room or the property,?\s+contact\s+([^\n]+?)\.?\s*\n/i)?.[1];
  const fromSubject = subject.match(/\b(?:stay|reservation) at\s+(.+?)(?:\s+[-|(]|$)/i)?.[1];
  const name = (fromItinerary ?? fromContact ?? fromSubject)?.trim();
  return name ? titleCaseIfShouting(decodeEntities(name)) : undefined;
}

function signal(s: DetectedSignal): EmailResult {
  return { type: "signal", signal: s };
}

export function parseEmail(email: EmailInput): EmailResult | null {
  const subject = decodeEntities(email.subject);
  const body = email.bodyText;
  const ref = bookingRef(`${subject}\n${body}`);

  if (/cancel(?:l)?(?:ation|ed)/i.test(subject)) {
    return ref ? { type: "cancellation", bookingRef: ref } : null;
  }

  // "Your FRIDAY JUNE 7, 2024 - SUNDAY JUNE 9, 2024 Stay at HOTEL NAME" (post-stay folios)
  const explicitStay = subject.match(/^Your\s+(.+?)\s+-\s+(.+?)\s+Stay at\s+(.+)$/i);
  if (explicitStay) {
    const startDay = findDate(explicitStay[1], email.internalDate);
    const endDay = findDate(explicitStay[2], email.internalDate);
    if (startDay && endDay && endDay > startDay) {
      return signal({
        kind: "lodging",
        isAnchor: true,
        summary: titleCaseIfShouting(explicitStay[3].trim()),
        startDay,
        endDay,
        locationLabel: cityFromAddress(body),
        bookingRef: ref,
      });
    }
  }

  if (isFromDomain(email.from, "southwest.com")) {
    const flight = subject.match(/going to (.+?) on (\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    const day = flight ? findDate(flight[2], email.internalDate) : undefined;
    if (flight && day) {
      return signal({
        kind: "flight",
        isAnchor: true,
        summary: `Flight to ${flight[1].trim()}`,
        startDay: day,
        endDay: day,
        bookingRef: subject.match(/\(([A-Z0-9]{6})\)/)?.[1],
      });
    }
  }

  if (BOOKING_HINT.test(subject)) {
    const stay = stayFromBody(body, email.internalDate);
    if (stay) {
      return signal({
        kind: "lodging",
        isAnchor: true,
        summary: hotelName(subject, body) ?? subject,
        ...stay,
        locationLabel: cityFromAddress(body),
        bookingRef: ref,
      });
    }

    // Fallback when the body layout changes: the subject still carries the check-in date.
    const travelSite = subject.match(/(?:Hotels\.com|Expedia) travel confirmation - (.+?) - /i);
    const checkIn = travelSite ? findDate(travelSite[1], email.internalDate) : undefined;
    if (checkIn) {
      return signal({
        kind: "lodging",
        isAnchor: true,
        summary: hotelName(subject, body) ?? subject,
        startDay: checkIn,
        endDay: addDays(checkIn, 1),
        locationLabel: cityFromAddress(body),
        bookingRef: ref,
      });
    }
  }

  if (OTHER_HINT.test(subject)) {
    const day = dateToDay(email.internalDate);
    return signal({ kind: "email", isAnchor: false, summary: subject, startDay: day, endDay: day });
  }

  return null;
}
