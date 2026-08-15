// ─────────────────────────────────────────────────────────────────────────────
// Guest CRM — who your guests are, and who to speak to today.
//
// Shaped around what the hotel's own numbers actually say. At the time this was
// written: 44 guests, 47 bookings, 42 of them one-time. A repeat rate of 5%
// against an independent-hotel norm of 20–30%, and the top 9 guests bringing in
// 47% of all revenue.
//
// A CRM for a hotel in that position has ONE job: turn a first stay into a
// second one. So the screen leads with a short ranked list of who to contact and
// why, and everything else supports that. A wall of identical guest cards
// answers no question and does not scale past a few dozen guests.
//
// Two faults in the old segmenting that this replaces:
//   · it counted only CHECKED-OUT stays, so a guest with a confirmed booking and
//     money owing was labelled "Inactive" — the one person you must not ignore;
//   · with 42 of 44 guests on a single stay, nearly everyone came out as "New",
//     so the badges and filters carried no information at all.
//
// Reads bookings; never writes to them. No money figure here feeds an invoice.
// ─────────────────────────────────────────────────────────────────────────────

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const digits = s => String(s || "").replace(/\D/g, "");

// Explicit locale. A bare toLocaleString() follows whatever the device is set
// to, so a manager on a German-locale phone would have sent a guest a message
// reading "4.400" instead of "4,400". These strings go to customers.
const taka = n => "৳" + Math.round(num(n)).toLocaleString("en-US");

export const dayDiff = (from, to) =>
  Math.round((new Date(to + "T00:00:00") - new Date(from + "T00:00:00")) / 86400000);

/** Money still owed on one booking. */
export function bookingDue(b) {
  const paid = num(b.advance) + num(b.restPayment) + num(b.extrasAdvance);
  return Math.max(0, (b.invoiceTotal ?? b.amount ?? 0) - paid);
}

/**
 * Build the guest book from bookings. One entry per phone number, because that
 * is the only identifier a small hotel reliably captures.
 */
export function buildGuests(bookings = [], guestProfiles = {}) {
  const map = {};
  const add = (key, seed) => (map[key] ||= { ...seed, stays: [], totalSpent: 0, totalNights: 0, due: 0 });

  (bookings || []).filter(b => b && b.status !== "cancelled" && b.phone).forEach(b => {
    const key = digits(b.phone);
    if (!key) return;
    const g = add(key, {
      key, phone: b.phone, name: b.guest, nationality: b.nationality || "",
      idType: b.idType || "", idNum: b.idNum || "",
      savedProfile: (guestProfiles || {})[key] || {},
    });
    g.stays.push({
      id: b.id, checkin: b.checkin, checkout: b.checkout, room: b.room,
      amount: b.invoiceTotal ?? b.amount, nights: b.nights || 0,
      status: b.status, source: b.source || "",
    });
    g.totalSpent  += (b.invoiceTotal ?? b.amount) || 0;
    g.totalNights += b.nights || 0;
    g.due         += b.status === "checked-out" ? 0 : bookingDue(b);
    g.name = b.guest;

    // Companions travel on someone else's bill: the stay is theirs, the money
    // stays with the payer, so they never inflate lifetime value.
    const companions = [
      ...(b.spouseName && b.spousePhone ? [{ name: b.spouseName, phone: b.spousePhone }] : []),
      ...((b.groupMembers || []).map(m => (typeof m === "string" ? { name: m, phone: "" } : m))),
    ].filter(m => m && m.name && m.phone);
    companions.forEach(m => {
      const mk = digits(m.phone);
      if (!mk || mk === key) return;
      const c = add(mk, { key: mk, phone: m.phone, name: m.name, nationality: "", idType: "", idNum: "",
        savedProfile: (guestProfiles || {})[mk] || {} });
      c.stays.push({ id: b.id, checkin: b.checkin, checkout: b.checkout, room: b.room,
        amount: 0, nights: b.nights || 0, status: b.status, source: "Companion of " + b.guest });
      c.totalNights += b.nights || 0;
      c.name = m.name;
    });
  });
  return map;
}

// ── Where a guest is in their life with the hotel ────────────────────────────
export const STAGES = {
  champion:  { label: "★ Champion", short: "Champion",  color: "#7a5c00", bg: "#F5E6C0" },
  returning: { label: "Returning",       short: "Returning", color: "#1e40af", bg: "#e8f1fd" },
  upcoming:  { label: "Upcoming",        short: "Upcoming",  color: "#6b2fa0", bg: "#f6ecfb" },
  fresh:     { label: "First stay",      short: "Fresh",     color: "#166534", bg: "#F0FDF4" },
  cooling:   { label: "Cooling",         short: "Cooling",   color: "#92400e", bg: "#FFFBEB" },
  lapsed:    { label: "Lapsed",          short: "Lapsed",    color: "#64748b", bg: "#f1f0f7" },
};
export const STAGE_ORDER = ["champion", "returning", "upcoming", "fresh", "cooling", "lapsed"];

