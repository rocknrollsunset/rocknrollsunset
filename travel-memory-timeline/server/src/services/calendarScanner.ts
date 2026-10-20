import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";
import { calendarEventToSignal } from "./parsers/calendar.js";
import { saveSignal } from "./signalStore.js";

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

    for (const event of list.data.items ?? []) {
      if (!event.id) continue;
      scanned += 1;

      const signal = calendarEventToSignal(event);
      if (!signal) continue;

      await saveSignal("calendar", event.id, signal, { location: event.location, eventType: event.eventType });
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
