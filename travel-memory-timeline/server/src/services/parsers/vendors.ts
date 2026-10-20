import { EmailInput, ParsedSignal, VendorParser } from "./types.js";
import { extractDateRange } from "./dateHelpers.js";

function locationFromSubject(subject: string): string | undefined {
  const match = subject.match(/(?:in|at)\s+([A-Z][a-zA-Z.\-' ]{2,40})/);
  return match?.[1]?.trim();
}

function makeDomainVendor(opts: {
  name: string;
  domains: string[];
  keywords: RegExp;
  kind: "hotel" | "flight" | "rental_car" | "shortterm_rental";
  confidence: number;
}): VendorParser {
  return {
    name: opts.name,
    matches: (email) =>
      opts.domains.some((d) => email.from.toLowerCase().includes(d)) &&
      opts.keywords.test(`${email.subject} ${email.snippet}`),
    parse: (email) => {
      const { start, end } = extractDateRange(`${email.subject}\n${email.bodyText}`, email.internalDate);
      if (!start) return null;

      const locationLabel = locationFromSubject(email.subject);
      const label =
        opts.kind === "flight"
          ? "Flight"
          : opts.kind === "hotel"
            ? "Hotel stay"
            : opts.kind === "rental_car"
              ? "Rental car"
              : "Stay";
      const summary = locationLabel ? `${label}: ${locationLabel}` : `${label} (${opts.name})`;

      const signal: ParsedSignal = {
        summary,
        date: start,
        startDate: start,
        endDate: end ?? start,
        locationLabel,
        confidence: opts.confidence,
      };
      return signal;
    },
  };
}

export const vendorParsers: VendorParser[] = [
  makeDomainVendor({
    name: "Airbnb",
    domains: ["@airbnb.com", "@mail.airbnb.com"],
    keywords: /reservation|confirmed|itinerary|check[- ]?in/i,
    kind: "shortterm_rental",
    confidence: 0.8,
  }),
  makeDomainVendor({
    name: "Vrbo",
    domains: ["@vrbo.com", "@homeaway.com"],
    keywords: /reservation|confirmed|itinerary|check[- ]?in/i,
    kind: "shortterm_rental",
    confidence: 0.75,
  }),
  makeDomainVendor({
    name: "Booking.com",
    domains: ["@booking.com"],
    keywords: /confirmed|reservation|your stay/i,
    kind: "hotel",
    confidence: 0.75,
  }),
  makeDomainVendor({
    name: "Marriott",
    domains: ["@marriott.com", "@email-marriott.com"],
    keywords: /reservation|confirmation|your stay/i,
    kind: "hotel",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "Hilton",
    domains: ["@hilton.com"],
    keywords: /reservation|confirmation|your stay/i,
    kind: "hotel",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "Delta",
    domains: ["@delta.com"],
    keywords: /itinerary|confirmation|e[- ]?ticket|boarding pass/i,
    kind: "flight",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "United",
    domains: ["@united.com"],
    keywords: /itinerary|confirmation|e[- ]?ticket|boarding pass/i,
    kind: "flight",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "Southwest",
    domains: ["@southwest.com"],
    keywords: /itinerary|confirmation|check[- ]?in/i,
    kind: "flight",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "American Airlines",
    domains: ["@aa.com"],
    keywords: /itinerary|confirmation|e[- ]?ticket/i,
    kind: "flight",
    confidence: 0.7,
  }),
  makeDomainVendor({
    name: "Rental car",
    domains: ["@enterprise.com", "@hertz.com", "@avis.com", "@budget.com"],
    keywords: /reservation|confirmation|rental/i,
    kind: "rental_car",
    confidence: 0.6,
  }),
];
