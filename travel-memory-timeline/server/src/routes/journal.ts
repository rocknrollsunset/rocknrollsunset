import { Router } from "express";
import { prisma } from "../db.js";

export const journalRouter = Router();

journalRouter.post("/:tripId", async (req, res) => {
  const { body } = req.body ?? {};
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const entry = await prisma.journalEntry.create({
    data: { tripId: req.params.tripId, body },
  });
  res.status(201).json(entry);
});

journalRouter.patch("/entry/:entryId", async (req, res) => {
  const { body } = req.body ?? {};
  const entry = await prisma.journalEntry.update({
    where: { id: req.params.entryId },
    data: { body },
  });
  res.json(entry);
});

journalRouter.delete("/entry/:entryId", async (req, res) => {
  await prisma.journalEntry.delete({ where: { id: req.params.entryId } });
  res.status(204).end();
});
