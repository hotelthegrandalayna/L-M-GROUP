// Guards the coffee house arithmetic. The invariant that matters most:
// every taka the manager logs must land in net profit exactly once — never
// twice, never nowhere — however it was filed.
import { describe, it, expect } from "vitest";
import {
  monthSummary, expectedCashOn, dailyCloses, monthsWithData, ownerTookIn,
  prevMonth, nextMonth, emptyRestaurant, normalise, mergeRestaurant,
  monthReport, reportExtremes, productPer100, recordCounts, receiptIdsIn,
  clearMonth, monthsAffectedBy,
} from "./restaurantMoney";

const sale  = (date, cash, refunds = 0) => ({ id: date, date, cash, refunds });
const shelf = (date, amount, what = "beans") => ({ id: "s" + date + amount, date, what, amount, isStock: true });
const cost  = (date, amount, what = "Rent")  => ({ id: "c" + date + amount, date, what, amount, isStock: false });

describe("the owner's worked example", () => {
  // Revenue 12,000 · opening stock 2,000 · bought 4,000 · closing 2,500
  // → goods used 3,500 · gross 8,500 · other expenses 5,000 · net 3,500
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-05", 12000)],
    spend: [shelf("2026-08-06", 4000), cost("2026-08-07", 5000)],
    months: { "2026-08": { openCash: 3000, openStock: 2000, closeStock: 2500 } },
  };
  const s = monthSummary(data, "2026-08");

  it("computes cost of goods used as opening + bought − closing", () => expect(s.cogs).toBe(3500));
  it("computes gross profit as revenue − goods used", () => {
    expect(s.revenue).toBe(12000);
    expect(s.gross).toBe(8500);
  });
  it("computes net profit as gross − other expenses", () => {
    expect(s.otherExpenses).toBe(5000);
    expect(s.net).toBe(3500);
  });
});

describe("one list, one tick, no taka lost", () => {
  it("sends shelf items through goods used and running costs straight off profit", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 1000)],
      spend: [shelf("2026-08-02", 300), cost("2026-08-03", 150, "Cleaning")],
      months: { "2026-08": { openStock: 0, closeStock: 300 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.cogs).toBe(0);             // the 300 of stock is still on the shelf
    expect(s.otherExpenses).toBe(150);
    expect(s.net).toBe(850);            // 1000 − 0 − 150
  });

  it("net profit always equals revenue minus every cost, however it was filed", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 1000, 50)],
      spend: [shelf("2026-08-02", 400), cost("2026-08-03", 260), cost("2026-08-04", 90)],
      months: { "2026-08": { openStock: 100, closeStock: 350 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.net).toBe(s.revenue - (s.openStock + s.stockPurchases - s.closeStock) - s.otherExpenses);
    expect(s.revenue).toBe(950);
    expect(s.spendTotal).toBe(750);
  });

  it("treats a row with no tick recorded as shelf stock", () => {
    const data = {
      ...emptyRestaurant(),
      spend: [{ id: 1, date: "2026-08-02", what: "beans", amount: 500 }],
      months: { "2026-08": { openStock: 0, closeStock: 0 } },
    };
    expect(monthSummary(data, "2026-08").stockPurchases).toBe(500);
  });
});

