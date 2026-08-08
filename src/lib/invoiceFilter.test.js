// Tests for invoice search. The 5–8 Aug date range returning zero results was a
// real reported bug — these lock the behaviour so it cannot come back.
import { describe, it, expect } from "vitest";
import { filterInvoices, invoiceRooms, stayOverlapsRange, invoiceTotals, monthOverlap } from "./invoiceFilter";

// Real August bookings from production
const rows = [
  { id: 79,  guest: "Asiful Alam Tangim",     phone: "01935006574", room: "101", checkin: "2026-08-07", checkout: "2026-08-08", status: "checked-out", invoiceTotal: 3400, paymentHistory: [{ amount: 3400 }] },
  { id: 81,  guest: "Guest B",                phone: "0170000081",  room: "103", checkin: "2026-08-04", checkout: "2026-08-05", status: "checked-out", invoiceTotal: 1700, paymentHistory: [{ amount: 1700 }] },
  { id: 84,  guest: "Guest C",                phone: "0170000084",  room: "101", checkin: "2026-08-05", checkout: "2026-08-07", status: "checked-out", invoiceTotal: 3400, paymentHistory: [{ amount: 3400 }] },
  { id: 102, guest: "Mir Mohammad Soaibuddin",phone: "0177679357",  room: "103", checkin: "2026-08-07", checkout: "2026-08-08", status: "checked-in",  invoiceTotal: 6800, paymentHistory: [{ amount: 6800 }],
    extraRooms: [{ number: "104" }, { number: "105" }, { number: "106" }] },
  { id: 105, guest: "Md Moniruzzaman dali",   phone: "01911015713", room: "107", checkin: "2026-08-07", checkout: "2026-08-08", status: "checked-in",  invoiceTotal: 1500, paymentHistory: [{ amount: 1500 }] },
  { id: 31,  guest: "July Guest",             phone: "0170000031",  room: "101", checkin: "2026-07-03", checkout: "2026-07-04", status: "checked-out", invoiceTotal: 1800, paymentHistory: [{ amount: 1800 }] },
];

describe("date range search (the 5–8 Aug bug)", () => {
  it("finds every stay overlapping 5 Aug → 8 Aug", () => {
    const out = filterInvoices(rows, { dateFrom: "2026-08-05", dateTo: "2026-08-08" });
    expect(out.map(b => b.id).sort((a, b) => a - b)).toEqual([79, 81, 84, 102, 105]);
    expect(out.length).toBeGreaterThan(0); // must never be zero
  });

  it("works with a month filter applied at the same time", () => {
    const out = filterInvoices(rows, { month: "2026-08", dateFrom: "2026-08-05", dateTo: "2026-08-08" });
    expect(out.length).toBe(5);
  });

  it("excludes stays entirely outside the range", () => {
    const out = filterInvoices(rows, { dateFrom: "2026-08-05", dateTo: "2026-08-08" });
    expect(out.find(b => b.id === 31)).toBeUndefined(); // the July stay
  });

  it("supports an open-ended range", () => {
    expect(filterInvoices(rows, { dateFrom: "2026-08-01" }).length).toBe(5);
    expect(filterInvoices(rows, { dateTo: "2026-07-31" }).length).toBe(1);
  });

  it("counts a stay that only touches the edge of the range", () => {
    // 4→5 Aug checkout lands exactly on the range start
    expect(stayOverlapsRange(rows[1], "2026-08-05", "2026-08-08")).toBe(true);
  });
});

describe("room search covers multi-room bookings", () => {
  it("finds the booking by any of its rooms", () => {
    for (const rm of ["103", "104", "105", "106"]) {
      const out = filterInvoices(rows, { room: rm });
      expect(out.some(b => b.id === 102)).toBe(true);
    }
  });

  it("lists every room of a booking", () => {
    expect(invoiceRooms(rows[3])).toEqual(["103", "104", "105", "106"]);
  });
});

