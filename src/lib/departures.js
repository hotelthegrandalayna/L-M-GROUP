// ─────────────────────────────────────────────────────────────────────────────
// WHO LEAVES TODAY — the one rule behind the front desk's Departures card.
//
// Why this file exists: the card used to require status "checked-in", so it only
// ever listed guests who had NOT left yet. The moment the desk checked a guest
// out the room dropped off the card — by the evening "Today's Departures" read 0
// on a day with several checkouts, and the desk lost its list of the day's work.
//
// A departure is also not always the booked checkout date. When the desk forces
// a guest out early the booking KEEPS its original checkout date, so that date
// cannot be trusted to say when the guest left. The day they really left is
// recorded on the booking as `checkedOutOn` at checkout time, and it wins
// whenever it is there. Bookings checked out before that field existed have no
// recorded day, so they fall back to the booked checkout date.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The day this booking's guest leaves, or left. Empty string when the booking
 * never departs at all — a cancelled booking, or a reservation nobody checked
 * into.
 */
export function departureDate(b) {
  if (!b) return "";
  if (b.status === "checked-out") return b.checkedOutOn || b.checkout || "";
  if (b.status === "checked-in")  return b.checkout || "";
  return "";
}

/** True once the guest has actually gone — drawn differently on the card. */
export function hasDeparted(b) {
  return b?.status === "checked-out";
}

/** Every booking leaving on `today`, whether or not the guest has gone yet. */
export function todaysDepartures(bookings = [], today = "") {
  if (!today) return [];
  const list = Array.isArray(bookings) ? bookings : [];
  return list.filter(b => departureDate(b) === today);
}