describe("records made before the two screens merged", () => {
  it("folds old purchases and expenses into the one list", () => {
    const legacy = {
      sales: [sale("2026-07-01", 900)],
      purchases: [{ id: "p1", date: "2026-07-02", what: "Milk", amount: 200, isStock: true }],
      expenses: [{ id: "e1", date: "2026-07-03", cat: "Rent", desc: "July", amount: 300 }],
      months: { "2026-07": { openStock: 0, closeStock: 200 } },
    };
    const n = normalise(legacy);
    expect(n.spend).toHaveLength(2);
    expect(n.spend.find(r => r.id === "e1").what).toBe("Rent — July");
    expect(n.spend.find(r => r.id === "e1").isStock).toBe(false);

    const s = monthSummary(legacy, "2026-07");
    expect(s.stockPurchases).toBe(200);
    expect(s.otherExpenses).toBe(300);
    expect(s.net).toBe(600);            // 900 − 0 goods used − 300
  });

  it("still counts card and mobile takings already typed, and keeps them out of the drawer", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [{ id: 1, date: "2026-08-01", cash: 500, card: 300, mobile: 200 }],
      months: { "2026-08": { openCash: 0, openStock: 0, closeStock: 0 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.revenue).toBe(1000);
    expect(s.expectedCash).toBe(500);
  });

  it("keeps a legacy card payment out of the drawer sum", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 1000)],
      spend: [{ id: 1, date: "2026-08-02", what: "x", amount: 400, isStock: false, method: "Card" }],
      months: { "2026-08": { openCash: 0, openStock: 0, closeStock: 0 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.otherExpenses).toBe(400);   // still a cost
    expect(s.expectedCash).toBe(1000);   // but it never left the drawer
  });
});

describe("the cash drawer", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 7200)],
    spend: [shelf("2026-08-02", 2600), cost("2026-08-03", 3200)],
    ownerMoves: [{ id: 1, date: "2026-08-20", dir: "out", amount: 200 }],
    counts: [{ date: "2026-08-31", counted: 4150 }],
    months: { "2026-08": { openCash: 3000, openStock: 0, closeStock: 0 } },
  };
  const s = monthSummary(data, "2026-08");

  it("expects opening + cash taken − everything paid out", () => expect(s.expectedCash).toBe(4200));
  it("reports the shortfall against the counted drawer", () => {
    expect(s.countedCash).toBe(4150);
    expect(s.cashDiff).toBe(-50);
  });
  it("says nothing rather than guessing when the drawer was never counted", () => {
    const s2 = monthSummary({ ...data, counts: [] }, "2026-08");
    expect(s2.countedCash).toBeNull();
    expect(s2.cashDiff).toBeNull();
  });
});

describe("owner money moves cash but never profit", () => {
  const base = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 1000)],
    months: { "2026-08": { openCash: 0, openStock: 0, closeStock: 0 } },
  };
  it("a withdrawal lowers the drawer and leaves profit alone", () => {
    const s = monthSummary({ ...base, ownerMoves: [{ id: 1, date: "2026-08-10", dir: "out", amount: 400 }] }, "2026-08");
    expect(s.expectedCash).toBe(600);
    expect(s.net).toBe(1000);
    expect(s.otherExpenses).toBe(0);
  });
  it("money put in raises the drawer and is not revenue", () => {
    const s = monthSummary({ ...base, ownerMoves: [{ id: 1, date: "2026-08-10", dir: "in", amount: 500 }] }, "2026-08");
    expect(s.expectedCash).toBe(1500);
    expect(s.revenue).toBe(1000);
    expect(s.net).toBe(1000);
  });
});

describe("closing the month and the owner taking their money", () => {
  const base = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 4000)],
    counts: [{ date: "2026-08-31", counted: 4150 }],
    months: { "2026-08": { openCash: 150, openStock: 0, closeStock: 0 } },
  };

  it("shows what would carry forward before the month is closed", () => {
    const s = monthSummary(base, "2026-08");
    expect(s.inDrawer).toBe(4150);
    expect(s.closed).toBe(false);
    expect(s.carriesForward).toBe(4150);   // nothing taken yet
  });

  it("takes LESS than is there — the rest opens next month", () => {
    const closed = { ...base, months: { "2026-08": { ...base.months["2026-08"], closed: true, ownerTook: 3000 } } };
    const aug = monthSummary(closed, "2026-08");
    expect(aug.closed).toBe(true);
    expect(aug.ownerTook).toBe(3000);
    expect(aug.carriesForward).toBe(1150);
    expect(monthSummary(closed, "2026-09").openCash).toBe(1150);
  });

  it("takes ALL of it — next month opens empty", () => {
    const closed = { ...base, months: { "2026-08": { ...base.months["2026-08"], closed: true, ownerTook: 4150 } } };
    expect(monthSummary(closed, "2026-09").openCash).toBe(0);
  });

  it("an open month hands the whole drawer on, taking nothing", () => {
    expect(monthSummary(base, "2026-09").openCash).toBe(4150);
    expect(ownerTookIn(base, "2026-08")).toBe(0);
  });

  it("carries through a closed month into the one after next", () => {
    const closed = { ...base, months: { "2026-08": { ...base.months["2026-08"], closed: true, ownerTook: 4000 } } };
    expect(monthSummary(closed, "2026-10").openCash).toBe(150);
  });

  it("closing does not touch profit", () => {
    const open   = monthSummary(base, "2026-08");
    const closed = monthSummary({ ...base, months: { "2026-08": { ...base.months["2026-08"], closed: true, ownerTook: 3000 } } }, "2026-08");
    expect(closed.net).toBe(open.net);
    expect(closed.revenue).toBe(open.revenue);
  });
});

