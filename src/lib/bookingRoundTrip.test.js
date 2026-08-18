// ─────────────────────────────────────────────────────────────────────────────
// THE GUARD AGAINST THE BUG THAT KEEPS COMING BACK.
//
// A booking is saved to Supabase by buildBookingRow/buildGuestRow and read back
// by fromDbBooking. Anything those mappers do not carry is gone the next time
// any device syncs — and it goes WITHOUT AN ERROR, which is why one feature
// (stay extensions) broke three separate times:
//
//   · extension taken WITH a payment    → rebuilt from payment notes → fine
//   · two rooms extended the same day   → misread as two nights      → fixed
//   · extension with NO money collected → nothing survived at all    → invisible
//
// All three were fixed on the READING side. Nobody ever checked whether the
// field was being SAVED, because nothing tested this seam.
//
// This test does. Every field the app puts on a booking must appear in ONE of
// the two lists below. Add a field and forget it and this fails, naming exactly
// what would vanish — on your machine in seconds, instead of in Bangladesh three
// weeks later.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { buildGuestRow, buildBookingRow, fromDbBooking } from "./hotelSupabase";

/** Fields that MUST come back from the cloud unchanged. */
const MUST_SURVIVE = [
  "guest", "phone", "email", "nationality", "idType", "idNum",
  "room", "checkin", "checkout", "nights", "roomRate", "acChoice",
  "baseAmount", "discType", "discAmt", "discReason",
  "paymentMethod", "transactionNumber", "amount", "invoiceTotal",
  "advance", "restPayment", "notes", "status",
  "paymentHistory", "extraRooms", "multiRooms", "isMultiRoomBooking",
  "invoiceExtras", "extrasAdvance", "extraPersonCharge",
  "refName", "refPhone", "forfeitedAmount",
];

/**
 * Fields with NO column of their own. Each must name where it really lives, so
 * "there is no column for this" can never again be discovered in production.
 */
const LIVES_ELSEWHERE = {
  extensions:   "paymentHistory entries of type 'extension' (a real column), plus app_config hotel_booking_extensions, plus recoverable from baseAmount vs nights",
  guestType:    "app_config hotel_booking_companions",
  spouseName:   "app_config hotel_booking_companions",
  spousePhone:  "app_config hotel_booking_companions",
  groupMembers: "app_config hotel_booking_companions",
  invoiceDate:  "local only — cosmetic, re-derived from createdAt",
  tcPrinted:    "local only — cosmetic print flag",
  idFront:      "guest row column image_front",
  idBack:       "guest row column image_back",
  idDocs:       "guest row column id_docs",
  source:       "no column yet — booking channel, not currently synced",
  checkedOutOn: "smuggled into the notes column as a [_out:] marker",
};

/** Ids and derived values the cloud owns or recomputes — not app data. */
const NOT_APP_DATA = [
  "id", "guest_id", "roomId", "type", "createdAt", "createdTz", "dueAmount",
  "supabaseBookingId", "by", "txnNumber", "referredBy", "referredByName",
  "referredByPhone", "isReservation",
];

/** A booking carrying every field the app is known to write. */
const fullBooking = {
  id: 4242, guest: "Test Guest", phone: "01700000000", email: "t@example.com",
  nationality: "Bangladeshi", idType: "NID", idNum: "123456",
  room: "102", checkin: "2026-08-17", checkout: "2026-08-19", nights: 2,
  roomRate: 2000, acChoice: "AC", baseAmount: 2000,
  discType: "flat", discAmt: 400, discReason: "Regular guest",
  paymentMethod: "Cash", transactionNumber: "TXN1",
  amount: 3600, invoiceTotal: 3600, advance: 1800, restPayment: 0,
  notes: "quiet room please", status: "checked-in",
  refName: "Ref Person", refPhone: "01800000000", forfeitedAmount: 0,
  paymentHistory: [
    { ts: "2026-08-17T09:00:00.000Z", amount: 1800, note: "Advance paid", type: "room" },
    { ts: "2026-08-18T16:20:00.000Z", amount: 0, note: "Extend stay +1 night",
      type: "extension", extNights: 1, extAmount: 1800 },
  ],
  extraRooms: [], multiRooms: [], isMultiRoomBooking: false,
  invoiceExtras: [{ desc: "Laundry", amount: 200 }],
  extrasAdvance: 200,
  extraPersonCharge: { persons: 1, amount: 500 },
  // the ones with no column of their own
  extensions: [{ nights: 1, amount: 1800, at: "2026-08-18" }],
  guestType: "couple", spouseName: "Spouse", spousePhone: "01900000000",
  groupMembers: [], invoiceDate: "2026-08-17", tcPrinted: true,
  idFront: "", idBack: "", idDocs: [], source: "Walk-in", checkedOutOn: "",
};

