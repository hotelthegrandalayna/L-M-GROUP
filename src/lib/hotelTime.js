// ─────────────────────────────────────────────────────────────────────────────
// THE HOTEL'S CLOCK.
//
// The hotel is in Sitakunda. The owner watches from Denmark. Timestamps are
// stored as UTC, and JavaScript's toLocaleTimeString renders them in whatever
// timezone the VIEWER happens to be in — so the same invoice printed 18:48 at
// the desk and 14:48 in Denmark, for the same moment.
//
// Every date or time a guest or the owner reads is the hotel's local time, no
// matter who is looking or where from. That is what a hotel document means by
// "the time": the time it was at the front desk.
//
// Slicing an ISO string (`iso.slice(0, 10)`) is NOT a shortcut for the date —
// it gives the UTC day, which is the previous day in Bangladesh for anything
// before 06:00. See CLAUDE.md §3.
// ─────────────────────────────────────────────────────────────────────────────

export const HOTEL_TZ = "Asia/Dhaka";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// "2026-08-14" -> "14 Aug 2026". Plain dates carry no timezone, so they are
// printed exactly as stored.
export function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  if (p.length !== 3) return String(d);
  return p[2] + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
}

/** The hotel-local calendar day of a timestamp, as "YYYY-MM-DD". */
export function hotelDay(v) {
  if (!v) return "";
  const s = String(v);
  if (!s.includes("T")) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d)) return s.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: HOTEL_TZ });
}

/**
 * A stored moment as { date, time }, both on the hotel's clock.
 * Accepts a full ISO stamp or a plain "YYYY-MM-DD". `time` comes back empty
 * unless the stamp genuinely carries one — a date-only record is never given an
 * invented time.
 */
export function fmtStamp(v) {
  if (!v) return { date:"", time:"" };
  const s = String(v);
  if (!s.includes("T")) return { date: fmtDate(s.slice(0, 10)), time:"" };
  const d = new Date(s);
  if (isNaN(d)) return { date: fmtDate(s.slice(0, 10)), time:"" };
  return {
    date: d.toLocaleDateString("en-GB", { timeZone: HOTEL_TZ, day:"2-digit", month:"short", year:"numeric" }),
    time: d.toLocaleTimeString("en-GB", { timeZone: HOTEL_TZ, hour:"2-digit", minute:"2-digit", hour12:false }),
  };
}
