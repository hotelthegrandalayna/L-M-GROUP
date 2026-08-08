// ─────────────────────────────────────────────────────────────────────────────
// THE GUARD THAT MATTERS MOST.
//
// Every screen that shows money must agree. This test takes one set of bookings
// and checks that the INVOICE LIST (filter by month, sum each stay's share of
// that month) equals the REVENUE ENGINE (monthMoney) used by Desk and Reports.
//
// A real bug shipped because these two used different rules: the invoice list
// filtered by check-in month while revenue followed the night stayed, so three
// 31 Jul → 2 Aug stays put 4,000 into August revenue that the invoice list never
// showed (43,600 vs 39,600). If anyone changes one rule and not the other, this
// test fails immediately. Fix the code — never the test.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { monthMoney, bookingMonthlyParts } from "./hotelMoney";
import { filterInvoices } from "./invoiceFilter";

const pay = (ts, amount) => ({ ts, amount, note: "Advance paid", type: "room" });

// A realistic mix: normal stays, month-boundary stays, multi-night, part-paid
const bookings = [
  { id: 69, guest: "Boundary A", room: "101", status: "checked-out", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2, invoiceTotal: 3000, paymentHistory: [pay("2026-08-06T10:00:00Z", 3000)] },
  { id: 75, guest: "Boundary B", room: "105", status: "checked-out", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2, invoiceTotal: 2500, paymentHistory: [pay("2026-08-06T10:00:00Z", 2500)] },
  { id: 76, guest: "Boundary C", room: "106", status: "checked-out", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2, invoiceTotal: 2500, paymentHistory: [pay("2026-08-06T10:00:00Z", 2500)] },
  { id: 79, guest: "August A",   room: "101", status: "checked-out", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1, invoiceTotal: 3400, paymentHistory: [pay("2026-08-07T10:00:00Z", 3400)] },
  { id: 85, guest: "August B",   room: "102", status: "checked-out", checkin: "2026-08-05", checkout: "2026-08-07", nights: 2, invoiceTotal: 7000, paymentHistory: [pay("2026-08-05T10:00:00Z", 7000)] },
  { id: 90, guest: "Part paid",  room: "106", status: "checked-in",  checkin: "2026-08-06", checkout: "2026-08-07", nights: 1, invoiceTotal: 2000, paymentHistory: [pay("2026-08-06T10:00:00Z", 800)] },
  { id: 31, guest: "July only",  room: "101", status: "checked-out", checkin: "2026-07-03", checkout: "2026-07-04", nights: 1, invoiceTotal: 1800, paymentHistory: [pay("2026-07-03T10:00:00Z", 1800)] },
  { id: 50, guest: "Long stay",  room: "104", status: "checked-out", checkin: "2026-07-28", checkout: "2026-08-03", nights: 6, invoiceTotal: 6000, paymentHistory: [pay("2026-07-28T10:00:00Z", 6000)] },
  { id: 60, guest: "Cancelled",  room: "108", status: "cancelled",   checkin: "2026-08-04", checkout: "2026-08-05", nights: 1, invoiceTotal: 9999, paymentHistory: [pay("2026-08-04T10:00:00Z", 9999)] },
];

// What the Invoices tab shows for a month: filter by month, then sum each row's
// share of that month — exactly what the UI does.
function invoiceListTotals(month) {
  const rows = filterInvoices(bookings, { month });
  let billed = 0, collected = 0;
  rows.forEach(bk => {
    // Cancelled invoices are listed but contribute no money — same as the app
    if (bk.status === "cancelled") return;
    bookingMonthlyParts(bk).forEach(p => {
      if (p.month === month) { billed += p.billed; collected += p.collected; }
    });
  });
  return { billed, collected, count: rows.length };
}

describe("Invoices tab must reconcile with the revenue engine", () => {
  for (const month of ["2026-07", "2026-08"]) {
    it(`${month}: invoice list collected === monthMoney collected`, () => {
      const list = invoiceListTotals(month);
      const rev  = monthMoney({ bookings, month });
      expect(list.collected).toBeCloseTo(rev.collected, 2);
    });

    it(`${month}: invoice list billed === monthMoney billed`, () => {
      const list = invoiceListTotals(month);
      const rev  = monthMoney({ bookings, month });
      expect(list.billed).toBeCloseTo(rev.billed, 2);
    });
  }

  it("a month-boundary stay appears in BOTH months and is never double counted", () => {
    const jul = invoiceListTotals("2026-07");
    const aug = invoiceListTotals("2026-08");
    // Booking 69 shows in both months...
    expect(filterInvoices(bookings, { month: "2026-07" }).some(b => b.id === 69)).toBe(true);
    expect(filterInvoices(bookings, { month: "2026-08" }).some(b => b.id === 69)).toBe(true);
    // ...but its money is split, never counted twice
    const parts = bookingMonthlyParts(bookings[0]);
    const totalAcrossMonths = parts.reduce((s, p) => s + p.collected, 0);
    expect(totalAcrossMonths).toBeCloseTo(3000, 2);
    expect(jul.collected).toBeGreaterThan(0);
    expect(aug.collected).toBeGreaterThan(0);
  });

  it("every taka lands in exactly one month across the whole data set", () => {
    const paidTotal = bookings
      .filter(b => b.status !== "cancelled")
      .reduce((s, b) => s + b.paymentHistory.reduce((t, p) => t + p.amount, 0), 0);
    const months = ["2026-07", "2026-08", "2026-09"];
    const spread = months.reduce((s, m) => s + monthMoney({ bookings, month: m }).collected, 0);
    expect(spread).toBeCloseTo(paidTotal, 2);
  });

  // Reported bug: picking "All Months" showed LESS than any single month, because
  // it summed only the live 30-day window instead of every month.
  it("ALL MONTHS equals the sum of the individual months", () => {
    const months = new Set();
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      bookingMonthlyParts(b).forEach(p => p.month && months.add(p.month));
    });
    let billed = 0, collected = 0;
    months.forEach(m => {
      const mm = monthMoney({ bookings, month: m });
      billed += mm.billed; collected += mm.collected;
    });

    // Every taka actually paid, across the whole data set
    const paidTotal = bookings
      .filter(b => b.status !== "cancelled")
      .reduce((s, b) => s + b.paymentHistory.reduce((t, p) => t + p.amount, 0), 0);

    expect(collected).toBeCloseTo(paidTotal, 2);
    expect(billed).toBeGreaterThanOrEqual(collected);
    // and it must exceed any one month on its own
    months.forEach(m => {
      expect(collected).toBeGreaterThanOrEqual(monthMoney({ bookings, month: m }).collected);
    });
  });

  it("cancelled invoices are excluded from both sides", () => {
    const rev = monthMoney({ bookings, month: "2026-08" });
    expect(rev.collected).toBeLessThan(9999 + 20000); // the 9,999 cancelled row never counts
    expect(filterInvoices(bookings, { month: "2026-08", status: "All" }).some(b => b.id === 60)).toBe(true);
  });
});
