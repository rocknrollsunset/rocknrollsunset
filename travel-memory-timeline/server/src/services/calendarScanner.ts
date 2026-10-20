import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";

const TRAVEL_TITLE_KEYWORDS = /\b(trip|vacation|getaway|cabin|lodge|resort|flight|cruise)\b/i;

export async function scanCalendar(auth: OAuth2Client, sinceYears: number) {
  const calendar = google.calendar({ version: "v3", auth });
  const timeMin = new Date();
  timeMin.setFullYear(timeMin.getFullYear() - sinceYears);

  let pageToken: string | undefined;
  let scanned = 0;
  let matched = 0;

  do {
    const list = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: new Date().toISOString(),
      singleEvents: true,
      maxResults: 250,
      pageToken,
    });

    const events = list.data.items ?? [];
    for (const event of events) {
      if (!event.id) continue;
      scanned += 1;

      const hasLocation = Boolean(event.location);
      const titleMatches = TRAVEL_TITLE_KEYWORDS.test(event.summary ?? "");
      if (!hasLocation && !titleMatches) continue;

      const exists = await prisma.signal.findUnique({
        where: { type_sourceId: { type: "calendar", sourceId: event.id } },
      });
      if (exists) continue;

      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      if (!start) continue;

      await prisma.signal.create({
        data: {
          type: "calendar",
          sourceId: event.id,
          summary: event.summary || "Calendar event",
          date: new Date(start),
          confidence: hasLocation ? 0.6 : 0.4,
          rawMeta: JSON.stringify({ location: event.location, start, end }),
        },
      });
      matched += 1;
    }

    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  await prisma.syncState.upsert({
    where: { service: "calendar" },
    create: { service: "calendar", lastSyncedAt: new Date() },
    update: { lastSyncedAt: new Date() },
  });

  return { scanned, matched };
}
