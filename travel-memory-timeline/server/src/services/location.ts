const WITH_ZIP = /([A-Za-z][A-Za-z .'-]*),\s*([A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)?),?\s+\d{5}/;
const CITY_STATE = /^\s*([A-Za-z][A-Za-z .'-]*),\s*([A-Z]{2})\s*$/;
// Addresses without a comma after the street ("500 Shore Road Example Beach, Florida 32401").
// "St"/"Dr" are left out because they also mean Saint/Doctor in city names.
const STREET_PREFIX = /^.*\b(?:road|rd|street|blvd|boulevard|avenue|ave|drive|lane|ln|way|pkwy|parkway|highway|hwy)\.?\s+/i;

// "100 Example Blvd, Springfield, IL 62701, USA" -> "Springfield, IL"
export function cityFromAddress(address?: string | null): string | undefined {
  if (!address) return undefined;
  const match = address.match(WITH_ZIP) ?? address.match(CITY_STATE);
  if (!match) return undefined;
  const city = match[1].trim().replace(STREET_PREFIX, "");
  return `${city}, ${match[2]}`;
}
