import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Trip } from "../api";

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    if (!id) return;
    const data = await api.getTrip(id);
    setTrip(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitJournal() {
    if (!id || !draft.trim()) return;
    await api.addJournalEntry(id, draft.trim());
    setDraft("");
    load();
  }

  if (!trip) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{trip.title}</h1>
        <p className="text-slate-500">
          {new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Detected signals</h2>
        <ul className="space-y-2">
          {trip.signals.map((signal) => (
            <li key={signal.id} className="rounded border bg-white p-3 text-sm">
              <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">{signal.type}</span>
              {signal.summary}
              <span className="ml-2 text-slate-400">{new Date(signal.date).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Journal</h2>
        <ul className="mb-3 space-y-2">
          {trip.journalEntries.map((entry) => (
            <li key={entry.id} className="rounded border bg-white p-3 text-sm">
              {entry.body}
            </li>
          ))}
        </ul>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What happened on this trip?"
          className="w-full rounded border p-2 text-sm"
          rows={3}
        />
        <button onClick={submitJournal} className="mt-2 rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Add journal entry
        </button>
      </section>
    </div>
  );
}
