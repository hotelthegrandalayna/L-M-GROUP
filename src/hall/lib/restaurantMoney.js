// ─────────────────────────────────────────────────────────────────────────────
// Coffee house bookkeeping — the ONE place every Restaurant figure is computed.
//
// The owner's rules, kept exactly as specified:
//
//   Cost of goods used = Opening stock + Purchases − Closing stock
//   Gross profit       = Revenue − Cost of goods used
//   Net profit         = Gross profit − Other expenses
//   Expected cash      = Opening cash + cash in − cash out
//
// Two rules that keep those honest, and which the tests enforce:
//
//  1. NO TAKA MAY VANISH. A purchase that is not stock (cleaning liquid, bin
//     bags) is never counted in the inventory count, so putting it through the
//     goods-used formula would report it as consumed twice over — or, if left
//     out, not at all. Non-stock purchases are therefore added to other
//     expenses. However the manager files a cost, it lands in net profit once.
//
//  2. OWNER MONEY IS NOT A COST. Money the owner puts in or takes out moves the
//     drawer and nothing else. Counting a withdrawal as an expense would make a
//     profitable shop look like it is losing money.
//
// Card and mobile takings are revenue but never reach the drawer, so they are
// deliberately absent from the cash column.
// ─────────────────────────────────────────────────────────────────────────────

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const monthOf = iso => String(iso || "").slice(0, 7);

/** Empty store, so a first-run device and a synced one have the same shape. */
export const emptyRestaurant = () => ({
  sales: [], purchases: [], expenses: [], ownerMoves: [], counts: [], months: {},
});

/** Normalise anything loaded from the cloud or localStorage into that shape. */
export function normalise(data) {
  const d = data && typeof data === "object" ? data : {};
  const arr = v => (Array.isArray(v) ? v : []);
  return {
    sales: arr(d.sales), purchases: arr(d.purchases), expenses: arr(d.expenses),
    ownerMoves: arr(d.ownerMoves), counts: arr(d.counts),
    months: d.months && typeof d.months === "object" ? d.months : {},
  };
}

/** The month before "2026-08" is "2026-07". */
export function prevMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  if (!y || !mo) return "";
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

/** Every month that has any activity at all, oldest first. */
export function monthsWithData(data) {
  const d = normalise(data);
  const s = new Set([
    ...d.sales.map(r => monthOf(r.date)),
    ...d.purchases.map(r => monthOf(r.date)),
    ...d.expenses.map(r => monthOf(r.date)),
    ...d.ownerMoves.map(r => monthOf(r.date)),
    ...d.counts.map(r => monthOf(r.date)),
    ...Object.keys(d.months),
  ].filter(Boolean));
  return [...s].sort();
}

const inMonth = (rows, m) => rows.filter(r => monthOf(r.date) === m);

// ── Trading figures for one month, ignoring where the openings came from ─────
function tradingOf(d, month) {
  const sales     = inMonth(d.sales, month);
  const purchases = inMonth(d.purchases, month);
  const expenses  = inMonth(d.expenses, month);
  const owner     = inMonth(d.ownerMoves, month);

  const cashSales   = sales.reduce((s, r) => s + num(r.cash), 0);
  const cardSales   = sales.reduce((s, r) => s + num(r.card), 0);
  const mobileSales = sales.reduce((s, r) => s + num(r.mobile), 0);
  // Refunds are money handed back over the counter: they reduce both the day's
  // takings and the drawer.
  const refunds     = sales.reduce((s, r) => s + num(r.refunds), 0);
  const revenue     = cashSales + cardSales + mobileSales - refunds;

  const stockBuys    = purchases.filter(r => r.isStock !== false);
  const nonStockBuys = purchases.filter(r => r.isStock === false);
  const stockPurchases    = stockBuys.reduce((s, r) => s + num(r.amount), 0);
  const nonStockPurchases = nonStockBuys.reduce((s, r) => s + num(r.amount), 0);
  const purchasesTotal    = stockPurchases + nonStockPurchases;

  const expensesLogged = expenses.reduce((s, r) => s + num(r.amount), 0);
  // Rule 1: a non-stock purchase is a running cost, not stock on the shelf.
  const otherExpenses  = expensesLogged + nonStockPurchases;

  const isCash = r => (r.method || "Cash") === "Cash";
  const cashPurchases = purchases.filter(isCash).reduce((s, r) => s + num(r.amount), 0);
  const cashExpenses  = expenses.filter(isCash).reduce((s, r) => s + num(r.amount), 0);

  const ownerIn  = owner.filter(r => r.dir === "in").reduce((s, r) => s + num(r.amount), 0);
  const ownerOut = owner.filter(r => r.dir === "out").reduce((s, r) => s + num(r.amount), 0);

  return {
    cashSales, cardSales, mobileSales, refunds, revenue,
    stockPurchases, nonStockPurchases, purchasesTotal,
    expensesLogged, otherExpenses,
    cashPurchases, cashExpenses, ownerIn, ownerOut,
    daysEntered: sales.length,
  };
}

/** The last drawer count in a month, or null if it was never counted. */
export function lastCount(data, month) {
  const counts = inMonth(normalise(data).counts, month)
    .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return counts.length ? num(counts[counts.length - 1].counted) : null;
}

// Opening cash and opening stock are never typed twice: they are last month's
// closing figures. Resolved by walking forward from the first month with data,
// so a gap month (shop closed) carries the balance through rather than zeroing.
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
    // Closing stock: what the manager counted. If a month was never counted,
    // nothing is invented — the stock is carried through unchanged.
    const closeStock = set.closeStock === undefined || set.closeStock === ""
      ? stock + t.stockPurchases
      : num(set.closeStock);
    const counted = lastCount(d, m);
    const expected = cash + t.cashSales - t.refunds - t.cashPurchases - t.cashExpenses + t.ownerIn - t.ownerOut;
    // A real count beats the calculation — the drawer is the truth.
    cash = counted === null ? expected : counted;
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

export function nextMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  if (!y || !mo) return "";
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
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
  // Until the manager counts, "nothing was consumed" is the only honest
  // assumption — inventing a figure would invent a profit.
  const closeStock = closeStockSet ? num(set.closeStock) : openStock + t.stockPurchases;

  const cogs  = openStock + t.stockPurchases - closeStock;
  const gross = t.revenue - cogs;
  const net   = gross - t.otherExpenses;

  const expectedCash = openCash + t.cashSales - t.refunds - t.cashPurchases - t.cashExpenses + t.ownerIn - t.ownerOut;
  const countedCash  = lastCount(d, month);

  return {
    month, ...t,
    openStock, closeStock, closeStockSet, openStockAuto,
    cogs, gross, net,
    openCash, openCashAuto, expectedCash, countedCash,
    cashDiff: countedCash === null ? null : countedCash - expectedCash,
  };
}

/**
 * Expected cash in the drawer at the end of one day — opening cash for the
 * month plus everything logged up to and including that date.
 */
export function expectedCashOn(data, date) {
  const d = normalise(data);
  const month = monthOf(date);
  const { openCash } = openings(d, month);
  const upTo = rows => inMonth(rows, month).filter(r => String(r.date) <= String(date));
  const sales = upTo(d.sales), purch = upTo(d.purchases), exp = upTo(d.expenses), own = upTo(d.ownerMoves);
  const isCash = r => (r.method || "Cash") === "Cash";
  return openCash
    + sales.reduce((s, r) => s + num(r.cash) - num(r.refunds), 0)
    - purch.filter(isCash).reduce((s, r) => s + num(r.amount), 0)
    - exp.filter(isCash).reduce((s, r) => s + num(r.amount), 0)
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
