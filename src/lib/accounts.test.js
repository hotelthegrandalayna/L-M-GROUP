// Tests for the Accounts reports. Same rule as everywhere else: money follows the
// night stayed, and a multi-room booking is split across its rooms.
import { describe, it, expect } from "vitest";
import {
  roomLegs, legNightsInMonth, roomStats, acStats, nightsSold, occupancy,
  discountStats, paymentStats, patternStats, revenueByDay, revenueByMonth, salaryStats,
  costByCategoryOverMonths, weekdayStats, WEEKDAYS,
} from "./accounts";

const rooms = [
  { number: "101", name: "Orchid Blue" }, { number: "103", name: "Jasmine Dew" },
  { number: "104", name: "Rose Valley" }, { number: "105", name: "Lavender Bloom" },
  { number: "106", name: "Lotus Glow" },
];

const bookings = [
  // single room, 1 night, AC
  { id: 1, guest: "A", room: "101", status: "checked-out", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1,
    invoiceTotal: 3400, acChoice: "AC", discAmt: 0, paymentMethod: "Cash",
    paymentHistory: [{ ts: "2026-08-07T10:00:00Z", amount: 3400, method: "Cash" }] },
  // multi-room: 103 primary + 104/105/106 extras, 1 night
  { id: 2, guest: "B", room: "103", status: "checked-out", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1,
    invoiceTotal: 6800, acChoice: "Non-AC", discAmt: 2200, paymentMethod: "Cash",
    extraRooms: [
      { number: "104", acChoice: "Non-AC", amount: 1700, discAmt: 300 },
      { number: "105", acChoice: "AC",     amount: 1700, discAmt: 800 },
      { number: "106", acChoice: "AC",     amount: 1700, discAmt: 800 },
    ],
    paymentHistory: [{ ts: "2026-08-07T16:00:00Z", amount: 6800, method: "Cash" }] },
  // month-boundary stay: 31 Jul → 2 Aug, 2 nights
  { id: 3, guest: "C", room: "101", status: "checked-out", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2,
    invoiceTotal: 3000, acChoice: "AC", discAmt: 0, paymentMethod: "bKash",
    paymentHistory: [{ ts: "2026-08-01T10:00:00Z", amount: 3000, method: "bKash" }] },
  // cancelled — must never count
  { id: 4, guest: "X", room: "104", status: "cancelled", checkin: "2026-08-04", checkout: "2026-08-05", nights: 1,
    invoiceTotal: 9999, acChoice: "AC", paymentHistory: [{ ts: "2026-08-04T10:00:00Z", amount: 9999 }] },
];

describe("room legs and nights", () => {
  it("splits a multi-room booking into one leg per room", () => {
    expect(roomLegs(bookings[1]).map(l => l.number)).toEqual(["103", "104", "105", "106"]);
  });

  it("the legs' money adds up to the invoice total", () => {
    const sum = roomLegs(bookings[1]).reduce((s, l) => s + l.amount, 0);
    expect(sum).toBeCloseTo(6800, 2);
  });

  it("counts only the nights that fall in the month", () => {
    const leg = roomLegs(bookings[2])[0]; // 31 Jul → 2 Aug
    expect(legNightsInMonth(leg, "2026-07")).toBe(1);
    expect(legNightsInMonth(leg, "2026-08")).toBe(1);
    expect(legNightsInMonth(leg, "")).toBe(2);
  });
});

describe("room performance", () => {
  const stats = roomStats(bookings, rooms, "2026-08");

  it("ranks rooms by revenue and ignores cancelled bookings", () => {
    expect(stats[0].revenue).toBeGreaterThan(0);
    // room 104's only other booking was cancelled, so it should show just the multi-room leg
    const r104 = stats.find(r => r.number === "104");
    expect(r104.revenue).toBeCloseTo(1700, 2);
  });

  it("gives every room an average rate", () => {
    const r101 = stats.find(r => r.number === "101");
    expect(r101.nights).toBe(2);        // 1 night booking + 1 August night of the boundary stay
    expect(r101.avgRate).toBeGreaterThan(0);
  });
});

