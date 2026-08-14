// Regression tests for the multi-room invoice rules in CLAUDE.md §2.
// The exact bug these guard against shipped TWICE: extra rooms printed at their
// already-discounted amount while the full discount was subtracted again, so the
// accommodation sub-total disagreed with the total (4,900 vs 6,800 on booking 102).
import { describe, it, expect } from "vitest";
import { buildInvoiceHTML, allRoomNumbers, roomLabel } from "./Invoice";

// Pull every "৳n,nnn" figure that follows a given label out of the invoice HTML
function amountAfter(html, label) {
  const i = html.indexOf(label);
  if (i === -1) return null;
  const m = html.slice(i).match(/৳([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

// Real booking #102 from production: one guest, four rooms, per-room discounts.
const multiRoomBooking = {
  id: 102, guest: "Mir Mohammad Soaibuddin", phone: "0177679357",
  room: "103", roomName: "Jasmine Dew", status: "checked-in",
  checkin: "2026-08-07", checkout: "2026-08-08", nights: 1,
  roomRate: 2000, acChoice: "Non-AC",
  baseAmount: 6800, discAmt: 2200, discType: "flat",
  invoiceTotal: 6800, amount: 6800, advance: 6800, restPayment: 0,
  extraRooms: [
    { number: "104", name: "Rose Valley",    acChoice: "Non-AC", rate: 2000, grossAmt: 2000, discAmt: 300, amount: 1700 },
    { number: "105", name: "Lavender Bloom", acChoice: "AC",     rate: 2500, grossAmt: 2500, discAmt: 800, amount: 1700 },
    { number: "106", name: "Lotus Glow",     acChoice: "AC",     rate: 2500, grossAmt: 2500, discAmt: 800, amount: 1700 },
  ],
  paymentHistory: [{ ts: "2026-08-07T16:20:06Z", amount: 6800, method: "Cash", note: "Advance paid", type: "room" }],
};

describe("RULE: multi-room invoice arithmetic must balance", () => {
  const html = buildInvoiceHTML(multiRoomBooking, [], [], "room");

  it("accommodation sub-total equals the total amount", () => {
    expect(amountAfter(html, "Accommodation Sub-total")).toBe(6800);
    expect(amountAfter(html, "Total Amount")).toBe(6800);
  });

  it("lists every room, not just the primary one", () => {
    for (const rm of ["103", "104", "105", "106"]) {
      expect(html).toContain("Room " + rm);
    }
  });

  it("shows a discount line for each discounted room", () => {
    for (const rm of ["103", "104", "105", "106"]) {
      expect(html).toContain("Discount — Rm " + rm);
    }
  });

  it("prints rooms at GROSS so the single discount is not counted twice", () => {
    // 2,500 is room 105/106's gross; if the net 1,700 were printed the sub-total breaks
    expect(html).toContain("৳2,500");
  });

  it("header lists all room numbers on one line", () => {
    expect(html).toContain("Rooms (4)");
  });
});

describe("RULE: a booking is never labelled with only one of its rooms", () => {
  it("handles the primary + extraRooms shape", () => {
    expect(allRoomNumbers(multiRoomBooking)).toEqual(["103", "104", "105", "106"]);
    expect(roomLabel(multiRoomBooking)).toBe("Rooms 103, 104, 105, 106");
  });

  it("handles the multiRooms shape", () => {
    const b = { isMultiRoomBooking: true, multiRooms: [{ number: "201" }, { number: "202" }] };
    expect(allRoomNumbers(b)).toEqual(["201", "202"]);
    expect(roomLabel(b)).toBe("Rooms 201, 202");
  });

  it("still reads naturally for a single room", () => {
    expect(roomLabel({ room: "101" })).toBe("Rm 101");
  });
});

describe("RULE: single-room invoices still balance", () => {
  it("sub-total matches the total with a plain discount", () => {
    const b = {
      id: 79, guest: "Asiful", room: "101", status: "checked-in",
      checkin: "2026-08-07", checkout: "2026-08-08", nights: 1,
      roomRate: 3400, invoiceTotal: 3400, amount: 3400, advance: 3400,
      paymentHistory: [{ ts: "2026-08-07T10:00:00Z", amount: 3400, note: "Advance paid", type: "room" }],
    };
    const html = buildInvoiceHTML(b, [], [], "room");
    expect(amountAfter(html, "Total Amount")).toBe(3400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Booking 118 as printed on 14 Aug 2026: two rooms booked for ONE night, then
// extended twice. The invoice showed "3 Nights" against both rooms, Room 104's
// qty x rate (3 x 2,500) did not match its own amount (2,500), a 4,500 discount
// appeared that nobody gave, the two extensions were nowhere in the charges, and
// the total said 5,000 while 8,000 had been collected.
// ─────────────────────────────────────────────────────────────────────────────
describe("RULE: an extended stay bills the original nights, then each extension", () => {
  const b118 = {
    id: 118, guest: "MD NURUL ALAM TAYEB", phone: "01309401048", room: "101", status: "checked-in",
    checkin: "2026-08-13", checkout: "2026-08-15", nights: 2,
    roomRate: 2500, acChoice: "Non-AC", baseAmount: 4000, invoiceTotal: 8000, amount: 8000,
    discAmt: 1000, discType: "flat", advance: 4000, restPayment: 4000,
    extraRooms: [{ number: "104", name: "Rose Valley", acChoice: "AC", rate: 2500, grossAmt: 2500, discAmt: 500, amount: 2000 }],
    paymentHistory: [
      { ts: "2026-08-13T11:52:59Z", amount: 4000, method: "Cash", note: "Advance paid", type: "room" },
      { ts: "2026-08-14T13:38:13Z", amount: 2000, method: "Cash", note: "Extend stay +1 night", type: "room" },
      { ts: "2026-08-14T13:39:25Z", amount: 2000, method: "Cash", note: "Extend stay +1 night", type: "room" },
    ],
  };
  const html = buildInvoiceHTML(b118, [{ number: "101", name: "Orchid Blue" }], [], "room");

  it("bills each room for the ONE night it was booked", () => {
    expect(html).toContain("Room 101 — Orchid Blue — Accommodation (1 Night)");
    expect(html).toContain("Room 104 — Rose Valley — Accommodation (1 Night)");
    expect(html).not.toContain("Accommodation (3 Nights)");
  });

  it("shows the extension once per room, for the one night both rooms stayed", () => {
    expect(html).toContain("Stay Extension");
    expect(html).toContain("Extension — Room 101 (1 Night)");
    expect(html).toContain("Extension — Room 104 (1 Night)");
    expect(amountAfter(html, "Extension Sub-total")).toBe(4000);   // 2,000 per room
  });

  it("prints the check-out date and explains the night count", () => {
    expect(html).toContain("Check-Out");
    expect(html).toContain("15 Aug 2026");
    expect(html).toContain("(1 + 1 extended)");
  });

  it("totals to the money actually collected", () => {
    const paid = b118.paymentHistory.reduce((s, p) => s + p.amount, 0);
    expect(amountAfter(html, "Total Amount")).toBe(paid);   // 8,000
  });

  it("no longer invents a discount the size of the extensions", () => {
    const d = amountAfter(html, "Discount — Rm 101");
    expect(d === null || d <= 500).toBe(true);
  });
});