describe("openings are never typed twice", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-07-10", 5000), sale("2026-08-10", 6000)],
    spend: [shelf("2026-07-11", 1000), shelf("2026-08-11", 2000)],
    counts: [{ date: "2026-07-31", counted: 3800 }],
    months: { "2026-07": { openCash: 1000, openStock: 500, closeStock: 900 }, "2026-08": {} },
  };
  it("carries July's closing stock into August's opening", () => {
    const aug = monthSummary(data, "2026-08");
    expect(aug.openStock).toBe(900);
    expect(aug.openStockAuto).toBe(true);
  });
  it("carries July's COUNTED drawer into August, not the calculated one", () => {
    expect(monthSummary(data, "2026-07").expectedCash).toBe(5000);
    expect(monthSummary(data, "2026-08").openCash).toBe(3800);
  });
  it("lets an explicit opening override the carried figure", () => {
    const forced = { ...data, months: { ...data.months, "2026-08": { openStock: 25, openCash: 99 } } };
    const aug = monthSummary(forced, "2026-08");
    expect(aug.openStock).toBe(25);
    expect(aug.openCash).toBe(99);
    expect(aug.openStockAuto).toBe(false);
  });
});

describe("before the manager has counted", () => {
  it("assumes nothing was consumed rather than inventing a profit", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 1000)],
      spend: [shelf("2026-08-02", 400)],
      months: { "2026-08": { openStock: 200 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.closeStockSet).toBe(false);
    expect(s.closeStock).toBe(600);
    expect(s.cogs).toBe(0);
    expect(s.net).toBe(1000);
  });
});

describe("daily closing", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 500), sale("2026-08-02", 700)],
    spend: [cost("2026-08-02", 100)],
    counts: [{ date: "2026-08-01", counted: 1500 }, { date: "2026-08-02", counted: 2050 }],
    months: { "2026-08": { openCash: 1000 } },
  };
  it("expects the drawer day by day, not just at month end", () => {
    expect(expectedCashOn(data, "2026-08-01")).toBe(1500);
    expect(expectedCashOn(data, "2026-08-02")).toBe(2100);
  });
  it("shows which day the money went missing", () => {
    const rows = dailyCloses(data, "2026-08");
    expect(rows.find(r => r.date === "2026-08-01").diff).toBe(0);
    expect(rows.find(r => r.date === "2026-08-02").diff).toBe(-50);
  });
});

