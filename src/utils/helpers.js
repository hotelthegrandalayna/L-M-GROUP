export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function money(n) {
  return '৳' + (n || 0).toLocaleString();
}

export function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function nightsBetween(ci, co) {
  return Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
}

export function bookingConflicts(roomNum, ci, co, excludeId, bookings) {
  const ciD = new Date(ci), coD = new Date(co);
  return bookings.some(b => {
    if (excludeId !== null && b.id === excludeId) return false;
    if (b.status === 'cancelled' || b.status === 'checked-out') return false;
    // New multi-room bookings: each room has its own dates
    if (b.multiRooms && b.multiRooms.length) {
      return b.multiRooms.some(mr => {
        if (String(mr.number) !== String(roomNum)) return false;
        const mrCi = new Date(mr.checkin || b.checkin);
        const mrCo = new Date(mr.checkout || b.checkout);
        return ciD < mrCo && coD > mrCi;
      });
    }
    // Single room + old extraRooms: use booking-level dates
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)];
    if (!allRooms.map(String).includes(String(roomNum))) return false;
    const bci = new Date(b.checkin), bco = new Date(b.checkout);
    return ciD < bco && coD > bci;
  });
}

// Does this booking include the given room? Handles single, extra-room, and
// multi-room bookings — so every caller agrees on which rooms a booking covers.
export function bookingCoversRoom(b, roomNumber) {
  const num = String(roomNumber);
  if (b.multiRooms && b.multiRooms.length) {
    return b.multiRooms.some(mr => String(mr.number) === num);
  }
  return [b.room, ...(b.extraRooms || []).map(r => r.number)].map(String).includes(num);
}

// The check-in/check-out window for a specific room within a booking. For a
// multi-room booking each room can have its own dates; otherwise the booking's.
export function roomBookingWindow(b, roomNumber) {
  const num = String(roomNumber);
  if (b.multiRooms && b.multiRooms.length) {
    const mr = b.multiRooms.find(m => String(m.number) === num);
    if (mr) return { checkin: mr.checkin || b.checkin, checkout: mr.checkout || b.checkout };
  }
  return { checkin: b.checkin, checkout: b.checkout };
}

export function getRoomDisplayStatus(room, bookings, today) {
  const active = bookings.find(b =>
    b.status === 'checked-in' && bookingCoversRoom(b, room.number)
    && roomBookingWindow(b, room.number).checkout >= today);
  if (active) return 'occupied';
  // Only paint the room "reserved" once the reservation has actually started
  // (check-in date reached). A purely FUTURE reservation leaves the room vacant
  // today — it's still sellable tonight — and the "N ahead" badge flags the
  // upcoming booking instead.
  const reserved = bookings.find(b => {
    if (b.status !== 'confirmed' || !bookingCoversRoom(b, room.number)) return false;
    const w = roomBookingWindow(b, room.number);
    return w.checkin <= today && w.checkout > today;
  });
  if (reserved) return 'reserved';
  return 'vacant';
}

export function maxId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

// Collision-proof client-side id. Based on the timestamp (always far larger
// than Supabase's small serial ids) plus randomness, so an offline booking can
// NEVER accidentally share an id with a different booking from the cloud or
// another device. Fixes the maxId() id-collision data-loss bug.
export function newLocalId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
