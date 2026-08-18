// ─────────────────────────────────────────────────────────────────────────────
// Correcting a CONFIRMED convention-hall invoice.
//
// Until now the Edit button was switched off the moment an invoice was
// confirmed (`inv.isLead || !inv.confirmed`), so an invoice raised with the
// wrong event date could not be fixed at all — only deleted and re-created,
// which loses the payment history and hands the client a new invoice number.
//
// The reason this needs care rather than just re-enabling the button: the hall's
// monthly figures are grouped by the EVENT date
// (`invInMonth = evDate || invDate` in HallContext), so correcting a date moves
// that invoice's billing and collection from one month into another. Both months
// change. That must never happen silently, so an amendment always shows what it
// will move before it is saved, and leaves a record of who moved it.
//
// WHERE THE RECORD LIVES: app_config, key `hall_invoice_amendments`. There is no
// column for it on the invoice row, and the audit_log table is write-only in
// this app (getAuditLog reads localStorage), so a record written there would be
// invisible on every other device. See the sync rule in CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────

export const AMENDMENTS_CONFIG_KEY = "hall_invoice_amendments";
export const AMENDMENTS_CACHE_KEY  = "a_inv_amendments";

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const isPlain = v => !!v && typeof v === "object" && !Array.isArray(v);

/** Fields worth reporting when an invoice is corrected, in reading order. */
export const TRACKED_FIELDS = [
  ["invDate",  "Invoice date"],
  ["evDate",   "Event date"],
  ["hDate",    "Holud date"],
  ["evType",   "Event type"],
  ["startTime","Start time"],
  ["endTime",  "End time"],
  ["client",   "Client name"],
  ["phone",    "Phone"],
  ["address",  "Address"],
  ["guests",   "Guests"],
  ["grand",    "Grand total"],
  ["discount", "Discount"],
  ["adv",      "Advance paid"],
  ["note",     "Note"],
];

const shown = v => (v === undefined || v === null || v === "" ? "—" : String(v));

/** What actually changed between the invoice as it was and as it will be. */
export function diffInvoice(before = {}, after = {}) {
  return TRACKED_FIELDS
    .map(([field, label]) => ({ field, label, was: before[field], now: after[field] }))
    .filter(c => shown(c.was) !== shown(c.now))
    .map(c => ({ ...c, was: shown(c.was), now: shown(c.now) }));
}

/** The month an invoice's money is counted in — event date first, as HallContext does. */
export function invoiceMonth(inv = {}) {
  return String(inv.evDate || inv.invDate || "").slice(0, 7);
}

/**
 * Does this amendment move money between months, and how much?
 * Returns null when the month is unchanged, so the warning only appears when it
 * genuinely applies.
 */
export function monthMove(before = {}, after = {}) {
  const from = invoiceMonth(before);
  const to   = invoiceMonth(after);
  if (!from || !to || from === to) return null;
  return { from, to, billed: num(after.grand), was: num(before.grand) };
}

/** One amendment entry, ready to store. */
export function buildAmendment(before, after, by = "", at = new Date().toISOString()) {
  const changes = diffInvoice(before, after);
  if (!changes.length) return null;
  return { ts: at, by: by || "admin", changes, move: monthMove(before, after) };
}

// ── Storage: one document, keyed by invoice, merged rather than replaced ─────

const entryKey = e => [e?.ts || "", (e?.changes || []).map(c => c.field).join(",")].join("|");

/** Union two maps so two devices amending different invoices cannot wipe each other. */
export function mergeAmendmentMaps(a = {}, b = {}) {
  const left = isPlain(a) ? a : {};
  const right = isPlain(b) ? b : {};
  const out = {};
  new Set([...Object.keys(left), ...Object.keys(right)]).forEach(id => {
    const seen = new Set();
    const list = [];
    [...(Array.isArray(left[id]) ? left[id] : []), ...(Array.isArray(right[id]) ? right[id] : [])]
      .forEach(e => {
        if (!e || typeof e !== "object") return;
        const k = entryKey(e);
        if (seen.has(k)) return;
        seen.add(k);
        list.push(e);
      });
    list.sort((x, y) => String(x.ts || "").localeCompare(String(y.ts || "")));
    if (list.length) out[id] = list;
  });
  return out;
}

/** Add one amendment to the map, leaving every other invoice untouched. */
export function addAmendment(map = {}, invoiceId, entry) {
  if (!invoiceId || !entry) return isPlain(map) ? map : {};
  return mergeAmendmentMaps(map, { [String(invoiceId)]: [entry] });
}

/** Every amendment for one invoice, oldest first. */
export function amendmentsFor(map = {}, invoiceId) {
  if (!isPlain(map) || !invoiceId) return [];
  return Array.isArray(map[String(invoiceId)]) ? map[String(invoiceId)] : [];
}

/**
 * Every amendment across every invoice, newest first — for the Admin list.
 * `invoices` is used only to put a number and a client name against each row.
 */
export function allAmendments(map = {}, invoices = []) {
  if (!isPlain(map)) return [];
  const byId = new Map((invoices || []).map(i => [String(i.id), i]));
  const rows = [];
  Object.entries(map).forEach(([id, list]) => {
    (Array.isArray(list) ? list : []).forEach(e => {
      const inv = byId.get(String(id));
      rows.push({
        invoiceId: id,
        num: inv?.num || "—",
        client: inv?.client || "",
        ts: e.ts || "",
        by: e.by || "",
        changes: e.changes || [],
        move: e.move || null,
      });
    });
  });
  return rows.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}
