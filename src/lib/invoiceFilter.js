// Pure invoice search/filter logic — no React, no data loading, so it can be
// tested exactly. Used by the Invoices tab. See CLAUDE.md §2 for the multi-room
// rule: a search must match ANY room on a booking, not just the primary one.

// Every room number on a booking (both storage shapes)
export function invoiceRooms(b) {
  if (!b) return [];
  if (b.isMultiRoomBooking && (b.multiRooms || []).length) return b.multiRooms.map(r => String(r.number));
  return [String(b.room ?? ""), ...((b.extraRooms || []).map(r => String(r.number)))].filter(Boolean);
}

export function invoiceMonth(b) {
  return String(b?.checkin || b?.createdAt || "").slice(0, 7);
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
  const { search = "", room = "", month = "", dateFrom = "", dateTo = "", status = "All" } = opts;
  const q = String(search).trim().toLowerCase();
  const roomQ = String(room).trim().toLowerCase();

  return (bookings || []).filter(b => {
    if (!b) return false;
    if (status && status !== "All" && b.status !== status) return false;
    if (month && invoiceMonth(b) !== month) return false;
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

// Summary figures for whatever is currently listed
export function invoiceTotals(rows) {
  const total = (rows || []).reduce((s, b) => s + invoiceTotal(b), 0);
  const paid  = (rows || []).reduce((s, b) => s + invoicePaid(b), 0);
  return { total, paid, balance: Math.max(0, total - paid) };
}
