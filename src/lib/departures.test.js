// Built around the two real rooms the card missed on 14 Aug 2026: room 102, a
// normal same-day checkout that vanished the instant it was checked out, and
// room 107, forced out early so its booked checkout date was still days away.
import { describe, it, expect } from "vitest";
import { departureDate, hasDeparted, todaysDepartures } from "./departures";

const TODAY = "2026-08-14";

describe("the two rooms that went missing", () => {
  it("keeps a guest on the card after they have been checked out (room 102)", () => {
    const b102 = { id: 102, room: "102", status: "checked-out",
      checkin: "2026-08-12", checkout: TODAY, checkedOutOn: TODAY };
    expect(todaysDepartures([b102], TODAY)).toHaveLength(1);
    expect(hasDeparted(b102)).toBe(true);
  });

  it("shows a forced early checkout on the day it happened (room 107)", () => {
    // Booked to 17 Aug, put out today. The booked date must not decide this.
    const b107 = { id: 107, room: "107", status: "checked-out",
      checkin: "2026-08-11", checkout: "2026-08-17", checkedOutOn: TODAY };
    expect(todaysDepartures([b107], TODAY).map(b => b.id)).toEqual([107]);
    expect(todaysDepartures([b107], "2026-08-17")).toEqual([]);
  });
});

describe("who belongs on the card", () => {
  it("lists a guest who is still in the room but leaves today", () => {
    const b = { id: 1, status: "checked-in", checkin: "2026-08-13", checkout: TODAY };
    expect(todaysDepartures([b], TODAY)).toHaveLength(1);
    expect(hasDeparted(b)).toBe(false);
  });

  it("leaves out a guest who is staying on", () => {
    const b = { id: 2, status: "checked-in", checkin: "2026-08-13", checkout: "2026-08-16" };
    expect(todaysDepartures([b], TODAY)).toEqual([]);
  });

  it("never lists a cancelled booking", () => {
    const b = { id: 3, status: "cancelled", checkin: "2026-08-13", checkout: TODAY };
    expect(departureDate(b)).toBe("");
    expect(todaysDepartures([b], TODAY)).toEqual([]);
  });

  it("never lists a reservation nobody checked into", () => {
    const b = { id: 4, status: "confirmed", checkin: "2026-08-13", checkout: TODAY };
    expect(todaysDepartures([b], TODAY)).toEqual([]);
  });

  it("falls back to the booked date for checkouts recorded before checkedOutOn existed", () => {
    const b = { id: 5, status: "checked-out", checkin: "2026-08-13", checkout: TODAY };
    expect(departureDate(b)).toBe(TODAY);
    expect(todaysDepartures([b], TODAY)).toHaveLength(1);
  });

  it("returns nothing on a day with no departures", () => {
    const bookings = [
      { id: 6, status: "checked-in",  checkout: "2026-08-16" },
      { id: 7, status: "checked-out", checkout: "2026-08-12", checkedOutOn: "2026-08-12" },
    ];
    expect(todaysDepartures(bookings, TODAY)).toEqual([]);
  });

  it("survives junk input", () => {
    expect(todaysDepartures(null, TODAY)).toEqual([]);
    expect(todaysDepartures([{ id: 8 }], TODAY)).toEqual([]);
    expect(todaysDepartures([{ id: 9, status: "checked-in", checkout: TODAY }], "")).toEqual([]);
    expect(departureDate(undefined)).toBe("");
  });
});
