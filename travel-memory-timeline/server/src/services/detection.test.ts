import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findDate } from "./dates.js";
import { cityFromAddress } from "./location.js";
import { parseEmail } from "./parsers/email.js";
import { calendarEventToSignal } from "./parsers/calendar.js";
import { photoTakenDay } from "./parsers/photo.js";
import { findTripForDay, groupAnchors, tripTitle } from "./grouping.js";
import { EmailInput } from "./parsers/types.js";

// Fixtures mirror real email/calendar layouts; every name, date, and address is fictional.

function email(overrides: Partial<EmailInput>): EmailInput {
  return { id: "m1", from: "", subject: "", snippet: "", bodyText: "", internalDate: new Date(), ...overrides };
}

function signalOf(result: ReturnType<typeof parseEmail>) {
  assert.ok(result && result.type === "signal", `expected a signal, got ${JSON.stringify(result)}`);
  return result.signal;
}

const HOTELS_COM_BODY = `
 All set, Pat. Your hotel is confirmed.
View full itinerary
 Example Mountain Lodge & Resort
 Hotels.com itinerary: 70000000000001

 Check-in
 4:00pm
 Fri, Mar 13

 Check-out
 11:00am
 Sun, Mar 15

 2 nights, 2 adults, 1 room
100 Example Blvd, Springfield, IL, 62701 United States of America
 Free cancellation until Mar 10 at 6:00pm (property local time)
 This plan is available until 11:59pm UTC on Mar 01, 2026.
Check-in policies
Check-in time starts at 4:00 PM
Expedia, Inc. 1111 Expedia Group Way West, Seattle WA 98119, USA.
`;

describe("email parsing", () => {
  it("reads check-in/check-out from a Hotels.com confirmation, ignoring other dates in the body", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "Hotels.com <hotels@eg.hotels.com>",
          subject: "Hotels.com travel confirmation - Fri, Mar 13 - (Itinerary # 70000000000001)",
          bodyText: HOTELS_COM_BODY,
          internalDate: new Date("2026-02-20T02:21:02Z"),
        })
      )
    );
    assert.equal(s.kind, "lodging");
    assert.equal(s.isAnchor, true);
    assert.equal(s.startDay, "2026-03-13");
    assert.equal(s.endDay, "2026-03-15");
    assert.equal(s.summary, "Example Mountain Lodge & Resort");
    assert.equal(s.locationLabel, "Springfield, IL");
    assert.equal(s.bookingRef, "70000000000001");
  });

  it("reads side-by-side check-in/check-out columns from the older Expedia template", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "Expedia <hotels@eg.hotels.com>",
          subject: "Expedia travel confirmation - Fri, Apr 5 - (Itinerary # 70000000000004)",
          bodyText: `Thank you, Pat! Your booking is confirmed.

*Itinerary #* 70000000000004

Example Vacation Club Downtown

[100 Example Boulevard South, Reno, NV, 89501 United States of America](https://example.com)

Check-in

Check-out

Fri, Apr 5

Sat, Apr 13

Check-in time starts at 4:00 PM

Free cancellation until Apr 2 at 11:59pm

For special requests and questions about your reserved room or the property, contact Example Vacation Club Downtown.

Tel: 1 (555) 555-0100
Date of booking: Sat, 10 Feb
`,
          internalDate: new Date("2024-02-10T00:48:55Z"),
        })
      )
    );
    assert.equal(s.startDay, "2024-04-05");
    assert.equal(s.endDay, "2024-04-13");
    assert.equal(s.summary, "Example Vacation Club Downtown");
    assert.equal(s.locationLabel, "Reno, NV");
    assert.equal(s.bookingRef, "70000000000004");
  });

  it("puts a stay booked in November for 'Fri, Jan 12' in the following year", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "Expedia <hotels@eg.hotels.com>",
          subject: "Expedia travel confirmation - Fri, Jan 12 - (Itinerary # 70000000000002)",
          bodyText: "Thank you for your reservation",
          internalDate: new Date("2023-11-25T21:56:04Z"),
        })
      )
    );
    assert.equal(s.startDay, "2024-01-12");
    assert.equal(s.endDay, "2024-01-13");
    assert.equal(s.isAnchor, true);
  });

  it("reads explicit stay dates from a post-stay folio subject", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "your_recent_stay@marriott.com",
          subject: "Your FRIDAY JUNE 7, 2024 - SUNDAY JUNE 9, 2024 Stay at EXAMPLE RIVERSIDE HOTEL & SPA",
          internalDate: new Date("2024-06-09T05:28:59Z"),
        })
      )
    );
    assert.equal(s.startDay, "2024-06-07");
    assert.equal(s.endDay, "2024-06-09");
    assert.equal(s.summary, "Example Riverside Hotel & Spa");
  });

  it("matches airline mail sent from a subdomain", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "Southwest Airlines <southwestairlines@ifly.southwest.com>",
          subject: "You're going to Denver on 3/22 (ABC123)!",
          internalDate: new Date("2024-02-01T02:11:29Z"),
        })
      )
    );
    assert.equal(s.kind, "flight");
    assert.equal(s.startDay, "2024-03-22");
    assert.equal(s.summary, "Flight to Denver");
    assert.equal(s.bookingRef, "ABC123");
  });

  it("reports cancellations by itinerary number", () => {
    assert.deepEqual(
      parseEmail(
        email({
          subject:
            "Hotels.com Hotel Cancellation Confirmation - Example Hotel, Jun 7, 2024 - Jun 9, 2024 (Itinerary #70000000000003)",
        })
      ),
      { type: "cancellation", bookingRef: "70000000000003" }
    );
  });

  it("ignores loyalty-program promos from a hotel brand's marketing domain", () => {
    assert.equal(
      parseEmail(
        email({
          from: "marriottbonvoy@email-marriott.com",
          subject: "Earn 1,500 Bonus Points on Each Stay",
          bodyText: "Book your next stay and check-in faster.",
        })
      ),
      null
    );
  });

  it("keeps other travel mail as a non-anchor dated by when it was sent", () => {
    const s = signalOf(
      parseEmail(
        email({
          from: "hotels@eg.hotels.com",
          subject: "Pat, review your stay at Example Mountain Lodge &amp; Resort",
          internalDate: new Date("2026-03-15T16:36:18Z"),
        })
      )
    );
    assert.equal(s.isAnchor, false);
    assert.equal(s.startDay, "2026-03-15");
    assert.equal(s.summary, "Pat, review your stay at Example Mountain Lodge & Resort");
  });
});

