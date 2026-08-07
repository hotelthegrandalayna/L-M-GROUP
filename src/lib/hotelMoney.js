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

const inMonth = (dateStr, month) => typeof dateStr === "string" && dateStr.slice(0, 7) === month;

// The month an extension's extra night belongs to: the first extra night (`from`
// = the old checkout), falling back to when it was recorded / the new checkout.
function extensionMonth(ext, b) {
  return String(ext.from || ext.at || ext.to || b.checkout || b.checkin || "").slice(0, 7);
}

// Split one booking into monthly parts per RULE 1: base stay → check-in month,
// each extension → its extra-night month. Payments are allocated base-first, then
// to extensions in order, so `collected` lands in the same month as the money owed.
export function bookingMonthlyParts(b) {
  const exts = (b.extensions || []).map(e => ({ billed: parseFloat(e.amount) || 0, month: extensionMonth(e, b) }));
  const extTotal = exts.reduce((s, e) => s + e.billed, 0);
  const baseBilled = Math.max(0, bookingTotal(b) - extTotal);
  const parts = [{ month: bookingMonth(b), billed: baseBilled }, ...exts];
  let paid = bookingPaid(b);
  parts.forEach(p => { const c = Math.min(paid, p.billed); p.collected = c; paid -= c; });
  return parts;
}

// Canonical monthly figures. `bookings` must already be de-duplicated and must
// exclude deleted rows (useMonthBookings does this). Cancelled are ignored here.
export function monthMoney({ bookings = [], revenues = [], expenses = [], month }) {
  let roomBilled = 0, roomCollected = 0;
  const monthB = [];
  bookings.forEach(b => {
    if (b.status === "cancelled") return;
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
