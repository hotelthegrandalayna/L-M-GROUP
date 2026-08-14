// Built around the real booking that printed wrong: GA-0118, 2 rooms, 1 night,
// extended twice, which showed "3 Nights" on every room and a 4,500 discount.
import { describe, it, expect } from "vitest";
import { stayBreakdown, stayExtensions, baseInvoiceAmount, nightsBetween, addDays } from "./stayBreakdown";

const pay = (ts, amount, note) => ({ ts, amount, method: "Cash", note, type: "room" });

// Exactly as it comes back from the cloud: no extensions column, so the only
// record of the two extensions is in the payment notes.
const b118 = {
  id: 118, guest: "MD NURUL ALAM TAYEB", room: "101",
  checkin: "2026-08-13", checkout: "2026-08-16", nights: 3,
  roomRate: 2500, baseAmount: 4000, invoiceTotal: 4000, discAmt: 5000,
  extraRooms: [{ number: "104", name: "Rose Valley", acChoice: "AC", rate: 2500, grossAmt: 2500, discAmt: 500, amount: 2000 }],
  paymentHistory: [
    pay("2026-08-13T11:52:59Z", 4000, "Advance paid"),
    pay("2026-08-14T13:38:13Z", 2000, "Extend stay +1 night"),
    pay("2026-08-14T13:39:25Z", 2000, "Extend stay +1 night"),
  ],
};

describe("the stay that printed wrong", () => {
  const bd = stayBreakdown(b118);

  it("bills the original stay as ONE night, not three", () => {
    expect(bd.baseNights).toBe(1);
    expect(bd.baseCheckin).toBe("2026-08-13");
    expect(bd.baseCheckout).toBe("2026-08-14");
  });

  it("finds both extensions from the payment notes", () => {
    expect(bd.extensions).toHaveLength(2);
    expect(bd.extensionNights).toBe(2);
    expect(bd.extensionTotal).toBe(4000);
  });

  it("gives each extension its own dates, in order", () => {
    expect(bd.extensions[0]).toMatchObject({ from: "2026-08-14", to: "2026-08-15", nights: 1, amount: 2000 });
    expect(bd.extensions[1]).toMatchObject({ from: "2026-08-15", to: "2026-08-16", nights: 1, amount: 2000 });
  });

  it("still adds up to the whole stay", () => {
    expect(bd.totalNights).toBe(3);
    expect(bd.baseNights + bd.extensionNights).toBe(nightsBetween(b118.checkin, b118.checkout));
  });

  it("rebuilds the original invoice even though the stored total went stale", () => {
    // stored total (4,000) minus extensions (4,000) would be zero — the room
    // amounts have to win, or the invoice prints nothing for the first night.
    expect(baseInvoiceAmount(b118, bd)).toBe(4000);
  });

  it("makes the invoice total match the money actually collected", () => {
    const total = baseInvoiceAmount(b118, bd) + bd.extensionTotal;
    const paid = b118.paymentHistory.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(8000);
    expect(total).toBe(paid);
  });
});

describe("a plain stay with no extension", () => {
  const plain = { checkin: "2026-08-07", checkout: "2026-08-08", nights: 1, roomRate: 3400, invoiceTotal: 3400,
    paymentHistory: [pay("2026-08-07T10:00:00Z", 3400, "Advance paid")] };

  it("is untouched by the extension logic", () => {
    const bd = stayBreakdown(plain);
    expect(bd.wasExtended).toBe(false);
    expect(bd.baseNights).toBe(1);
    expect(bd.extensions).toEqual([]);
    expect(baseInvoiceAmount(plain, bd)).toBe(3400);
  });
});

describe("a booking with a proper extension log", () => {
  const logged = {
    checkin: "2026-07-14", checkout: "2026-07-18", nights: 4, roomRate: 1500, invoiceTotal: 6000,
    extensions: [
      { nights: 1, amount: 1500, from: "2026-07-16", to: "2026-07-17", at: "2026-07-16" },
      { nights: 1, amount: 1500, from: "2026-07-17", to: "2026-07-18", at: "2026-07-17" },
    ],
    paymentHistory: [pay("2026-07-15T07:39:00Z", 3000, "Advance paid")],
  };

  it("prefers the log over the payment notes", () => {
    const bd = stayBreakdown(logged);
    expect(bd.baseNights).toBe(2);              // 14 -> 16
    expect(bd.baseCheckout).toBe("2026-07-16");
    expect(bd.extensionTotal).toBe(3000);
    expect(baseInvoiceAmount(logged, bd)).toBe(3000);
  });
});

describe("a multi-night extension", () => {
  it("reads +2 nights from the note", () => {
    const b = { checkin: "2026-08-01", checkout: "2026-08-05", nights: 4,
      paymentHistory: [pay("2026-08-03T10:00:00Z", 4000, "Extend stay +2 nights")] };
    const bd = stayBreakdown(b);
    expect(bd.extensions[0].nights).toBe(2);
    expect(bd.extensions[0].from).toBe("2026-08-03");
    expect(bd.baseNights).toBe(2);
  });
});

describe("date helpers", () => {
  it("counts nights and walks dates without timezone drift", () => {
    expect(nightsBetween("2026-07-31", "2026-08-02")).toBe(2);
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});
