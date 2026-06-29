export function todayStr() {
  return new Date().toISOString().split('T')[0];
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
    // Check primary room AND all extra rooms
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)];
    if (!allRooms.includes(roomNum)) return false;
    const bci = new Date(b.checkin), bco = new Date(b.checkout);
    return ciD < bco && coD > bci;
  });
}

export function getRoomDisplayStatus(room, bookings, today) {
  const num = room.number;
  const active = bookings.find(b => {
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)];
    return allRooms.includes(num) && b.status === 'checked-in' && b.checkin <= today && b.checkout >= today;
  });
  if (active) return 'occupied';
  const reserved = bookings.find(b => {
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)];
    return allRooms.includes(num) && b.status === 'confirmed' && b.checkout > today;
  });
  if (reserved) return 'reserved';
  return 'vacant';
}

export function maxId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}