describe("AC vs non-AC", () => {
  it("counts nights and revenue per choice", () => {
    const ac = acStats(bookings, "2026-08");
    expect(ac.AC.nights).toBeGreaterThan(0);
    expect(ac["Non-AC"].nights).toBeGreaterThan(0);
    expect(ac.AC.avgRate).toBeGreaterThan(0);
  });

  it("never counts a cancelled booking", () => {
    const ac = acStats(bookings, "2026-08");
    const totalNights = ac.AC.nights + ac["Non-AC"].nights + ac["Not set"].nights;
    expect(totalNights).toBe(nightsSold(bookings, "2026-08"));
  });
});

describe("nights sold and occupancy", () => {
  it("counts every room-night", () => {
    // Aug: booking1 = 1 night on 101; booking2 = 4 rooms x 1 night; booking3 = 1 Aug night
    expect(nightsSold(bookings, "2026-08")).toBe(6);
  });

  it("occupancy is nights sold over rooms times days", () => {
    const occ = occupancy(bookings, 8, "2026-08");
    expect(occ.available).toBe(8 * 31);
    expect(occ.sold).toBe(6);
    expect(occ.pct).toBe(Math.round(6 / 248 * 100));
  });
});

describe("discounts", () => {
  it("totals discounts and finds the biggest", () => {
    const d = discountStats(bookings, "2026-08");
    expect(d.total).toBe(2200);
    expect(d.count).toBe(1);
    expect(d.biggest.room).toBe("103");
    expect(d.gross).toBe(d.billed + d.total);
  });
});

describe("payments and cash", () => {
  const expenses = [
    { date: "2026-08-03", amount: 1000, method: "Cash", category: "Laundry" },
    { date: "2026-08-04", amount: 500, method: "bKash", category: "Misc" },
  ];

  it("splits collections by method", () => {
    const p = paymentStats(bookings, "2026-08", expenses);
    const cash = p.rows.find(r => r.method === "Cash");
    expect(cash.amount).toBeCloseTo(3400 + 6800, 2);
    expect(p.rows.find(r => r.method === "bKash").amount).toBeCloseTo(3000, 2);
  });

  it("works out the cash the manager should hold", () => {
    const p = paymentStats(bookings, "2026-08", expenses);
    expect(p.cashOut).toBe(1000);                 // only the cash expense
    expect(p.cashExpected).toBeCloseTo(10200 - 1000, 2);
  });
});

describe("booking pattern", () => {
  it("reports stay length, multi-room count and extension revenue", () => {
    const p = patternStats(bookings, "2026-08");
    expect(p.multiRoom).toBe(1);
    expect(p.avgStay).toBeGreaterThan(0);
    expect(p.extensionRevenue).toBe(0);
  });
});

describe("revenue series", () => {
  it("daily revenue sums to the month's room revenue", () => {
    const days = revenueByDay(bookings, [], "2026-08");
    const total = days.reduce((s, d) => s + d.amount, 0);
    expect(total).toBeCloseTo(3400 + 6800 + 1500, 2); // boundary stay contributes half
  });

  it("monthly series splits a boundary stay across both months", () => {
    const months = revenueByMonth(bookings, []);
    const jul = months.find(m => m.month === "2026-07");
    const aug = months.find(m => m.month === "2026-08");
    expect(jul.amount).toBeCloseTo(1500, 2);
    expect(aug.amount).toBeCloseTo(3400 + 6800 + 1500, 2);
  });
});

describe("salary", () => {
  const expenses = [
    { date: "2026-08-01", amount: 9000, category: "Salaries", empName: "Iqbal", empRole: "Housekeeping" },
    { date: "2026-08-01", amount: 7000, category: "Salaries", empName: "Rana", empRole: "Front desk" },
    { date: "2026-08-02", amount: 500,  category: "Laundry" },
    { date: "2026-07-01", amount: 9000, category: "Salaries", empName: "Iqbal" },
  ];

  it("groups salary by employee for the month", () => {
    const s = salaryStats(expenses, "2026-08");
    expect(s.count).toBe(2);
    expect(s.total).toBe(16000);
    expect(s.staff[0].name).toBe("Iqbal");
    expect(s.staff[0].role).toBe("Housekeeping");
  });

  it("excludes non-salary expenses", () => {
    expect(salaryStats(expenses, "2026-08").total).toBe(16000);
  });
});

