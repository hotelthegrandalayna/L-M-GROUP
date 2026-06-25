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
    notes: toText(booking.notes),
    is_reservation: (booking.status || "") === "confirmed",
    created_by: null,
    created_at: booking.createdAt || new Date().toISOString(),
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
    notes: row.notes || "",
    status: row.is_reservation ? "confirmed" : "checked-in",
    isReservation: Boolean(row.is_reservation),
    createdAt: row.created_at || "",
    supabaseBookingId: row.id,
    by: row.created_by || "",
    paymentHistory: [],
    extraPersonCharge: null,
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

  return {
    guest,
    booking: bookingResult,
  };
}

export async function deleteHotelBooking(bookingId) {
  if (!hasHotelSupabaseConfig() || !bookingId) return;
  await request("bookings", {
    method: "DELETE",
    query: { id: `eq.${bookingId}` },
  });
}

export async function deleteHotelBookings(bookingIds = []) {
  if (!hasHotelSupabaseConfig() || !bookingIds.length) return;
  await request("bookings", {
    method: "DELETE",
    query: { id: `in.(${bookingIds.join(",")})` },
  });
}

export async function loadHotelBookingsFromSupabase() {
  if (!hasHotelSupabaseConfig()) return [];

  const [bookingRows, guestRows] = await Promise.all([
    request("bookings", { query: { order: "created_at.desc" } }),
    request("guests", { query: { order: "created_at.desc" } }),
  ]);

  const guestById = new Map(
    (Array.isArray(guestRows) ? guestRows : []).map((g) => [g.id, g]),
  );

  return (Array.isArray(bookingRows) ? bookingRows : []).map((row) =>
    fromDbBooking(row, guestById.get(row.guest_id)),
  );
}
