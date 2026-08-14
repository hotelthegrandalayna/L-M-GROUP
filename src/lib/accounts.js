// ─────────────────────────────────────────────────────────────────────────────
// Accounts reporting — pure functions, no React, so every figure is testable.
// All money attribution follows the same rule as the rest of the app:
// MONEY FOLLOWS THE NIGHT STAYED (see CLAUDE.md §1 and lib/hotelMoney.js).
// ─────────────────────────────────────────────────────────────────────────────
import { bookingMonthlyParts, bookingPaid, bookingTotal, forfeitedAllocation } from "./hotelMoney";

const isLive = b => b && b.status !== "cancelled";

export function localDay(iso, k = 0) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Every room a booking covers, with that room's own window and money
export function roomLegs(b) {
  if (!b) return [];
  const nights = Math.max(1, b.nights || 1);
  if (b.isMultiRoomBooking && (b.multiRooms || []).length) {
    return b.multiRooms.map(r => ({
      number: String(r.number),
      checkin: r.checkin || b.checkin,
      checkout: r.checkout || b.checkout,
      acChoice: r.acChoice || "",
      amount: r.amount ?? r.net ?? Math.max(0, (r.grossAmt ?? (r.rate || 0) * nights) - (r.discAmt || 0)),
      discount: r.discAmt || 0,
    }));
  }
  const extras = b.extraRooms || [];
  const extrasDisc = extras.reduce((s, r) => s + (r.discAmt || 0), 0);
  const extrasAmt = extras.reduce((s, r) => s + (r.amount ?? 0), 0);
  const primaryDisc = Math.max(0, (b.discAmt || 0) - extrasDisc);
  const primaryAmt = Math.max(0, bookingTotal(b) - extrasAmt);
  return [
    { number: String(b.room), checkin: b.checkin, checkout: b.checkout, acChoice: b.acChoice || "", amount: primaryAmt, discount: primaryDisc },
    ...extras.map(r => ({
      number: String(r.number), checkin: b.checkin, checkout: b.checkout, acChoice: r.acChoice || "",
      amount: r.amount ?? 0, discount: r.discAmt || 0,
    })),
  ];
}

// Nights of a leg that fall inside `month` ("YYYY-MM"); month blank = all nights
export function legNightsInMonth(leg, month) {
  if (!leg?.checkin) return 0;
  const total = Math.max(0, Math.round((new Date(leg.checkout + "T00:00:00") - new Date(leg.checkin + "T00:00:00")) / 86400000));
  if (!month) return total || 1;
  let n = 0;
  for (let i = 0; i < total; i++) if (localDay(leg.checkin, i).slice(0, 7) === month) n++;
  return n;
}

