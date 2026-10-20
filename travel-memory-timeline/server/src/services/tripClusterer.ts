import { prisma } from "../db.js";
import { dateToDay, dayToDate } from "./dates.js";
import { AnchorInput, findTripForDay, groupAnchors, tripLocation, tripTitle } from "./grouping.js";

type SignalRow = Awaited<ReturnType<typeof prisma.signal.findMany>>[number];

function asAnchor(signal: SignalRow): AnchorInput {
  const startDay = dateToDay(signal.date);
  return {
    id: signal.id,
    kind: signal.kind,
    summary: signal.summary,
    startDay,
    endDay: signal.endDate ? dateToDay(signal.endDate) : startDay,
    locationLabel: signal.locationLabel,
  };
}

async function loadTripRanges() {
  const trips = await prisma.trip.findMany();
  return trips.map((t) => ({ id: t.id, startDay: dateToDay(t.startDate), endDay: dateToDay(t.endDate) }));
}

export async function buildTrips() {
  const existing = await loadTripRanges();
  const anchors = (await prisma.signal.findMany({ where: { tripId: null, isAnchor: true } })).map(asAnchor);

  const fresh: AnchorInput[] = [];
  for (const anchor of anchors) {
    const trip = existing.find((t) => anchor.startDay <= t.endDay && anchor.endDay >= t.startDay);
    if (trip) {
      await prisma.signal.update({ where: { id: anchor.id }, data: { tripId: trip.id } });
    } else {
      fresh.push(anchor);
    }
  }

  const groups = groupAnchors(fresh);
  for (const group of groups) {
    const startDay = group.reduce((min, a) => (a.startDay < min ? a.startDay : min), group[0].startDay);
    const endDay = group.reduce((max, a) => (a.endDay > max ? a.endDay : max), group[0].endDay);
    await prisma.trip.create({
      data: {
        title: tripTitle(group),
        locationLabel: tripLocation(group),
        startDate: dayToDate(startDay),
        endDate: dayToDate(endDay),
        signals: { connect: group.map((a) => ({ id: a.id })) },
      },
    });
  }

  const trips = await loadTripRanges();
  const loose = await prisma.signal.findMany({ where: { tripId: null, isAnchor: false } });
  let attached = 0;
  for (const signal of loose) {
    const trip = findTripForDay(trips, dateToDay(signal.date), 1);
    if (!trip) continue;
    await prisma.signal.update({ where: { id: signal.id }, data: { tripId: trip.id } });
    attached += 1;
  }

  return { tripsCreated: groups.length, signalsAttached: attached };
}
