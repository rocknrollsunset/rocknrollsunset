import { Router } from "express";
import { getAuthorizedClient } from "../auth/googleClient.js";
import { scanGmail } from "../services/gmailScanner.js";
import { scanCalendar } from "../services/calendarScanner.js";
import { attachDrivePhotos } from "../services/driveScanner.js";
import { buildTrips } from "../services/tripClusterer.js";

export const backfillRouter = Router();

let running = false;
let lastResult: unknown = null;
let lastError: string | null = null;

async function runBackfill(years: number) {
  const auth = await getAuthorizedClient();
  const [gmail, calendar] = await Promise.all([scanGmail(auth, years), scanCalendar(auth, years)]);
  const trips = await buildTrips();
  const photos = await attachDrivePhotos(auth, years);
  return { gmail, calendar, trips, photos, finishedAt: new Date().toISOString() };
}

// A multi-year scan outlives an HTTP request, so it runs in the background and the client polls.
backfillRouter.post("/run", (req, res) => {
  if (running) {
    res.status(409).json({ error: "A scan is already running" });
    return;
  }
  const years = Number(req.body?.years ?? 6);
  running = true;
  lastError = null;
  runBackfill(years)
    .then((result) => {
      lastResult = result;
    })
    .catch((err: Error) => {
      lastError = err.message;
    })
    .finally(() => {
      running = false;
    });
  res.status(202).json({ started: true });
});

backfillRouter.get("/status", (_req, res) => {
  res.json({ running, lastResult, lastError });
});
