// ─────────────────────────────────────────────────────────────────────────────
// Where a stay extension lives so every device can see it.
//
// THE BUG THIS EXISTS TO FIX. `booking.extensions` had nowhere to live in the
// cloud: no Supabase column, and no app_config store either — despite a comment
// in bookingMerge.js claiming "it lives in app_config and is restored by the
// caller". That mechanism was never built. Every booking pulled from the cloud
// came back with `extensions: []`, including ones that had definitely been
// extended.
//
// It went unnoticed because stayBreakdown.js can rebuild extensions from
// PAYMENT NOTES ("Extend stay +1 night") — but only when money was collected at
// the time. The extend dialog's amount box starts empty, because a guest often
// pays at checkout. So an extension taken with nothing collected left no trace
// at all outside the one device that typed it: the manager in Bangladesh saw it,
// the owner in Denmark saw nothing.
//
// Same pattern the booking companions already use (hotel_booking_companions):
// one document in app_config, keyed by booking id, merged rather than replaced
// so two devices extending different rooms cannot wipe each other out.
// ─────────────────────────────────────────────────────────────────────────────

export const EXTENSIONS_CONFIG_KEY = "hotel_booking_extensions";
export const EXTENSIONS_CACHE_KEY  = "ga_extensions";

const arr = v => (Array.isArray(v) ? v : []);
const isPlain = v => !!v && typeof v === "object" && !Array.isArray(v);

/** Identity of one extension. Two devices logging the same event agree on this. */
export function extensionKey(e) {
  return [e?.ts || "", e?.at || "", e?.from || "", e?.to || "",
          e?.nights ?? "", e?.amount ?? ""].join("|");
}

/** Every booking that has an extension log, as { bookingId: extensions[] }. */
export function collectExtensionMap(bookings = []) {
  const out = {};
  (bookings || []).forEach(b => {
    if (!b || b.id == null) return;
    const list = arr(b.extensions);
    if (list.length) out[String(b.id)] = list;
  });
  return out;
}

/**
 * Combine two maps. Per booking the entries are UNIONED, not replaced: two
 * rooms of one booking extended from two different phones must both survive.
 */
export function mergeExtensionMaps(a = {}, b = {}) {
  const left = isPlain(a) ? a : {};
  const right = isPlain(b) ? b : {};
  const out = {};
  new Set([...Object.keys(left), ...Object.keys(right)]).forEach(id => {
    const seen = new Set();
    const list = [];
    [...arr(left[id]), ...arr(right[id])].forEach(e => {
      if (!e || typeof e !== "object") return;
      const k = extensionKey(e);
      if (seen.has(k)) return;
      seen.add(k);
      list.push(e);
    });
    // Oldest first, so an invoice prints them in the order they happened.
    list.sort((x, y) => String(x.ts || x.at || "").localeCompare(String(y.ts || y.at || "")));
    if (list.length) out[id] = list;
  });
  return out;
}

/**
 * Put the log back on a booking that came from the cloud without one.
 * A log already on the booking wins — it is the device that just typed it.
 */
export function restoreExtensions(booking, map = {}) {
  if (!booking) return booking;
  if (arr(booking.extensions).length) return booking;
  const m = isPlain(map) ? map : {};
  const found = arr(m[String(booking.id)])
    .concat(booking.supabaseBookingId != null ? arr(m[String(booking.supabaseBookingId)]) : []);
  if (!found.length) return booking;
  const seen = new Set();
  const list = found.filter(e => { const k = extensionKey(e); return seen.has(k) ? false : seen.add(k); });
  return { ...booking, extensions: list };
}

/** Restore across a whole list. */
export function restoreExtensionsAll(bookings = [], map = {}) {
  return (bookings || []).map(b => restoreExtensions(b, map));
}

// ── Is an extension still owed for? ──────────────────────────────────────────
// An extension taken with nothing collected used to disappear from the Desk at
// midnight, because "Today's Extensions" only ever matched the day it was typed.
// The owner watching from abroad, hours out of step with the front desk, could
// miss it entirely. An extension that has not been paid for stays on the list
// until it is settled.

/** Was this booking extended today? */
export function extendedOn(extensions = [], today = "") {
  return (Array.isArray(extensions) ? extensions : []).some(e => e && e.at === today);
}

/**
 * The booking has been extended and money is still outstanding on it.
 * `due` is passed in rather than recomputed so this file never becomes a second
 * opinion on what a guest owes — see getHotelDue.
 */
export function hasUnsettledExtension(extensions = [], due = 0, status = "") {
  const list = Array.isArray(extensions) ? extensions : [];
  if (!list.length) return false;
  if (status === "cancelled") return false;
  return (parseFloat(due) || 0) > 0;
}
