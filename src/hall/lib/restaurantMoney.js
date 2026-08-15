// ─────────────────────────────────────────────────────────────────────────────
// Coffee house bookkeeping — the ONE place every Restaurant figure is computed.
//
// The owner's rules, kept exactly as specified:
//
//   Cost of goods used = Opening stock + Bought for the shelf − Closing stock
//   Gross profit       = Revenue − Cost of goods used
//   Net profit         = Gross profit − Other expenses
//   Expected cash      = Opening cash + cash in − cash out
//
// Everything the shop spends money on lives in ONE list. A single flag,
// `isStock`, decides which half of the profit sum it goes through:
//   ticked   → it sits on the shelf and is in the month-end count → goods used
//   unticked → a running cost (rent, salary, cleaning) → other expenses
//
// Three rules keep the figures honest, and the tests enforce all three:
//
//  1. NO TAKA MAY VANISH. Whichever way a cost is filed, it reaches net profit
//     exactly once — never twice, never nowhere.
//  2. OWNER MONEY IS NOT A COST. Money put in or taken out moves the drawer and
//     nothing else. Counting a withdrawal as an expense would make a profitable
//     shop look like it is losing money.
//  3. WHAT THE OWNER LEAVES BEHIND IS NEXT MONTH'S OPENING CASH. Closing a
//     month records what was taken; the remainder carries forward on its own.
//
// The shop is cash-only. Card and mobile boxes were removed from the forms, but
// any figure already typed into them is still counted as revenue and still kept
// out of the drawer — so no past month changes.
// ─────────────────────────────────────────────────────────────────────────────

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const monthOf = iso => String(iso || "").slice(0, 7);

/** Empty store, so a first-run device and a synced one have the same shape. */
export const emptyRestaurant = () => ({
  sales: [], spend: [], ownerMoves: [], counts: [], months: {},
});

/**
 * Normalise anything loaded from the cloud or localStorage into that shape.
 * Also folds the older split of `purchases` + `expenses` into the single
 * `spend` list, so records made before the two screens merged still read.
 */
export function normalise(data) {
  const d = data && typeof data === "object" ? data : {};
  const arr = v => (Array.isArray(v) ? v : []);

  const legacyBuys = arr(d.purchases).map(r => ({
    id: r.id, date: r.date, by: r.by,
    what: r.what || r.supplier || "Purchase",
    amount: num(r.amount),
    isStock: r.isStock !== false,
    method: r.method,
    receiptId: r.receiptId || "", receiptName: r.receiptName || "",
  }));
  const legacyExps = arr(d.expenses).map(r => ({
    id: r.id, date: r.date, by: r.by,
    what: [r.cat, r.desc].filter(Boolean).join(" — ") || "Expense",
    amount: num(r.amount),
    isStock: false,
    method: r.method,
    receiptId: r.receiptId || "", receiptName: r.receiptName || "",
  }));

  return {
    sales: arr(d.sales),
    spend: [...arr(d.spend), ...legacyBuys, ...legacyExps],
    ownerMoves: arr(d.ownerMoves),
    counts: arr(d.counts),
    months: d.months && typeof d.months === "object" ? d.months : {},
  };
}

/**
 * Combine the cloud's copy of the books with this device's.
 *
 * The cloud is the truth, as it is everywhere else in this app — but a row typed
 * seconds ago may not have reached it yet, and a sync that simply replaced local
 * state would make that row vanish in front of the person who just typed it.
 * So: take the cloud's version of everything it knows about, and keep any row
 * this device has that the cloud has never seen. Same rule the expense-type sync
 * already uses.
 */
export function mergeRestaurant(cloudData, localData) {
  const cloud = normalise(cloudData);
  const local = normalise(localData);
  const keepNew = (c, l, keyOf) => {
    const seen = new Set(c.map(keyOf));
    return [...c, ...l.filter(r => !seen.has(keyOf(r)))];
  };
  const byId = r => String(r.id);
  return {
    sales:      keepNew(cloud.sales,      local.sales,      byId),
    spend:      keepNew(cloud.spend,      local.spend,      byId),
    ownerMoves: keepNew(cloud.ownerMoves, local.ownerMoves, byId),
    // A drawer count is identified by its day — one count per day, not per id.
    counts:     keepNew(cloud.counts,     local.counts,     r => String(r.date)),
    // Cloud wins for a month it already knows about; a month only this device
    // has (opened offline) is kept.
    months: { ...local.months, ...cloud.months },
  };
}

