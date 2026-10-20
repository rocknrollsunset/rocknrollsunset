export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  bodyText: string;
  internalDate: Date;
}

export type SignalKind = "lodging" | "flight" | "reservation" | "event" | "email";

export interface DetectedSignal {
  kind: SignalKind;
  isAnchor: boolean;
  summary: string;
  startDay: string;
  endDay: string;
  locationLabel?: string;
  bookingRef?: string;
}

export type EmailResult =
  | { type: "signal"; signal: DetectedSignal }
  | { type: "cancellation"; bookingRef: string };
