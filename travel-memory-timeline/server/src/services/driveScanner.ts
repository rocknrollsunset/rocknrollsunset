import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";
import { dateToDay, dayToDate } from "./dates.js";
import { findTripForDay } from "./grouping.js";
import { photoTakenDay } from "./parsers/photo.js";

// Photos never create trips; they attach to a trip whose dates they were taken within.
export async function attachDrivePhotos(auth: OAuth2Client, sinceYears: number) {
  const trips = (await prisma.trip.findMany({ where: { status: { not: "dismissed" } } })).map((t) => ({
    id: t.id,
    startDay: dateToDay(t.startDate),
    endDay: dateToDay(t.endDate),
  }));
  if (trips.length === 0) return { scanned: 0, attached: 0 };

  const drive = google.drive({ version: "v3", auth });
  const afterDate = new Date();
  afterDate.setFullYear(afterDate.getFullYear() - sinceYears);

  let pageToken: string | undefined;
  let scanned = 0;
  let attached = 0;

  do {
    const list = await drive.files.list({
      q: `mimeType contains 'image/' and trashed = false and createdTime > '${afterDate.toISOString()}'`,
      fields: "nextPageToken, files(id, name, createdTime, imageMediaMetadata(time))",
      pageSize: 1000,
      pageToken,
    });

    for (const file of list.data.files ?? []) {
      if (!file.id) continue;
      scanned += 1;

      const day = photoTakenDay(file);
      const trip = day ? findTripForDay(trips, day, 0) : undefined;
      if (!day || !trip) continue;

      await prisma.signal.upsert({
        where: { type_sourceId: { type: "photo", sourceId: file.id } },
        create: {
          type: "photo",
          sourceId: file.id,
          kind: "photo",
          summary: file.name || "Photo",
          date: dayToDate(day),
          tripId: trip.id,
        },
        update: {},
      });
      attached += 1;
    }

    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  await prisma.syncState.upsert({
    where: { service: "drive" },
    create: { service: "drive", lastSyncedAt: new Date() },
    update: { lastSyncedAt: new Date() },
  });

  return { scanned, attached };
}
