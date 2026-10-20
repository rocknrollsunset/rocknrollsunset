import { createHash } from "node:crypto";

export interface PickedMediaItem {
  id?: string;
  createTime?: string;
  type?: string;
  mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string };
}

export interface PickedPhoto {
  id: string;
  filename: string;
  day?: string;
  downloadUrl: string;
}

// A 2048px rendition instead of the original keeps a multi-year archive a manageable size.
const PHOTO_SIZE = "=w2048-h2048";

export function pickedPhotos(items: PickedMediaItem[]): { photos: PickedPhoto[]; videos: number } {
  const photos: PickedPhoto[] = [];
  let videos = 0;
  for (const item of items) {
    if (item.type === "VIDEO") {
      videos += 1;
      continue;
    }
    const baseUrl = item.mediaFile?.baseUrl;
    if (item.type !== "PHOTO" || !item.id || !baseUrl) continue;
    photos.push({
      id: item.id,
      filename: item.mediaFile?.filename || "Photo",
      // createTime is when the photo was taken, in UTC.
      day: item.createTime?.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
      downloadUrl: `${baseUrl}${PHOTO_SIZE}`,
    });
  }
  return { photos, videos };
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

// Only formats a browser can display are kept (HEIC originals, for example, are not).
export function sniffImageExtension(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (ascii(bytes, 0, 4) === "\x89PNG") return "png";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return undefined;
}

// Media item IDs are long opaque strings; hashing gives a safe, stable filename.
export function photoFileName(mediaItemId: string, extension: string): string {
  return `${createHash("sha256").update(mediaItemId).digest("hex").slice(0, 32)}.${extension}`;
}

// The Picker API reports durations like "5s".
export function pollIntervalMs(pollInterval?: string): number {
  const seconds = pollInterval ? Number(pollInterval.replace(/s$/, "")) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1000, Math.round(seconds * 1000)) : 5000;
}
