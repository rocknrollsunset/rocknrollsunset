import { api, PhotoImportResult } from "./api";

const GIVE_UP_AFTER_MS = 30 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Must be called straight from a click handler: the window is opened before any await so
// pop-up blockers allow it, then pointed at Google Photos once the session exists.
export async function pickFromGooglePhotos(
  tripId: string | undefined,
  onStatus: (message: string) => void
): Promise<PhotoImportResult | null> {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Your browser blocked the Google Photos window. Allow pop-ups for this site and try again.");

  let session;
  try {
    session = await api.startPhotoPicker();
  } catch (err) {
    popup.close();
    throw err;
  }
  popup.location.href = session.pickerUri;
  onStatus("Choose photos in the Google Photos tab, then click Done.");

  const deadline = Date.now() + GIVE_UP_AFTER_MS;
  let pollsSinceClosed = 0;
  while (Date.now() < deadline) {
    await sleep(session.pollIntervalMs);
    const status = await api.syncPickedPhotos(session.sessionId, tripId);
    if (status.state === "error") throw new Error(status.error ?? "Import failed");
    if (status.state === "done") return status.result ?? null;
    if (status.state === "importing") {
      onStatus(`Saving photos… ${status.done ?? 0} of ${status.total ?? 0}`);
    } else if (popup.closed && ++pollsSinceClosed > 2) {
      return null;
    }
  }
  return null;
}

export function describeImport(result: PhotoImportResult | null): string {
  if (!result) return "No photos were picked.";
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [`Added ${count(result.imported, "photo", "photos")}.`];
  if (result.outsideTrips) {
    parts.push(`${count(result.outsideTrips, "photo wasn't", "photos weren't")} taken during a trip.`);
  }
  if (result.videosSkipped) parts.push(`${count(result.videosSkipped, "video", "videos")} skipped.`);
  if (result.unsupported) {
    parts.push(`${count(result.unsupported, "photo was", "photos were")} in a format browsers can't show (like HEIC).`);
  }
  return parts.join(" ");
}
