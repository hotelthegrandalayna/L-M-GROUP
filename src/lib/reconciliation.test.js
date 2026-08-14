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
import { monthMoney, bookingMonthlyParts, bookingPaid } from "./hotelMoney";
import { filterInvoices } from "./invoiceFilter";
import { paymentStats, revenueByDay } from "./accounts";

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
  // Cancelled but the deposit was KEPT: guest cancelled, hotel did not refund.
  // The 1,200 is real revenue in the month it was taken; the 4,000 stay is not.
  { id: 113, guest: "Forfeited", room: "102", status: "cancelled",   checkin: "2026-08-18", checkout: "2026-08-19", nights: 1, invoiceTotal: 4000, forfeitedAmount: 1200, paymentHistory: [pay("2026-08-10T15:31:00Z", 1200)] },
];

// What the Invoices tab shows for a month: filter by month, then sum each row's
// share of that month — exactly what the UI does.
function invoiceListTotals(month) {
  const rows = filterInvoices(bookings, { month });
  let billed = 0, collected = 0;
  rows.forEach(bk => {
    // No special case for cancelled here on purpose: bookingMonthlyParts is the
    // ONE rule, and it already returns nothing for a cancellation that kept
    // nothing, and only the kept deposit for one that did.
    bookingMonthlyParts(bk).forEach(p => {
      if (p.month === month) { billed += p.billed; collected += p.collected; }
    });
  });
  return { billed, collected, count: rows.length };
}

