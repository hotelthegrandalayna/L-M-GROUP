// ─────────────────────────────────────────────────────────────────────────────
// Filtering expenses by SEVERAL categories at once.
//
// The category filter used to hold one value, so looking at Salaries and
// Electricity together meant looking twice and adding up by hand. It now holds a
// list, and both the hotel and the hall share these rules so the two tabs cannot
// drift apart.
//
// The rule that matters: an EMPTY list means every category, not none. That is
// what "All Categories" did before, and it is what stops a cleared filter from
// showing an empty screen with no obvious way back.
// ─────────────────────────────────────────────────────────────────────────────

const clean = (list) =>
  Array.isArray(list) ? list.filter((c) => typeof c === "string" && c !== "") : [];

/** Add a category if it is missing, remove it if it is already there. */
export function toggleCat(list, cat) {
  if (!cat) return clean(list);
  const cur = clean(list);
  return cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat];
}

/** Does this expense's category pass the filter? Nothing selected passes everything. */
export function matchesCats(list, cat) {
  const cur = clean(list);
  if (!cur.length) return true;
  return cur.includes(cat || "");
}

/** Filter a list of records by category, reading each record's category with `read`. */
export function filterByCats(records = [], list = [], read = (r) => r.category) {
  const cur = clean(list);
  if (!cur.length) return [...records];
  return records.filter((r) => cur.includes(read(r) || ""));
}

/**
 * What to write under the filter, so the figures on screen are never ambiguous
 * about which categories they cover.
 */
export function catScopeLabel(list, allCount) {
  const cur = clean(list);
  if (!cur.length) return "all categories";
  if (cur.length === 1) return cur[0];
  if (allCount && cur.length >= allCount) return "all categories";
  return `${cur.length} categories`;
}

/** Total spent per category, for the amount shown on each chip. */
export function totalsByCat(records = [], read = (r) => r.category, amount = (r) => r.amount) {
  const out = {};
  records.forEach((r) => {
    const k = read(r) || "";
    if (!k) return;
    const n = parseFloat(amount(r));
    out[k] = (out[k] || 0) + (Number.isFinite(n) ? n : 0);
  });
  return out;
}
