import { prisma } from "../db.js";

const GAP_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days between signals to stay in the same trip

type SignalRow = Awaited<ReturnType<typeof prisma.signal.findMany>>[number];

function readRawMeta(signal: SignalRow): Record<string, unknown> {
  if (!signal.rawMeta) return {};
  try {
    return JSON.parse(signal.rawMeta);
  } catch {
    return {};
  }
}

export async function clusterSignalsIntoTrips() {
  const signals = await prisma.signal.findMany({
    where: { tripId: null },
    orderBy: { date: "asc" },
  });

  const clusters: SignalRow[][] = [];
  let current: SignalRow[] = [];

  for (const signal of signals) {
    if (current.length === 0) {
      current.push(signal);
      continue;
    }
    const last = current[current.length - 1];
    if (signal.date.getTime() - last.date.getTime() <= GAP_TOLERANCE_MS) {
      current.push(signal);
    } else {
      clusters.push(current);
      current = [signal];
    }
  }
  if (current.length > 0) clusters.push(current);

  let created = 0;
  for (const cluster of clusters) {
    // Require either one corroborating signal (email/calendar) or 2+ weaker signals,
    // so a single geotagged photo near home doesn't become a "trip".
    const strongSignal = cluster.some((s) => s.confidence >= 0.5);
    if (!strongSignal && cluster.length < 2) continue;

    const dates = cluster.map((s) => s.date.getTime());
    const startDate = new Date(Math.min(...dates));
    const endDate = new Date(Math.max(...dates));

    const emailSignal = cluster.find((s) => s.type === "email");
    const calendarSignal = cluster.find((s) => s.type === "calendar");

    const locationLabel =
      (emailSignal && (readRawMeta(emailSignal).locationLabel as string | undefined)) ||
      (calendarSignal && (readRawMeta(calendarSignal).location as string | undefined)) ||
      undefined;

    const title = locationLabel || emailSignal?.summary || calendarSignal?.summary || "Trip";

    await prisma.trip.create({
      data: {
        title,
        locationLabel,
        startDate,
        endDate,
        signals: { connect: cluster.map((s) => ({ id: s.id })) },
      },
    });
    created += 1;
  }

  return { clustersEvaluated: clusters.length, tripsCreated: created };
}
