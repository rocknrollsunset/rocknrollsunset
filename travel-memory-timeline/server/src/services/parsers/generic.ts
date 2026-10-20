import { EmailInput, ParsedSignal } from "./types.js";
import { extractDateRange } from "./dateHelpers.js";

const TRAVEL_KEYWORDS =
  /\b(itinerary|reservation|confirmation|check[- ]?in|check[- ]?out|boarding pass|your trip|your stay|booking confirmed)\b/i;

export function genericParse(email: EmailInput): ParsedSignal | null {
  const text = `${email.subject}\n${email.snippet}\n${email.bodyText}`;
  if (!TRAVEL_KEYWORDS.test(text)) return null;

  const { start, end } = extractDateRange(text, email.internalDate);
  if (!start) return null;

  return {
    summary: email.subject || "Travel-related email",
    date: start,
    startDate: start,
    endDate: end ?? start,
    confidence: 0.35,
  };
}