export function prevMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  if (!y || !mo) return "";
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

export function nextMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  if (!y || !mo) return "";
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** Every month that has any activity at all, oldest first. */
export function monthsWithData(data) {
  const d = normalise(data);
  const s = new Set([
    ...d.sales.map(r => monthOf(r.date)),
    ...d.spend.map(r => monthOf(r.date)),
    ...d.ownerMoves.map(r => monthOf(r.date)),
    ...d.counts.map(r => monthOf(r.date)),
    ...Object.keys(d.months),
  ].filter(Boolean));
  return [...s].sort();
}

const inMonth = (rows, m) => rows.filter(r => monthOf(r.date) === m);

// ── Trading figures for one month, ignoring where the openings came from ─────
function tradingOf(d, month) {
  const sales = inMonth(d.sales, month);
  const spend = inMonth(d.spend, month);
  const owner = inMonth(d.ownerMoves, month);

  const cashSales   = sales.reduce((s, r) => s + num(r.cash), 0);
  // Legacy only — the forms no longer offer these, but old figures still count.
  const cardSales   = sales.reduce((s, r) => s + num(r.card), 0);
  const mobileSales = sales.reduce((s, r) => s + num(r.mobile), 0);
  // Refunds are money handed back over the counter: they reduce the day's
  // takings and the drawer alike.
  const refunds     = sales.reduce((s, r) => s + num(r.refunds), 0);
  const revenue     = cashSales + cardSales + mobileSales - refunds;

  const stockRows = spend.filter(r => r.isStock !== false);
  const runRows   = spend.filter(r => r.isStock === false);
  const stockPurchases = stockRows.reduce((s, r) => s + num(r.amount), 0);
  const otherExpenses  = runRows.reduce((s, r) => s + num(r.amount), 0);
  const spendTotal     = stockPurchases + otherExpenses;

  // Cash-only shop. A legacy row explicitly marked Card or Bank stays out of the
  // drawer sum; everything else, including every new row, is cash.
  const isCash = r => !r.method || r.method === "Cash";
  const cashSpend = spend.filter(isCash).reduce((s, r) => s + num(r.amount), 0);

  const ownerIn  = owner.filter(r => r.dir === "in").reduce((s, r) => s + num(r.amount), 0);
  const ownerOut = owner.filter(r => r.dir === "out").reduce((s, r) => s + num(r.amount), 0);

  return {
    cashSales, cardSales, mobileSales, refunds, revenue,
    stockPurchases, otherExpenses, spendTotal, cashSpend,
    ownerIn, ownerOut,
    daysEntered: sales.length,
  };
}

/** The last drawer count in a month, or null if it was never counted. */
export function lastCount(data, month) {
  const counts = inMonth(normalise(data).counts, month)
    .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return counts.length ? num(counts[counts.length - 1].counted) : null;
}

/** What the owner took when the month was closed. 0 if it is still open. */
export function ownerTookIn(data, month) {
  const set = normalise(data).months[month] || {};
  return set.closed ? num(set.ownerTook) : 0;
}

/** Cash left in the shop at the end of a month — this is next month's opening. */
function closingCashOf(d, month, openCash) {
  const t = tradingOf(d, month);
  const expected = openCash + t.cashSales - t.refunds - t.cashSpend + t.ownerIn - t.ownerOut;
  const counted = lastCount(d, month);
  // A real count beats the calculation — the drawer is the truth.
  const inDrawer = counted === null ? expected : counted;
  const set = d.months[month] || {};
  // Closing the month is the owner taking their money out. Whatever is left
  // behind opens the next month, with no figure typed anywhere.
  return set.closed ? inDrawer - num(set.ownerTook) : inDrawer;
}

