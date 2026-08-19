// Money that arrived with no booking and no invoice — June's ৳93,500 — is
// recorded as a plain revenue row. The whole thing hinges on ONE property: the
// row must carry no bookingId, because that is what makes monthMoney count it by
// its own date instead of by a stay. If a future edit ever attaches one, the
// money silently stops landing in the month it was received.
import { describe, it, expect } from "vitest";
import { monthMoney } from "../lib/hotelMoney";
import { manualRowsIn, defaultDate } from "./ManualIncome";
import { todayStr } from "../utils/helpers";

const adjustment = {
  id: 1, source: "Revenue Adjustment", amount: 93500,
  date: "2026-06-30", note: "June income received without an invoice", by: "admin",
};

describe("income with no invoice behind it", () => {
  it("adds the full amount to the month it is dated in", () => {
    const before = monthMoney({ bookings: [], revenues: [], month: "2026-06" });
    const after  = monthMoney({ bookings: [], revenues: [adjustment], month: "2026-06" });
    expect(after.collected - before.collected).toBe(93500);
  });

  it("turns 24,500 into 118,000 — the case this was built for", () => {
    const existing = { id: 2, source: "Room Rent", amount: 24500, date: "2026-06-12" };
    const june = monthMoney({ bookings: [], revenues: [existing, adjustment], month: "2026-06" });
    expect(june.collected).toBe(118000);
    expect(june.billed).toBe(118000);
  });

  it("adds nothing to outstanding — it is money already in hand", () => {
    expect(monthMoney({ bookings: [], revenues: [adjustment], month: "2026-06" }).outstanding).toBe(0);
  });

  it("stays out of every other month", () => {
    expect(monthMoney({ bookings: [], revenues: [adjustment], month: "2026-07" }).collected).toBe(0);
    expect(monthMoney({ bookings: [], revenues: [adjustment], month: "2026-05" }).collected).toBe(0);
  });

  // The guard that matters. A bookingId would hand the row to the stay-based
  // rules, where it is counted against nights instead of its own date.
  it("is IGNORED if it ever gets a bookingId attached", () => {
    const wrong = { ...adjustment, bookingId: "abc" };
    expect(monthMoney({ bookings: [], revenues: [wrong], month: "2026-06" }).collected).toBe(0);
  });

  it("does not disturb room revenue that is already there", () => {
    const booking = {
      id: "b1", checkin: "2026-06-10", checkout: "2026-06-11",
      amount: 2000, paymentHistory: [{ ts: "2026-06-10T10:00:00Z", amount: 2000 }],
    };
    const withOnly = monthMoney({ bookings: [booking], revenues: [], month: "2026-06" });
    const withBoth = monthMoney({ bookings: [booking], revenues: [adjustment], month: "2026-06" });
    expect(withBoth.collected).toBe(withOnly.collected + 93500);
    expect(withBoth.bookings).toHaveLength(1);   // no phantom booking invented
  });
});

describe("which rows this screen is allowed to touch", () => {
  const rows = [
    adjustment,
    { id: 3, source: "Room Rent", amount: 2000, date: "2026-06-04", bookingId: "b1" },
    { id: 4, source: "Room Rent", amount: 1500, date: "2026-06-05", fromBooking: true },
    { id: 5, source: "Other", amount: 500, date: "2026-07-01" },
  ];

  it("lists only manual rows, and only for the month being viewed", () => {
    expect(manualRowsIn(rows, "2026-06").map(r => r.id)).toEqual([1]);
  });

  it("never offers a booking's revenue for removal", () => {
    const listed = manualRowsIn(rows, "2026-06");
    expect(listed.some(r => r.bookingId || r.fromBooking)).toBe(false);
  });

  it("survives an empty or missing list", () => {
    expect(manualRowsIn([], "2026-06")).toEqual([]);
    expect(manualRowsIn(null, "2026-06")).toEqual([]);
  });
});

// A date built through toISOString() lands a day early east of Greenwich — in
// Bangladesh the last day of June came out as 29 June. The default date has to be
// the real last day of the month, in the month the owner is looking at.
describe("the date the entry defaults to", () => {
  it("is the true last day of the month, not a timezone-shifted one", () => {
    expect(defaultDate("2026-06")).toBe("2026-06-30");
    expect(defaultDate("2026-02")).toBe("2026-02-28");
    expect(defaultDate("2024-02")).toBe("2024-02-29");   // leap year
    expect(defaultDate("2026-12")).toBe("2026-12-31");
  });

  it("uses today when the month being viewed is the current one", () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    expect(defaultDate(thisMonth)).toBe(todayStr());
  });

  it("always lands inside the month it was asked for", () => {
    ["2026-01","2026-04","2026-06","2026-09","2026-11"].forEach(m =>
      expect(defaultDate(m).slice(0, 7)).toBe(m));
  });
});
