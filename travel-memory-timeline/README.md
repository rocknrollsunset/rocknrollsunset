# Travel Memory Timeline

Pulls hotel/flight confirmation emails, calendar events, and geotagged Google Drive
photos into a single timeline of your trips, with a journal entry per trip.

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
5. **Journal.** Add notes to any trip alongside what was found.

## Known limitations (read before you run the 6-year backfill)

- **Trips without a hotel or flight email are missed.** A day trip, or a stay with
  family, has nothing to anchor it. A restaurant reservation in another city doesn't
  create a trip yet, since the app doesn't know where home is.
- **Photos come from Google Drive only.** Photos that live only in Google Photos
  won't show up. The trip page links to each photo in Drive rather than showing
  thumbnails.
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
   - Enable the **Gmail API**, **Google Calendar API**, and **Google Drive API**.
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

Run the detection tests with `npm test` in `server/`.

## Project layout

```
server/   Express + Prisma (SQLite) API, Google OAuth, scan/cluster pipeline
client/   React + Vite + Tailwind timeline UI
```

## Suggested next steps

- Add a photo-upload fallback for trips the auto-scan misses entirely.
- Swap SQLite for Postgres and deploy both halves if you want this on your phone
  away from localhost (e.g. Railway/Fly.io for the server, Vercel/Netlify for the
  client).
- Add more vendor parsers as you find emails the generic fallback mishandles.
- Periodic re-scan (cron/scheduled task) instead of manual "Run backfill" once the
  initial 6-year pass looks right.
