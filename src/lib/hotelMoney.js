// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for hotel monthly money.
//
// Every screen (Desk P&L, Expenses & Cash, Admin Finance, Admin Invoices) MUST
// use these helpers. Do not compute monthly revenue anywhere else — that is what
// caused four screens to disagree.
//
// ATTRIBUTION RULES (fixed — do not change without the owner's explicit say-so):
//   RULE 1 — a booking's BASE stay counts in its CHECK-IN month. An EXTENSION
//     counts in the month of its extra night, not the check-in month. So a guest
//     who checks in Jul 31 (that night = July) and extends into Aug 1 (~৳3,000)
//     puts the ৳3,000 in AUGUST. Money follows the night that was stayed, never
//     the date the cash happened to be handed over.
//   RULE 2 — a month, once locked (Admin › Reports), is frozen: its saved figures
//     never move again regardless of later edits.
//   billed = base(check-in month) + extensions(their own month); collected = what
//   has actually been paid, allocated base-first then to extensions; outstanding
//   = billed − collected. Manual (non-booking) revenues use their own date.
//
// COMPLETENESS RULE:
//   Past-month figures must be computed from the COMPLETE month loaded from the
//   cloud (useMonthBookings), never from the rolling ~30-day live window, or the
//   totals drift as old bookings age out of memory.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { hasHotelSupabaseConfig, loadHotelBookingsForMonth } from "./hotelSupabase";
import { saveConfig, loadConfig } from "../utils/supabaseSync";

// ── RULE 2: month locking ────────────────────────────────────────────────────
// A locked month is frozen: its saved figures are the official record and never
// move again, even if bookings are later edited. Stored cross-device in app_config.
const LOCKS_KEY = "hotel_month_locks";

export async function loadMonthLocks() {
  try { const v = await loadConfig(LOCKS_KEY); return (v && typeof v === "object") ? v : {}; }
  catch { return {}; }
}
export async function saveMonthLock(month, figures, by) {
  const cur = await loadMonthLocks();
  cur[month] = {
    billed: figures.billed, collected: figures.collected, outstanding: figures.outstanding,
    expenses: figures.expenses, netProfit: figures.netProfit,
    lockedAt: new Date().toISOString(), lockedBy: by || "admin",
  };
  await saveConfig(LOCKS_KEY, cur);
  return cur;
}
export async function unlockMonth(month) {
  const cur = await loadMonthLocks();
  delete cur[month];
  await saveConfig(LOCKS_KEY, cur);
  return cur;
}

export function bookingPaid(b) {
  const hist = b.paymentHistory || [];
  if (hist.length) return hist.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  return (parseFloat(b.advance) || 0) + (parseFloat(b.restPayment) || 0) + (parseFloat(b.extrasAdvance) || 0);
}

export function bookingTotal(b) {
  return parseFloat(b.invoiceTotal ?? b.amount ?? 0) || 0;
}

// The month a booking is attributed to (its check-in / stay month), "YYYY-MM".
export function bookingMonth(b) {
  return (b.checkin || b.createdAt || "").slice(0, 7);
}

// ── Forfeited deposits ───────────────────────────────────────────────────────
// A cancelled reservation normally earns nothing. But when the guest cancels and
// the hotel KEEPS the deposit, that money was genuinely earned and must not
// vanish from revenue — cancelling used to delete it outright.
//
// There is no night stayed to follow here: the stay never happened. The only
// honest basis is the month the money was actually received, so the kept amount
// is taken from the booking's own payments, in order, until it runs out.
//
// Every screen reads these two functions, so the Desk, Accounts, Expenses & Cash
// and the Invoices tab can never disagree about a cancellation charge.

