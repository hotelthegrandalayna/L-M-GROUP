// A convention-hall invoice's price is its hall rental. It was written to
// event_details.hall_rental for every event type, but only read back for
// Wedding and Holud — so every Engagement, Reception, Mazbani, Birthday,
// Corporate and Others invoice came back from the cloud with no rental in its
// parts while the stored grand total was still right.
//
// Nothing looked wrong until an invoice was opened and saved: the total is
// recomputed from the parts on save, so it silently became ৳0. That is exactly
// what happened to ACH-00015 (MD jabbar, ৳15,000) while testing the amend
// feature, and this test exists so it cannot happen again.
import { describe, it, expect } from "vitest";
import { buildEventDetailRows, applyDetailToInvoice } from "./hallSupabase";

/** Save an invoice and load it back, the way the sync does. */
const roundTrip = (invoice) => {
  const back = { evType: invoice.evType };
  buildEventDetailRows(invoice, "inv-1").forEach((row) =>
    applyDetailToInvoice(back, row),
  );
  return back;
};

/**
 * Which field carries the price for each type — a Holud on its own is billed
 * through hRental, everything else through wRental, and a Wedding + Holud has
 * one of each.
 */
const rentalFields = (evType) =>
  evType === "Holud"
    ? ["hRental"]
    : evType === "Wedding + Holud"
      ? ["wRental", "hRental"]
      : ["wRental"];

const EVERY_TYPE = [
  "Wedding",
  "Wedding + Holud",
  "Holud",
  "Reception",
  "Engagement",
  "Mazbani",
  "Birthday",
  "Corporate Event",
  "Others",
];

/** An invoice of this type, priced at 15,000 per event section. */
const priced = (evType) => {
  const inv = {
    evType,
    evDate: "2026-08-14",
    hDate: "2026-08-13",
    wWaiters: 4,
    wWaiterPrice: 500,
    wGuests: 100,
    wTables: 3,
  };
  rentalFields(evType).forEach((f) => { inv[f] = 15000; });
  return inv;
};

describe("an invoice survives a trip through the cloud", () => {
  EVERY_TYPE.forEach((evType) => {
    it(`keeps the hall rental for ${evType}`, () => {
      const back = roundTrip(priced(evType));
      rentalFields(evType).forEach((f) =>
        expect({ evType, field: f, value: Number(back[f]) })
          .toEqual({ evType, field: f, value: 15000 }),
      );
    });
  });

  it("keeps the waiter cost too, which is billed separately", () => {
    const back = roundTrip(priced("Engagement"));
    expect(Number(back.wWaiters)).toBe(4);
    expect(Number(back.wWaiterPrice)).toBe(500);
  });

  it("keeps the event date", () => {
    expect(roundTrip(priced("Engagement")).evDate).toBe("2026-08-14");
  });

  // The failure was silent because the parts and the stored total disagreed:
  // the total said 15,000 and the parts added up to 0.
  it("brings back parts that still add up to what was billed", () => {
    EVERY_TYPE.forEach((evType) => {
      const back = roundTrip(priced(evType));
      const parts = (Number(back.wRental) || 0) + (Number(back.hRental) || 0);
      const expected = rentalFields(evType).length * 15000;
      expect({ evType, parts }).toEqual({ evType, parts: expected });
    });
  });

  it("does not invent a rental where there was none", () => {
    const back = roundTrip({ evType: "Engagement", evDate: "2026-08-14" });
    expect(Number(back.wRental) || 0).toBe(0);
  });
});
