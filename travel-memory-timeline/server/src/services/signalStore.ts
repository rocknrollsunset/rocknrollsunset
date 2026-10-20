import { prisma } from "../db.js";
import { dayToDate } from "./dates.js";
import { DetectedSignal } from "./parsers/types.js";

export async function saveSignal(
  type: "email" | "calendar",
  sourceId: string,
  signal: DetectedSignal,
  rawMeta: Record<string, unknown>
) {
  const data = {
    type,
    sourceId,
    kind: signal.kind,
    isAnchor: signal.isAnchor,
    summary: signal.summary,
    date: dayToDate(signal.startDay),
    endDate: dayToDate(signal.endDay),
    locationLabel: signal.locationLabel,
    bookingRef: signal.bookingRef,
    rawMeta: JSON.stringify(rawMeta),
  };
  await prisma.signal.upsert({
    where: { type_sourceId: { type, sourceId } },
    create: data,
    update: {},
  });
}
