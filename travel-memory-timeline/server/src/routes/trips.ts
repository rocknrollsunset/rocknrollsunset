import { Router } from "express";
import { prisma } from "../db.js";

export const tripsRouter = Router();

tripsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const trips = await prisma.trip.findMany({
    where: status ? { status } : undefined,
    orderBy: { startDate: "desc" },
    include: { signals: true, journalEntries: true },
  });
  res.json(trips);
});

tripsRouter.get("/:id", async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: { signals: true, journalEntries: true },
  });
  if (!trip) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(trip);
});

tripsRouter.patch("/:id", async (req, res) => {
  const { title, locationLabel, startDate, endDate, status } = req.body ?? {};
  const trip = await prisma.trip.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(locationLabel !== undefined ? { locationLabel } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });
  res.json(trip);
});

tripsRouter.delete("/:id", async (req, res) => {
  await prisma.signal.updateMany({ where: { tripId: req.params.id }, data: { tripId: null } });
  await prisma.journalEntry.deleteMany({ where: { tripId: req.params.id } });
  await prisma.trip.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
