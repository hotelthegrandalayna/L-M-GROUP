// Tests for the Accounts reports. Same rule as everywhere else: money follows the
// night stayed, and a multi-room booking is split across its rooms.
import { describe, it, expect } from "vitest";
import {
  roomLegs, legNightsInMonth, roomStats, acStats, nightsSold, occupancy,
  discountStats, paymentStats, patternStats, revenueByDay, revenueByMonth, salaryStats,
  costByCategoryOverMonths, weekdayStats, WEEKDAYS, sourceStats, referrerStats, referrerKey,
  revenueByWeek, weekBuckets, weekExtremes,
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

  // The hotel is SIX rooms. 107 (game zone) and 108 (pray room) take an overflow
  // guest when it is already full, and counting them as sellable made a
  // completely full night read as 75% on the Desk and 20% for the month.
  describe("only the real guest rooms count", () => {
    const guestRooms = ["101", "102", "103", "104", "105", "106"];
    const withOverflow = [
      ...bookings,
      { id: 9, guest: "Overflow", room: "107", status: "checked-out",
        checkin: "2026-08-20", checkout: "2026-08-22", nights: 2, invoiceTotal: 2000,
        paymentHistory: [{ ts: "2026-08-20T10:00:00Z", amount: 2000, method: "Cash" }] },
    ];

    it("measures against six rooms, not eight", () => {
      const occ = occupancy(bookings, guestRooms, "2026-08");
      expect(occ.available).toBe(6 * 31);
      expect(occ.pct).toBe(Math.round(6 / 186 * 100));
    });

    it("reports overflow nights separately instead of hiding them", () => {
      const occ = occupancy(withOverflow, guestRooms, "2026-08");
      expect(occ.sold).toBe(6);        // guest rooms only
      expect(occ.overflow).toBe(2);    // the two nights in 107
    });

    it("can never exceed 100% just because the overflow rooms were used", () => {
      const everyRoomEveryNight = guestRooms.map((room, i) => ({
        id: 200 + i, guest: "G", room, status: "checked-out",
        checkin: "2026-09-01", checkout: "2026-10-01", nights: 30, invoiceTotal: 1000,
      }));
      const occ = occupancy([...everyRoomEveryNight,
        { id: 300, guest: "X", room: "108", status: "checked-out",
          checkin: "2026-09-05", checkout: "2026-09-07", nights: 2, invoiceTotal: 500 },
      ], guestRooms, "2026-09");
      expect(occ.pct).toBe(100);
      expect(occ.overflow).toBe(2);
    });

    it("still accepts a plain room count, so older callers keep working", () => {
      expect(occupancy(bookings, 6, "2026-08").available).toBe(6 * 31);
    });
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
  // The DAILY series is money received — payment dates — by the owner's decision,
  // so a day means "what came in that day" and matches the Desk. It used to
  // assert the billed, night-split figure (…+ 1500, half the boundary stay); that
  // was the old rule and the assertion is deliberately changed, not patched to
  // pass. The MONTHLY series below still follows the night stayed, unchanged.
  it("daily money received falls on the day the payment landed", () => {
    const days = revenueByDay(bookings, [], "2026-08");
    const total = days.reduce((s, d) => s + d.amount, 0);
    // The 31 Jul → 2 Aug stay was paid in full on 1 Aug, so all 3,000 is August.
    expect(total).toBeCloseTo(3400 + 6800 + 3000, 2);
    expect(days.find(d => d.day === "2026-08-01").amount).toBeCloseTo(3000, 2);
    expect(days.find(d => d.day === "2026-08-07").amount).toBeCloseTo(3400 + 6800, 2);
  });

  it("a cancelled booking never reaches the daily series", () => {
    // Booking 4 is cancelled with nothing kept — its 9,999 must not appear.
    const days = revenueByDay(bookings, [], "2026-08");
    expect(days.find(d => d.day === "2026-08-04")).toBeUndefined();
  });

  it("monthly series splits a boundary stay across both months", () => {
    const months = revenueByMonth(bookings, []);
    const jul = months.find(m => m.month === "2026-07");
    const aug = months.find(m => m.month === "2026-08");
    expect(jul.amount).toBeCloseTo(1500, 2);
    expect(aug.amount).toBeCloseTo(3400 + 6800 + 1500, 2);
  });
});

describe("the weekly money-received chart", () => {
  // Two faults this guards, both of which shipped:
  //  1. a week that earned nothing vanished from the chart entirely, so bars
  //     labelled 1, 3 and 5 sat side by side and read as consecutive weeks;
  //  2. the last week of a 31-day month is THREE days, and was being crowned
  //     "quietest week" for being short.
  const rev = [
    { id: 1, date: "2026-08-03", amount: 5000 },   // week 1
    { id: 2, date: "2026-08-18", amount: 3000 },   // week 3
    { id: 3, date: "2026-08-30", amount: 900 },    // week 5, only 3 days long
  ];

  it("draws every week of the month, including the empty ones", () => {
    const rows = revenueByWeek([], rev, "2026-08");
    expect(rows.map(r => r.label)).toEqual(["Week 1","Week 2","Week 3","Week 4","Week 5"]);
    expect(rows.find(r => r.label === "Week 2").amount).toBe(0);
    expect(rows.find(r => r.label === "Week 4").amount).toBe(0);
  });

  it("puts each week's takings in the right week", () => {
    const rows = revenueByWeek([], rev, "2026-08");
    expect(rows.map(r => r.amount)).toEqual([5000, 0, 3000, 0, 900]);
  });

  it("adds up to the month's receipts", () => {
    const rows = revenueByWeek([], rev, "2026-08");
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(8900);
  });

  it("says how long each week is, so the short last one is obvious", () => {
    const b = weekBuckets("2026-08");
    expect(b.map(x => x.days)).toEqual([7,7,7,7,3]);
    expect(b[4].short).toBe(true);
    expect(b[0].short).toBe(false);
    expect(b[4].sub).toBe("29–31 Aug");
  });

  it("handles February, where the last week is exactly 28", () => {
    expect(weekBuckets("2026-02").map(x => x.days)).toEqual([7,7,7,7]);
    expect(weekBuckets("2026-02").every(x => !x.short)).toBe(true);
  });

  it("never names a three-day week the quietest", () => {
    const rows = revenueByWeek([], rev, "2026-08");   // no `today` — month is over
    const { quiet } = weekExtremes(rows);
    expect(quiet.label).not.toBe("Week 5");
    expect(quiet.amount).toBe(0);                     // a genuinely dead week
  });

  it("does not rank the week that is still running", () => {
    // Mid-month: today is the 15th, so week 3 has had one day.
    const rows = revenueByWeek([], rev, "2026-08", "2026-08-15");
    const wk3 = rows.find(r => r.label === "Week 3");
    expect(wk3.inProgress).toBe(true);
    expect(wk3.rankable).toBe(false);
    expect(rows.find(r => r.label === "Week 4").future).toBe(true);
    const { best, quiet } = weekExtremes(rows);
    expect([best.label, quiet.label]).not.toContain("Week 3");
    expect([best.label, quiet.label]).not.toContain("Week 4");
  });

  it("ranks nothing until two weeks have finished", () => {
    const rows = revenueByWeek([], rev, "2026-08", "2026-08-05");
    expect(weekExtremes(rows).best).toBeNull();
  });

  it("treats a month that is over as fully rankable", () => {
    const rows = revenueByWeek([], rev, "2026-08", "2026-09-10");
    expect(rows.every(r => r.rankable)).toBe(true);
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

describe("where bookings come from", () => {
  const srcBookings = [
    { id: 1, room: "101", status: "checked-out", checkin: "2026-08-01", checkout: "2026-08-02", nights: 1, invoiceTotal: 2000, source: "Walk-in" },
    { id: 2, room: "102", status: "checked-out", checkin: "2026-08-02", checkout: "2026-08-03", nights: 1, invoiceTotal: 2000, source: "Walk-in" },
    { id: 3, room: "103", status: "checked-out", checkin: "2026-08-03", checkout: "2026-08-04", nights: 1, invoiceTotal: 9000, source: "Referral", referredByName: "Md Iqbal" },
    { id: 4, room: "104", status: "checked-out", checkin: "2026-08-04", checkout: "2026-08-05", nights: 1, invoiceTotal: 5000, source: "Referral", referredByName: "MD IQBAL" },
    { id: 5, room: "105", status: "checked-out", checkin: "2026-08-05", checkout: "2026-08-06", nights: 1, invoiceTotal: 1000, source: "Referral", referredByName: "Hridoy" },
    { id: 6, room: "106", status: "cancelled",   checkin: "2026-08-06", checkout: "2026-08-07", nights: 1, invoiceTotal: 99999, source: "OTA", referredByName: "Ghost" },
    // stay spanning July → August, so only half its money belongs to August
    { id: 7, room: "101", status: "checked-out", checkin: "2026-07-31", checkout: "2026-08-02", nights: 2, invoiceTotal: 4000, source: "Phone" },
  ];

  it("ranks sources by how many bookings they bring", () => {
    const s = sourceStats(srcBookings, "2026-08");
    expect(s.top.source).toBe("Referral");
    expect(s.top.bookings).toBe(3);
    expect(s.second.source).toBe("Walk-in");
  });

  it("names the source that pays best per booking", () => {
    const s = sourceStats(srcBookings, "2026-08");
    expect(s.richest.source).toBe("Referral");   // 15,000 over 3 bookings
    expect(s.richest.avgPerBooking).toBe(5000);
  });

  it("counts only the nights that fall in the month", () => {
    const s = sourceStats(srcBookings, "2026-08");
    const phone = s.rows.find(r => r.source === "Phone");
    expect(phone.nights).toBe(1);
    expect(phone.revenue).toBeCloseTo(2000, 2);  // half of a 4,000 two-night stay
  });

  it("never counts a cancelled booking", () => {
    const s = sourceStats(srcBookings, "2026-08");
    expect(s.rows.find(r => r.source === "OTA").bookings).toBe(0);
    expect(s.totalBookings).toBe(6);
  });

  it("keeps every source visible even with no bookings", () => {
    const s = sourceStats([], "2026-08");
    expect(s.rows).toHaveLength(6);
    expect(s.top).toBeNull();
  });

  it("merges referrer names that differ only by case or spacing", () => {
    expect(referrerKey("  MD   IQBAL ")).toBe(referrerKey("Md Iqbal"));
    const r = referrerStats(srcBookings, "2026-08");
    expect(r.people).toBe(2);
    const iqbal = r.rows[0];
    expect(iqbal.count).toBe(2);
    expect(iqbal.revenue).toBeCloseTo(14000, 2);
    expect(iqbal.spellings).toBe(2);
  });

  it("prefers the tidiest spelling over the shouted one", () => {
    const r = referrerStats(srcBookings, "2026-08");
    expect(r.rows[0].name).toBe("Md Iqbal");
  });

  it("keeps genuinely different spellings apart", () => {
    expect(referrerKey("Md Ikbal")).not.toBe(referrerKey("Md Iqbal"));
  });

  it("ignores cancelled bookings and bookings with no referrer", () => {
    const r = referrerStats(srcBookings, "2026-08");
    expect(r.rows.find(x => x.name === "Ghost")).toBeUndefined();
    expect(r.bookings).toBe(3);
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