/** What this cancelled booking kept. Zero for anything not cancelled. */
export function forfeitedAmount(b) {
  if (!b || b.status !== "cancelled") return 0;
  const n = parseFloat(b.forfeitedAmount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Does this booking still contribute money? */
export function countsAsRevenue(b) {
  return !!b && (b.status !== "cancelled" || forfeitedAmount(b) > 0);
}

/** Which payments make up the kept amount, with their month, day and method. */
export function forfeitedAllocation(b) {
  const kept = forfeitedAmount(b);
  if (kept <= 0.005) return [];
  const out = [];
  let left = kept;
  const pays = (b.paymentHistory || [])
    .filter(p => p && p.ts)
    .sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
  for (const p of pays) {
    if (left <= 0.005) break;
    const take = Math.min(left, parseFloat(p.amount) || 0);
    if (take <= 0) continue;
    out.push({ amount: take, month: String(p.ts).slice(0, 7), day: String(p.ts).slice(0, 10),
      method: p.method || b.paymentMethod || "Cash" });
    left -= take;
  }
  // Kept more than the recorded payments account for — never drop it.
  if (left > 0.005) {
    out.push({ amount: left, month: bookingMonth(b), day: b.checkin || "",
      method: b.paymentMethod || "Cash" });
  }
  return out;
}

const inMonth = (dateStr, month) => typeof dateStr === "string" && dateStr.slice(0, 7) === month;

// The month an extension's extra night belongs to: the first extra night (`from`
// = the old checkout), falling back to when it was recorded / the new checkout.
function extensionMonth(ext, b) {
  return String(ext.from || ext.at || ext.to || b.checkout || b.checkin || "").slice(0, 7);
}

// Extensions recorded BEFORE the `extensions` log existed show up only as a
// payment noted "Extend stay …". Recover those so an older cross-month extension
// is still counted in the month of its extra night (= when it was paid/recorded).
function legacyExtensionsFromPayments(b) {
  return (b.paymentHistory || [])
    .filter(p => /extend/i.test(p.note || ""))
    .map(p => ({
      billed: parseFloat(p.amount) || 0,
      month: String(p.ts || b.checkout || b.checkin || "").slice(0, 7),
    }))
    .filter(e => e.billed > 0 && e.month);
}

function addDaysLocal(iso, k) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// How many nights of a stay fall in each month, e.g. Jul 31 → Aug 2 = {2026-07:1, 2026-08:1}
function nightsByMonth(ciIso, coIso) {
  const out = new Map();
  if (!ciIso) return { map: out, nights: 0 };
  const nights = Math.max(0, Math.round((new Date(coIso + "T00:00:00") - new Date(ciIso + "T00:00:00")) / 86400000));
  for (let i = 0; i < nights; i++) {
    const m = addDaysLocal(ciIso, i).slice(0, 7);
    out.set(m, (out.get(m) || 0) + 1);
  }
  return { map: out, nights };
}

// Split one booking into monthly parts per RULE 1 — MONEY FOLLOWS THE NIGHT STAYED.
// A stay that crosses a month boundary is split night by night: a guest who checks
// in Jul 31 and leaves Aug 2 puts the Jul-31 night in July and the Aug-1 night in
// August. Recorded extensions keep their own exact amount and month.
export function bookingMonthlyParts(b) {
  // A cancelled booking contributes nothing at all, unless its deposit was kept —
  // then it contributes exactly that, in the month it was received, and nothing
  // of the stay that never happened.
  if (b && b.status === "cancelled") {
    const byMonth = new Map();
    forfeitedAllocation(b).forEach(a => byMonth.set(a.month, (byMonth.get(a.month) || 0) + a.amount));
    return [...byMonth.entries()].map(([month, amount]) => ({ month, billed: amount, collected: amount }));
  }
  const logged = (b.extensions || []).map(e => ({ billed: parseFloat(e.amount) || 0, month: extensionMonth(e, b) }));
  const exts = logged.length ? logged : legacyExtensionsFromPayments(b);
  const extTotal = exts.reduce((s, e) => s + e.billed, 0);
  const baseBilled = Math.max(0, bookingTotal(b) - extTotal);

  // The base stay ends where the first recorded extension begins (if any)
  const extFrom = logged.length
    ? (b.extensions || []).map(e => e.from).filter(Boolean).sort()[0]
    : null;
  const baseCi = b.checkin;
  const baseCo = extFrom || b.checkout;

  const { map: nm, nights } = nightsByMonth(baseCi, baseCo);
  const baseParts = nights > 0
    ? [...nm.entries()].map(([month, n]) => ({ month, billed: baseBilled * n / nights }))
    : [{ month: bookingMonth(b), billed: baseBilled }];

  const parts = [...baseParts, ...exts];
  let paid = bookingPaid(b);
  parts.forEach(p => { const c = Math.min(paid, p.billed); p.collected = c; paid -= c; });
  // MONEY IS NEVER DROPPED. Anything paid beyond the room invoice (service charges
  // like restaurant/laundry, extras, or a later top-up) is counted as revenue in the
  // month it was actually received — not silently discarded.
  if (paid > 0.005) {
    const extraPays = (b.paymentHistory || [])
      .filter(p => p.ts && (p.type === "service" || /service|extra|restaurant|laundry/i.test(p.note || "")))
      .map(p => ({ amount: parseFloat(p.amount) || 0, month: String(p.ts).slice(0, 7) }))
      .filter(p => p.amount > 0);
    const byMonth = new Map();
    let left = paid;
    for (const p of extraPays) {
      if (left <= 0.005) break;
      const take = Math.min(left, p.amount);
      byMonth.set(p.month, (byMonth.get(p.month) || 0) + take);
      left -= take;
    }
    if (left > 0.005) {
      // Can't tell which payment it was — attribute to the latest payment's month,
      // falling back to the stay month.
      const last = (b.paymentHistory || []).filter(p => p.ts)
        .sort((x, y) => String(y.ts).localeCompare(String(x.ts)))[0];
      const m = last ? String(last.ts).slice(0, 7) : bookingMonth(b);
      byMonth.set(m, (byMonth.get(m) || 0) + left);
    }
    byMonth.forEach((amount, month) => parts.push({ month, billed: amount, collected: amount }));
  }
  return parts;
}

// Canonical monthly figures. `bookings` must already be de-duplicated and must
// exclude deleted rows (useMonthBookings does this). A cancelled booking brings
// nothing unless its deposit was forfeited — bookingMonthlyParts is the single
// place that decides, so there is no second rule to keep in step here.
export function monthMoney({ bookings = [], revenues = [], expenses = [], month }) {
  let roomBilled = 0, roomCollected = 0;
  const monthB = [];
  bookings.forEach(b => {
    let touches = false;
    bookingMonthlyParts(b).forEach(p => {
      if (p.month !== month) return;
      roomBilled += p.billed;
      roomCollected += p.collected;
      touches = true;
    });
    if (touches) monthB.push(b);
  });

  const manual = revenues
    .filter(r => !r.bookingId && !r.fromBooking && inMonth(r.date, month))
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const billed      = roomBilled + manual;
  const collected   = roomCollected + manual;      // manual revenue is money in hand
  const outstanding = Math.max(0, roomBilled - roomCollected); // manual has no due
  const exp = expenses.filter(e => inMonth(e.date, month)).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  return { billed, collected, outstanding, expenses: exp, netProfit: collected - exp, bookings: monthB };
}

// Load the COMPLETE set of bookings for a month: the live (context) bookings plus
// an on-demand cloud fetch for past months, de-duplicated and with locally-deleted
// rows removed. Read-only — never merged back into live app state.
export function useMonthBookings(month, liveBookings) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [cache, setCache] = useState({}); // { 'YYYY-MM': rows }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!month || month >= thisMonth) return;   // current/future are fully in live state
    if (cache[month]) return;
    if (!hasHotelSupabaseConfig()) return;
    let alive = true;
    setLoading(true);
    loadHotelBookingsForMonth(month)
      .then(rows => { if (alive) setCache(p => ({ ...p, [month]: rows || [] })); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, thisMonth, cache]);

  const bookings = useMemo(() => {
    const extra = cache[month] || [];
    const deleted = (() => {
      try {
        const legacy = JSON.parse(localStorage.getItem("ga_deleted_booking_ids") || "[]");
        const v1 = (JSON.parse(localStorage.getItem("ga_deleted_ids_v1") || "{}").bkg) || [];
        return new Set([...legacy, ...v1].map(String));
      } catch { return new Set(); }
    })();
    const live = (liveBookings || []).filter(b =>
      !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? "")));
    if (!extra.length) return live;
    const have = new Set(live.map(b => String(b.supabaseBookingId ?? b.id)));
    const add = extra.filter(b =>
      !have.has(String(b.supabaseBookingId ?? b.id)) &&
      !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? "")));
    return add.length ? [...live, ...add] : live;
  }, [cache, month, liveBookings]);

  return { bookings, loading };
}
