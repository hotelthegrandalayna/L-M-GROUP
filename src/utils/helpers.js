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

export function getRoomDisplayStatus(room, bookings, today) {
  const num = String(room.number);
  const active = bookings.find(b => {
    if (b.status !== 'checked-in') return false;
    // New multi-room: check per-room checkout
    if (b.multiRooms && b.multiRooms.length) {
      return b.multiRooms.some(mr => String(mr.number) === num && (mr.checkout || b.checkout) >= today);
    }
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)].map(String);
    return allRooms.includes(num) && b.checkout >= today;
  });
  if (active) return 'occupied';
  const reserved = bookings.find(b => {
    if (b.status !== 'confirmed') return false;
    // New multi-room: check per-room checkout
    if (b.multiRooms && b.multiRooms.length) {
      return b.multiRooms.some(mr => String(mr.number) === num && (mr.checkout || b.checkout) > today);
    }
    const allRooms = [b.room, ...(b.extraRooms || []).map(r => r.number)].map(String);
    return allRooms.includes(num) && b.checkout > today;
  });
  if (reserved) return 'reserved';
  return 'vacant';
}

export function maxId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}
