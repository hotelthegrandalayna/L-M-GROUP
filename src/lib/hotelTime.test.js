// The manager raises an invoice at the desk in Sitakunda; the owner opens it in
// Denmark. Both must read the same time — the hotel's. These assertions are
// fixed strings on purpose: if the formatting ever falls back to the viewer's
// timezone, they fail on any machine that is not on UTC+6.
import { describe, it, expect } from "vitest";
import { HOTEL_TZ, fmtDate, hotelDay, fmtStamp } from "./hotelTime";

describe("the invoice reads the same in Sitakunda and in Denmark", () => {
  // 18:48 at the front desk on 14 Aug (UTC+6) is 12:48 UTC.
  const raisedAtDesk = "2026-08-14T12:48:00.000Z";

  it("prints the desk's time, not the viewer's", () => {
    expect(fmtStamp(raisedAtDesk)).toEqual({ date: "14 Aug 2026", time: "18:48" });
  });

  it("keeps the hotel's day for a booking made after midnight there", () => {
    // 01:30 on 14 Aug at the desk is still 13 Aug in UTC — and in Denmark.
    const afterMidnight = "2026-08-13T19:30:00.000Z";
    expect(hotelDay(afterMidnight)).toBe("2026-08-14");
    expect(fmtStamp(afterMidnight)).toEqual({ date: "14 Aug 2026", time: "01:30" });
  });

  it("keeps the hotel's day for a late-evening booking", () => {
    // 23:15 on 14 Aug at the desk is 17:15 UTC, same day everywhere.
    expect(hotelDay("2026-08-14T17:15:00.000Z")).toBe("2026-08-14");
    expect(fmtStamp("2026-08-14T17:15:00.000Z").time).toBe("23:15");
  });

  it("uses a 24-hour clock, never am/pm", () => {
    expect(fmtStamp("2026-08-14T12:48:00.000Z").time).toBe("18:48");
    expect(fmtStamp("2026-08-14T02:00:00.000Z").time).toBe("08:00");
  });

  it("is pinned to the hotel, not to whatever machine is running", () => {
    expect(HOTEL_TZ).toBe("Asia/Dhaka");
  });
});

describe("records without a time", () => {
  it("never invents one for a date-only record", () => {
    expect(fmtStamp("2026-08-14")).toEqual({ date: "14 Aug 2026", time: "" });
  });

  it("prints a plain date exactly as stored", () => {
    expect(fmtDate("2026-08-14")).toBe("14 Aug 2026");
    expect(hotelDay("2026-08-14")).toBe("2026-08-14");
  });

  it("survives junk", () => {
    expect(fmtStamp("")).toEqual({ date:"", time:"" });
    expect(fmtStamp(null)).toEqual({ date:"", time:"" });
    expect(fmtStamp("not a date")).toEqual({ date:"not a date", time:"" });
    expect(fmtDate("")).toBe("");
    expect(hotelDay("")).toBe("");
  });
});
