# Travel Memory Timeline

Pulls hotel/flight confirmation emails, calendar events, and your Google Photos and
Google Drive pictures into a single timeline of your trips, with a journal entry per trip.

## How it works

1. **Find anchors.** Hotel stays and flights define a trip's dates. They come from:
   - Google Calendar's auto-created "Stay at …" / "Flight to …" events (Gmail makes
     these from confirmation emails, with exact dates and addresses).
   - Confirmation emails, for older bookings that never got a calendar event:
     Hotels.com/Expedia check-in/check-out, hotel folio subjects ("Your FRIDAY
     JUNE 7, 2024 - SUNDAY JUNE 9, 2024 Stay at …"), and Southwest flights.
     Cancellation emails remove the booking they cancel.
2. **Group.** Overlapping or back-to-back anchors become one trip (checking out of one
   hotel and into the next is a single road trip).
3. **Attach.** Restaurant reservations, shows, and travel emails that fall inside a
   trip's dates attach to it. They never create a trip on their own, so movie nights
   and local concerts stay off the timeline. Google Drive photos attach by the day
   they were taken (EXIF time, then camera filename), no GPS needed.
4. **Review.** Every detected trip starts as "suggested." You confirm or dismiss it.
5. **Add Google Photos.** Google only lets apps see photos you pick in its own picker
   (since March 2025 no app can scan a whole library). Two ways in:
   - **Import from Google Photos** on the timeline: pick photos from any number of
     trips (up to 2,000 at a time) and each is filed under the trip it was taken
     during. Photos from outside any trip are skipped without downloading.
   - **Add from Google Photos** on a trip: everything you pick goes to that trip.

   Picked photos are saved locally at 2048px (in `server/data/photos/`) because
   Google's links to them expire after an hour. Videos are skipped for now.
6. **Journal.** Add notes to any trip alongside what was found.

## Known limitations (read before you run the 6-year backfill)

- **Trips without a hotel or flight email are missed.** A day trip, or a stay with
  family, has nothing to anchor it. A restaurant reservation in another city doesn't
  create a trip yet, since the app doesn't know where home is.
- **Google Photos needs you to pick.** The backfill scan can't reach Google Photos,
  and the picker can't be pre-filtered to a trip's dates, so you browse or search
  (by place or date) inside it. HEIC originals that Google doesn't convert, and
  videos, are skipped. Drive photos are still found automatically, as links.
- **Email parsing covers the formats seen so far.** Hotels.com/Expedia (both current
  and older layouts), Marriott folios, and Southwest. Other senders are detected
  through Google Calendar's auto-created events when those exist.
- **Gmail scope is broad (read-only).** `gmail.readonly` can read the whole inbox;
  the app only stores emails that match the travel query.
- **Google re-asks every 7 days.** While the OAuth app is in "Testing" mode, Google
  expires refresh tokens after a week, so click "Connect Google Account" again before
  rescanning.

## Setup (about 20 minutes)

1. **Create Google OAuth credentials** (~10 min):
   - Go to https://console.cloud.google.com/, create a project.
   - Enable the **Gmail API**, **Google Calendar API**, **Google Drive API**, and
     **Google Photos Picker API**.
   - Go to "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID".
   - Application type: "Web application". Add authorized redirect URI:
     `http://localhost:4000/auth/google/callback`
   - Copy the generated Client ID and Client Secret.
   - On the OAuth consent screen, add your own Google account as a test user
     (the app stays in "Testing" mode — no Google review needed for personal use).

2. **Configure the server** (~2 min):
   ```bash
   cd server
   cp .env.example .env
   # paste your Client ID / Client Secret into .env
   npm install
   npx prisma migrate dev --name init
   npm run dev
   ```
   Server runs at http://localhost:4000.

3. **Configure the client** (~2 min):
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Client runs at http://localhost:5173.

4. **Connect and backfill** (~5 min to click through; the scan itself runs in the
   background and can take 10–30 minutes for 6 years of email):
   - Open http://localhost:5173, click "Connect Google Account", approve the scopes.
   - Click "Run 6-year backfill scan" and leave the tab open until it finishes.
   - Review the "Needs review" section — confirm real trips, dismiss noise.
   - Click "Import from Google Photos". A Google Photos tab opens (allow pop-ups for
     localhost, and be signed in to the same Google account); pick, click Done, and
     the tab closes itself while the app saves the photos.

If you connected before Google Photos support was added, click "Connect Google
Account" again so Google asks for the new permission.

Run the detection tests with `npm test` in `server/`.

## Project layout

```
server/   Express + Prisma (SQLite) API, Google OAuth, scan/cluster pipeline
client/   React + Vite + Tailwind timeline UI
```

## Suggested next steps

- Add a manual "new trip" button for trips the auto-scan misses entirely.
- Swap SQLite for Postgres and deploy both halves if you want this on your phone
  away from localhost (e.g. Railway/Fly.io for the server, Vercel/Netlify for the
  client).
- Add more vendor parsers as you find emails the generic fallback mishandles.
- Periodic re-scan (cron/scheduled task) instead of manual "Run backfill" once the
  initial 6-year pass looks right.