/** Facts about a guest that both the stage and the action list are built from. */
export function guestFacts(g, today) {
  const stays = g.stays || [];
  const done  = stays.filter(s => s.status === "checked-out");
  const inHouse = stays.some(s => s.status === "checked-in");
  const future  = stays.filter(s => s.status !== "checked-out" && s.checkin && s.checkin > today);
  const lastOut = done.map(s => s.checkout || s.checkin).filter(Boolean).sort().pop() || "";
  const nextIn  = future.map(s => s.checkin).sort()[0] || "";
  // A stay counts once the guest is actually in the building. Counting only
  // checked-OUT stays is the same narrowness that used to file an arriving
  // guest under "Inactive": it showed a three-time guest worth 10,800, still
  // in-house, as a first-timer.
  const staysHad = done.length + stays.filter(s => s.status === "checked-in").length;
  return {
    completed: staysHad,
    checkedOut: done.length,
    inHouse,
    arriving: nextIn ? dayDiff(today, nextIn) : null,
    nextIn,
    lastOut,
    daysSince: lastOut ? dayDiff(lastOut, today) : null,
    due: g.due || 0,
    value: g.totalSpent || 0,
  };
}

/**
 * The stage. A guest who has booked but not yet arrived is UPCOMING — the old
 * rule dropped them into "Inactive" because it only looked at checked-out stays.
 */
export function guestStage(g, today, vipValue = 20000) {
  const f = guestFacts(g, today);
  if (f.completed >= 3 || f.value >= vipValue) return "champion";
  if (f.completed === 2) return "returning";
  if (f.completed === 0) return (f.inHouse || f.arriving !== null) ? "upcoming" : "lapsed";
  if (f.daysSince === null) return "fresh";
  if (f.daysSince <= 30) return "fresh";
  if (f.daysSince <= 90) return "cooling";
  return "lapsed";
}

/** Headline numbers. Repeat rate is the one that decides a small hotel. */
export function crmMetrics(guests = [], today = "") {
  const list = (guests || []).filter(Boolean);
  const withStay = list.filter(g => guestFacts(g, today).completed > 0);
  const repeat = list.filter(g => guestFacts(g, today).completed > 1);
  const revenue = list.reduce((s, g) => s + (g.totalSpent || 0), 0);
  const bySpend = [...list].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  const topN = Math.max(1, Math.round(list.length * 0.2));
  const topRevenue = bySpend.slice(0, topN).reduce((s, g) => s + (g.totalSpent || 0), 0);
  return {
    guests: list.length,
    guestsWithStay: withStay.length,
    repeat: repeat.length,
    repeatRate: withStay.length ? Math.round(repeat.length / withStay.length * 100) : 0,
    revenue,
    avgValue: list.length ? Math.round(revenue / list.length) : 0,
    topN,
    topShare: revenue ? Math.round(topRevenue / revenue * 100) : 0,
    owed: list.reduce((s, g) => s + (g.due || 0), 0),
  };
}

/** How many guests sit in each stage, and what they are worth. */
export function stageBreakdown(guests = [], today = "") {
  const out = {};
  STAGE_ORDER.forEach(k => (out[k] = { key: k, count: 0, value: 0, ...STAGES[k] }));
  (guests || []).forEach(g => {
    const s = guestStage(g, today);
    out[s].count += 1;
    out[s].value += g.totalSpent || 0;
  });
  return STAGE_ORDER.map(k => out[k]);
}

// ── Today's actions ──────────────────────────────────────────────────────────
// Ordered by what a contact is worth, not by when it happened to come up:
// money owed, then the review at the one moment a guest will write one, then
// the biggest guests who have gone quiet.

const SIGN = "— Hotel The Grand Alayna";

function msgFor(kind, g, f) {
  const first = (g.name || "").split(" ").slice(0, 2).join(" ");
  switch (kind) {
    case "arrival-due":
      return `Assalamu Alaikum ${first}, we look forward to welcoming you on ${f.nextIn}. Your balance of ${taka(f.due)} can be settled on arrival. ${SIGN}`;
    case "arrival":
      return `Assalamu Alaikum ${first}, your room is confirmed for ${f.nextIn}. Please tell us your arrival time and we will have everything ready. ${SIGN}`;
    case "review":
      return `Thank you for staying with us, ${first}. If you have a moment, a short Google review would mean a great deal to us. ${SIGN}`;
    case "balance":
      return `Assalamu Alaikum ${first}, a gentle reminder that ${taka(f.due)} is outstanding on your stay. Thank you. ${SIGN}`;
    case "champion-quiet":
      return `Assalamu Alaikum ${first}, it has been a while since your last stay and we would be glad to welcome you back. Tell us your dates and we will keep your usual room. ${SIGN}`;
    case "invite-back":
      return `Assalamu Alaikum ${first}, we hope you enjoyed your stay. Book direct next time and we will hold your room until 8pm. ${SIGN}`;
    case "last-nudge":
      return `Assalamu Alaikum ${first}, we have not seen you in a while and we would love to have you back. ${SIGN}`;
    case "birthday":
      return `Assalamu Alaikum ${first}, wishing you a very happy birthday from all of us. ${SIGN}`;
    default:
      return `Assalamu Alaikum ${first}. ${SIGN}`;
  }
}

