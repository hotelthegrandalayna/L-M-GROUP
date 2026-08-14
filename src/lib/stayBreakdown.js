// ─────────────────────────────────────────────────────────────────────────────
// How a stay breaks into billable lines: the ORIGINAL nights, then each
// EXTENSION as its own line.
//
// Why this exists: the invoice used to multiply every room by the TOTAL nights
// (original + extensions) and then hide the difference inside a swollen
// discount. A 1-night, 2-room booking extended twice printed as "3 Nights" per
// room, with one room's qty x rate not even matching its own amount, a ~4,500
// discount nobody gave, and a total that disagreed with the money collected.
//
// Rules:
//   · An extension is a separate line, on its own dates, for the money actually
//     taken for it. It never changes the original nights or the room rate.
//   · Extensions come from the booking's own log when it has one, otherwise they
//     are recovered from the payment notes ("Extend stay +1 night"), which is the
//     only copy that survives a cloud round-trip.
//   · The invoice total is ALWAYS original + extensions + services. If the stored
//     total disagrees, the stored total is stale and the parts win.
// ─────────────────────────────────────────────────────────────────────────────

const n = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };

export function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000));
}

export function addDays(iso, k) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Every extension on this booking, oldest first, with dates we can print.
export function stayExtensions(b) {
  if (!b) return [];
  const logged = (b.extensions || [])
    .map(e => ({
      nights: Math.max(1, Math.round(n(e.nights)) || 1),
      amount: n(e.amount),
      from: e.from || "",
      to: e.to || "",
      at: e.at || "",
    }))
    .filter(e => e.amount > 0 || e.nights > 0);
  if (logged.length) return logged;

  // Recovered from payment notes — the only copy that survives the cloud, since
  // there is no extensions column.
  const fromPays = (b.paymentHistory || [])
    .filter(p => /extend/i.test(p.note || ""))
    .map(p => {
      const m = String(p.note || "").match(/\+\s*(\d+)\s*night/i);
      return {
        nights: m ? Math.max(1, parseInt(m[1], 10)) : 1,
        amount: n(p.amount),
        at: String(p.ts || "").slice(0, 10),
        from: "",
        to: "",
      };
    })
    .filter(e => e.amount > 0)
    .sort((a, b2) => String(a.at).localeCompare(String(b2.at)));

  // Walk the dates backwards from checkout so each extension can print its nights.
  let cursor = b.checkout || "";
  for (let i = fromPays.length - 1; i >= 0; i--) {
    const e = fromPays[i];
    e.to = cursor;
    e.from = cursor ? addDays(cursor, -e.nights) : "";
    cursor = e.from;
  }
  return fromPays;
}

/**
 * The billable shape of a stay.
 * @returns {{
 *   baseCheckin: string, baseCheckout: string, baseNights: number,
 *   extensions: Array, extensionNights: number, extensionTotal: number,
 *   totalNights: number, checkout: string, wasExtended: boolean
 * }}
 */
export function stayBreakdown(b) {
  const checkin = b?.checkin || "";
  const checkout = b?.checkout || "";
  const exts = stayExtensions(b);
  const extensionNights = exts.reduce((s, e) => s + e.nights, 0);
  const extensionTotal = exts.reduce((s, e) => s + e.amount, 0);

  const totalNights = Math.max(
    nightsBetween(checkin, checkout),
    Math.max(1, Math.round(n(b?.nights))) || 0,
  ) || 0;

  // The original stay is everything before the first extension.
  const firstFrom = exts.map(e => e.from).filter(Boolean).sort()[0] || "";
  let baseNights = firstFrom ? nightsBetween(checkin, firstFrom) : totalNights - extensionNights;
  if (!(baseNights > 0)) baseNights = Math.max(1, totalNights - extensionNights);
  const baseCheckout = firstFrom || (checkin ? addDays(checkin, baseNights) : checkout);

  return {
    baseCheckin: checkin,
    baseCheckout,
    baseNights,
    extensions: exts,
    extensionNights,
    extensionTotal,
    totalNights: baseNights + extensionNights,
    checkout,
    wasExtended: exts.length > 0,
  };
}

/**
 * What the ORIGINAL stay was invoiced, with extensions stripped out. Falls back
 * to the room amounts when the stored total is stale (which happens when an
 * extension failed to write its new total to the cloud).
 */
export function baseInvoiceAmount(b, breakdown) {
  const bd = breakdown || stayBreakdown(b);
  const stored = n(b?.invoiceTotal ?? b?.amount);
  const fromStored = stored - bd.extensionTotal;
  if (fromStored > 0.5) return fromStored;

  // Rebuild from the rooms themselves.
  const extraRooms = (b?.extraRooms || []).reduce((s, r) => s + n(r.amount), 0);
  const base = n(b?.baseAmount);
  if (base > 0.5) return base;
  const rate = n(b?.roomRate);
  if (rate > 0.5) return rate * bd.baseNights + extraRooms;
  return Math.max(0, stored);
}