describe("which weekday earns most", () => {
  const pay = (ts, amount) => ({ ts, amount, method: "Cash", note: "Advance paid", type: "room" });
  // August 2026: 7th is a Friday, 8th a Saturday. Two Friday stays, one Monday stay.
  const wdBookings = [
    { id: 1, guest: "A", room: "101", status: "checked-out", checkin: "2026-08-07", checkout: "2026-08-08", nights: 1, invoiceTotal: 5000, paymentHistory: [pay("2026-08-07T10:00:00Z", 5000)] },
    { id: 2, guest: "B", room: "102", status: "checked-out", checkin: "2026-08-14", checkout: "2026-08-15", nights: 1, invoiceTotal: 3000, paymentHistory: [pay("2026-08-14T10:00:00Z", 3000)] },
    { id: 3, guest: "C", room: "103", status: "checked-out", checkin: "2026-08-03", checkout: "2026-08-04", nights: 1, invoiceTotal: 1000, paymentHistory: [pay("2026-08-03T10:00:00Z", 1000)] },
  ];

  it("finds Friday as the strongest weekday", () => {
    const s = weekdayStats(wdBookings, [], ["2026-08"]);
    expect(s.best.label).toBe("Fri");
    expect(s.best.total).toBe(8000);          // both Friday stays
  });

  it("averages per weekday rather than totalling", () => {
    const s = weekdayStats(wdBookings, [], ["2026-08"]);
    const fri = s.rows.find(r => r.label === "Fri");
    expect(fri.days).toBe(4);                  // August 2026 has 4 Fridays
    expect(fri.avg).toBeCloseTo(8000 / 4, 2);
  });

  it("reports the best and quietest day for each month", () => {
    const s = weekdayStats(wdBookings, [], ["2026-08"]);
    expect(s.perMonth).toHaveLength(1);
    expect(WEEKDAYS[s.perMonth[0].bestWd]).toBe("Fri");
    expect(s.perMonth[0].bestAmount).toBe(8000);
    expect(WEEKDAYS[s.perMonth[0].quietWd]).toBe("Mon");
  });

  it("counts in how many months that day was top", () => {
    const s = weekdayStats(wdBookings, [], ["2026-08"]);
    expect(s.topCount).toBe(1);
    expect(s.monthCount).toBe(1);
  });

  it("copes with a period that earned nothing", () => {
    const s = weekdayStats([], [], ["2026-08"]);
    expect(s.best).toBeNull();
    expect(s.topCount).toBe(0);
  });

  it("never counts cancelled bookings", () => {
    const withCancelled = [...wdBookings,
      { id: 9, guest: "X", room: "104", status: "cancelled", checkin: "2026-08-10", checkout: "2026-08-11", nights: 1, invoiceTotal: 99999, paymentHistory: [pay("2026-08-10T10:00:00Z", 99999)] }];
    const s = weekdayStats(withCancelled, [], ["2026-08"]);
    expect(s.best.label).toBe("Fri");
    expect(s.rows.reduce((t, r) => t + r.total, 0)).toBe(9000);
  });
});

describe("cost by category over months", () => {
  it("builds a per-category series across the given months", () => {
    const expenses = [
      { date: "2026-07-05", amount: 20000, category: "Salaries" },
      { date: "2026-08-05", amount: 5520,  category: "Miscellaneous" },
      { date: "2026-08-06", amount: 720,   category: "Guest Amenities" },
    ];
    const rows = costByCategoryOverMonths(expenses, ["2026-07", "2026-08"]);
    expect(rows[0].cat).toBe("Salaries");
    expect(rows[0].byMonth["2026-07"]).toBe(20000);
    expect(rows.find(r => r.cat === "Miscellaneous").byMonth["2026-08"]).toBe(5520);
  });
});
