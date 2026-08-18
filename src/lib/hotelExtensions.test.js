// The reported failure, in one sentence: the manager in Bangladesh extended
// rooms 101 and 102, saw it on his extensions tab, and the owner in Denmark saw
// nothing at all — because `booking.extensions` had no home in the cloud and the
// only cross-device fallback (payment notes) needs money to have been collected.
import { describe, it, expect } from "vitest";
import {
  collectExtensionMap, mergeExtensionMaps, restoreExtensions, restoreExtensionsAll,
  extensionKey, EXTENSIONS_CONFIG_KEY, extendedOn, hasUnsettledExtension,
} from "./hotelExtensions";
import { stayExtensions } from "./stayBreakdown";

const ext = (o = {}) => ({
  nights: o.nights ?? 1, amount: o.amount ?? 1800,
  from: o.from || "2026-08-18", to: o.to || "2026-08-19",
  at: o.at || "2026-08-18", ts: o.ts || "2026-08-18T10:00:00.000Z", tz: "Asia/Dhaka",
});

describe("the reported case: an extension with NO money collected", () => {
  // Exactly what happened: extended, amount box left empty (guest pays at
  // checkout), so there is no payment note for the fallback to read.
  const onManagerPhone = {
    id: 140, guest: "Guest", room: "101", checkin: "2026-08-17", checkout: "2026-08-19",
    nights: 2, invoiceTotal: 3600, advance: 1800,
    paymentHistory: [{ ts: "2026-08-17T09:00:00Z", amount: 1800, note: "advance payment" }],
    extensions: [ext({ amount: 1800 })],
  };
  // What the cloud hands back: no extensions column, so the log is gone.
  const fromCloud = { ...onManagerPhone, extensions: [] };

  it("proves the old fallback cannot save this case", () => {
    expect(stayExtensions(fromCloud)).toEqual([]);   // no paid extension to read
    expect(stayExtensions(onManagerPhone)).toHaveLength(1);
  });

  it("survives the round-trip once the log is stored in app_config", () => {
    const map = collectExtensionMap([onManagerPhone]);
    expect(map["140"]).toHaveLength(1);
    const restored = restoreExtensions(fromCloud, map);
    expect(restored.extensions).toHaveLength(1);
    expect(restored.extensions[0].amount).toBe(1800);
    expect(stayExtensions(restored)).toHaveLength(1);
  });

  it("still works when money WAS collected — the fallback keeps working too", () => {
    const paid = { ...fromCloud,
      paymentHistory: [...fromCloud.paymentHistory,
        { ts: "2026-08-18T10:00:00Z", amount: 1800, note: "Extend stay +1 night" }] };
    expect(stayExtensions(paid)).toHaveLength(1);              // fallback alone
    expect(stayExtensions(restoreExtensions(paid, collectExtensionMap([onManagerPhone])))).toHaveLength(1);
  });
});

describe("two devices must not wipe each other", () => {
  it("unions extensions logged from different phones for one booking", () => {
    const dhaka  = { "140": [ext({ ts: "2026-08-18T10:00:00.000Z", amount: 1800 })] };
    const denmark = { "140": [ext({ ts: "2026-08-19T11:00:00.000Z", amount: 2000, at: "2026-08-19" })] };
    const merged = mergeExtensionMaps(dhaka, denmark);
    expect(merged["140"]).toHaveLength(2);
    expect(merged["140"][0].ts < merged["140"][1].ts).toBe(true);  // oldest first
  });

  it("does not duplicate the same extension seen twice", () => {
    const one = { "140": [ext()] };
    expect(mergeExtensionMaps(one, one)["140"]).toHaveLength(1);
    expect(mergeExtensionMaps(one, { "140": [{ ...ext() }] })["140"]).toHaveLength(1);
  });

  it("keeps bookings only one side knows about", () => {
    const merged = mergeExtensionMaps({ "1": [ext()] }, { "2": [ext()] });
    expect(Object.keys(merged).sort()).toEqual(["1", "2"]);
  });
});

describe("restoring", () => {
  it("never overwrites a log the device just typed", () => {
    const fresh = { id: 1, extensions: [ext({ amount: 999 })] };
    const stale = { "1": [ext({ amount: 111 })] };
    expect(restoreExtensions(fresh, stale).extensions[0].amount).toBe(999);
  });

  it("matches on the Supabase id as well as the local id", () => {
    const b = { id: 5001, supabaseBookingId: 140, extensions: [] };
    expect(restoreExtensions(b, { "140": [ext()] }).extensions).toHaveLength(1);
  });

  it("leaves a booking alone when there is nothing to restore", () => {
    const b = { id: 9, extensions: [] };
    expect(restoreExtensions(b, {}).extensions).toEqual([]);
    expect(restoreExtensions(b, null)).toBe(b);
  });

  it("restores across a whole list", () => {
    const list = [{ id: 1, extensions: [] }, { id: 2, extensions: [] }];
    const out = restoreExtensionsAll(list, { "2": [ext()] });
    expect(out[0].extensions).toEqual([]);
    expect(out[1].extensions).toHaveLength(1);
  });
});

describe("housekeeping", () => {
  it("collects only bookings that actually have a log", () => {
    const map = collectExtensionMap([
      { id: 1, extensions: [ext()] }, { id: 2, extensions: [] }, { id: 3 }, null,
    ]);
    expect(Object.keys(map)).toEqual(["1"]);
  });
  it("survives junk without throwing", () => {
    expect(collectExtensionMap(null)).toEqual({});
    expect(mergeExtensionMaps(null, undefined)).toEqual({});
    expect(mergeExtensionMaps({ a: "nope" }, {})).toEqual({});
    expect(restoreExtensionsAll(null, {})).toEqual([]);
  });
  it("uses a stable identity for an extension", () => {
    expect(extensionKey(ext())).toBe(extensionKey({ ...ext() }));
    expect(extensionKey(ext())).not.toBe(extensionKey(ext({ amount: 2 })));
  });
  it("names the config key the sync will use", () => {
    expect(EXTENSIONS_CONFIG_KEY).toBe("hotel_booking_extensions");
  });
});

describe("an unpaid extension must not vanish at midnight", () => {
  // Rooms 102 and 103: extended, nothing collected, 1,800 still owed on each.
  // "Today's Extensions" only ever matched the day it was typed, so the owner
  // abroad — hours out of step with the front desk — saw nothing the next day.
  const exts = [ext({ at: "2026-08-18", amount: 1800 })];

  it("shows on the day it was taken", () => {
    expect(extendedOn(exts, "2026-08-18")).toBe(true);
  });
  it("still shows the next day while the money is owed", () => {
    expect(extendedOn(exts, "2026-08-19")).toBe(false);
    expect(hasUnsettledExtension(exts, 1800, "checked-in")).toBe(true);
  });
  it("drops off once it has been paid", () => {
    expect(hasUnsettledExtension(exts, 0, "checked-in")).toBe(false);
  });
  it("ignores a booking with no extension at all", () => {
    expect(hasUnsettledExtension([], 1800, "checked-in")).toBe(false);
  });
  it("ignores a cancelled booking", () => {
    expect(hasUnsettledExtension(exts, 1800, "cancelled")).toBe(false);
  });
  it("survives junk", () => {
    expect(extendedOn(null, "2026-08-18")).toBe(false);
    expect(hasUnsettledExtension(null, "x", "")).toBe(false);
  });
});