describe("calendar events", () => {
  it("turns Gmail's all-day 'Stay at' event into a lodging anchor with an inclusive end date", () => {
    for (const start of ["2026-03-13", "2026-03-13T00:00:00Z"]) {
      const s = calendarEventToSignal({
        eventType: "fromGmail",
        summary: "Stay at Example Mountain Lodge & Resort",
        location: "100 Example Boulevard, Springfield, IL 62701, USA",
        start: { date: start },
        end: { date: "2026-03-16" },
      });
      assert.deepEqual(s, {
        kind: "lodging",
        isAnchor: true,
        summary: "Example Mountain Lodge & Resort",
        startDay: "2026-03-13",
        endDay: "2026-03-15",
        locationLabel: "Springfield, IL",
      });
    }
  });

  it("keeps an evening reservation on its local day", () => {
    const s = calendarEventToSignal({
      eventType: "fromGmail",
      summary: "Reservation at Example Bistro",
      location: "Example Bistro",
      start: { dateTime: "2026-05-08T19:45:00-05:00" },
      end: { dateTime: "2026-05-08T20:45:00-05:00" },
    });
    assert.equal(s?.kind, "reservation");
    assert.equal(s?.isAnchor, false);
    assert.equal(s?.startDay, "2026-05-08");
  });

  it("never lets a movie or concert start a trip, even one titled like a vacation", () => {
    const movie = calendarEventToSignal({
      eventType: "fromGmail",
      summary: "Some Movie",
      location: "Example Cinema 15",
      start: { dateTime: "2026-08-21T16:15:00-05:00" },
      end: { dateTime: "2026-08-21T17:15:00-05:00" },
    });
    assert.equal(movie?.isAnchor, false);

    const show = calendarEventToSignal({
      eventType: "fromGmail",
      summary: "Christmas Vacation: Live Show",
      location: "Example Theatre",
      start: { dateTime: "2025-12-20T19:00:00-06:00" },
      end: { dateTime: "2025-12-20T20:00:00-06:00" },
    });
    assert.equal(show?.isAnchor, false);
  });

  it("keeps a restaurant reservation that has no location", () => {
    const s = calendarEventToSignal({
      eventType: "fromGmail",
      summary: "Reservation at Example Grill",
      start: { dateTime: "2026-03-14T18:00:00-05:00" },
      end: { dateTime: "2026-03-14T19:00:00-05:00" },
    });
    assert.equal(s?.kind, "reservation");
    assert.equal(s?.startDay, "2026-03-14");
  });

  it("drops single-day events without a location and recurring events", () => {
    assert.equal(
      calendarEventToSignal({ eventType: "fromGmail", summary: "Promo deal", start: { date: "2022-11-25" }, end: { date: "2022-11-26" } }),
      null
    );
    assert.equal(
      calendarEventToSignal({
        summary: "Gym",
        location: "Example Gym",
        recurringEventId: "abc",
        start: { dateTime: "2026-01-05T06:00:00-06:00" },
      }),
      null
    );
  });

  it("treats a user's own multi-day all-day event as a trip anchor", () => {
    const s = calendarEventToSignal({ summary: "Beach", start: { date: "2026-08-10" }, end: { date: "2026-08-15" } });
    assert.equal(s?.isAnchor, true);
    assert.equal(s?.endDay, "2026-08-14");
  });
});

