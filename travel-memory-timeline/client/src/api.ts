export interface Signal {
  id: string;
  type: string;
  summary: string;
  date: string;
  confidence: number;
  rawMeta: string | null;
}

export interface JournalEntry {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  title: string;
  locationLabel: string | null;
  startDate: string;
  endDate: string;
  status: string;
  signals: Signal[];
  journalEntries: JournalEntry[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listTrips: (status?: string) => request<Trip[]>(`/api/trips${status ? `?status=${status}` : ""}`),
  getTrip: (id: string) => request<Trip>(`/api/trips/${id}`),
  updateTrip: (id: string, data: Partial<Trip>) =>
    request<Trip>(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTrip: (id: string) => request<void>(`/api/trips/${id}`, { method: "DELETE" }),
  addJournalEntry: (tripId: string, body: string) =>
    request<JournalEntry>(`/api/journal/${tripId}`, { method: "POST", body: JSON.stringify({ body }) }),
  runBackfill: (years: number) =>
    request<unknown>(`/api/backfill/run`, { method: "POST", body: JSON.stringify({ years }) }),
};
