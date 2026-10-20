export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  bodyText: string;
  internalDate: Date;
}

export interface ParsedSignal {
  summary: string;
  date: Date;
  startDate?: Date;
  endDate?: Date;
  locationLabel?: string;
  confidence: number;
}

export interface VendorParser {
  name: string;
  matches: (email: EmailInput) => boolean;
  parse: (email: EmailInput) => ParsedSignal | null;
}