describe("trip grouping", () => {
  const anchors = [
    { id: "a", kind: "lodging", summary: "Example Suites Downtown", startDay: "2026-06-01", endDay: "2026-06-02" },
    { id: "b", kind: "lodging", summary: "The Example Inn", startDay: "2026-06-02", endDay: "2026-06-05" },
    { id: "c", kind: "lodging", summary: "Example Riverside Resort", startDay: "2026-07-10", endDay: "2026-07-14" },
  ];

  it("merges back-to-back hotel stays into one trip and keeps separate trips apart", () => {
    const groups = groupAnchors(anchors);
    assert.deepEqual(groups.map((g) => g.map((a) => a.id)), [["a", "b"], ["c"]]);
    assert.equal(tripTitle(groups[0]), "Example Suites Downtown → The Example Inn");
  });

  it("collapses the same hotel reported by email and calendar into one name", () => {
    const title = tripTitle([
      { id: "x", kind: "lodging", summary: "Example Lodge & Resort", startDay: "2026-03-13", endDay: "2026-03-15" },
      { id: "y", kind: "lodging", summary: "Grand Example Lodge & Resort", startDay: "2026-03-13", endDay: "2026-03-15" },
    ]);
    assert.equal(title, "Grand Example Lodge & Resort");
  });

  it("attaches things that happen during a trip, with optional slack", () => {
    const trips = [{ id: "t", startDay: "2026-03-13", endDay: "2026-03-15" }];
    assert.equal(findTripForDay(trips, "2026-03-14", 0)?.id, "t");
    assert.equal(findTripForDay(trips, "2026-03-16", 1)?.id, "t");
    assert.equal(findTripForDay(trips, "2026-03-16", 0), undefined);
    assert.equal(findTripForDay(trips, "2026-02-01", 1), undefined);
  });
});

describe("helpers", () => {
  it("reads the day a photo was taken", () => {
    assert.equal(photoTakenDay({ imageMediaMetadata: { time: "2026:03:14 13:11:28" }, name: "x.jpg" }), "2026-03-14");
    assert.equal(photoTakenDay({ name: "PXL_20260314_131128000.jpg" }), "2026-03-14");
    assert.equal(photoTakenDay({ name: "beach.jpg", createdTime: "2026-03-15T01:00:00Z" }), "2026-03-15");
  });

  it("pulls a city out of common address formats", () => {
    assert.equal(cityFromAddress("100 Example Boulevard, Springfield, IL 62701, USA"), "Springfield, IL");
    assert.equal(cityFromAddress("200 Example Street, Orlando, Florida 32801, United States"), "Orlando, Florida");
    assert.equal(cityFromAddress("500 Shore Road Example Beach, Florida 32401 USA"), "Example Beach, Florida");
    assert.equal(cityFromAddress("Springfield, IL"), "Springfield, IL");
    assert.equal(cityFromAddress("Example Cinema 15"), undefined);
  });

  it("skips invalid numeric dates like 24/7", () => {
    assert.equal(findDate("24/7 support, departs 3/22", new Date("2024-02-01T00:00:00Z")), "2024-03-22");
  });
});
