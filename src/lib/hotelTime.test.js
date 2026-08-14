// THE RULE: a recorded moment reads on the clock of whoever recorded it, to
// everybody. The manager raises an invoice in Sitakunda and it says Bangladesh
// time in Denmark too; the owner raises one from Denmark and it says Danish time
// at the front desk.
//
// These assertions are fixed strings on purpose. This machine is not on UTC+6,
// so if the formatting ever falls back to the viewer's timezone they fail right
// here rather than on a printed invoice.
import { describe, it, expect } from "vitest";
import { HOTEL_TZ, fmtDate, hotelDay, fmtStamp, deviceTz, tzLabel } from "./hotelTime";

const DHAKA = "Asia/Dhaka";
const COPENHAGEN = "Europe/Copenhagen";

describe("an invoice raised by the manager in Sitakunda", () => {
  // 18:48 at the front desk on 14 Aug (UTC+6) is 12:48 UTC.
  const atTheDesk = "2026-08-14T12:48:00.000Z";

  it("reads Bangladesh time wherever it is opened", () => {
    expect(fmtStamp(atTheDesk, DHAKA)).toEqual({ date:"14 Aug 2026", time:"18:48", zone:"" });
  });

  it("carries no timezone label — the hotel's own clock needs no explaining", () => {
    expect(fmtStamp(atTheDesk, DHAKA).zone).toBe("");
    expect(tzLabel(DHAKA, atTheDesk)).toBe("");
  });

  it("keeps the hotel's day for a booking taken after midnight there", () => {
    // 01:30 on 14 Aug at the desk is still 13 Aug in UTC — and in Denmark.
    const afterMidnight = "2026-08-13T19:30:00.000Z";
    expect(hotelDay(afterMidnight, DHAKA)).toBe("2026-08-14");
    expect(fmtStamp(afterMidnight, DHAKA).date).toBe("14 Aug 2026");
    expect(fmtStamp(afterMidnight, DHAKA).time).toBe("01:30");
  });
});

describe("an invoice raised by the owner from Denmark", () => {
  // 14:02 in Copenhagen on 14 Aug (CEST, UTC+2) is 12:02 UTC.
  const inDenmark = "2026-08-14T12:02:00.000Z";

  it("reads Danish time, not the hotel's", () => {
    const s = fmtStamp(inDenmark, COPENHAGEN);
    expect(s.date).toBe("14 Aug 2026");
    expect(s.time).toBe("14:02");
  });

  it("is marked with its zone so it cannot be mistaken for desk time", () => {
    expect(fmtStamp(inDenmark, COPENHAGEN).zone).toBe("CEST");
  });

  it("is the same moment the desk would call 18:02", () => {
    expect(fmtStamp(inDenmark, DHAKA).time).toBe("18:02");
  });
});

describe("records made before the zone was recorded", () => {
  it("falls back to the hotel — every one of them was made at the desk", () => {
    const s = fmtStamp("2026-08-14T12:48:00.000Z");
    expect(s).toEqual({ date:"14 Aug 2026", time:"18:48", zone:"" });
    expect(hotelDay("2026-08-14T19:30:00.000Z")).toBe("2026-08-15");
  });
});

describe("the basics", () => {
  it("uses a 24-hour clock, never am/pm", () => {
    expect(fmtStamp("2026-08-14T02:00:00.000Z", DHAKA).time).toBe("08:00");
  });

  it("never invents a time for a date-only record", () => {
    expect(fmtStamp("2026-08-14", COPENHAGEN)).toEqual({ date:"14 Aug 2026", time:"", zone:"" });
  });

  it("prints a plain date exactly as stored", () => {
    expect(fmtDate("2026-08-14")).toBe("14 Aug 2026");
    expect(hotelDay("2026-08-14")).toBe("2026-08-14");
  });

  it("reports a usable zone for this device", () => {
    expect(typeof deviceTz()).toBe("string");
    expect(deviceTz().length).toBeGreaterThan(0);
  });

  it("survives junk", () => {
    expect(fmtStamp("")).toEqual({ date:"", time:"", zone:"" });
    expect(fmtStamp(null)).toEqual({ date:"", time:"", zone:"" });
    expect(fmtStamp("not a date")).toEqual({ date:"not a date", time:"", zone:"" });
    expect(fmtDate("")).toBe("");
    expect(hotelDay("")).toBe("");
    expect(HOTEL_TZ).toBe("Asia/Dhaka");
  });
});
