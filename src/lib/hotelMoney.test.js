// Regression tests for the money rules in CLAUDE.md §1.
// These encode owner-confirmed business rules. If one fails, the reported revenue
// is wrong — fix the code, do not "fix" the test.
import { describe, it, expect } from "vitest";
import { monthMoney, bookingMonthlyParts, bookingPaid } from "./hotelMoney";

const pay = (ts, amount, note = "Advance paid", type = "room") => ({ ts, amount, note, type });

describe("RULE: money follows the night stayed", () => {
  it("splits a stay that crosses the month boundary night by night", () => {
    // Real case: guest checked in 31 Jul, left 2 Aug (2 nights), paid 3000.
    const b = {
      id: 69, guest: "G", room: "101", status: "checked-out",
      checkin: "2026-07-31", checkout: "2026-08-02", nights: 2,
      invoiceTotal: 3000, paymentHistory: [pay("2026-08-06T22:14:51Z", 3000, "Adjusted by admin")],
    };
    const jul = monthMoney({ bookings: [b], month: "2026-07" });
    const aug = monthMoney({ bookings: [b], month: "2026-08" });
    expect(jul.collected).toBe(1500); // the 31-Jul night
    expect(aug.collected).toBe(1500); // the 1-Aug night
  });

  it("does NOT use the payment date (cash basis is rejected)", () => {
    // Stay entirely in July, but paid in August — must stay July revenue.
    const b = {
      id: 1, guest: "G", room: "101", status: "checked-out",
      checkin: "2026-07-10", checkout: "2026-07-11", nights: 1,
      invoiceTotal: 2000, paymentHistory: [pay("2026-08-03T10:00:00Z", 2000)],
    };
    expect(monthMoney({ bookings: [b], month: "2026-07" }).collected).toBe(2000);
    expect(monthMoney({ bookings: [b], month: "2026-08" }).collected).toBe(0);
  });

  it("puts a recorded extension in its extra-night month", () => {
    const b = {
      id: 2, guest: "G", room: "101", status: "checked-out",
      checkin: "2026-07-30", checkout: "2026-08-01", nights: 2,
      invoiceTotal: 3000,
      extensions: [{ nights: 1, amount: 1200, from: "2026-07-31", to: "2026-08-01", at: "2026-07-31" }],
      paymentHistory: [pay("2026-07-30T10:00:00Z", 3000)],
    };
    // base = 3000 - 1200 = 1800 for the 30-Jul night; extension 1200 for the 31-Jul night
    expect(monthMoney({ bookings: [b], month: "2026-07" }).collected).toBe(3000);
  });
});

describe("RULE: money is never dropped or double counted", () => {
  const cases = [
    { name: "simple stay", b: { id: 3, guest: "G", room: "1", checkin: "2026-08-02", checkout: "2026-08-03", nights: 1, invoiceTotal: 1700, paymentHistory: [pay("2026-08-02T09:00:00Z", 1700)] } },
    { name: "boundary stay", b: { id: 4, guest: "G", room: "1", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2, invoiceTotal: 2500, paymentHistory: [pay("2026-08-01T09:00:00Z", 2500)] } },
    { name: "paid MORE than the room invoice (service charges)", b: { id: 5, guest: "G", room: "1", checkin: "2026-08-05", checkout: "2026-08-06", nights: 1, invoiceTotal: 2000, paymentHistory: [pay("2026-08-05T09:00:00Z", 2000), pay("2026-08-06T20:00:00Z", 800, "Restaurant", "service")] } },
    { name: "partially paid", b: { id: 6, guest: "G", room: "1", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1, invoiceTotal: 3400, paymentHistory: [pay("2026-08-07T09:00:00Z", 1000)] } },
  ];

  for (const { name, b } of cases) {
    it(`${name}: every taka appears in exactly one month`, () => {
      const parts = bookingMonthlyParts(b);
      const totalCollected = parts.reduce((s, p) => s + p.collected, 0);
      expect(totalCollected).toBeCloseTo(bookingPaid(b), 2);
    });
  }

  it("a service payment beyond the room total still counts as revenue", () => {
    const b = cases[2].b;
    expect(monthMoney({ bookings: [b], month: "2026-08" }).collected).toBe(2800);
  });
});

describe("RULE: cancelled bookings and manual revenue", () => {
  it("ignores cancelled bookings", () => {
    const b = { id: 7, guest: "G", room: "1", status: "cancelled", checkin: "2026-08-02", checkout: "2026-08-03", nights: 1, invoiceTotal: 5000, paymentHistory: [pay("2026-08-02T09:00:00Z", 5000)] };
    expect(monthMoney({ bookings: [b], month: "2026-08" }).collected).toBe(0);
  });

  it("counts manual (non-booking) revenue by its own date", () => {
    const revs = [{ id: 1, date: "2026-08-04", amount: 900, source: "Laundry" }];
    expect(monthMoney({ bookings: [], revenues: revs, month: "2026-08" }).collected).toBe(900);
    expect(monthMoney({ bookings: [], revenues: revs, month: "2026-07" }).collected).toBe(0);
  });

  it("outstanding is what the month's stays still owe", () => {
    const b = { id: 8, guest: "G", room: "1", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1, invoiceTotal: 3400, paymentHistory: [pay("2026-08-07T09:00:00Z", 1000)] };
    const m = monthMoney({ bookings: [b], month: "2026-08" });
    expect(m.collected).toBe(1000);
    expect(m.outstanding).toBe(2400);
    expect(m.billed).toBe(3400);
  });
});
