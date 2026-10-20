import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";

export async function scanDrivePhotos(auth: OAuth2Client, sinceYears: number) {
  const drive = google.drive({ version: "v3", auth });
  const afterDate = new Date();
  afterDate.setFullYear(afterDate.getFullYear() - sinceYears);

  let pageToken: string | undefined;
  let scanned = 0;
  let matched = 0;

  do {
    const list = await drive.files.list({
      q: "mimeType contains 'image/' and trashed = false",
      fields: "nextPageToken, files(id, name, imageMediaMetadata, createdTime)",
      pageToken,
      pageSize: 200,
    });

    const files = list.data.files ?? [];
    for (const file of files) {
      if (!file.id) continue;
      scanned += 1;

      const taken = file.imageMediaMetadata?.time
        ? new Date(file.imageMediaMetadata.time)
        : file.createdTime
          ? new Date(file.createdTime)
          : null;
      if (!taken || taken < afterDate) continue;

      // Only geotagged photos count as trip signals for now -- home photos would
      // otherwise swamp every cluster near your own city.
      const location = file.imageMediaMetadata?.location;
      if (!location) continue;

      const exists = await prisma.signal.findUnique({
        where: { type_sourceId: { type: "photo", sourceId: file.id } },
      });
      if (exists) continue;

      await prisma.signal.create({
        data: {
          type: "photo",
          sourceId: file.id,
          summary: file.name || "Photo",
          date: taken,
          confidence: 0.5,
          rawMeta: JSON.stringify({ lat: location.latitude, lng: location.longitude }),
        },
      });
      matched += 1;
    }

    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  await prisma.syncState.upsert({
    where: { service: "drive" },
    create: { service: "drive", lastSyncedAt: new Date() },
    update: { lastSyncedAt: new Date() },
  });

  return { scanned, matched };
}