/** Save it, then read it back exactly as a second device would. */
function roundTrip(b) {
  const guestRow = buildGuestRow(b);
  const row = buildBookingRow(b, "guest-1");
  return fromDbBooking({ ...row, id: 4242, guest_id: "guest-1" }, { ...guestRow, id: "guest-1" });
}

const same = (a, c) => {
  if (Array.isArray(a) || (a && typeof a === "object")) return JSON.stringify(a) === JSON.stringify(c);
  if (typeof a === "number") return Number(c) === a;
  if (typeof a === "boolean") return Boolean(c) === a;
  return String(c ?? "") === String(a ?? "");
};

describe("every field on a booking is accounted for", () => {
  it("a new field must declare whether it survives, or where it lives instead", () => {
    const unaccounted = Object.keys(fullBooking).filter(k =>
      !MUST_SURVIVE.includes(k) && !(k in LIVES_ELSEWHERE) && !NOT_APP_DATA.includes(k));
    expect(unaccounted,
      "These booking fields are in neither list. Either give them a column so they " +
      "survive the cloud, or record their real home in LIVES_ELSEWHERE — otherwise " +
      "they vanish silently on the next sync: " + unaccounted.join(", ")
    ).toEqual([]);
  });

  it("every field promised to survive actually does", () => {
    const back = roundTrip(fullBooking);
    const lost = MUST_SURVIVE.filter(k => !same(fullBooking[k], back[k]));
    expect(lost,
      "These fields did NOT survive the trip to the cloud and back: " + lost.join(", ")
    ).toEqual([]);
  });

  it("every field without a column names a real home", () => {
    Object.entries(LIVES_ELSEWHERE).forEach(([field, home]) => {
      expect(String(home).length, field + " must say where it survives").toBeGreaterThan(10);
    });
  });
});

describe("the extension — the one that kept getting lost", () => {
  it("an unpaid extension survives, because it rides in payment history", () => {
    const ext = (roundTrip(fullBooking).paymentHistory || []).find(p => p.type === "extension");
    expect(ext, "the extension record must come back from the cloud").toBeTruthy();
    expect(ext.extNights).toBe(1);
    expect(ext.extAmount).toBe(1800);
    expect(ext.amount).toBe(0);      // nothing collected, which is fine
  });

  it("the log field itself is still dropped — which is why it needs a second home", () => {
    expect(roundTrip(fullBooking).extensions).toBeUndefined();
    expect(LIVES_ELSEWHERE.extensions).toMatch(/paymentHistory/);
  });

  it("baseAmount survives, so an extension made before the fix stays recoverable", () => {
    const back = roundTrip(fullBooking);
    expect(back.baseAmount).toBe(2000);
    expect(back.roomRate).toBe(2000);
    expect(back.nights).toBe(2);
  });
});

describe("money is never altered by the trip", () => {
  it("the invoice total, discount and what was paid come back to the taka", () => {
    const back = roundTrip(fullBooking);
    expect(back.invoiceTotal).toBe(3600);
    expect(back.advance).toBe(1800);
    expect(back.discAmt).toBe(400);
    expect((back.paymentHistory || []).reduce((s, p) => s + (p.amount || 0), 0)).toBe(1800);
  });
});