// Opening cash and opening stock are never typed twice. Resolved by walking
// forward from the first month with data, so a gap month (shop closed) carries
// the balance through rather than zeroing it.
function openings(d, month) {
  const all = monthsWithData(d);
  const first = all.length ? all[0] : month;
  let cash = num(d.months[first]?.openCash);
  let stock = num(d.months[first]?.openStock);
  let m = first;
  let guard = 0;
  while (m !== month && guard++ < 600) {
    const set = d.months[m] || {};
    const t = tradingOf(d, m);
    // If a month was never counted, nothing is invented — the stock carries
    // through unchanged rather than inventing a profit or a loss.
    const closeStock = set.closeStock === undefined || set.closeStock === ""
      ? stock + t.stockPurchases
      : num(set.closeStock);
    cash = closingCashOf(d, m, cash);
    stock = closeStock;
    m = nextMonth(m);
    if (!m) break;
  }
  const set = d.months[month] || {};
  return {
    openCash:  set.openCash  === undefined || set.openCash  === "" ? cash  : num(set.openCash),
    openStock: set.openStock === undefined || set.openStock === "" ? stock : num(set.openStock),
    openCashAuto:  set.openCash  === undefined || set.openCash  === "",
    openStockAuto: set.openStock === undefined || set.openStock === "",
  };
}

/**
 * Everything the dashboard shows for one month.
 * Every figure here traces back to rows the owner can open and check.
 */
export function monthSummary(data, month) {
  const d = normalise(data);
  const t = tradingOf(d, month);
  const { openCash, openStock, openCashAuto, openStockAuto } = openings(d, month);

  const set = d.months[month] || {};
  const closeStockSet = !(set.closeStock === undefined || set.closeStock === "");
  const closeStock = closeStockSet ? num(set.closeStock) : openStock + t.stockPurchases;

  const cogs  = openStock + t.stockPurchases - closeStock;
  const gross = t.revenue - cogs;
  const net   = gross - t.otherExpenses;

  const expectedCash = openCash + t.cashSales - t.refunds - t.cashSpend + t.ownerIn - t.ownerOut;
  const countedCash  = lastCount(d, month);
  const inDrawer     = countedCash === null ? expectedCash : countedCash;

  const closed    = !!set.closed;
  const ownerTook = closed ? num(set.ownerTook) : 0;

  return {
    month, ...t,
    openStock, closeStock, closeStockSet, openStockAuto,
    cogs, gross, net,
    openCash, openCashAuto, expectedCash, countedCash, inDrawer,
    cashDiff: countedCash === null ? null : countedCash - expectedCash,
    closed, ownerTook, closedAt: set.closedAt || "",
    // What next month opens with — shown on the closing screen before committing.
    carriesForward: inDrawer - ownerTook,
  };
}

/**
 * Expected cash in the drawer at the end of one day — the month's opening cash
 * plus everything logged up to and including that date.
 */
export function expectedCashOn(data, date) {
  const d = normalise(data);
  const month = monthOf(date);
  const { openCash } = openings(d, month);
  const upTo = rows => inMonth(rows, month).filter(r => String(r.date) <= String(date));
  const sales = upTo(d.sales), spend = upTo(d.spend), own = upTo(d.ownerMoves);
  const isCash = r => !r.method || r.method === "Cash";
  return openCash
    + sales.reduce((s, r) => s + num(r.cash) - num(r.refunds), 0)
    - spend.filter(isCash).reduce((s, r) => s + num(r.amount), 0)
    + own.filter(r => r.dir === "in").reduce((s, r) => s + num(r.amount), 0)
    - own.filter(r => r.dir === "out").reduce((s, r) => s + num(r.amount), 0);
}

/** Every day of a month that has a count, with what was expected against it. */
export function dailyCloses(data, month) {
  const d = normalise(data);
  return inMonth(d.counts, month)
    .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(c => {
      const expected = expectedCashOn(d, c.date);
      const counted = num(c.counted);
      return { date: c.date, expected, counted, diff: counted - expected };
    });
}