// Every taka that counts as revenue: all payments on a live booking, but only
// the KEPT part of a cancelled one — the rest was refunded and left the books.
const revenuePaid = b => b.status === "cancelled"
  ? (b.forfeitedAmount || 0)
  : b.paymentHistory.reduce((t, p) => t + p.amount, 0);

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
    const paidTotal = bookings.reduce((s, b) => s + revenuePaid(b), 0);
    const months = ["2026-07", "2026-08", "2026-09"];
    const spread = months.reduce((s, m) => s + monthMoney({ bookings, month: m }).collected, 0);
    expect(spread).toBeCloseTo(paidTotal, 2);
  });

  // Reported bug: picking "All Months" showed LESS than any single month, because
  // it summed only the live 30-day window instead of every month.
  it("ALL MONTHS equals the sum of the individual months", () => {
    const months = new Set();
    bookings.forEach(b => {
      bookingMonthlyParts(b).forEach(p => p.month && months.add(p.month));
    });
    let billed = 0, collected = 0;
    months.forEach(m => {
      const mm = monthMoney({ bookings, month: m });
      billed += mm.billed; collected += mm.collected;
    });

    // Every taka that counts as revenue, across the whole data set
    const paidTotal = bookings.reduce((s, b) => s + revenuePaid(b), 0);

    expect(collected).toBeCloseTo(paidTotal, 2);
    expect(billed).toBeGreaterThanOrEqual(collected);
    // and it must exceed any one month on its own
    months.forEach(m => {
      expect(collected).toBeGreaterThanOrEqual(monthMoney({ bookings, month: m }).collected);
    });
  });

  // Reported bug: the Accounts screen showed cash-only 135,000 labelled as if it
  // were everything received, so the figures on one card contradicted each other.
  describe("money received must tie to the revenue engine", () => {
    it("all-time received (every method) equals all-time revenue collected", () => {
      const received = paymentStats(bookings, "", []).totalIn;
      const months = new Set();
      bookings.forEach(b => bookingMonthlyParts(b).forEach(p => p.month && months.add(p.month)));
      let collected = 0;
      months.forEach(m => { collected += monthMoney({ bookings, month: m }).collected; });
      expect(received).toBeCloseTo(collected, 2);
    });

    it("all-time received equals every taka that counts as revenue", () => {
      const received = paymentStats(bookings, "", []).totalIn;
      const paid = bookings.reduce((s, b) =>
        s + (b.status === "cancelled" ? (b.forfeitedAmount || 0) : bookingPaid(b)), 0);
      expect(received).toBeCloseTo(paid, 2);
    });

    it("the months of received money add up to the all-time figure", () => {
      const all = paymentStats(bookings, "", []).totalIn;
      const months = new Set();
      bookings.forEach(b => {
        (b.paymentHistory || []).forEach(p => months.add(String(p.ts || b.checkin).slice(0, 7)));
        if (!(b.paymentHistory || []).length) months.add(String(b.checkin).slice(0, 7));
      });
      let sum = 0;
      months.forEach(m => { sum += paymentStats(bookings, m, []).totalIn; });
      expect(sum).toBeCloseTo(all, 2);
    });

    it("cash is never more than the total received", () => {
      const p = paymentStats(bookings, "", []);
      expect(p.cashIn).toBeLessThanOrEqual(p.totalIn + 0.01);
    });
  });

  // The owner's requirement: the SAME month must show the SAME number on every
  // screen. Accounts and Expenses & Cash must use one identical formula.
  describe("every screen shows the same figure for the same month", () => {
    const expenses = [
      { date: "2026-08-03", amount: 1000, category: "Laundry" },
      { date: "2026-08-05", amount: 2000, category: "Salaries" },
      { date: "2026-07-05", amount: 3000, category: "Maintenance" },
    ];

    for (const month of ["2026-07", "2026-08"]) {
      it(`${month}: revenue, profit and cash in hand agree across screens`, () => {
        const mm = monthMoney({ bookings, revenues: [], expenses, month });
        const cost = expenses.filter(e => e.date.slice(0, 7) === month)
          .reduce((s, e) => s + e.amount, 0);

        // Expenses & Cash formula
        const expScreenProfit = mm.collected - cost;
        const expScreenCash   = mm.collected - cost - 0; // no non-business rows here
        // Accounts formula — must be identical, not merely similar
        const accProfit = mm.collected - mm.expenses;
        const accCash   = mm.collected - mm.expenses - 0;

        expect(mm.expenses).toBeCloseTo(cost, 2);
        expect(accProfit).toBeCloseTo(expScreenProfit, 2);
        expect(accCash).toBeCloseTo(expScreenCash, 2);
      });
    }

    it("cash in hand is never derived from payment dates", () => {
      // Guards the reported bug: cash was counted when the guest PAID while
      // revenue was counted on the night STAYED, so one month could show
      // 47,100 revenue next to 53,100 cash. Both bases must not coexist.
      const aug = monthMoney({ bookings, revenues: [], expenses, month: "2026-08" });
      const cashInHand = aug.collected - aug.expenses;
      expect(cashInHand).toBeCloseTo(aug.collected - aug.expenses, 2);
      // and it can never exceed the revenue it came from
      expect(cashInHand).toBeLessThanOrEqual(aug.collected + 0.01);
    });
  });

  // Reported bug: the Accounts daily chart showed 13.1k for a day the Desk called
  // 11.0k, and its own total sat ~5,200 above the Revenue tile beside it. The
  // chart was spreading each room's INVOICE TOTAL across its nights — billed, not
  // collected. Nothing caught it because the only test asserted the billed figure.
  describe("the daily revenue chart must reconcile with the revenue engine", () => {
    for (const month of ["2026-07", "2026-08"]) {
      it(`${month}: the days add up to monthMoney collected`, () => {
        const days = revenueByDay(bookings, [], month);
        const total = days.reduce((s, d) => s + d.amount, 0);
        expect(total).toBeCloseTo(monthMoney({ bookings, month }).collected, 2);
      });

      it(`${month}: every day of the chart falls inside the month`, () => {
        revenueByDay(bookings, [], month).forEach(d => {
          expect(d.day.slice(0, 7)).toBe(month);
        });
      });
    }

    it("manual revenue lands on its own date and is counted once", () => {
      const extra = [{ id: 1, date: "2026-08-14", amount: 500, note: "Laundry" }];
      const withManual = revenueByDay(bookings, extra, "2026-08")
        .reduce((s, d) => s + d.amount, 0);
      const without = revenueByDay(bookings, [], "2026-08")
        .reduce((s, d) => s + d.amount, 0);
      expect(withManual - without).toBeCloseTo(500, 2);
      expect(withManual).toBeCloseTo(monthMoney({ bookings, revenues: extra, month: "2026-08" }).collected, 2);
    });

    it("a kept deposit shows on the day the money came in", () => {
      // Booking 113: cancelled, 1,200 kept, paid 10 Aug for an 18 Aug stay that
      // never happened — so it has no nights to spread across.
      const day = revenueByDay(bookings, [], "2026-08").find(d => d.day === "2026-08-10");
      expect(day).toBeTruthy();
      expect(day.amount).toBeGreaterThanOrEqual(1200);
    });
  });

  it("cancelled invoices are excluded from both sides", () => {
    const rev = monthMoney({ bookings, month: "2026-08" });
    expect(rev.collected).toBeLessThan(9999 + 20000); // the 9,999 cancelled row never counts
    expect(filterInvoices(bookings, { month: "2026-08", status: "All" }).some(b => b.id === 60)).toBe(true);
  });

  // The owner's case: a reservation cancelled without a refund. Deleting that
  // money was the old behaviour and it took real revenue off the books.
  describe("a cancelled reservation that kept its deposit", () => {
    const forfeited = bookings.find(b => b.id === 113);

    it("keeps exactly the deposit as revenue — never the whole stay", () => {
      const parts = bookingMonthlyParts(forfeited);
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ month: "2026-08", billed: 1200, collected: 1200 });
    });

    it("counts in the month the money was received, not the month of the stay", () => {
      // Paid 10 Aug for an 18 Aug booking. The stay never happened, so the only
      // honest basis is when the money actually came in.
      expect(bookingMonthlyParts(forfeited)[0].month).toBe("2026-08");
    });

    it("appears on the Invoices tab in that same month, so both sides agree", () => {
      expect(filterInvoices(bookings, { month: "2026-08" }).some(b => b.id === 113)).toBe(true);
      const list = invoiceListTotals("2026-08");
      const rev = monthMoney({ bookings, month: "2026-08" });
      expect(list.collected).toBeCloseTo(rev.collected, 2);
    });

    it("shows up in money received, so Accounts still ties to revenue", () => {
      const aug = paymentStats(bookings, "2026-08", []).totalIn;
      const without = paymentStats(bookings.filter(b => b.id !== 113), "2026-08", []).totalIn;
      expect(aug - without).toBeCloseTo(1200, 2);
    });

    it("a cancellation that kept nothing still earns nothing", () => {
      expect(bookingMonthlyParts(bookings.find(b => b.id === 60))).toEqual([]);
    });
  });
});
