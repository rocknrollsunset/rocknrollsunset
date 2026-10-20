import { Router } from "express";
import { getAuthorizedClient } from "../auth/googleClient.js";
import { scanGmail } from "../services/gmailScanner.js";
import { scanCalendar } from "../services/calendarScanner.js";
import { scanDrivePhotos } from "../services/driveScanner.js";
import { clusterSignalsIntoTrips } from "../services/tripClusterer.js";

export const backfillRouter = Router();

backfillRouter.post("/run", async (req, res) => {
  const years = Number(req.body?.years ?? 6);

  try {
    const auth = await getAuthorizedClient();

    const [gmailResult, calendarResult, driveResult] = await Promise.all([
      scanGmail(auth, years),
      scanCalendar(auth, years),
      scanDrivePhotos(auth, years),
    ]);

    const clusterResult = await clusterSignalsIntoTrips();

    res.json({ gmailResult, calendarResult, driveResult, clusterResult });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
