import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db.js";
import { parseEmail } from "./parsers/index.js";

const SEARCH_QUERY =
  '(subject:(itinerary OR reservation OR confirmation OR "check-in" OR "boarding pass" OR "your stay" OR "your trip") OR from:(airbnb.com OR vrbo.com OR booking.com OR marriott.com OR hilton.com OR delta.com OR united.com OR southwest.com OR aa.com OR enterprise.com OR hertz.com OR avis.com OR budget.com))';

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function scanGmail(auth: OAuth2Client, sinceYears: number) {
  const gmail = google.gmail({ version: "v1", auth });
  const afterDate = new Date();
  afterDate.setFullYear(afterDate.getFullYear() - sinceYears);
  const after = Math.floor(afterDate.getTime() / 1000);

  let pageToken: string | undefined;
  let scanned = 0;
  let matched = 0;

  do {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: `${SEARCH_QUERY} after:${after}`,
      pageToken,
      maxResults: 100,
    });

    const messages = list.data.messages ?? [];
    for (const msg of messages) {
      if (!msg.id) continue;
      scanned += 1;

      const exists = await prisma.signal.findUnique({
        where: { type_sourceId: { type: "email", sourceId: msg.id } },
      });
      if (exists) continue;

      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const headers = full.data.payload?.headers;
      const email = {
        id: msg.id,
        from: header(headers, "From"),
        subject: header(headers, "Subject"),
        snippet: full.data.snippet ?? "",
        bodyText: extractPlainText(full.data.payload),
        internalDate: full.data.internalDate ? new Date(Number(full.data.internalDate)) : new Date(),
      };

      const parsed = parseEmail(email);
      if (!parsed) continue;

      await prisma.signal.create({
        data: {
          type: "email",
          sourceId: msg.id,
          summary: parsed.summary,
          date: parsed.date,
          confidence: parsed.confidence,
          rawMeta: JSON.stringify({
            from: email.from,
            subject: email.subject,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            locationLabel: parsed.locationLabel,
          }),
        },
      });
      matched += 1;
    }

    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  await prisma.syncState.upsert({
    where: { service: "gmail" },
    create: { service: "gmail", lastSyncedAt: new Date() },
    update: { lastSyncedAt: new Date() },
  });

  return { scanned, matched };
}
