// Pure invoice search/filter logic — no React, no data loading, so it can be
// tested exactly. Used by the Invoices tab. See CLAUDE.md §2 for the multi-room
// rule: a search must match ANY room on a booking, not just the primary one.
import { forfeitedAllocation, bookingMonthlyParts } from "./hotelMoney";

// Every room number on a booking (both storage shapes)
export function invoiceRooms(b) {
  if (!b) return [];
  if (b.isMultiRoomBooking && (b.multiRooms || []).length) return b.multiRooms.map(r => String(r.number));
  return [String(b.room ?? ""), ...((b.extraRooms || []).map(r => String(r.number)))].filter(Boolean);
}

export function invoiceMonth(b) {
  return String(b?.checkin || b?.createdAt || "").slice(0, 7);
}

// Does this stay have at least one NIGHT inside the given month?
// Revenue follows the night stayed, so the invoice list must use the same test —
// otherwise a 31 Jul → 2 Aug stay earns August money but never appears in August.
export function monthOverlap(b, month) {
  if (!month) return true;
  // A cancelled reservation is still LISTED under the month it was booked for —
  // the owner needs to see that it happened. If its deposit was kept, that money
  // counts in the month it was RECEIVED (see hotelMoney.js), so the row must also
  // appear there or the two sides of the reconciliation stop agreeing. When the
  // two months differ the row shows in both, but only ever carries money in one.
  if (b?.status === "cancelled" && forfeitedAllocation(b).some(a => a.month === month)) return true;
  const ci = String(b?.checkin || "");
  const co = String(b?.checkout || "");
  if (!ci) return false;
  const [y, m] = month.split("-").map(Number);
  const monthStart = month + "-01";
  const nextStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  // nights run [checkin, checkout) — overlap when checkin < next month and checkout > month start
  if (ci >= nextStart) return false;
  if (co && co <= monthStart) return false;
  if (!co) return ci.slice(0, 7) === month; // no checkout recorded: fall back to check-in month
  return true;
}

export function invoicePaid(b) {
  const hist = b?.paymentHistory || [];
  if (hist.length) return hist.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  return (parseFloat(b?.advance) || 0) + (parseFloat(b?.restPayment) || 0) + (parseFloat(b?.extrasAdvance) || 0);
}

export function invoiceTotal(b) {
  return parseFloat(b?.invoiceTotal ?? b?.amount ?? 0) || 0;
}

// A stay OVERLAPS the range [from, to] if it starts on/before `to` and ends on/after
// `from`. Either bound may be blank, meaning "open ended".
export function stayOverlapsRange(b, from, to) {
  const ci = String(b?.checkin || "");
  const co = String(b?.checkout || b?.checkin || "");
  if (from && co && co < from) return false;
  if (to && ci && ci > to) return false;
  return true;
}

export function filterInvoices(bookings, opts = {}) {
  const { search = "", room = "", rooms = [], month = "", dateFrom = "", dateTo = "", status = "All" } = opts;
  const q = String(search).trim().toLowerCase();
  const roomQ = String(room).trim().toLowerCase();
  // Multi-room selection: a booking matches if it covers ANY of the chosen rooms
  const roomSet = (rooms || []).map(r => String(r).trim()).filter(Boolean);

  return (bookings || []).filter(b => {
    if (!b) return false;
    if (status && status !== "All" && b.status !== status) return false;
    // Month = "has a night in this month", matching how revenue is attributed
    if (month && !monthOverlap(b, month)) return false;
    if (roomSet.length && !invoiceRooms(b).some(n => roomSet.includes(n))) return false;
    if (roomQ && !invoiceRooms(b).some(n => n.toLowerCase().includes(roomQ))) return false;
    if ((dateFrom || dateTo) && !stayOverlapsRange(b, dateFrom, dateTo)) return false;
    if (q && !(
      String(b.guest || "").toLowerCase().includes(q) ||
      String(b.id ?? "").toLowerCase().includes(q) ||
      String(b.phone || "").toLowerCase().includes(q) ||
      String(b.idNum || "").toLowerCase().includes(q) ||
      invoiceRooms(b).some(n => n.toLowerCase().includes(q))
    )) return false;
    return true;
  }).sort((a, b) => String(b.checkin || b.createdAt || "").localeCompare(String(a.checkin || a.createdAt || "")));
}

/**
 * What ONE invoice contributes to the totals, for the month being viewed (or the
 * whole stay when no month is picked).
 *
 * Lives here, not inside the Invoices screen, because the reconciliation test and
 * the screen must run the SAME code. They did not: the screen zeroed every
 * cancelled invoice while the revenue engine had started keeping forfeited
 * deposits, so the Invoices tab sat 1,200 below Accounts for August 2026 and no
 * test noticed, because the test had its own copy of the rule.
 */
export function invoiceShare(bk, month = "") {
  if (!bk) return { billed: 0, collected: 0, partial: false, cancelled: false };

  // A cancelled booking is not worth the stay that never happened — only a
  // deposit that was kept, in the month it was taken. bookingMonthlyParts is the
  // single rule and already returns nothing when the money was refunded.
  if (bk.status === "cancelled") {
    let billed = 0, collected = 0;
    bookingMonthlyParts(bk).forEach(p => {
      if (!month || p.month === month) { billed += p.billed; collected += p.collected; }
    });
    return { billed, collected, partial: false, cancelled: true };
  }

  if (!month) {
    const total = invoiceTotal(bk);
    return { billed: total, collected: invoicePaid(bk), partial: false, cancelled: false };
  }

  let billed = 0, collected = 0;
  bookingMonthlyParts(bk).forEach(p => {
    if (p.month === month) { billed += p.billed; collected += p.collected; }
  });
  return { billed, collected, partial: Math.abs(billed - invoiceTotal(bk)) > 1, cancelled: false };
}

/** The totals for a list of invoices — what the Invoices tab prints on top. */
export function invoiceListTotals(rows, month = "") {
  let billed = 0, collected = 0;
  (rows || []).forEach(bk => {
    const s = invoiceShare(bk, month);
    billed += s.billed; collected += s.collected;
  });
  return { billed, collected, balance: Math.max(0, billed - collected), count: (rows || []).length };
}

// Summary figures for whatever is currently listed
export function invoiceTotals(rows) {
  const total = (rows || []).reduce((s, b) => s + invoiceTotal(b), 0);
  const paid  = (rows || []).reduce((s, b) => s + invoicePaid(b), 0);
  return { total, paid, balance: Math.max(0, total - paid) };
}
