// ─────────────────────────────────────────────────────────────────────────────
// Recovering a saved booking's discount when you reopen it.
//
// Why this file exists: a two-room reservation was taken with a discount, and
// when the desk reopened it to check the guest in, the discount had vanished and
// the bill had gone back up. The discount had to be typed in a second time.
//
// The cause is that the booking form kept the primary room's own discount in a
// field called `primaryDiscAmt` which is stored NOWHERE — it has no Supabase
// column (see lib/hotelSupabase.js) and mergeBooking does not carry it. So the
// first time the reservation came back from the cloud the field was undefined,
// the form read it as 0, and the primary room lost its discount.
//
// It does not need to be stored, because it is implied by two things that ARE
// stored: the booking's total discount, and each extra room's own discount
// (both live in the cloud, the latter inside the extra_rooms JSON). This is the
// same identity the invoice uses — see "Invoice line-item arithmetic" in
// CLAUDE.md:  primary share = total discount − sum(extra rooms' discounts).
// ─────────────────────────────────────────────────────────────────────────────

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/** Total discount carried by a booking's extra rooms. */
export function extraRoomsDiscount(booking) {
  return (booking?.extraRooms || []).reduce((s, r) => s + num(r?.discAmt), 0);
}

/**
 * The primary room's own share of the discount, derived rather than stored.
 * Never negative, and never more than the booking's total discount.
 */
export function primaryDiscShare(booking) {
  if (!booking) return 0;
  const total = num(booking.discAmt);
  if (total <= 0) return 0;
  // The multi-room-card shape keeps every room's discount in multiRooms[], so
  // there is no "primary" room to carry a leftover share.
  if (booking.isMultiRoomBooking && (booking.multiRooms || []).length) return 0;
  return Math.max(0, total - extraRoomsDiscount(booking));
}