/** Was this guest contacted for this reason recently enough to leave alone? */
function recentlyContacted(g, kind, today, withinDays = 14) {
  const log = (g.savedProfile && g.savedProfile.contactLog) || [];
  return log.some(e => e && e.kind === kind && e.date && dayDiff(e.date, today) < withinDays);
}

function birthdaySoon(g, today, withinDays = 7) {
  const bd = g.savedProfile && g.savedProfile.birthday;
  if (!bd) return false;
  const [, mm, dd] = String(bd).split("-");
  if (!mm || !dd) return false;
  const y = Number(today.slice(0, 4));
  for (const yr of [y, y + 1]) {
    const d = dayDiff(today, `${yr}-${mm}-${dd}`);
    if (d >= 0 && d <= withinDays) return true;
  }
  return false;
}

/**
 * The queue. Every entry says who, why, and what to send.
 * `limit` caps what is shown; the rest come back as `remaining` so they can be
 * messaged as one group instead of one at a time.
 */
export function actionQueue(guests = [], today = "", limit = 6) {
  const out = [];
  const push = (g, kind, priority, reason) => {
    if (recentlyContacted(g, kind, today)) return;
    // Money is chased whatever the marketing preference; only marketing obeys it.
    const isMoney = kind === "arrival-due" || kind === "balance" || kind === "arrival";
    if (!isMoney && g.savedProfile?.marketingOk === false) return;
    const f = guestFacts(g, today);
    out.push({ key: g.key + "|" + kind, guest: g, kind, priority, reason,
      message: msgFor(kind, g, f), stage: guestStage(g, today), facts: f });
  };

  (guests || []).forEach(g => {
    const f = guestFacts(g, today);
    const arriving = f.arriving;
    const stage = guestStage(g, today);

    // 1 — arriving with money owing. Nothing is worth more than this.
    if (arriving !== null && arriving >= 0 && arriving <= 7 && f.due > 0)
      push(g, "arrival-due", 1, `Arrives in ${arriving} day${arriving === 1 ? "" : "s"} · ${taka(f.due)} outstanding`);
    else if (arriving !== null && arriving >= 0 && arriving <= 3)
      push(g, "arrival", 3, arriving === 0 ? "Arrives today" : `Arrives in ${arriving} day${arriving === 1 ? "" : "s"}`);

    // 2 — the review, asked the day they leave. The only moment most guests
    // will actually write one.
    if (f.daysSince !== null && f.daysSince <= 1 && f.completed > 0)
      push(g, "review", 2, f.daysSince === 0 ? "Checked out today · best moment to ask" : "Checked out yesterday");

    // 3 — money owed on a stay already finished.
    if (f.due > 0 && arriving === null && !f.inHouse && f.completed > 0)
      push(g, "balance", 2, `${taka(f.due)} still outstanding`);

    // 4 — a champion gone quiet is the most expensive guest to lose.
    if (stage === "champion" && f.daysSince !== null && f.daysSince >= 30)
      push(g, "champion-quiet", 4, `Your best kind of guest · quiet ${f.daysSince} days`);

    // 5 — first-timers, in the window where a nudge still works.
    if (stage === "fresh" && f.daysSince !== null && f.daysSince >= 5)
      push(g, "invite-back", 5, `First stay ${f.daysSince} days ago · ${taka(f.value)} · never invited back`);
    if (stage === "cooling")
      push(g, "last-nudge", 6, `${f.daysSince} days quiet · last cheap chance before they lapse`);

    if (birthdaySoon(g, today)) push(g, "birthday", 4, "Birthday this week");
  });

  // Priority first, then the bigger guest, so a 10,000 guest is contacted
  // before a 1,500 one at the same priority.
  out.sort((a, b) => a.priority - b.priority || b.facts.value - a.facts.value);
  const seen = new Set();
  const unique = out.filter(a => (seen.has(a.guest.key) ? false : seen.add(a.guest.key)));
  return { actions: unique.slice(0, limit), remaining: unique.slice(limit) };
}

/** Record that a guest was contacted, so nobody messages them twice. */
export function logContact(profile = {}, kind, today, by = "") {
  const log = Array.isArray(profile.contactLog) ? profile.contactLog : [];
  return { ...profile, contactLog: [...log, { kind, date: today, by }].slice(-40) };
}

/** Where bookings come from. Empty is reported as empty, never invented. */
export function sourceBreakdown(bookings = []) {
  const live = (bookings || []).filter(b => b && b.status !== "cancelled");
  const out = new Map();
  live.forEach(b => {
    const key = (b.source || "").trim();
    if (!key) return;
    const cur = out.get(key) || { source: key, count: 0, value: 0 };
    cur.count += 1;
    cur.value += (b.invoiceTotal ?? b.amount) || 0;
    out.set(key, cur);
  });
  const rows = [...out.values()].sort((a, b) => b.value - a.value);
  return { rows, recorded: rows.reduce((s, r) => s + r.count, 0), total: live.length };
}
