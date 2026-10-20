import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Trip } from "../api";
import { formatRange } from "../format";
import { describeImport, pickFromGooglePhotos } from "../googlePhotos";

export default function Timeline() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await api.listTrips();
    setTrips(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function connectGoogle() {
    window.location.href = "/auth/google";
  }

  async function runBackfill() {
    setBackfillRunning(true);
    setBackfillError(null);
    try {
      await api.startBackfill(6);
      let status = await api.backfillStatus();
      while (status.running) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        status = await api.backfillStatus();
      }
      if (status.lastError) setBackfillError(status.lastError);
      await load();
    } catch (err) {
      setBackfillError((err as Error).message);
    } finally {
      setBackfillRunning(false);
    }
  }

  async function importPhotos() {
    setPhotoBusy(true);
    setPhotoStatus(null);
    try {
      const result = await pickFromGooglePhotos(undefined, setPhotoStatus);
      setPhotoStatus(describeImport(result));
      await load();
    } catch (err) {
      setPhotoStatus((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function confirmTrip(id: string) {
    await api.updateTrip(id, { status: "confirmed" });
    load();
  }

  async function dismissTrip(id: string) {
    await api.updateTrip(id, { status: "dismissed" });
    load();
  }

  const suggested = trips.filter((t) => t.status === "suggested");
  const confirmed = trips.filter((t) => t.status === "confirmed");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <button onClick={connectGoogle} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Connect Google Account
        </button>
        <button
          onClick={runBackfill}
          disabled={backfillRunning}
          className="rounded border border-slate-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          {backfillRunning ? "Scanning last 6 years..." : "Run 6-year backfill scan"}
        </button>
        <button
          onClick={importPhotos}
          disabled={photoBusy}
          className="rounded border border-slate-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          {photoBusy ? "Importing photos..." : "Import from Google Photos"}
        </button>
      </div>
      {backfillError && <p className="text-sm text-rose-700">{backfillError}</p>}
      {photoStatus && <p className="text-sm text-slate-600">{photoStatus}</p>}
      {!photoStatus && (
        <p className="text-sm text-slate-500">
          Google Photos only shares the photos you pick. Select photos from any of your trips and each one is filed
          under the trip it was taken during.
        </p>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {suggested.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Needs review ({suggested.length})
              </h2>
              <ul className="space-y-3">
                {suggested.map((trip) => (
                  <li key={trip.id} className="rounded border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <Link to={`/trips/${trip.id}`} className="font-medium hover:underline">
                        {trip.title}
                      </Link>
                      <div className="flex gap-2 text-sm">
                        <button onClick={() => confirmTrip(trip.id)} className="text-emerald-700">
                          Confirm
                        </button>
                        <button onClick={() => dismissTrip(trip.id)} className="text-rose-700">
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatRange(trip.startDate, trip.endDate)}
                      {trip.locationLabel ? ` · ${trip.locationLabel}` : ""} · {trip.signals.length} item
                      {trip.signals.length === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
            <ul className="space-y-3">
              {confirmed.map((trip) => (
                <li key={trip.id} className="rounded border bg-white p-4">
                  <Link to={`/trips/${trip.id}`} className="font-medium hover:underline">
                    {trip.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {formatRange(trip.startDate, trip.endDate)}
                    {trip.locationLabel ? ` · ${trip.locationLabel}` : ""}
                  </p>
                </li>
              ))}
              {confirmed.length === 0 && <p className="text-sm text-slate-500">No confirmed trips yet.</p>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
