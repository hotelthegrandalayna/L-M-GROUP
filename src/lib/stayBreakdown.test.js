// Built around the real booking that printed wrong: GA-0118, 2 rooms, 1 night,
// extended twice, which showed "3 Nights" on every room and a 4,500 discount.
import { describe, it, expect } from "vitest";
import { stayBreakdown, stayExtensions, baseInvoiceAmount, nightsBetween, addDays } from "./stayBreakdown";

const pay = (ts, amount, note) => ({ ts, amount, method: "Cash", note, type: "room" });

// Exactly as it comes back from the cloud: no extensions column, so the only
// record of the two extensions is in the payment notes.
// The true stay: rooms 101 and 104 for one guest, 13 -> 14 Aug, then BOTH rooms
// extended one night to 15 Aug. The two 2,000 payments a minute apart are one
// night per room — not two nights of one room.
const b118 = {
  id: 118, guest: "MD NURUL ALAM TAYEB", room: "101",
  checkin: "2026-08-13", checkout: "2026-08-15", nights: 2,
  roomRate: 2500, baseAmount: 4000, invoiceTotal: 8000, discAmt: 1000,
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

  it("reads two rooms extended together as ONE night, not two", () => {
    expect(bd.extensions).toHaveLength(1);
    expect(bd.extensionNights).toBe(1);
    expect(bd.extensionTotal).toBe(4000);          // 2,000 per room
    expect(bd.extensions[0].parts).toHaveLength(2);
  });

  it("dates the extension to the night actually stayed", () => {
    expect(bd.extensions[0]).toMatchObject({ from: "2026-08-14", to: "2026-08-15", nights: 1, amount: 4000 });
  });

  it("still adds up to the whole stay", () => {
    expect(bd.totalNights).toBe(2);
    expect(bd.baseNights + bd.extensionNights).toBe(nightsBetween(b118.checkin, b118.checkout));
  });

  it("rebuilds the original invoice from the room amounts", () => {
    expect(baseInvoiceAmount(b118, bd)).toBe(4000);   // 2,000 + 2,000 for the first night
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

describe("an extension nobody paid for still crosses to every device", () => {
  // The reported failure: rooms 102 and 103 were extended, no money taken, and
  // the owner abroad saw nothing — because the only cross-device copy was read
  // from payment notes and required amount > 0. paymentHistory is the one part
  // of a booking that has always synced, so the record now rides in it whether
  // or not money changed hands.
  const unpaid = {
    id: 129, room: "102", checkin: "2026-08-17", checkout: "2026-08-19", nights: 2,
    invoiceTotal: 3600, advance: 1800, extensions: [],   // log wiped by the cloud
    paymentHistory: [
      { ts: "2026-08-17T09:00:00.000Z", amount: 1800, note: "advance payment", type: "room" },
      { ts: "2026-08-18T16:20:00.000Z", amount: 0, note: "Extend stay +1 night",
        type: "extension", extNights: 1, extAmount: 1800, from: "2026-08-18", to: "2026-08-19" },
    ],
  };

  it("is found even though nothing was collected", () => {
    const exts = stayExtensions(unpaid);
    expect(exts).toHaveLength(1);
    expect(exts[0].nights).toBe(1);
    expect(exts[0].amount).toBe(1800);      // what the night is worth, not what was paid
    expect(exts[0].at).toBe("2026-08-18");
  });

  it("keeps the original nights separate from the extension", () => {
    const s = stayBreakdown(unpaid);
    expect(s.wasExtended).toBe(true);
    expect(s.extensionNights).toBe(1);
    expect(s.extensionTotal).toBe(1800);
  });

  it("still reads an older record that only had a paid note", () => {
    const legacy = { ...unpaid, paymentHistory: [
      { ts: "2026-08-18T16:20:00.000Z", amount: 1800, note: "Extend stay +1 night", type: "room" },
    ] };
    const exts = stayExtensions(legacy);
    expect(exts).toHaveLength(1);
    expect(exts[0].amount).toBe(1800);
  });

  it("still groups two rooms extended at the same time as ONE extension", () => {
    // The bug fixed earlier must stay fixed: two rooms, same day, is one night.
    const twoRooms = { ...unpaid, paymentHistory: [
      { ts: "2026-08-18T16:20:00.000Z", amount: 0, note: "Extend stay +1 night",
        type: "extension", extNights: 1, extAmount: 1800 },
      { ts: "2026-08-18T16:21:00.000Z", amount: 0, note: "Extend stay +1 night",
        type: "extension", extNights: 1, extAmount: 1800 },
    ] };
    const exts = stayExtensions(twoRooms);
    expect(exts).toHaveLength(1);
    expect(exts[0].nights).toBe(1);          // one night, not two
    expect(exts[0].amount).toBe(3600);       // both rooms' money
  });

  it("prefers the booking's own log when the device still has it", () => {
    const withLog = { ...unpaid, extensions: [
      { nights: 1, amount: 1800, from: "2026-08-18", to: "2026-08-19", at: "2026-08-18" },
    ] };
    expect(stayExtensions(withLog)).toHaveLength(1);
  });
});

describe("recovering an extension the old code never recorded", () => {
  // Rooms 102 and 103, exactly as they sit in the cloud: no log, no extension
  // payment, but baseAmount still holds what the ORIGINAL booking was worth
  // because extending a stay never updated it.
  const lost = {
    id: 129, room: "102", checkin: "2026-08-17", checkout: "2026-08-19",
    nights: 2, roomRate: 2000, baseAmount: 2000, invoiceTotal: 3600,
    discAmt: 400, advance: 1800, extensions: [],
    paymentHistory: [{ ts: "2026-08-17T08:37:37.217Z", amount: 1800, note: "Advance paid", type: "room" }],
  };

  it("works out that one of the two nights was added later", () => {
    const exts = stayExtensions(lost);
    expect(exts).toHaveLength(1);
    expect(exts[0].nights).toBe(1);
    expect(exts[0].derived).toBe(true);
  });

  it("splits the money so original + extension still equals the invoice", () => {
    const s = stayBreakdown(lost);
    expect(s.baseNights).toBe(1);
    expect(s.extensionNights).toBe(1);
    expect(s.extensionTotal + (lost.invoiceTotal - s.extensionTotal)).toBe(3600);
    expect(s.extensionTotal).toBe(1800);
  });

  it("dates the extra night from the end of the original stay", () => {
    const e = stayExtensions(lost)[0];
    expect(e.from).toBe("2026-08-18");
    expect(e.to).toBe("2026-08-19");
  });

  it("leaves an ordinary two-night booking alone", () => {
    const plain = { ...lost, baseAmount: 4000, invoiceTotal: 3600 };
    expect(stayExtensions(plain)).toEqual([]);
  });

  it("does not guess when only the money grew but the nights did not", () => {
    const services = { ...lost, nights: 1, baseAmount: 2000, invoiceTotal: 3600 };
    expect(stayExtensions(services)).toEqual([]);
  });

  it("never guesses on a multi-room booking", () => {
    const multi = { ...lost, extraRooms: [{ number: "104", amount: 1800 }] };
    expect(stayExtensions(multi)).toEqual([]);
    const cards = { ...lost, isMultiRoomBooking: true, multiRooms: [{ number: "102" }, { number: "103" }] };
    expect(stayExtensions(cards)).toEqual([]);
  });

  it("prefers a real record over the guess", () => {
    const recorded = { ...lost, paymentHistory: [ ...lost.paymentHistory,
      { ts: "2026-08-18T16:20:00.000Z", amount: 0, note: "Extend stay +1 night",
        type: "extension", extNights: 1, extAmount: 1800 } ] };
    const e = stayExtensions(recorded)[0];
    expect(e.derived).toBeUndefined();
    expect(e.amount).toBe(1800);
  });

  it("does nothing without a rate or a base amount to compare", () => {
    expect(stayExtensions({ ...lost, roomRate: 0 })).toEqual([]);
    expect(stayExtensions({ ...lost, baseAmount: 0 })).toEqual([]);
  });
});
