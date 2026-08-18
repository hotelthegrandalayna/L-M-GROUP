// ─────────────────────────────────────────────────────────────────────────────
// ONE RULE for combining a cloud booking with the device's local copy.
//
// Why this file exists: two computers were showing different revenue for the
// same month. The cause was that the sync took the INVOICE TOTAL from the cloud
// but the PAYMENT HISTORY from the device. Those two drift apart the moment a
// write is slow, and they drift differently on every machine — so each device
// computed a different "collected" figure from the same booking.
//
// The rule now: once a booking exists in the cloud, the cloud is the truth for
// money. The only local thing we keep is a payment that is genuinely NEWER than
// anything the cloud has (i.e. taken on this device and not yet pushed) — and we
// hand those back to the caller so they can be re-pushed instead of lost.
// ─────────────────────────────────────────────────────────────────────────────

const ts = p => String(p?.ts || "");
const amt = p => { const n = parseFloat(p?.amount); return Number.isFinite(n) ? n : 0; };

// Identity of a payment. Two entries with the same stamp, amount and note are
// the same payment, whichever device is looking at it.
export function paymentKey(p) {
  return [ts(p), amt(p), String(p?.note || "").trim(), String(p?.method || "").trim()].join("|");
}

// Payments the device has that the cloud has never seen AND that are newer than
// the newest cloud payment. Anything older is a stale local leftover — dropping
// it is correct, because an admin edit may have deliberately removed it.
export function unsyncedPayments(cloudPays = [], localPays = []) {
  const cloud = Array.isArray(cloudPays) ? cloudPays : [];
  const local = Array.isArray(localPays) ? localPays : [];
  if (!local.length) return [];
  const known = new Set(cloud.map(paymentKey));
  const newestCloud = cloud.reduce((m, p) => (ts(p) > m ? ts(p) : m), "");
  return local.filter(p => !known.has(paymentKey(p)) && ts(p) && ts(p) > newestCloud);
}

export function mergePaymentHistory(cloudPays = [], localPays = []) {
  const cloud = Array.isArray(cloudPays) ? cloudPays : [];
  const extra = unsyncedPayments(cloud, localPays);
  if (!extra.length) return cloud;
  return [...cloud, ...extra].sort((a, b) => ts(a).localeCompare(ts(b)));
}

// Fields the cloud does not store, so the local copy is the only source.
// NOTE: money fields are deliberately absent — those always come from the cloud.
const LOCAL_ONLY = [
  "invoiceExtras", "extrasAdvance", "extraPersonCharge",
  "invoiceDate", "tcPrinted",
  "guestType", "spouseName", "spousePhone", "groupMembers",
];

/**
 * Combine one cloud booking with this device's local copy.
 * @returns {{ booking: object, needsPush: boolean }}
 *   needsPush is true when the device held payments the cloud has not got yet.
 */
export function mergeBooking(cloudBooking, localBooking, companion) {
  const sb = cloudBooking || {};
  const l = localBooking || {};
  const comp = companion || null;
  if (!localBooking && !comp) return { booking: sb, needsPush: false };

  const extra = unsyncedPayments(sb.paymentHistory, l.paymentHistory);
  const out = {
    ...sb,
    // Money: cloud wins, full stop. Local values are only used when the cloud
    // genuinely has nothing (an older row saved before these columns existed).
    discAmt:    sb.discAmt    || l.discAmt    || 0,
    discType:   sb.discType   || l.discType   || "",
    discReason: sb.discReason || l.discReason || "",
    baseAmount: sb.baseAmount || l.baseAmount || 0,
    paymentHistory: extra.length
      ? [...(Array.isArray(sb.paymentHistory) ? sb.paymentHistory : []), ...extra]
          .sort((a, b) => ts(a).localeCompare(ts(b)))
      : (Array.isArray(sb.paymentHistory) ? sb.paymentHistory : []),
    // The extension log has no cloud column. This comment used to claim it
    // "lives in app_config and is restored by the caller" — that mechanism did
    // not exist, and believing it cost three separate rounds of debugging. It
    // now genuinely has three homes: paymentHistory entries of type
    // "extension" (a real column), app_config hotel_booking_extensions, and a
    // last-resort recovery from baseAmount vs nights. Keep whichever copy has
    // entries. See lib/bookingRoundTrip.test.js.
    extensions: (Array.isArray(sb.extensions) && sb.extensions.length)
      ? sb.extensions
      : (Array.isArray(l.extensions) ? l.extensions : []),
  };

  LOCAL_ONLY.forEach(k => {
    const lv = l[k];
    const has = Array.isArray(lv) ? lv.length > 0 : (lv !== undefined && lv !== null && lv !== "" && lv !== false);
    if (has) out[k] = lv;
    else if (out[k] === undefined) out[k] = sb[k];
  });

  if (comp) {
    out.guestType   = l.guestType   || sb.guestType   || comp.guestType   || "single";
    out.spouseName  = l.spouseName  || sb.spouseName  || comp.spouseName  || "";
    out.spousePhone = l.spousePhone || sb.spousePhone || comp.spousePhone || "";
    out.groupMembers = (l.groupMembers?.length ? l.groupMembers
      : sb.groupMembers?.length ? sb.groupMembers
      : (comp.groupMembers || []));
  }

  return { booking: out, needsPush: extra.length > 0 };
}
