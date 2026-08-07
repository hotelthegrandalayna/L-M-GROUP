// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for hotel monthly money.
//
// Every screen (Desk P&L, Expenses & Cash, Admin Finance, Admin Invoices) MUST
// use these helpers. Do not compute monthly revenue anywhere else — that is what
// caused four screens to disagree.
//
// ATTRIBUTION RULE (fixed, do not change without changing it everywhere):
//   A booking belongs to the month of its CHECK-IN (its stay month). ALL of that
//   booking's money is that month's revenue, even if a payment lands in a later
//   month. So: billed = sum of the month's bookings' invoice totals; collected =
//   sum of what those bookings have been paid; outstanding = the difference.
//   This is how the owner reconciles ("all of a July stay is July revenue") and
//   it makes the Invoices list rows sum exactly to the headline.
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

// Canonical monthly figures. `bookings` must already be de-duplicated and must
// exclude deleted rows (useMonthBookings does this). Cancelled are ignored here.
//   billed      = invoice totals of bookings that CHECK IN this month
//   collected   = what those bookings have been paid (regardless of pay date)
//   outstanding = billed - collected (their unpaid balance)
export function monthMoney({ bookings = [], revenues = [], expenses = [], month }) {
  const monthB = bookings.filter(b => b.status !== "cancelled" && bookingMonth(b) === month);
  const manual = revenues
    .filter(r => !r.bookingId && !r.fromBooking && inMonth(r.date, month))
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const roomBilled    = monthB.reduce((s, b) => s + bookingTotal(b), 0);
  const roomCollected = monthB.reduce((s, b) => s + bookingPaid(b), 0);

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
