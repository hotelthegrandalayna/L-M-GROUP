const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ||
  "";

export function hasHotelSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function apiBase() {
  return SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

function queryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? "?" + qs : "";
}

async function request(path, { method = "GET", query, body, extraHeaders } = {}) {
  const res = await fetch(apiBase() + "/" + path + queryString(query), {
    method,
    headers: headers(extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof payload === "string"
        ? payload
        : payload?.message ||
          payload?.error ||
          res.statusText ||
          "Supabase request failed";
    throw new Error(msg);
  }

  return payload;
}

function toText(value) {
  return value === undefined || value === null || value === ""
    ? null
    : String(value);
}

function toNum(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function firstImage(val) {
  if (Array.isArray(val)) return val[0] || null;
  return val || null;
}

function buildGuestRow(booking) {
  return {
    full_name: toText(booking.guest),
    phone: toText(booking.phone),
    nationality: toText(booking.nationality),
    email: toText(booking.email),
    ref_name: toText(booking.referredByName || booking.refName),
    ref_phone: toText(booking.referredByPhone || booking.refPhone),
    id_type: toText(booking.idType),
    id_number: toText(booking.idNum),
    image_front: toText(firstImage(booking.idFront)),
    image_back: toText(firstImage(booking.idBack)),
    id_docs: booking.idDocs?.length ? JSON.stringify(booking.idDocs) : null,
  };
}

function buildBookingRow(booking, guestId) {
  const total = toNum(booking.invoiceTotal ?? booking.amount, 0);
  const advance = toNum(booking.advance, 0);
  const restPayment = toNum(booking.restPayment, 0);
  const due = toNum(
    booking.dueAmount ??
      booking.due ??
      Math.max(0, total - advance - restPayment),
    Math.max(0, total - advance - restPayment),
  );
  const roomId =
    booking.roomId ?? booking.room_id ?? toInt(booking.room) ?? null;

  return {
    guest_id: guestId,
    room_id: roomId,
    checkin_date: booking.checkin || new Date().toISOString().slice(0, 10),
    checkout_date: booking.checkout || new Date().toISOString().slice(0, 10),
    adults: toInt(booking.adults) ?? 1,
    children: toInt(booking.children) ?? 0,
    room_rate: toNum(booking.roomRate ?? booking.rate, 0),
    ac_choice: toText(booking.acChoice),
    base_amount: toNum(booking.baseAmount ?? booking.amount, 0),
    discount_type: toText(booking.discType),
    discount_amount: toNum(booking.discAmt, 0),
    discount_reason: toText(booking.discReason),
    payment_method: toText(booking.paymentMethod),
    transaction_number: toText(booking.transactionNumber ?? booking.txnNumber),
    total_amount: total,
    advance_amount: advance,
    rest_payment: restPayment,
    due_amount: due,
    notes: (booking.status && !["confirmed","checked-in"].includes(booking.status)
      ? `[_st:${booking.status}]` : "") + (toText(booking.notes) || ""),
    is_reservation: (booking.status || "") === "confirmed",
    created_by: null,
    created_at: booking.createdAt || new Date().toISOString(),
    extra_rooms: booking.extraRooms?.length ? JSON.stringify(booking.extraRooms) : JSON.stringify([]),
  };
}

function fromDbBooking(row, guest) {
  const booking = {
    id: Number(row.id),
    guest_id: row.guest_id,
    guest: guest?.full_name || "",
    phone: guest?.phone || "",
    email: guest?.email || "",
    nationality: guest?.nationality || "",
    refName: guest?.ref_name || "",
    refPhone: guest?.ref_phone || "",
    referredByName: guest?.ref_name || "",
    referredByPhone: guest?.ref_phone || "",
    referredBy: guest?.ref_name || guest?.ref_phone || "",
    idType: guest?.id_type || "",
    idNum: guest?.id_number || "",
    idFront: guest?.image_front || "",
    idBack: guest?.image_back || "",
    idDocs: (() => { try { return guest?.id_docs ? JSON.parse(guest.id_docs) : []; } catch { return []; } })(),
    room: row.room_id != null ? String(row.room_id) : "",
    roomId: row.room_id,
    type: "",
    checkin: row.checkin_date || "",
    checkout: row.checkout_date || "",
    nights: row.checkin_date && row.checkout_date
      ? Math.max(
          1,
          Math.round(
            (new Date(row.checkout_date) - new Date(row.checkin_date)) /
              86400000,
          ),
        )
      : 0,
    roomRate: toNum(row.room_rate, 0),
    acChoice: row.ac_choice || "",
    baseAmount: toNum(row.base_amount, 0),
    discType: row.discount_type || "",
    discAmt: toNum(row.discount_amount, 0),
    discReason: row.discount_reason || "",
    paymentMethod: row.payment_method || "",
    transactionNumber: row.transaction_number || "",
    txnNumber: row.transaction_number || "",
    amount: toNum(row.total_amount, 0),
    invoiceTotal: toNum(row.total_amount, 0),
    advance: toNum(row.advance_amount, 0),
    restPayment: toNum(row.rest_payment, 0),
    dueAmount: toNum(row.due_amount, 0),
    notes: (row.notes || "").replace(/^\[_st:[^\]]+\]/, ""),
    status: (() => {
      const m = (row.notes || "").match(/^\[_st:([^\]]+)\]/);
      if (m) return m[1];
      return row.is_reservation ? "confirmed" : "checked-in";
    })(),
    isReservation: Boolean(row.is_reservation),
    createdAt: row.created_at || "",
    supabaseBookingId: row.id,
    by: row.created_by || "",
    paymentHistory: [],
    extraPersonCharge: null,
    extraRooms: (() => { try { return row.extra_rooms ? JSON.parse(row.extra_rooms) : []; } catch { return []; } })(),
  };

  return booking;
}

export async function persistHotelBookingBundle(booking) {
  if (!hasHotelSupabaseConfig() || !booking?.guest) {
    return { skipped: true, booking };
  }

  const guestId = booking.guest_id ?? booking.guestId ?? null;
  const bookingId = toInt(booking.supabaseBookingId ?? booking.bookingDbId);
  const guestRow = buildGuestRow(booking);
  let guest;

  if (guestId) {
    const guestRows = await request("guests", {
      method: "PATCH",
      query: { id: `eq.${guestId}` },
      body: guestRow,
      extraHeaders: { Prefer: "return=representation" },
    });
    guest = Array.isArray(guestRows) ? guestRows[0] : guestRows;
  } else {
    const guestRows = await request("guests", {
      method: "POST",
      body: guestRow,
      extraHeaders: { Prefer: "return=representation" },
    });
    guest = Array.isArray(guestRows) ? guestRows[0] : guestRows;
  }

  if (!guest?.id) {
    throw new Error("Supabase guest sync did not return an id");
  }

  const bookingRow = buildBookingRow(booking, guest.id);
  let bookingResult;
  const isNewGuest = !guestId;

  try {
    if (bookingId && guestId) {
      const bookingRows = await request("bookings", {
        method: "PATCH",
        query: { id: `eq.${bookingId}` },
        body: bookingRow,
        extraHeaders: { Prefer: "return=representation" },
      });
      bookingResult = Array.isArray(bookingRows) ? bookingRows[0] : bookingRows;
    } else {
      const bookingRows = await request("bookings", {
        method: "POST",
        body: bookingRow,
        extraHeaders: { Prefer: "return=representation" },
      });
      bookingResult = Array.isArray(bookingRows) ? bookingRows[0] : bookingRows;
    }
  } catch (err) {
    // If booking insert failed and we just created a new guest, clean it up
    // so we don't leave an orphaned guest row with no booking
    if (isNewGuest && guest?.id) {
      request("guests", { method: "DELETE", query: { id: `eq.${guest.id}` } }).catch(() => {});
    }
    throw err;
  }

  return {
    guest,
    booking: bookingResult,
  };
}

async function cleanupOrphanedGuest(guestId) {
  if (!guestId) return;
  const remaining = await request("bookings", { query: { guest_id: `eq.${guestId}` } }).catch(() => null);
  if (Array.isArray(remaining) && remaining.length === 0) {
    await request("guests", { method: "DELETE", query: { id: `eq.${guestId}` } }).catch(() => {});
  }
}

export async function deleteHotelBooking(bookingId, guestId) {
  if (!hasHotelSupabaseConfig() || !bookingId) return;
  await request("bookings", {
    method: "DELETE",
    query: { id: `eq.${bookingId}` },
  });
  await cleanupOrphanedGuest(guestId);
}

export async function deleteHotelBookings(bookingIds = [], guestIds = []) {
  if (!hasHotelSupabaseConfig() || !bookingIds.length) return;
  await request("bookings", {
    method: "DELETE",
    query: { id: `in.(${bookingIds.join(",")})` },
  });
  await Promise.all(guestIds.map(cleanupOrphanedGuest));
}

// ── Room sync — stored as JSON blob in app_config (same table as ntfy, guaranteed to work) ──
export async function loadRoomsFromSupabase() {
  if (!hasHotelSupabaseConfig()) return null;
  try {
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
    const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "";
    const res = await fetch(
      SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/app_config?key=eq.hotel_rooms",
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const val = rows?.[0]?.value;
    if (!Array.isArray(val) || val.length === 0) return null;
    return val;
  } catch { return null; }
}

export async function saveRoomsToSupabase(rooms) {
  if (!hasHotelSupabaseConfig()) return;
  const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
  const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "";
  const res = await fetch(
    SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/app_config",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key: "hotel_rooms", value: rooms, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error("Supabase rooms save failed: " + msg);
  }
}

export async function loadHotelBookingsFromSupabase() {
  if (!hasHotelSupabaseConfig()) return [];

  // Only fetch bookings where checkout >= 30 days ago — covers all active guests,
  // future reservations, and recent history. Old data stays in Supabase but isn't
  // re-downloaded every 30 seconds, which was causing 14 GB/month egress.
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const cutoff = d.toISOString().slice(0, 10);

  const bookingRows = await request("bookings", {
    query: { checkout_date: `gte.${cutoff}`, order: "created_at.desc" },
  });

  if (!Array.isArray(bookingRows) || bookingRows.length === 0) return [];

  // Only fetch the guests we actually need
  const guestIds = [...new Set(bookingRows.map(r => r.guest_id).filter(Boolean))];
  const guestRows = guestIds.length
    ? await request("guests", { query: { id: `in.(${guestIds.join(",")})` } })
    : [];

  const guestById = new Map(
    (Array.isArray(guestRows) ? guestRows : []).map((g) => [g.id, g]),
  );

  return bookingRows.map((row) =>
    fromDbBooking(row, guestById.get(row.guest_id)),
  );
}
