import { EmailInput, ParsedSignal } from "./types.js";
import { vendorParsers } from "./vendors.js";
import { genericParse } from "./generic.js";

export function parseEmail(email: EmailInput): ParsedSignal | null {
  for (const vendor of vendorParsers) {
    if (vendor.matches(email)) {
      const parsed = vendor.parse(email);
      if (parsed) return parsed;
    }
  }
  return genericParse(email);
}

export * from "./types.js";