// ── Per-room performance ─────────────────────────────────────────────────────
export function roomStats(bookings = [], rooms = [], month = "") {
  const map = new Map();
  (rooms || []).forEach(r => map.set(String(r.number), {
    number: String(r.number), name: r.name || "", bookings: 0, nights: 0, revenue: 0, discount: 0,
  }));
  bookings.filter(isLive).forEach(b => {
    roomLegs(b).forEach(leg => {
      const nightsHere = legNightsInMonth(leg, month);
      if (nightsHere <= 0) return;
      const legTotal = Math.max(1, legNightsInMonth(leg, ""));
      const row = map.get(leg.number) || { number: leg.number, name: "", bookings: 0, nights: 0, revenue: 0, discount: 0 };
      row.bookings += 1;
      row.nights += nightsHere;
      row.revenue += (leg.amount || 0) * nightsHere / legTotal;
      row.discount += (leg.discount || 0) * nightsHere / legTotal;
      map.set(leg.number, row);
    });
  });
  return [...map.values()]
    .map(r => ({ ...r, avgRate: r.nights ? Math.round(r.revenue / r.nights) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ── AC vs Non-AC ─────────────────────────────────────────────────────────────
export function acStats(bookings = [], month = "") {
  const out = { AC: { bookings: 0, nights: 0, revenue: 0 }, "Non-AC": { bookings: 0, nights: 0, revenue: 0 }, "Not set": { bookings: 0, nights: 0, revenue: 0 } };
  bookings.filter(isLive).forEach(b => {
    roomLegs(b).forEach(leg => {
      const nightsHere = legNightsInMonth(leg, month);
      if (nightsHere <= 0) return;
      const key = leg.acChoice === "AC" ? "AC" : leg.acChoice === "Non-AC" ? "Non-AC" : "Not set";
      const legTotal = Math.max(1, legNightsInMonth(leg, ""));
      out[key].bookings += 1;
      out[key].nights += nightsHere;
      out[key].revenue += (leg.amount || 0) * nightsHere / legTotal;
    });
  });
  Object.values(out).forEach(v => { v.avgRate = v.nights ? Math.round(v.revenue / v.nights) : 0; });
  return out;
}

// ── Nights sold + occupancy ──────────────────────────────────────────────────
export function nightsSold(bookings = [], month = "") {
  let n = 0;
  bookings.filter(isLive).forEach(b => roomLegs(b).forEach(leg => { n += legNightsInMonth(leg, month); }));
  return n;
}
export function daysInMonth(month) {
  if (!month) return 0;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
export function occupancy(bookings, roomCount, month) {
  const avail = roomCount * daysInMonth(month);
  if (!avail) return { sold: nightsSold(bookings, month), available: 0, pct: 0 };
  const sold = nightsSold(bookings, month);
  return { sold, available: avail, pct: Math.round(sold / avail * 100) };
}

// ── Discounts ────────────────────────────────────────────────────────────────
export function discountStats(bookings = [], month = "") {
  let total = 0, count = 0, biggest = null;
  bookings.filter(isLive).forEach(b => {
    const inMonth = !month || bookingMonthlyParts(b).some(p => p.month === month);
    if (!inMonth) return;
    const d = parseFloat(b.discAmt) || 0;
    if (d <= 0) return;
    total += d; count += 1;
    if (!biggest || d > biggest.amount) biggest = { amount: d, room: String(b.room), guest: b.guest || "" };
  });
  const billed = bookings.filter(isLive)
    .filter(b => !month || bookingMonthlyParts(b).some(p => p.month === month))
    .reduce((s, b) => s + bookingTotal(b), 0);
  const gross = billed + total;
  return { total, count, biggest, gross, billed, pctOfGross: gross ? Math.round(total / gross * 100) : 0,
    avg: count ? Math.round(total / count) : 0 };
}

// ── Payment methods + cash reconciliation ────────────────────────────────────
export function paymentStats(bookings = [], month = "", expenses = []) {
  const byMethod = {};
  bookings.filter(isLive).forEach(b => {
    const hist = b.paymentHistory || [];
    if (hist.length) {
      hist.forEach(p => {
        const d = p.ts ? String(p.ts).slice(0, 10) : b.checkin;
        if (month && String(d).slice(0, 7) !== month) return;
        const m = p.method || b.paymentMethod || "Cash";
        byMethod[m] = (byMethod[m] || 0) + (parseFloat(p.amount) || 0);
      });
    } else {
      if (month && String(b.checkin).slice(0, 7) !== month) return;
      const m = b.paymentMethod || "Cash";
      byMethod[m] = (byMethod[m] || 0) + bookingPaid(b);
    }
  });
  // A cancelled booking that kept its deposit really did take that money in, so
  // it belongs here too — otherwise "received" would no longer tie to revenue.
  // Only the kept part counts; anything refunded never reaches this screen.
  bookings.filter(b => b && b.status === "cancelled").forEach(b => {
    forfeitedAllocation(b).forEach(a => {
      if (month && a.month !== month) return;
      byMethod[a.method] = (byMethod[a.method] || 0) + a.amount;
    });
  });
  const rows = Object.entries(byMethod).map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);
  // totalIn = EVERY method. cashIn = the notes-and-coins part only. Keep these
  // distinct — labelling cash as "collected" made the screen contradict itself.
  const totalIn = rows.reduce((s, r) => s + r.amount, 0);
  const cashIn = byMethod["Cash"] || 0;
  const cashOut = (expenses || [])
    .filter(e => (!month || String(e.date || "").slice(0, 7) === month) && (!e.method || e.method === "Cash"))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  return { rows, totalIn, cashIn, cashOut, cashExpected: cashIn - cashOut };
}

// ── Booking pattern ──────────────────────────────────────────────────────────
export function patternStats(bookings = [], month = "") {
  const live = bookings.filter(isLive).filter(b => !month || bookingMonthlyParts(b).some(p => p.month === month));
  const stays = live.map(b => Math.max(1, b.nights || 1));
  const avgStay = stays.length ? stays.reduce((s, n) => s + n, 0) / stays.length : 0;
  const multiRoom = live.filter(b => (b.extraRooms || []).length || (b.multiRooms || []).length > 1).length;
  const extensionRevenue = live.reduce((s, b) => s + (b.extensions || []).reduce((t, e) => t + (parseFloat(e.amount) || 0), 0), 0);
  const byWeekday = {};
  live.forEach(b => {
    if (!b.checkin) return;
    const wd = new Date(b.checkin + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
    byWeekday[wd] = (byWeekday[wd] || 0) + 1;
  });
  const busiest = Object.entries(byWeekday).sort((a, b) => b[1] - a[1])[0];
  return {
    bookings: live.length,
    avgStay: Math.round(avgStay * 100) / 100,
    multiRoom,
    extensionRevenue,
    busiestWeekday: busiest ? busiest[0] : "—",
  };
}

// ── Where the booking came from ──────────────────────────────────────────────
// Two views of the same question: which channel brings the guests (source, as
// filled in on the invoice) and which person sends them (referred by).
// Revenue uses the same night-split as everywhere else, so a stay that spans
// two months only counts the part that belongs to the month you are looking at.

export const BOOKING_SOURCES = ["Walk-in", "Phone", "Website", "WhatsApp", "OTA", "Referral"];

// Revenue and nights of one booking that fall inside `month` ("" = all time).
function bookingSlice(b, month) {
  let revenue = 0, nights = 0;
  roomLegs(b).forEach(leg => {
    const here = legNightsInMonth(leg, month);
    if (here <= 0) return;
    const total = Math.max(1, legNightsInMonth(leg, ""));
    revenue += (leg.amount || 0) * here / total;
    nights += here;
  });
  return { revenue, nights };
}

export function sourceStats(bookings = [], month = "") {
  const map = new Map();
  BOOKING_SOURCES.forEach(s => map.set(s, { source: s, bookings: 0, nights: 0, revenue: 0 }));
  bookings.filter(isLive).forEach(b => {
    const { revenue, nights } = bookingSlice(b, month);
    if (nights <= 0) return;
    const key = (b.source || "").trim() || "Not set";
    const row = map.get(key) || { source: key, bookings: 0, nights: 0, revenue: 0 };
    row.bookings += 1; row.nights += nights; row.revenue += revenue;
    map.set(key, row);
  });
  const rows = [...map.values()]
    .map(r => ({ ...r, avgPerBooking: r.bookings ? Math.round(r.revenue / r.bookings) : 0 }))
    .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);
  const totalRevenue  = rows.reduce((s, r) => s + r.revenue, 0);
  const used = rows.filter(r => r.bookings > 0);
  // Highest value per booking, which is often a different channel from the busiest.
  const richest = used.slice().sort((a, b) => b.avgPerBooking - a.avgPerBooking)[0] || null;
  return {
    rows: rows.map(r => ({ ...r, pct: totalBookings ? Math.round(r.bookings / totalBookings * 100) : 0 })),
    totalBookings, totalRevenue,
    top: used[0] || null,
    second: used[1] || null,
    richest,
  };
}

// "MD IQBAL", "Md Iqbal" and "md  iqbal" are one person. Different spellings
// (Iqbal vs Ikbal) stay separate — merging those would risk joining two guests.
export function referrerKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function referrerStats(bookings = [], month = "") {
  const map = new Map();
  bookings.filter(isLive).forEach(b => {
    const raw = b.referredByName || b.referredBy || "";
    const key = referrerKey(raw);
    if (!key) return;
    const { revenue, nights } = bookingSlice(b, month);
    if (nights <= 0) return;
    const row = map.get(key) || { key, name: String(raw).trim(), count: 0, revenue: 0, spellings: new Set() };
    row.count += 1; row.revenue += revenue;
    row.spellings.add(String(raw).trim());
    // Keep the tidiest spelling: not all-caps, longest wins the tie.
    const cur = String(raw).trim();
    const better = (a, bb) => (a === a.toUpperCase()) !== (bb === bb.toUpperCase())
      ? (bb === bb.toUpperCase() ? a : bb) : (a.length >= bb.length ? a : bb);
    row.name = better(row.name, cur);
    map.set(key, row);
  });
  const rows = [...map.values()]
    .map(r => ({ key: r.key, name: r.name, count: r.count, revenue: r.revenue, spellings: r.spellings.size }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  return {
    rows,
    people: rows.length,
    bookings: rows.reduce((s, r) => s + r.count, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
  };
}

// ── Revenue series (daily / weekly / monthly) ────────────────────────────────
// Uses the shared night-split so every bucket agrees with the rest of the app.
export function revenueByDay(bookings = [], revenues = [], month = "") {
  const out = new Map();
  bookings.filter(isLive).forEach(b => {
    roomLegs(b).forEach(leg => {
      const total = Math.max(1, legNightsInMonth(leg, ""));
      const perNight = (leg.amount || 0) / total;
      for (let i = 0; i < total; i++) {
        const day = localDay(leg.checkin, i);
        if (month && day.slice(0, 7) !== month) continue;
        out.set(day, (out.get(day) || 0) + perNight);
      }
    });
  });
  (revenues || []).filter(r => r && !r.bookingId && !r.fromBooking).forEach(r => {
    const day = String(r.date || "").slice(0, 10);
    if (!day || (month && day.slice(0, 7) !== month)) return;
    out.set(day, (out.get(day) || 0) + (parseFloat(r.amount) || 0));
  });
  return [...out.entries()].map(([day, amount]) => ({ day, amount })).sort((a, b) => a.day.localeCompare(b.day));
}

export function revenueByMonth(bookings = [], revenues = []) {
  const out = new Map();
  bookings.filter(isLive).forEach(b => {
    bookingMonthlyParts(b).forEach(p => {
      if (!p.month) return;
      out.set(p.month, (out.get(p.month) || 0) + p.collected);
    });
  });
  (revenues || []).filter(r => r && !r.bookingId && !r.fromBooking).forEach(r => {
    const m = String(r.date || "").slice(0, 7);
    if (!m) return;
    out.set(m, (out.get(m) || 0) + (parseFloat(r.amount) || 0));
  });
  return [...out.entries()].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
}

export function revenueByWeek(bookings = [], revenues = [], month = "") {
  const days = revenueByDay(bookings, revenues, month);
  const out = new Map();
  days.forEach(({ day, amount }) => {
    const d = new Date(day + "T00:00:00");
    const week = Math.ceil(d.getDate() / 7);
    const key = `Week ${week}`;
    out.set(key, (out.get(key) || 0) + amount);
  });
  return [...out.entries()].map(([label, amount]) => ({ label, amount }));
}

// ── Which weekday earns most ─────────────────────────────────────────────────
// Answers "should I prepare for Fridays?". Uses the AVERAGE per weekday, so a
// month with five Fridays doesn't beat one with four just by counting days.
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayStats(bookings = [], revenues = [], months = []) {
  const byWd = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
  const perMonth = [];

  months.forEach(m => {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    const map = new Map(revenueByDay(bookings, revenues, m).map(d => [d.day, d.amount]));
    const [y, mm] = m.split("-").map(Number);
    const dim = new Date(y, mm, 0).getDate();
    const wdTotals = Array.from({ length: 7 }, () => 0);
    for (let i = 1; i <= dim; i++) {
      const iso = `${m}-${String(i).padStart(2, "0")}`;
      const wd = new Date(iso + "T00:00:00").getDay();
      const amt = map.get(iso) || 0;
      byWd[wd].total += amt; byWd[wd].days += 1;
      wdTotals[wd] += amt;
    }
    const hasMoney = wdTotals.some(v => v > 0);
    const bestWd = hasMoney ? wdTotals.indexOf(Math.max(...wdTotals)) : null;
    const earning = wdTotals.map((v, i) => ({ v, i })).filter(x => x.v > 0);
    const quietWd = earning.length ? earning.reduce((a, b) => b.v < a.v ? b : a).i : null;
    perMonth.push({
      month: m,
      bestWd, bestAmount: bestWd == null ? 0 : wdTotals[bestWd],
      quietWd, quietAmount: quietWd == null ? 0 : wdTotals[quietWd],
    });
  });

  const rows = byWd.map((x, i) => ({ wd: i, label: WEEKDAYS[i], total: x.total, days: x.days, avg: x.days ? x.total / x.days : 0 }));
  const totalDays = rows.reduce((s, r) => s + r.days, 0);
  const overallAvg = totalDays ? rows.reduce((s, r) => s + r.total, 0) / totalDays : 0;
  const anyMoney = rows.some(r => r.total > 0);
  const best = anyMoney ? rows.reduce((a, b) => b.avg > a.avg ? b : a) : null;
  const earningRows = rows.filter(r => r.avg > 0);
  const worst = earningRows.length ? earningRows.reduce((a, b) => b.avg < a.avg ? b : a) : null;
  const second = best ? rows.filter(r => r.wd !== best.wd).reduce((a, b) => b.avg > a.avg ? b : a, { avg: 0, label: "" }) : null;
  const topCount = best ? perMonth.filter(p => p.bestWd === best.wd).length : 0;
  const ratio = best && worst && worst.avg > 0 ? best.avg / worst.avg : null;

  return { rows, best, worst, second, perMonth, topCount, monthCount: perMonth.length, overallAvg, ratio };
}

export function expensesByMonth(expenses = []) {
  const out = new Map();
  (expenses || []).forEach(e => {
    const m = String(e.date || "").slice(0, 7);
    if (!m) return;
    out.set(m, (out.get(m) || 0) + (parseFloat(e.amount) || 0));
  });
  return [...out.entries()].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
}

// Cost by category across the last N months — for the comparison chart
export function costByCategoryOverMonths(expenses = [], months = []) {
  const cats = new Map();
  (expenses || []).forEach(e => {
    const m = String(e.date || "").slice(0, 7);
    if (!months.includes(m)) return;
    const c = e.category || "Other";
    if (!cats.has(c)) cats.set(c, { cat: c, total: 0, byMonth: {} });
    const row = cats.get(c);
    const amt = parseFloat(e.amount) || 0;
    row.total += amt;
    row.byMonth[m] = (row.byMonth[m] || 0) + amt;
  });
  return [...cats.values()].sort((a, b) => b.total - a.total);
}

// ── Salary ───────────────────────────────────────────────────────────────────
export function salaryStats(expenses = [], month = "") {
  const rows = (expenses || []).filter(e =>
    (e.category === "Salaries") && (!month || String(e.date || "").slice(0, 7) === month));
  const byPerson = new Map();
  rows.forEach(e => {
    const name = (e.empName || "").trim() || "Unnamed";
    if (!byPerson.has(name)) byPerson.set(name, { name, role: e.empRole || "", period: e.payPeriod || "", amount: 0, count: 0 });
    const p = byPerson.get(name);
    p.amount += parseFloat(e.amount) || 0;
    p.count += 1;
    if (!p.role && e.empRole) p.role = e.empRole;
    if (!p.period && e.payPeriod) p.period = e.payPeriod;
  });
  const staff = [...byPerson.values()].sort((a, b) => b.amount - a.amount);
  const total = staff.reduce((s, p) => s + p.amount, 0);
  return { staff, total, count: staff.length };
}
