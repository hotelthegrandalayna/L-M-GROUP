// The bug these tests exist to stop: a two-room reservation was taken with a
// discount, and when the desk reopened it to check the guest in the discount had
// vanished and the bill had gone back up. The owner had to type the discount in
// a second time and correct the total by hand.
//
// Cause: the form kept the primary room's discount in `primaryDiscAmt`, which is
// stored in no Supabase column and is not carried by mergeBooking. The first
// sync wiped it. The share is derived from stored data instead.
import { describe, it, expect } from "vitest";
import { primaryDiscShare, extraRoomsDiscount } from "./bookingDiscount";
import { mergeBooking } from "./bookingMerge";

// A reservation as it was actually taken: two rooms, primary at 7,000, 2,000 off.
const asSaved = {
  id: 401, guest: "Two-room guest", room: "102",
  checkin: "2026-08-20", checkout: "2026-08-21",
  discAmt: 2000, discType: "flat",
  primaryDiscAmt: 2000,                                  // local only — not stored
  extraRooms: [{ number: "103", grossAmt: 5000, discAmt: 0, amount: 5000 }],
  invoiceTotal: 10000,
};

describe("the reported bug: discount survives the trip to the cloud and back", () => {
  it("recovers the primary room's discount after primaryDiscAmt is wiped", () => {
    // What comes back from Supabase: no primaryDiscAmt column exists.
    const { primaryDiscAmt, ...fromCloud } = asSaved;
    expect(fromCloud.primaryDiscAmt).toBeUndefined();
    expect(primaryDiscShare(fromCloud)).toBe(2000);
  });

  it("survives a real mergeBooking round-trip", () => {
    const { primaryDiscAmt, ...cloudRow } = asSaved;
    const { booking } = mergeBooking(cloudRow, asSaved);
    // mergeBooking still drops the field — that is the cloud-wins rule, and the
    // reason the share must be derived rather than trusted.
    expect(booking.primaryDiscAmt).toBeUndefined();
    expect(primaryDiscShare(booking)).toBe(2000);
  });

  it("still trusts a freshly saved local value when it is there", () => {
    expect(asSaved.primaryDiscAmt ?? primaryDiscShare(asSaved)).toBe(2000);
  });
});

describe("splitting the discount between the rooms", () => {
  it("gives the primary room only what the extra rooms did not take", () => {
    const b = { discAmt: 2000, extraRooms: [{ number: "103", discAmt: 800 }] };
    expect(extraRoomsDiscount(b)).toBe(800);
    expect(primaryDiscShare(b)).toBe(1200);
  });

  it("adds back up to the booking's total discount", () => {
    const b = { discAmt: 3500, extraRooms: [{ discAmt: 1000 }, { discAmt: 500 }] };
    expect(primaryDiscShare(b) + extraRoomsDiscount(b)).toBe(b.discAmt);
  });

  it("gives the primary room nothing when the extras account for all of it", () => {
    const b = { discAmt: 1500, extraRooms: [{ discAmt: 1500 }] };
    expect(primaryDiscShare(b)).toBe(0);
  });

  it("never goes negative on inconsistent data", () => {
    const b = { discAmt: 500, extraRooms: [{ discAmt: 900 }] };
    expect(primaryDiscShare(b)).toBe(0);
  });
});

describe("shapes and edge cases", () => {
  it("returns 0 when there is no discount", () => {
    expect(primaryDiscShare({ discAmt: 0, extraRooms: [{ discAmt: 0 }] })).toBe(0);
    expect(primaryDiscShare({ room: "101" })).toBe(0);
    expect(primaryDiscShare(null)).toBe(0);
  });

  it("reads discounts typed into the form as strings", () => {
    const b = { discAmt: "2000", extraRooms: [{ discAmt: "750" }] };
    expect(primaryDiscShare(b)).toBe(1250);
  });

  it("claims nothing on the multiRooms shape, where every room carries its own", () => {
    const b = {
      discAmt: 2000, isMultiRoomBooking: true,
      multiRooms: [{ number: "101", discAmt: 1200 }, { number: "102", discAmt: 800 }],
    };
    expect(primaryDiscShare(b)).toBe(0);
  });

  it("handles a single-room booking with no extra rooms", () => {
    expect(primaryDiscShare({ discAmt: 2000, extraRooms: [] })).toBe(2000);
  });
});
