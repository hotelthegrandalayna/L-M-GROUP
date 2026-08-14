// ─────────────────────────────────────────────────────────────────────────────
// THE CLOCK OF WHOEVER WROTE IT DOWN.
//
// The hotel is in Sitakunda. The owner works from Denmark. Timestamps are
// stored as UTC, and JavaScript's toLocaleTimeString renders them in whatever
// timezone the VIEWER happens to be in — so one invoice printed 18:48 at the
// desk and 14:48 in Denmark, for the same moment. That is never right: a time
// on a document has to mean one thing.
//
// THE RULE: a recorded moment is shown on the clock of whoever recorded it, to
// everybody. The manager raises an invoice in Sitakunda and it reads Bangladesh
// time in Denmark too; the owner raises one from Denmark and it reads Danish
// time at the front desk. So every timestamp we write is stamped with the
// timezone of the device that wrote it, and records made before this existed
// fall back to the hotel's own zone — they were all made at the desk.
//
// Slicing an ISO string (`iso.slice(0, 10)`) is NOT a shortcut for the date —
// it gives the UTC day, which is the previous day in Bangladesh for anything
// before 06:00. See CLAUDE.md §3.
// ─────────────────────────────────────────────────────────────────────────────

export const HOTEL_TZ = "Asia/Dhaka";

/** The timezone of the device recording right now — stamp this beside every ts. */
export function deviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || HOTEL_TZ; }
  catch { return HOTEL_TZ; }
}

/**
 * A short zone label ("CEST") for a moment recorded away from the hotel.
 * Empty for the hotel's own zone — a Bangladeshi invoice does not need its own
 * timezone explained on it.
 */
export function tzLabel(tz, when) {
  const zone = tz || HOTEL_TZ;
  if (zone === HOTEL_TZ) return "";
  try {
    const at = when ? new Date(when) : new Date();
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(isNaN(at) ? new Date() : at);
    return (parts.find(p => p.type === "timeZoneName") || {}).value || "";
  } catch { return ""; }
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// "2026-08-14" -> "14 Aug 2026". Plain dates carry no timezone, so they are
// printed exactly as stored.
export function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  if (p.length !== 3) return String(d);
  return p[2] + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
}

/**
 * The calendar day of a timestamp, as "YYYY-MM-DD", on the recorder's clock.
 * Defaults to the hotel's zone for records that carry none.
 */
export function hotelDay(v, tz) {
  if (!v) return "";
  const s = String(v);
  if (!s.includes("T")) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d)) return s.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: tz || HOTEL_TZ });
}

/**
 * A stored moment as { date, time, zone }, on the clock of whoever recorded it.
 * Accepts a full ISO stamp or a plain "YYYY-MM-DD". `time` comes back empty
 * unless the stamp genuinely carries one — a date-only record is never given an
 * invented time. `zone` is a short label, empty unless the moment was recorded
 * away from the hotel.
 */
export function fmtStamp(v, tz) {
  if (!v) return { date:"", time:"", zone:"" };
  const s = String(v);
  if (!s.includes("T")) return { date: fmtDate(s.slice(0, 10)), time:"", zone:"" };
  const d = new Date(s);
  if (isNaN(d)) return { date: fmtDate(s.slice(0, 10)), time:"", zone:"" };
  const zone = tz || HOTEL_TZ;
  return {
    date: d.toLocaleDateString("en-GB", { timeZone: zone, day:"2-digit", month:"short", year:"numeric" }),
    time: d.toLocaleTimeString("en-GB", { timeZone: zone, hour:"2-digit", minute:"2-digit", hour12:false }),
    zone: tzLabel(zone, d),
  };
}
