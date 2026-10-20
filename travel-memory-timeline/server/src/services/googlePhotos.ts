import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { dateToDay, dayToDate } from "./dates.js";
import { findTripForDay } from "./grouping.js";
import {
  PickedMediaItem,
  photoFileName,
  pickedPhotos,
  pollIntervalMs,
  sniffImageExtension,
} from "./parsers/googlePhotos.js";

const PICKER_API = "https://photospicker.googleapis.com/v1";
export const PHOTO_DIR = path.resolve(process.env.PHOTO_DIR ?? "data/photos");

// The OAuth client's request() adds the bearer token and refreshes it when needed.
export interface AuthorizedHttp {
  request<T = unknown>(opts: {
    url: string;
    method?: "GET" | "POST" | "DELETE";
    data?: unknown;
    params?: Record<string, unknown>;
    responseType?: "json" | "arraybuffer";
  }): Promise<{ data: T }>;
}

interface PickingSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string };
}

export interface ImportResult {
  imported: number;
  outsideTrips: number;
  unsupported: number;
  videosSkipped: number;
}

function sessionUrl(sessionId: string): string {
  return `${PICKER_API}/sessions/${encodeURIComponent(sessionId)}`;
}

export async function createPickerSession(http: AuthorizedHttp) {
  const { data } = await http.request<PickingSession>({ url: `${PICKER_API}/sessions`, method: "POST", data: {} });
  return {
    sessionId: data.id,
    pickerUri: `${data.pickerUri}/autoclose`,
    pollIntervalMs: pollIntervalMs(data.pollingConfig?.pollInterval),
  };
}

export async function pickerSessionReady(http: AuthorizedHttp, sessionId: string): Promise<boolean> {
  const { data } = await http.request<PickingSession>({ url: sessionUrl(sessionId) });
  return Boolean(data.mediaItemsSet);
}

async function listPickedItems(http: AuthorizedHttp, sessionId: string): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await http.request<{ mediaItems?: PickedMediaItem[]; nextPageToken?: string }>({
      url: `${PICKER_API}/mediaItems`,
      params: { sessionId, pageSize: 100, pageToken },
    });
    items.push(...(data.mediaItems ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

// With a tripId every picked photo goes to that trip; otherwise each photo goes to the trip
// it was taken during, and photos from outside any trip are skipped without downloading.
export async function importPickedPhotos(
  http: AuthorizedHttp,
  sessionId: string,
  tripId: string | undefined,
  onProgress: (done: number, total: number) => void
): Promise<ImportResult> {
  const trips = (
    await prisma.trip.findMany({ where: tripId ? { id: tripId } : { status: { not: "dismissed" } } })
  ).map((t) => ({ id: t.id, startDay: dateToDay(t.startDate), endDay: dateToDay(t.endDate) }));
  if (tripId && trips.length === 0) throw new Error("Trip not found");

  const { photos, videos } = pickedPhotos(await listPickedItems(http, sessionId));
  await mkdir(PHOTO_DIR, { recursive: true });

  const result: ImportResult = { imported: 0, outsideTrips: 0, unsupported: 0, videosSkipped: videos };
  let done = 0;
  onProgress(done, photos.length);

  for (const photo of photos) {
    const trip = tripId ? trips[0] : photo.day ? findTripForDay(trips, photo.day, 0) : undefined;
    if (!trip) {
      result.outsideTrips += 1;
    } else {
      const { data } = await http.request<ArrayBuffer>({ url: photo.downloadUrl, responseType: "arraybuffer" });
      const bytes = new Uint8Array(data);
      const extension = sniffImageExtension(bytes);
      if (!extension) {
        result.unsupported += 1;
      } else {
        const fileName = photoFileName(photo.id, extension);
        await writeFile(path.join(PHOTO_DIR, fileName), bytes);
        await prisma.signal.upsert({
          where: { type_sourceId: { type: "gphotos", sourceId: photo.id } },
          create: {
            type: "gphotos",
            sourceId: photo.id,
            kind: "photo",
            summary: photo.filename,
            date: dayToDate(photo.day ?? trip.startDay),
            tripId: trip.id,
            filePath: fileName,
          },
          update: { tripId: trip.id, filePath: fileName },
        });
        result.imported += 1;
      }
    }
    done += 1;
    onProgress(done, photos.length);
  }

  await http.request({ url: sessionUrl(sessionId), method: "DELETE" }).catch(() => undefined);
  return result;
}

export function storedPhotoPath(filePath: string): string | undefined {
  const full = path.resolve(PHOTO_DIR, filePath);
  return full.startsWith(PHOTO_DIR + path.sep) ? full : undefined;
}