describe("a sync must not swallow a row typed seconds ago", () => {
  const cloud = {
    ...emptyRestaurant(),
    sales: [{ ...sale("2026-08-01", 500), id: "s1" }],
    spend: [{ ...shelf("2026-08-01", 100), id: "p1" }],
    counts: [{ date: "2026-08-01", counted: 600 }],
    months: { "2026-08": { openCash: 100 } },
  };
  const local = {
    ...cloud,
    sales: [...cloud.sales, { ...sale("2026-08-02", 700), id: "s2" }],   // not pushed yet
    spend: [...cloud.spend, { ...shelf("2026-08-02", 50), id: "p2" }],
    counts: [...cloud.counts, { date: "2026-08-02", counted: 1250 }],
  };

  it("keeps the rows the cloud has never seen", () => {
    const m = mergeRestaurant(cloud, local);
    expect(m.sales.map(r => r.id)).toEqual(["s1", "s2"]);
    expect(m.spend.map(r => r.id)).toEqual(["p1", "p2"]);
    expect(m.counts.map(c => c.date)).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("does not duplicate a row the cloud already has", () => {
    const m = mergeRestaurant(local, local);
    expect(m.sales).toHaveLength(2);
    expect(m.counts).toHaveLength(2);
  });

  it("lets the cloud win for a month it already knows", () => {
    const c = { ...cloud, months: { "2026-08": { openCash: 999, closed: true, ownerTook: 5 } } };
    const m = mergeRestaurant(c, local);
    expect(m.months["2026-08"].openCash).toBe(999);
    expect(m.months["2026-08"].closed).toBe(true);
  });

  it("keeps a month only this device has", () => {
    const l = { ...local, months: { ...local.months, "2026-09": { openStock: 42 } } };
    const m = mergeRestaurant(cloud, l);
    expect(m.months["2026-09"].openStock).toBe(42);
  });

  it("survives an empty or missing cloud copy", () => {
    expect(mergeRestaurant(null, local).sales).toHaveLength(2);
    expect(mergeRestaurant(cloud, null).sales).toHaveLength(1);
  });
});

describe("comparing months", () => {
  // The owner's own example: July turned 3,000 of product into 7,000 gross.
  // August turned 8,000 into 10,000. August is bigger on every taka figure and
  // yet ran the worse kitchen — only the ratio shows it.
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-07-05", 10000), sale("2026-08-05", 18000)],
    spend: [shelf("2026-07-06", 3000), cost("2026-07-07", 1500),
            shelf("2026-08-06", 8000), cost("2026-08-07", 2000)],
    months: {
      "2026-07": { openStock: 0, openCash: 0, closeStock: 0 },
      "2026-08": { openStock: 0, closeStock: 0 },
    },
  };
  const rows = monthReport(data);
  const jul = rows.find(r => r.month === "2026-07");
  const aug = rows.find(r => r.month === "2026-08");

  it("reproduces the owner's figures", () => {
    expect(jul.cogs).toBe(3000);  expect(jul.gross).toBe(7000);
    expect(aug.cogs).toBe(8000);  expect(aug.gross).toBe(10000);
  });

  it("scores product used per ৳100 of sales", () => {
    expect(Math.round(jul.productPer100)).toBe(30);
    expect(Math.round(aug.productPer100)).toBe(44);
  });

  it("names the worse kitchen even though it made more money", () => {
    expect(aug.net).toBeGreaterThan(jul.net);          // August looks better...
    const { best, worst, gap } = reportExtremes(rows);
    expect(best.month).toBe("2026-07");                // ...but July ran leaner
    expect(worst.month).toBe("2026-08");
    expect(Math.round(gap)).toBe(14);
  });

  it("says how much gross profit each taka of product returned", () => {
    expect(jul.grossPerProduct).toBeCloseTo(7000/3000, 5);
    expect(aug.grossPerProduct).toBeCloseTo(10000/8000, 5);
  });

  it("refuses to score a month whose shelf was never counted", () => {
    const d2 = { ...data, sales: [...data.sales, sale("2026-09-01", 4200)] };
    const sep = monthReport(d2).find(r => r.month === "2026-09");
    expect(sep.closeStockSet).toBe(false);
    expect(sep.scorable).toBe(false);
    expect(sep.productPer100).toBeNull();
    // and it must never be crowned the best month by having no figure at all
    expect(reportExtremes(monthReport(d2)).best.month).toBe("2026-07");
  });

  it("does not score a month with no sales", () => {
    const d2 = { ...emptyRestaurant(), spend: [shelf("2026-05-01", 100)], months: { "2026-05": { closeStock: 0 } } };
    expect(monthReport(d2)[0].scorable).toBe(false);
  });

  it("gives no ranking until two months can be scored", () => {
    const one = { ...emptyRestaurant(), sales: [sale("2026-07-05", 100)], months: { "2026-07": { closeStock: 0 } } };
    expect(reportExtremes(monthReport(one)).best).toBeNull();
  });
});

describe("deleting records", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-07-05", 100), sale("2026-08-05", 200)],
    spend: [{ ...shelf("2026-07-06", 10), receiptId: "r1" }, shelf("2026-08-06", 20)],
    ownerMoves: [{ id: "o1", date: "2026-08-10", dir: "out", amount: 5 }],
    counts: [{ date: "2026-07-31", counted: 90 }, { date: "2026-08-31", counted: 180 }],
    months: { "2026-07": { closeStock: 0 }, "2026-08": { closeStock: 0 } },
  };

  it("removes one month and leaves the others untouched", () => {
    const after = clearMonth(data, "2026-07");
    expect(after.sales.map(r => r.date)).toEqual(["2026-08-05"]);
    expect(after.spend).toHaveLength(1);
    expect(after.counts.map(c => c.date)).toEqual(["2026-08-31"]);
    expect(Object.keys(after.months)).toEqual(["2026-08"]);
    expect(after.ownerMoves).toHaveLength(1);
  });

  it("clears everything when no month is named", () => {
    const after = clearMonth(data, null);
    expect(after.sales).toHaveLength(0);
    expect(after.spend).toHaveLength(0);
    expect(Object.keys(after.months)).toHaveLength(0);
  });

  it("counts back exactly what it will remove, and the total matches its own rows", () => {
    const { parts, total } = recordCounts(data, "2026-07");
    expect(parts["Days of sales"]).toBe(1);
    expect(parts["Things bought and spent"]).toBe(1);
    expect(parts["Drawer counts"]).toBe(1);
    expect(parts["Invoice photos"]).toBe(1);
    expect(parts["Month settings"]).toBe(1);
    expect(parts["Owner money records"]).toBe(0);
    // The bug this guards: the total once counted months without listing them,
    // so an empty ledger read "0, 0, 0, 0, 0 — will be deleted: 1 record".
    const listed = parts["Days of sales"] + parts["Things bought and spent"]
      + parts["Owner money records"] + parts["Drawer counts"] + parts["Month settings"];
    expect(total).toBe(listed);
  });

  it("counts the whole ledger when no month is named", () => {
    expect(recordCounts(data, null).total).toBe(2 + 2 + 1 + 2 + 2);
  });

  it("reports nothing to delete for an empty ledger", () => {
    expect(recordCounts(emptyRestaurant(), null).total).toBe(0);
    expect(recordCounts(emptyRestaurant(), "2026-08").total).toBe(0);
  });

  it("hands back the receipts it is about to orphan", () => {
    expect(receiptIdsIn(data, "2026-07")).toEqual(["r1"]);
    expect(receiptIdsIn(data, "2026-08")).toEqual([]);
    expect(receiptIdsIn(data, null)).toEqual(["r1"]);
  });

  it("warns which later months lose their carried-forward opening", () => {
    expect(monthsAffectedBy(data, "2026-07")).toEqual(["2026-08"]);
    expect(monthsAffectedBy(data, "2026-08")).toEqual([]);
  });
});

describe("housekeeping", () => {
  it("survives junk and missing data without throwing", () => {
    expect(monthSummary(null, "2026-08").net).toBe(0);
    expect(monthSummary({ sales: "nope" }, "2026-08").revenue).toBe(0);
    expect(normalise(undefined).spend).toEqual([]);
  });
  it("steps months across a year boundary", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
  it("lists only months that have something in them, oldest first", () => {
    const data = { ...emptyRestaurant(), sales: [sale("2026-08-01", 1)], spend: [cost("2026-06-01", 1)] };
    expect(monthsWithData(data)).toEqual(["2026-06", "2026-08"]);
  });
});
