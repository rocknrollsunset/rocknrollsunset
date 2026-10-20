import { Router } from "express";
import { prisma } from "../db.js";
import { getAuthorizedClient, PHOTOS_PICKER_SCOPE } from "../auth/googleClient.js";
import {
  createPickerSession,
  ImportResult,
  importPickedPhotos,
  pickerSessionReady,
  storedPhotoPath,
} from "../services/googlePhotos.js";

export const photosRouter = Router();

interface ImportJob {
  state: "importing" | "done" | "error";
  done: number;
  total: number;
  result?: ImportResult;
  error?: string;
}

// Picked photos can number in the thousands, so the download runs in the background and the
// client polls /sync for progress.
const jobs = new Map<string, ImportJob>();

function errorMessage(err: unknown): string {
  const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
  return apiMessage ?? (err as Error).message;
}

photosRouter.post("/picker", async (_req, res) => {
  try {
    const client = await getAuthorizedClient(PHOTOS_PICKER_SCOPE);
    res.json(await createPickerSession(client));
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

photosRouter.post("/picker/:sessionId/sync", async (req, res) => {
  const { sessionId } = req.params;
  const tripId = typeof req.body?.tripId === "string" ? req.body.tripId : undefined;

  const existing = jobs.get(sessionId);
  if (existing) {
    if (existing.state !== "importing") jobs.delete(sessionId);
    res.json(existing);
    return;
  }

  try {
    const client = await getAuthorizedClient(PHOTOS_PICKER_SCOPE);
    if (!(await pickerSessionReady(client, sessionId))) {
      res.json({ state: "waiting" });
      return;
    }

    const job: ImportJob = { state: "importing", done: 0, total: 0 };
    jobs.set(sessionId, job);
    importPickedPhotos(client, sessionId, tripId, (done, total) => {
      job.done = done;
      job.total = total;
    })
      .then((result) => {
        job.state = "done";
        job.result = result;
      })
      .catch((err) => {
        job.state = "error";
        job.error = errorMessage(err);
      });
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

photosRouter.get("/:signalId/file", async (req, res) => {
  try {
    const signal = await prisma.signal.findUnique({ where: { id: req.params.signalId } });
    const full = signal?.filePath ? storedPhotoPath(signal.filePath) : undefined;
    if (!full) {
      res.status(404).end();
      return;
    }
    res.sendFile(full, { maxAge: "30d" });
  } catch {
    res.status(404).end();
  }
});