describe("month filter follows the night stayed (the 43,600 vs 39,600 gap)", () => {
  // Real case: three stays checked in 31 Jul and left 2 Aug. Their 1-Aug night is
  // August revenue, so they MUST appear when August is selected.
  const boundary = { id: 69, guest: "Boundary Guest", room: "101", checkin: "2026-07-31", checkout: "2026-08-02",
    status: "checked-out", invoiceTotal: 3000, paymentHistory: [{ amount: 3000 }] };

  it("a 31 Jul → 2 Aug stay appears in AUGUST", () => {
    expect(monthOverlap(boundary, "2026-08")).toBe(true);
    expect(filterInvoices([boundary], { month: "2026-08" }).map(b => b.id)).toEqual([69]);
  });

  it("the same stay still appears in JULY", () => {
    expect(monthOverlap(boundary, "2026-07")).toBe(true);
    expect(filterInvoices([boundary], { month: "2026-07" }).map(b => b.id)).toEqual([69]);
  });

  it("it does NOT leak into September", () => {
    expect(monthOverlap(boundary, "2026-09")).toBe(false);
  });

  it("a stay ending exactly on the 1st does not count for that month", () => {
    // 30 Jul → 1 Aug: the only nights are 30 and 31 Jul, so no August night
    const b = { id: 1, guest: "G", room: "1", checkin: "2026-07-30", checkout: "2026-08-01" };
    expect(monthOverlap(b, "2026-08")).toBe(false);
    expect(monthOverlap(b, "2026-07")).toBe(true);
  });

  it("a stay starting on the 1st counts for that month", () => {
    const b = { id: 2, guest: "G", room: "1", checkin: "2026-08-01", checkout: "2026-08-02" };
    expect(monthOverlap(b, "2026-08")).toBe(true);
    expect(monthOverlap(b, "2026-07")).toBe(false);
  });

  it("a long stay covers every month it touches", () => {
    const b = { id: 3, guest: "G", room: "1", checkin: "2026-07-28", checkout: "2026-09-03" };
    expect(monthOverlap(b, "2026-07")).toBe(true);
    expect(monthOverlap(b, "2026-08")).toBe(true);
    expect(monthOverlap(b, "2026-09")).toBe(true);
  });
});

describe("multiple room selection", () => {
  it("matches a booking covering ANY of the selected rooms", () => {
    const out = filterInvoices(rows, { rooms: ["107"] });
    expect(out.map(b => b.id)).toEqual([105]);
  });

  it("returns every booking touching any selected room", () => {
    const out = filterInvoices(rows, { rooms: ["107", "101"] });
    expect(out.map(b => b.id).sort((a, b) => a - b)).toEqual([31, 79, 84, 105]);
  });

  it("finds a multi-room booking by one of its extra rooms", () => {
    expect(filterInvoices(rows, { rooms: ["106"] }).map(b => b.id)).toEqual([102]);
  });

  it("an empty room selection means no room filter", () => {
    expect(filterInvoices(rows, { rooms: [] }).length).toBe(rows.length);
  });

  it("combines with a month filter", () => {
    const out = filterInvoices(rows, { rooms: ["101"], month: "2026-08" });
    expect(out.map(b => b.id).sort((a, b) => a - b)).toEqual([79, 84]);
  });
});

describe("text search", () => {
  it("matches guest name, phone and room", () => {
    expect(filterInvoices(rows, { search: "moniruzzaman" }).map(b => b.id)).toEqual([105]);
    expect(filterInvoices(rows, { search: "0177679357" }).map(b => b.id)).toEqual([102]);
    expect(filterInvoices(rows, { search: "106" }).map(b => b.id)).toEqual([102]);
  });
});

describe("status filter and totals", () => {
  it("filters by status", () => {
    expect(filterInvoices(rows, { status: "checked-in" }).length).toBe(2);
    expect(filterInvoices(rows, { status: "All" }).length).toBe(rows.length);
  });

  it("totals the listed rows", () => {
    const t = invoiceTotals(filterInvoices(rows, { month: "2026-08" }));
    expect(t.total).toBe(3400 + 1700 + 3400 + 6800 + 1500);
    expect(t.balance).toBe(0);
  });
});
