// A full house is every guest room occupied for one night. The count matters,
// but so does WHAT the night was made of — six same-day arrivals is a different
// night from five people who were already staying, and the owner wants to tell
// them apart.
import { describe, it, expect } from "vitest";
import { fullHouseStats, guestRoomNumbers } from "./accounts";

const SIX = ["101", "102", "103", "104", "105", "106"];

// One night, 4 Jul, every room full: 101+102 arrive today (one two-room booking),
// 103/104/105 are mid-stay, 106 is only there because it extended.
const bookings = [
  { id: 1, guest: "Rakib",  room: "101", status: "checked-out", checkin: "2026-07-04", checkout: "2026-07-05", nights: 1,
    extraRooms: [{ number: "102", amount: 2000 }] },
  { id: 2, guest: "Fayzul", room: "103", status: "checked-out", checkin: "2026-07-03", checkout: "2026-07-05", nights: 2 },
  { id: 3, guest: "Tayeb",  room: "104", status: "checked-out", checkin: "2026-07-02", checkout: "2026-07-05", nights: 3 },
  { id: 4, guest: "Jubair", room: "105", status: "checked-out", checkin: "2026-07-03", checkout: "2026-07-05", nights: 2 },
  { id: 5, guest: "Mohin",  room: "106", status: "checked-out", checkin: "2026-07-02", checkout: "2026-07-05", nights: 3,
    extensions: [{ nights: 1, amount: 2000, from: "2026-07-04", to: "2026-07-05", at: "2026-07-04" }] },
];

describe("counting full nights", () => {
  const july = fullHouseStats(bookings, SIX, "2026-07");

  it("finds the nights where every room was taken", () => {
    // 4 Jul is full. 3 Jul is not — 101 and 102 had not arrived yet.
    expect(july.nights.map(n => n.date)).toEqual(["2026-07-04"]);
    expect(july.count).toBe(1);
  });

  it("does not call a nearly-full night a full house", () => {
    const short = fullHouseStats(bookings.filter(b => b.id !== 4), SIX, "2026-07");
    expect(short.count).toBe(0);
  });

  it("counts each night separately, not each booking", () => {
    // Everyone in for two nights = two full nights.
    const twoNights = SIX.map((room, i) => ({
      id: 100 + i, guest: "G" + i, room, status: "checked-out",
      checkin: "2026-07-10", checkout: "2026-07-12", nights: 2,
    }));
    expect(fullHouseStats(twoNights, SIX, "2026-07").count).toBe(2);
  });
});

describe("what the night was made of", () => {
  const night = fullHouseStats(bookings, SIX, "2026-07").nights[0];
  const kindOf = n => night.rooms.find(r => r.number === n).kind;

  it("marks a guest who checked in that day as arrived", () => {
    expect(kindOf("101")).toBe("arrived");
  });

  it("marks every room of a multi-room arrival, not just the first", () => {
    expect(kindOf("102")).toBe("arrived");
    expect(night.rooms.find(r => r.number === "102").guest).toBe("Rakib");
  });

  it("marks a guest carried over from an earlier night as staying", () => {
    expect(kindOf("103")).toBe("staying");
    expect(kindOf("104")).toBe("staying");
  });

  it("marks a night that only exists because of an extension", () => {
    // Room 106 booked 2 -> 4 Jul, extended to the 5th. The 4 Jul night is the
    // extension, and must not be disguised as an ordinary night by b.checkout.
    expect(kindOf("106")).toBe("extension");
  });

  it("adds up to the rooms in the house", () => {
    expect(night.arrived + night.staying + night.extension).toBe(6);
    expect(night).toMatchObject({ arrived: 2, staying: 3, extension: 1 });
  });

  it("says which night of their stay each guest is on", () => {
    expect(night.rooms.find(r => r.number === "101").nightNo).toBe(1);
    expect(night.rooms.find(r => r.number === "104").nightNo).toBe(3);
  });
});

describe("the totals across a month", () => {
  it("sums every full night's composition", () => {
    const s = fullHouseStats(bookings, SIX, "2026-07");
    expect(s).toMatchObject({ count: 1, arrived: 2, staying: 3, extension: 1, roomCount: 6 });
  });

  it("respects the month picker", () => {
    expect(fullHouseStats(bookings, SIX, "2026-08").count).toBe(0);
    expect(fullHouseStats(bookings, SIX, "").count).toBe(1);
  });

  it("never counts a cancelled booking towards a full house", () => {
    const withCancel = bookings.map(b => b.id === 2 ? { ...b, status: "cancelled" } : b);
    expect(fullHouseStats(withCancel, SIX, "2026-07").count).toBe(0);
  });
});

describe("which rooms count", () => {
  it("leaves out the rooms that are not guest rooms", () => {
    const rooms = [{ number: "101" }, { number: "102" }, { number: "103" },
      { number: "104" }, { number: "105" }, { number: "106" },
      { number: "107", name: "game zone" }, { number: "108", name: "pray room" }];
    expect(guestRoomNumbers(rooms, ["107", "108"])).toEqual(SIX);
  });

  it("would not call the house full if a non-guest room were required", () => {
    expect(fullHouseStats(bookings, [...SIX, "107"], "2026-07").count).toBe(0);
  });

  it("survives junk", () => {
    expect(fullHouseStats([], SIX, "2026-07").count).toBe(0);
    expect(fullHouseStats(bookings, [], "2026-07")).toMatchObject({ count: 0, nights: [] });
    expect(guestRoomNumbers([], [])).toEqual([]);
  });
});
