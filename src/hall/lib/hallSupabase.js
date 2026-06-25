const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ||
  "";

export function hasHallSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function apiBase() {
  return SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
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

async function request(
  path,
  { method = "GET", query, body, extraHeaders } = {},
) {
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

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function toNum(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  return value === undefined || value === null || value === ""
    ? null
    : String(value);
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serviceMeta(service) {
  const parsed = safeParseJson(service.description);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function buildBaseInvoiceRow(invoice, idOverride) {
  const id = idOverride || invoice.id || crypto.randomUUID();
  return {
    id,
    invoice_number: toText(invoice.num),
    invoice_date: invoice.invDate || new Date().toISOString().slice(0, 10),
    client_name: toText(invoice.client),
    client_phone: toText(invoice.phone),
    client_phone2: toText(invoice.phone2),
    client_phone3: toText(invoice.phone3),
    client_email: toText(invoice.email),
    client_address: toText(invoice.address),
    event_type: toText(invoice.evType),
    advance_paid: toNum(invoice.adv, 0),
    balance_due: toNum(invoice.balance, 0),
    payment_method: toText(invoice.advMethod),
    payment_status: toText(invoice.payStatus),
    bank_name: toText(invoice.bankName),
    bank_ref: toText(invoice.bankRef),
    hear_about: toText(invoice.hearAbout),
    notes: toText(invoice.note),
    waiter_cost_paid: toNum(
      invoice.waiterCostPaid ?? invoice.waiterPaid,
      0,
    ),
    stage_image_url: toText(invoice.stageImgData),
    stage_image_name: toText(invoice.stageImgName),
    voter_id_image: toText(invoice.voterIdData),
    voter_id_name: toText(invoice.voterIdName),
    is_lead: Boolean(invoice.isLead),
    confirmed: Boolean(invoice.confirmed),
    discount: toNum(invoice.discount, 0),
    grand_total: toNum(invoice.grand, 0),
  };
}

function buildEventDetailRows(invoice, invoiceId) {
  const rows = [];

  const common = {
    invoice_id: invoiceId,
    client_side: toText(invoice.wSide || invoice.hSide),
    bride_name: toText(invoice.wBride),
    bride_religion: toText(invoice.wBrideRel),
    groom_name: toText(invoice.wGroom),
    groom_religion: toText(invoice.wGroomRel),
    couple_phone: toText(invoice.wCouplePhone),
    client_relation: toText(invoice.wRelation || invoice.hRelation),
    custom_event_name: toText(invoice.genTitle),
  };

  if (invoice.evType === "Wedding" || invoice.evType === "Wedding + Holud") {
    rows.push({
      ...common,
      event_section: "Wedding",
      event_date: invoice.evDate || null,
      booking_slot: toText(invoice.wDur),
      time_of_day: toText(invoice.wTod),
      duration: toText(invoice.wDur),
      start_time: toText(invoice.wStart),
      end_time: toText(invoice.wEnd),
      ceremony_time: null,
      guests: toInt(invoice.wGuests),
      tables_count: toInt(invoice.wTables),
      venue: toText(invoice.wVenue),
      waiters: toInt(invoice.wWaiters),
      waiter_price:
        invoice.wWaiterPrice !== undefined &&
        invoice.wWaiterPrice !== null &&
        invoice.wWaiterPrice !== ""
          ? toNum(invoice.wWaiterPrice, 0)
          : null,
      hall_rental: toNum(invoice.wRental, 0),
    });
  }

  if (invoice.evType === "Holud" || invoice.evType === "Wedding + Holud") {
    rows.push({
      ...common,
      event_section: "Holud",
      event_date: invoice.hDate || invoice.evDate || null,
      booking_slot: toText(invoice.hSlot),
      time_of_day: toText(invoice.hTime),
      duration: toText(invoice.hTime),
      start_time: toText(invoice.hStart),
      end_time: toText(invoice.hEnd),
      ceremony_time: toText(invoice.hTime),
      guests: toInt(invoice.hGuests),
      tables_count: toInt(invoice.hTables),
      venue: toText(invoice.hVenue),
      waiters: toInt(invoice.hWaiters),
      waiter_price:
        invoice.hWaiterPrice !== undefined &&
        invoice.hWaiterPrice !== null &&
        invoice.hWaiterPrice !== ""
          ? toNum(invoice.hWaiterPrice, 0)
          : null,
      hall_rental: toNum(invoice.hRental, 0),
    });
  }

  if (
    invoice.evType &&
    invoice.evType !== "Wedding" &&
    invoice.evType !== "Holud" &&
    invoice.evType !== "Wedding + Holud"
  ) {
    rows.push({
      ...common,
      event_section: "Generic",
      event_date: invoice.evDate || null,
      booking_slot: toText(invoice.wDur),
      time_of_day: toText(invoice.wTod),
      duration: toText(invoice.wDur),
      start_time: toText(invoice.wStart),
      end_time: toText(invoice.wEnd),
      ceremony_time: null,
      guests: toInt(invoice.wGuests),
      tables_count: toInt(invoice.wTables),
      venue: toText(invoice.wVenue),
      waiters: toInt(invoice.wWaiters),
      waiter_price:
        invoice.wWaiterPrice !== undefined &&
        invoice.wWaiterPrice !== null &&
        invoice.wWaiterPrice !== ""
          ? toNum(invoice.wWaiterPrice, 0)
          : null,
      hall_rental: toNum(invoice.wRental, 0),
    });
  }

  return rows;
}

function buildServiceRows(invoice, invoiceId) {
  return (invoice.services || []).map((service) => {
    const meta = serviceMeta(service) || {};
    const qty = Number.parseFloat(service.qty);
    return {
      invoice_id: invoiceId,
      service_name: service.desc || meta.service_name || "Service",
      description: JSON.stringify({
        qty: Number.isFinite(qty) ? qty : 1,
        fixed: Boolean(service.fixed),
        included: service.included !== false,
        declineReason: service.declineReason || "",
      }),
      unit_price: toNum(service.rate, 0),
    };
  });
}

function applyDetailToInvoice(target, detail) {
  const section = String(detail.event_section || "").toLowerCase();
  const prefix = section.includes("holud")
    ? "h"
    : section.includes("wedding")
      ? "w"
      : "";

  if (prefix === "h") {
    target.hDate = detail.event_date || target.hDate || "";
    target.hSlot = detail.booking_slot || target.hSlot || "";
    target.hTime =
      detail.time_of_day ||
      detail.ceremony_time ||
      detail.duration ||
      target.hTime ||
      "";
    target.hStart = detail.start_time || target.hStart || "";
    target.hEnd   = detail.end_time   || target.hEnd   || "";
    target.hGuests = detail.guests ?? target.hGuests ?? "";
    target.hTables = detail.tables_count ?? target.hTables ?? "";
    target.hSide = detail.client_side || target.hSide || "";
    target.hBride = detail.bride_name || target.hBride || "";
    target.hBrideRel = detail.bride_religion || target.hBrideRel || "";
    target.hGroom = detail.groom_name || target.hGroom || "";
    target.hGroomRel = detail.groom_religion || target.hGroomRel || "";
    target.hRelation = detail.client_relation || target.hRelation || "";
    target.hVenue = detail.venue || target.hVenue || "";
    target.hWaiters = detail.waiters ?? target.hWaiters ?? "";
    target.hWaiterPrice = detail.waiter_price ?? target.hWaiterPrice ?? "";
    target.hRental = detail.hall_rental ?? target.hRental ?? "";
  } else if (prefix === "w") {
    target.evDate = detail.event_date || target.evDate || "";
    target.wDur = detail.booking_slot || detail.duration || target.wDur || "";
    target.wTod = detail.time_of_day || target.wTod || "";
    target.wStart = detail.start_time || target.wStart || "";
    target.wEnd = detail.end_time || target.wEnd || "";
    target.wGuests = detail.guests ?? target.wGuests ?? "";
    target.wTables = detail.tables_count ?? target.wTables ?? "";
    target.wSide = detail.client_side || target.wSide || "";
    target.wBride = detail.bride_name || target.wBride || "";
    target.wBrideRel = detail.bride_religion || target.wBrideRel || "";
    target.wGroom = detail.groom_name || target.wGroom || "";
    target.wGroomRel = detail.groom_religion || target.wGroomRel || "";
    target.wCouplePhone = detail.couple_phone || target.wCouplePhone || "";
    target.wRelation = detail.client_relation || target.wRelation || "";
    target.wVenue = detail.venue || target.wVenue || "";
    target.wWaiters = detail.waiters ?? target.wWaiters ?? "";
    target.wWaiterPrice = detail.waiter_price ?? target.wWaiterPrice ?? "";
    target.wRental = detail.hall_rental ?? target.wRental ?? "";
  } else {
    target.evDate = detail.event_date || target.evDate || "";
    target.wTod = detail.time_of_day || target.wTod || "";
    target.wDur = detail.booking_slot || detail.duration || target.wDur || "";
    target.wStart = detail.start_time || target.wStart || "";
    target.wEnd = detail.end_time || target.wEnd || "";
    target.wGuests = detail.guests ?? target.wGuests ?? "";
    target.wTables = detail.tables_count ?? target.wTables ?? "";
    target.genTitle = detail.custom_event_name || target.genTitle || "";
    target.wVenue = detail.venue || target.wVenue || "";
  }
}

function parseServiceRow(serviceRow) {
  const meta = serviceMeta(serviceRow) || {};
  const qty = Number.parseFloat(meta.qty);
  return {
    desc: serviceRow.service_name || meta.service_name || "Service",
    rate: toNum(serviceRow.unit_price, 0),
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    fixed: Boolean(meta.fixed),
    included: meta.included === undefined ? true : Boolean(meta.included),
    declineReason: meta.declineReason || "",
  };
}

function fromDbInvoice(row) {
  const invoice = {
    id: row.id,
    num: row.invoice_number || "",
    invDate: row.invoice_date || "",
    client: row.client_name || "",
    phone: row.client_phone || "",
    phone2: row.client_phone2 || "",
    phone3: row.client_phone3 || "",
    email: row.client_email || "",
    address: row.client_address || "",
    evType: row.event_type || "Wedding",
    adv: toNum(row.advance_paid, 0),
    balance: toNum(row.balance_due, 0),
    advMethod: row.payment_method || "Cash",
    payStatus: row.payment_status || "Unpaid",
    bankName: row.bank_name || "",
    bankRef: row.bank_ref || "",
    hearAbout: row.hear_about || "",
    note: row.notes || "",
    stageImgData: row.stage_image_url || "",
    stageImgName: row.stage_image_name || "",
    voterIdData: row.voter_id_image || "",
    voterIdName: row.voter_id_name || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    waiterCostPaid: toNum(row.waiter_cost_paid, 0),
    waiterPaid: toNum(row.waiter_cost_paid, 0),
    isLead: Boolean(row.is_lead),
    confirmed: Boolean(row.confirmed),
    discount: toNum(row.discount, 0),
    grand: toNum(row.grand_total, 0),
  };

  const details = Array.isArray(row.event_details) ? row.event_details : [];
  details.forEach((detail) => applyDetailToInvoice(invoice, detail));

  const services = Array.isArray(row.invoice_services)
    ? row.invoice_services
    : [];
  invoice.services = services.map(parseServiceRow);

  // Recalculate waiterTotal from raw fields so the "Collect Waiter Cost" button shows correctly
  const wWaiters = toNum(invoice.wWaiters, 0) * toNum(invoice.wWaiterPrice, 0);
  const hWaiters = toNum(invoice.hWaiters, 0) * toNum(invoice.hWaiterPrice, 0);
  invoice.waiterTotal = wWaiters + hWaiters;
  invoice.waiterBalance = Math.max(0, invoice.waiterTotal - toNum(invoice.waiterCostPaid, 0));

  return invoice;
}

function canPersistInvoice(invoice) {
  return Boolean(
    invoice && invoice.num && invoice.client && invoice.phone && invoice.evType,
  );
}

export async function loadHallInvoicesFromSupabase() {
  if (!hasHallSupabaseConfig()) return [];

  const payload = await request("invoices", {
    query: {
      select: "*,event_details(*),invoice_services(*)",
      order: "created_at.desc",
    },
  });

  return Array.isArray(payload) ? payload.map(fromDbInvoice) : [];
}

export async function persistHallInvoiceBundle(invoice) {
  if (!hasHallSupabaseConfig() || !canPersistInvoice(invoice)) {
    return { skipped: true, invoice };
  }

  const id = isUuid(invoice.id) ? invoice.id : crypto.randomUUID();
  const localInvoice = { ...invoice, id };
  const invoiceRow = buildBaseInvoiceRow(localInvoice, id);
  const detailRows = buildEventDetailRows(localInvoice, id);
  const serviceRows = buildServiceRows(localInvoice, id);

  await request("invoices", {
    method: "POST",
    query: { on_conflict: "id" },
    body: [invoiceRow],
    extraHeaders: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });

  await request("event_details", {
    method: "DELETE",
    query: { invoice_id: `eq.${id}` },
  });
  if (detailRows.length) {
    await request("event_details", {
      method: "POST",
      body: detailRows,
      extraHeaders: {
        Prefer: "return=representation",
      },
    });
  }

  await request("invoice_services", {
    method: "DELETE",
    query: { invoice_id: `eq.${id}` },
  });
  if (serviceRows.length) {
    await request("invoice_services", {
      method: "POST",
      body: serviceRows,
      extraHeaders: {
        Prefer: "return=representation",
      },
    });
  }

  return { skipped: false, invoice: localInvoice };
}

export async function deleteHallInvoiceFromSupabase(id) {
  if (!hasHallSupabaseConfig() || !isUuid(id)) return { skipped: true };

  await request("invoices", {
    method: "DELETE",
    query: { id: `eq.${id}` },
  });

  return { skipped: false };
}

export async function deleteHallInvoicesFromSupabase(ids = []) {
  if (!hasHallSupabaseConfig()) return { skipped: true };
  const valid = [...new Set(ids)].filter(isUuid);
  if (!valid.length) return { skipped: true };

  await request("invoices", {
    method: "DELETE",
    query: { id: `in.(${valid.join(",")})` },
  });

  return { skipped: false };
}
