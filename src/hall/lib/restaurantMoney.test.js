// Guards the coffee house arithmetic. The invariant that matters most:
// every taka the manager logs must land in net profit exactly once — never
// twice, never nowhere — however it was filed.
import { describe, it, expect } from "vitest";
import {
  monthSummary, expectedCashOn, dailyCloses, monthsWithData,
  prevMonth, nextMonth, emptyRestaurant, normalise,
} from "./restaurantMoney";

const sale = (date, cash, card = 0, mobile = 0, refunds = 0) => ({ id: date, date, cash, card, mobile, refunds });
const buy  = (date, amount, method = "Cash", isStock = true) => ({ id: "p" + date + amount, date, what: "x", amount, method, isStock });
const exp  = (date, amount, method = "Cash") => ({ id: "e" + date + amount, date, cat: "Rent", amount, method });

describe("the owner's worked example", () => {
  // Revenue 12,000 · opening stock 2,000 · purchases 4,000 · closing 2,500
  // → goods used 3,500 · gross 8,500 · other expenses 5,000 · net 3,500
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-05", 12000)],
    purchases: [buy("2026-08-06", 4000)],
    expenses: [exp("2026-08-07", 5000)],
    months: { "2026-08": { openCash: 3000, openStock: 2000, closeStock: 2500 } },
  };
  const s = monthSummary(data, "2026-08");

  it("computes cost of goods used as opening + purchases − closing", () => {
    expect(s.cogs).toBe(3500);
  });
  it("computes gross profit as revenue − goods used", () => {
    expect(s.revenue).toBe(12000);
    expect(s.gross).toBe(8500);
  });
  it("computes net profit as gross − other expenses", () => {
    expect(s.otherExpenses).toBe(5000);
    expect(s.net).toBe(3500);
  });
});

describe("no taka may vanish", () => {
  it("puts a non-stock purchase into expenses, not into goods used", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 1000)],
      purchases: [buy("2026-08-02", 300, "Cash", true), buy("2026-08-03", 150, "Cash", false)],
      months: { "2026-08": { openStock: 0, closeStock: 300 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.cogs).toBe(0);            // the 300 of stock is still on the shelf
    expect(s.otherExpenses).toBe(150); // the cleaning liquid is a running cost
    expect(s.net).toBe(850);           // 1000 − 0 − 150
  });

  it("net profit always equals revenue minus every cost, however it was filed", () => {
    const data = {
      ...emptyRestaurant(),
      sales: [sale("2026-08-01", 500, 300, 200, 50)],
      purchases: [buy("2026-08-02", 400, "Card", true), buy("2026-08-04", 90, "Cash", false)],
      expenses: [exp("2026-08-03", 260, "Bank")],
      months: { "2026-08": { openStock: 100, closeStock: 350 } },
    };
    const s = monthSummary(data, "2026-08");
    const byHand = s.revenue - (s.openStock + s.stockPurchases - s.closeStock) - s.expensesLogged - s.nonStockPurchases;
    expect(s.net).toBe(byHand);
    expect(s.revenue).toBe(950);       // 500 + 300 + 200 − 50 refund
  });

  it("counts a purchase with no isStock flag as stock", () => {
    const data = {
      ...emptyRestaurant(),
      purchases: [{ id: 1, date: "2026-08-02", amount: 500, method: "Cash" }],
      months: { "2026-08": { openStock: 0, closeStock: 0 } },
    };
    const s = monthSummary(data, "2026-08");
    expect(s.stockPurchases).toBe(500);
    expect(s.cogs).toBe(500);
  });
});

describe("the cash drawer", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 7200, 3900, 925)],
    purchases: [buy("2026-08-02", 2600, "Cash")],
    expenses: [exp("2026-08-03", 3200, "Cash")],
    ownerMoves: [{ id: 1, date: "2026-08-20", dir: "out", amount: 200 }],
    counts: [{ date: "2026-08-31", counted: 4150 }],
    months: { "2026-08": { openCash: 3000, openStock: 0, closeStock: 0 } },
  };
  const s = monthSummary(data, "2026-08");

  it("expects opening + cash sales − cash costs − owner withdrawals", () => {
    expect(s.expectedCash).toBe(4200);
  });
  it("reports the shortfall against the counted drawer", () => {
    expect(s.countedCash).toBe(4150);
    expect(s.cashDiff).toBe(-50);
  });
  it("leaves card and mobile takings out of the drawer entirely", () => {
    expect(s.revenue).toBe(12025);
    expect(s.expectedCash).toBe(4200); // unchanged by the 3,900 + 925
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

describe("openings are never typed twice", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-07-10", 5000), sale("2026-08-10", 6000)],
    purchases: [buy("2026-07-11", 1000), buy("2026-08-11", 2000)],
    counts: [{ date: "2026-07-31", counted: 3800 }],
    months: {
      "2026-07": { openCash: 1000, openStock: 500, closeStock: 900 },
      "2026-08": {},                      // nothing typed for August
    },
  };
  it("carries July's closing stock into August's opening", () => {
    const aug = monthSummary(data, "2026-08");
    expect(aug.openStock).toBe(900);
    expect(aug.openStockAuto).toBe(true);
  });
  it("carries July's COUNTED drawer into August, not the calculated one", () => {
    const jul = monthSummary(data, "2026-07");
    expect(jul.expectedCash).toBe(5000);  // 1000 + 5000 − 1000
    expect(jul.countedCash).toBe(3800);
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
      purchases: [buy("2026-08-02", 400)],
      months: { "2026-08": { openStock: 200 } },   // no closing count yet
    };
    const s = monthSummary(data, "2026-08");
    expect(s.closeStockSet).toBe(false);
    expect(s.closeStock).toBe(600);   // 200 opening + 400 bought, nothing used
    expect(s.cogs).toBe(0);
    expect(s.net).toBe(1000);
  });
});

describe("daily closing", () => {
  const data = {
    ...emptyRestaurant(),
    sales: [sale("2026-08-01", 500), sale("2026-08-02", 700)],
    expenses: [exp("2026-08-02", 100, "Cash")],
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

describe("housekeeping", () => {
  it("survives junk and missing data without throwing", () => {
    expect(monthSummary(null, "2026-08").net).toBe(0);
    expect(monthSummary({ sales: "nope" }, "2026-08").revenue).toBe(0);
    expect(normalise(undefined).sales).toEqual([]);
  });
  it("steps months across a year boundary", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
  it("lists only months that have something in them, oldest first", () => {
    const data = { ...emptyRestaurant(), sales: [sale("2026-08-01", 1)], expenses: [exp("2026-06-01", 1)] };
    expect(monthsWithData(data)).toEqual(["2026-06", "2026-08"]);
  });
});
