# Travel Memory Timeline

Pulls hotel/flight confirmation emails, calendar events, and geotagged Google Drive
photos into a single timeline of your trips, with a journal entry per trip.

## How it works

1. **Scan.** The backend searches Gmail for travel-vendor emails and keyword matches,
   pulls Calendar events that have a location or a travel-sounding title, and pulls
   geotagged photos from Google Drive — all going back N years (6 by default).
2. **Cluster.** Signals that fall within ~2 days of each other are grouped into a
   single candidate trip.
3. **Review.** Every detected trip starts as "suggested." You confirm or dismiss it
   on the timeline — detection from 6 years of email is never going to be 100%
   accurate, so this review step keeps false positives out of your actual timeline.
4. **Journal.** Confirmed trips are where you add free-text notes, same as a diary
   entry, alongside the auto-detected signals (reservation, calendar event, photos).

## Known limitations (read before you run the 6-year backfill)

- **No direct Google Photos access.** This session only has a Google Drive
  connector, not Google Photos. If your photos live in Google Photos and aren't
  also synced to a Drive folder, they won't show up — you'd need to export them to
  Drive first, or swap in the Google Photos Library API later.
- **Email parsing is heuristic, not perfect.** Vendor parsers cover major airlines,
  hotel chains, Airbnb/Vrbo, Booking.com, and rental car companies by sender domain
  + keyword + date extraction. Anything else falls back to a generic keyword+date
  matcher with lower confidence. Expect to dismiss some false positives and manually
  add trips the scan misses.
- **Gmail scope is broad (read-only).** The OAuth scope is `gmail.readonly`, which
  can read your whole inbox, not just matching messages — Google requires the broad
  scope for search; the app only ever stores emails matched by the travel query.

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

4. **Connect and backfill** (~5 min to click through, scan itself can take a while
   for 6 years of email — expect several minutes depending on inbox size):
   - Open http://localhost:5173, click "Connect Google Account", approve the scopes.
   - Click "Run 6-year backfill scan".
   - Review the "Needs review" section — confirm real trips, dismiss noise.

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
