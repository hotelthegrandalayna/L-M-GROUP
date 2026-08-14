// Accounts — admin-only business view. Money and rooms only.
// Every figure comes from lib/accounts.js and lib/hotelMoney.js, so it always
// agrees with the Desk, Expenses and Invoices screens.
import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { money } from "../utils/helpers";
import { hotelBusinessOnly } from "../utils/expenseType";
import { monthMoney, bookingMonthlyParts } from "../lib/hotelMoney";
import { hasHotelSupabaseConfig, loadHotelBookingsForRange } from "../lib/hotelSupabase";
import AdminRooms from "./Admin/AdminRooms";
import {
  roomStats, acStats, occupancy, discountStats, patternStats,
  revenueByDay, revenueByWeek, revenueByMonth, costByCategoryOverMonths, salaryStats,
  weekdayStats, sourceStats, referrerStats, fullHouseStats, guestRoomNumbers,
} from "../lib/accounts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthLabel = m => m ? `${MONTHS[+m.slice(5,7)-1]} ${m.slice(0,4)}` : "All time";
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SERIES = ["#5f8f86","#c96a63","#d9a441","#7d93b5","#9b8bbf","#89a06f","#c98fa8","#b08968"];

// Rooms that exist in the room list but are not let to guests, so they must not
// be required for a "full house". Edit this if a room changes use.
const NON_GUEST_ROOMS = ["107", "108"];

const FH_KIND = {
  arrived:   { bg:"#D6EEC6", fg:"#356010", label:"in today" },
  staying:   { bg:"#DAD4F8", fg:"#332b7a", label:"" },
  extension: { bg:"#FAE4A6", fg:"#6b4600", label:"extended" },
};

// How many days of a month to draw: all of them, except the month in progress,
// which stops at today. A future day is not a day that earned nothing.
function daysShownIn(month) {
  const [yy, mm] = month.split("-").map(Number);
  const inMonth = new Date(yy, mm, 0).getDate();
  const now = new Date();
  const isCurrent = now.getFullYear() === yy && now.getMonth() + 1 === mm;
  return isCurrent ? Math.min(inMonth, now.getDate()) : inMonth;
}

const card  = { background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"13px 14px" };
const capLbl = { fontSize:10, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" };
const num   = { fontVariantNumeric:"tabular-nums" };

function Tile({ label, value, sub, color, accent }) {
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid "+(accent?"#e3d6a8":"var(--border)"), borderRadius:10, padding:"8px 10px", minWidth:0 }}>
      <div style={{ fontSize:8.5, letterSpacing:.5, textTransform:"uppercase", color:accent?"#a6832c":"var(--text3)", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</div>
      <div style={{ fontSize:14.5, fontWeight:600, color:color||"var(--text)", marginTop:2, ...num, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:"var(--text3)", marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sub}</div>}
    </div>
  );
}

// ── Full house ───────────────────────────────────────────────────────────────
// Closed it is a single row, because Accounts already carries a lot of panels.
// Open it lists the nights; open a night and it names the six rooms and why each
// guest was there. Nothing grows the page until it is asked to.
function FullHousePanel({ stats, month }) {
  const [open, setOpen] = useState(false);
  const [night, setNight] = useState("");
  const nightLabel = iso => new Date(iso + "T00:00:00")
    .toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
  const composition = n => [
    n.arrived   ? `${n.arrived} arrived`     : "",
    n.staying   ? `${n.staying} staying`     : "",
    n.extension ? `${n.extension} extension` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ ...card, padding:0, overflow:"hidden", marginBottom:12 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"9px 12px", flexWrap:"wrap",
          border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
          background: open ? "var(--bg4)" : "transparent" }}>
        <i className={"ti ti-chevron-" + (open ? "down" : "right")} style={{ color:"var(--text3)", fontSize:15 }} />
        <span style={capLbl}>Full house · all {stats.roomCount} rooms</span>
        <span style={{ fontSize:11, color:"var(--text3)" }}>{monthLabel(month)}</span>
        <span style={{ marginLeft:"auto", fontSize:11.5, borderRadius:20, padding:"2px 9px", ...num,
          background: stats.count ? "#DAD4F8" : "var(--bg3)", color: stats.count ? "#332b7a" : "var(--text3)" }}>
          {stats.count} night{stats.count === 1 ? "" : "s"}
        </span>
      </button>

      {open && (stats.count === 0 ? (
        <div style={{ fontSize:12, color:"var(--text3)", padding:"10px 12px", borderTop:"1px solid var(--border)" }}>
          The house was never completely full in this period.
        </div>
      ) : (
        <div style={{ maxHeight:290, overflowY:"auto" }}>
          {stats.nights.map(n => {
            const sel = night === n.date;
            return (
              <div key={n.date}>
                <button type="button" onClick={() => setNight(sel ? "" : n.date)}
                  style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"8px 12px", flexWrap:"wrap",
                    borderTop:"1px solid var(--border)", borderLeft:"none", borderRight:"none", borderBottom:"none",
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                    background: sel ? "var(--bg3)" : "transparent" }}>
                  <span style={{ fontSize:12, fontWeight:600, minWidth:82 }}>{nightLabel(n.date)}</span>
                  <span style={{ fontSize:11, color:"var(--text3)" }}>{composition(n)}</span>
                  <i className={"ti ti-chevron-" + (sel ? "down" : "right")}
                    style={{ marginLeft:"auto", color: sel ? "#7F77DD" : "var(--border2)", fontSize:14 }} />
                </button>
                {sel && (
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", padding:"9px 12px", background:"var(--bg3)" }}>
                    {n.rooms.map(r => {
                      const k = FH_KIND[r.kind] || FH_KIND.staying;
                      const note = r.kind === "staying" ? `night ${r.nightNo}` : k.label;
                      return (
                        <span key={r.number} title={r.guest}
                          style={{ background:k.bg, color:k.fg, borderRadius:6, padding:"4px 8px", fontSize:11,
                            lineHeight:1.35, textAlign:"center", minWidth:52 }}>
                          <span style={{ fontWeight:700, ...num }}>{r.number}</span><br />
                          <span style={{ fontSize:9.5, display:"block", maxWidth:74, overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.guest || "—"}</span>
                          <span style={{ fontSize:9 }}>{note}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const CUR_COLOR = "#5f8f86";  // the period being viewed
const CMP_COLOR = "#c49a4a";  // the period being compared against

// Earnings are discrete — one bar per period, not a smooth curve implying they
// flow into each other. The comparison sits beside each bar in its own colour.
function BarChart({ data, compare, height = 168 }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map(d => d.amount), ...(compare?.bars || [0]));
  const short = v => v >= 1000 ? (Math.round(v / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(v);
  const step = Math.max(1, Math.ceil(data.length / 10));
  const peak = data.reduce((a, b, i) => b.amount > data[a].amount ? i : a, 0);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:2, height,
        borderBottom:"1px solid var(--border)", paddingBottom:1 }}>
        {data.map((d, i) => {
          const h = Math.round(d.amount / max * (height - 20));
          const ch = compare ? Math.round((compare.bars[i] || 0) / max * (height - 20)) : 0;
          return (
            <div key={i} title={`${d.label}${d.sub ? " " + d.sub : ""} · ${money(Math.round(d.amount))}`
              + (compare ? `\n${monthLabel(compare.month)}: ${money(Math.round(compare.bars[i] || 0))}` : "")}
              style={{ flex:1, minWidth:0, position:"relative", display:"flex", flexDirection:"column",
                justifyContent:"flex-end", alignItems:"center", height:"100%" }}>
              {i === peak && d.amount > 0 && (
                <span style={{ position:"absolute", top:0, fontSize:9, color:"#2f7d4f", whiteSpace:"nowrap", ...num }}>
                  {short(d.amount)}
                </span>
              )}
              {/* Two solid bars side by side in two colours, so which is which is
                  obvious without reading a caption. */}
              <span style={{ display:"flex", alignItems:"flex-end", justifyContent:"center",
                gap:1, width:"100%", height:"100%" }}>
                <span style={{ width: compare ? "40%" : "62%", height:Math.max(d.amount > 0 ? 2 : 0, h),
                  background:CUR_COLOR, borderRadius:"3px 3px 0 0" }} />
                {compare && (
                  <span style={{ width:"40%", height:Math.max((compare.bars[i] || 0) > 0 ? 2 : 0, ch),
                    background:CMP_COLOR, borderRadius:"3px 3px 0 0" }} />
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:2, marginTop:3 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, minWidth:0, textAlign:"center", fontSize:8.5, color:"var(--text3)",
            whiteSpace:"nowrap", overflow:"hidden" }}>
            {i === data.length - 1 || i % step === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// Smooth line + soft fill — kept for the weekly and monthly views, where a trend
// across periods is the point.
// Pure SVG, no chart library, so nothing extra to load.
function AreaChart({ data, height = 200 }) {
  if (!data.length) return null;
  // preserveAspectRatio="none" — without it the chart shrinks to fit the height
  // and sits squashed in the middle of a wide screen.
  const W = 900, H = 178, L = 42, R = 12, T = 22, B = 44;
  const max = Math.max(1, ...data.map(d => d.amount));
  const avg = data.reduce((s, d) => s + d.amount, 0) / data.length;
  const x = i => data.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (data.length - 1);
  const y = v => T + (1 - v / max) * (H - T - B);
  const pts = data.map((d, i) => [x(i), y(d.amount)]);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length-1][0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z`;
  const peak = data.reduce((a, b, i) => b.amount > data[a].amount ? i : a, 0);
  const ticks = [0, 0.5, 1].map(f => ({ v: max * f, py: y(max * f) }));
  const step = Math.max(1, Math.ceil(data.length / 8));
  const short = v => v >= 1000 ? (Math.round(v / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height }}
      role="img" aria-label="Revenue over time">
      <defs>
        <linearGradient id="acctRev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5f8f86" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#5f8f86" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} y1={t.py} x2={W - R} y2={t.py} stroke={i === 0 ? "#e4e4e8" : "#f2f2f4"} strokeDasharray={i === 0 ? "" : "3 5"} />
          <text x={L - 6} y={t.py + 3} textAnchor="end" style={{ fontSize:8.5, fill:"#b0b5bf" }}>{short(t.v)}</text>
        </g>
      ))}
      {/* average line */}
      {avg > 0 && (<>
        <line x1={L} y1={y(avg)} x2={W - R} y2={y(avg)} stroke="#d9a441" strokeDasharray="5 4" />
        <text x={W - R} y={y(avg) - 4} textAnchor="end" style={{ fontSize:8, fill:"#a6832c" }}>avg {money(Math.round(avg))}</text>
      </>)}

      <path d={area} fill="url(#acctRev)" />
      <path d={line} fill="none" stroke="#5f8f86" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {/* A point for every day, and the AMOUNT on every day that earned money.
          Labels alternate above/below the line so they don't collide. */}
      {data.map((d, i) => {
        const has = d.amount > 0;
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.amount)} r={i === peak ? 4.5 : has ? 3 : 2}
              fill={i === peak ? "#fff" : has ? "#5f8f86" : "#c9ced6"}
              stroke={i === peak ? "#5f8f86" : "none"} strokeWidth={i === peak ? 2.5 : 0}>
              <title>{`${d.label} — ${money(Math.round(d.amount))}`}</title>
            </circle>
            {has && (
              <text x={x(i)} y={y(d.amount) - (i % 2 === 0 ? 8 : 16)} textAnchor="middle"
                style={{ fontSize: i === peak ? 9 : 7.5, fontWeight: i === peak ? 600 : 500,
                  fill: i === peak ? "#2f7d4f" : "#5a6172" }}>
                {short(d.amount)}
              </text>
            )}
          </g>
        );
      })}

      {/* date, with weekday underneath */}
      {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
        <g key={"x"+i}>
          <text x={x(i)} y={H - 20} textAnchor="middle" style={{ fontSize:8.5, fill:"#5a6172" }}>{d.label}</text>
          {d.sub && <text x={x(i)} y={H - 9} textAnchor="middle" style={{ fontSize:7.5, fill:"#b0b5bf" }}>{d.sub}</text>}
        </g>
      ))}
    </svg>
  );
}

export default function Accounts() {
  const { curRole, bookings, revenues, expenses, expTypes, rooms } = useApp();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [tab, setTab] = useState("overview");
  const [month, setMonth] = useState(thisMonth);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load the full booking history once — reports must never be limited to 30 days
  useEffect(() => {
    if (!hasHotelSupabaseConfig()) return;
    let alive = true;
    setLoading(true);
    loadHotelBookingsForRange("2000-01-01", "2999-12-31")
      .then(rows => { if (alive) setAllRows(Array.isArray(rows) ? rows : []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const src = useMemo(() => {
    const deleted = (() => {
      try {
        const legacy = JSON.parse(localStorage.getItem("ga_deleted_booking_ids") || "[]");
        const v1 = (JSON.parse(localStorage.getItem("ga_deleted_ids_v1") || "{}").bkg) || [];
        return new Set([...legacy, ...v1].map(String));
      } catch { return new Set(); }
    })();
    const alive = b => !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? ""));
    const live = (bookings || []).filter(alive);
    if (!allRows.length) return live;
    // THE CLOUD WINS. Reports are built from the full cloud history; the device's
    // own copy only contributes bookings the cloud has never seen. Letting the
    // local copy win is what made two computers report two different totals —
    // each had its own leftovers from the 30-day sync window.
    const cloud = allRows.filter(alive);
    const have = new Set(cloud.map(b => String(b.supabaseBookingId ?? b.id)));
    const localOnly = live.filter(b => !have.has(String(b.supabaseBookingId ?? b.id)));
    return localOnly.length ? [...cloud, ...localOnly] : cloud;
  }, [bookings, allRows]);

  // Date range narrows the booking set when used
  const scoped = useMemo(() => {
    if (!from && !to) return src;
    return src.filter(b => {
      const ci = b.checkin || "", co = b.checkout || ci;
      if (from && co && co < from) return false;
      if (to && ci && ci > to) return false;
      return true;
    });
  }, [src, from, to]);

  const bizExpenses = useMemo(() => hotelBusinessOnly(expenses, expTypes || {}), [expenses, expTypes]);
  const monthExpenses = useMemo(
    () => bizExpenses.filter(e => (!month || String(e.date||"").slice(0,7) === month)
      && (!from || String(e.date||"") >= from) && (!to || String(e.date||"") <= to)),
    [bizExpenses, month, from, to]);

  const mm = useMemo(() => month
    ? monthMoney({ bookings: scoped, revenues, expenses: bizExpenses, month })
    : (() => {
        const months = new Set();
        scoped.filter(b => b.status !== "cancelled").forEach(b => bookingMonthlyParts(b).forEach(p => p.month && months.add(p.month)));
        let billed=0, collected=0, outstanding=0;
        months.forEach(m => { const x = monthMoney({ bookings: scoped, revenues, expenses: bizExpenses, month: m });
          billed+=x.billed; collected+=x.collected; outstanding+=x.outstanding; });
        return { billed, collected, outstanding };
      })(),
  [scoped, revenues, bizExpenses, month]);

  // NOTE: this screen deliberately uses ONE basis only — money follows the night
  // stayed, exactly like Expenses & Cash, the Desk and Invoices. Payment-date
  // ("received") figures are NOT shown: two bases side by side made the screen
  // look wrong even when both numbers were right.
  // Declared BEFORE the totals below — a const used above its definition throws
  // "Cannot access before initialization" at runtime.
  const allPeriodExpenses = useMemo(
    () => (expenses || []).filter(e => (!month || String(e.date||"").slice(0,7) === month)
      && (!from || String(e.date||"") >= from) && (!to || String(e.date||"") <= to)),
    [expenses, month, from, to]);

  const costTotal   = monthExpenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const netProfit   = mm.collected - costTotal;
  // Same formula as Expenses & Cash, so the two screens always show the same figure
  const allExpTotal = allPeriodExpenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const nonBizTotal = Math.max(0, allExpTotal - costTotal);
  const cashInHand  = mm.collected - costTotal - nonBizTotal;
  const occ         = occupancy(scoped, (rooms||[]).length, month);
  const rStats      = useMemo(() => roomStats(scoped, rooms, month), [scoped, rooms, month]);
  const ac          = useMemo(() => acStats(scoped, month), [scoped, month]);
  const disc        = useMemo(() => discountStats(scoped, month), [scoped, month]);
  const pattern     = useMemo(() => patternStats(scoped, month), [scoped, month]);
  const fullHouse   = useMemo(
    () => fullHouseStats(scoped, guestRoomNumbers(rooms, NON_GUEST_ROOMS), month),
    [scoped, rooms, month]);
  const salary      = useMemo(() => salaryStats(expenses, month), [expenses, month]);
  const byMonth     = useMemo(() => revenueByMonth(scoped, revenues), [scoped, revenues]);
  const expByMonth  = useMemo(() => {
    const out = new Map();
    bizExpenses.forEach(e => { const m = String(e.date||"").slice(0,7); if (m) out.set(m, (out.get(m)||0) + (parseFloat(e.amount)||0)); });
    return out;
  }, [bizExpenses]);
  const lastMonths  = useMemo(() => byMonth.slice(-6).map(x => x.month), [byMonth]);
  const catOverTime = useMemo(() => costByCategoryOverMonths(bizExpenses, lastMonths), [bizExpenses, lastMonths]);
  const allMonths   = useMemo(() => {
    const s = new Set(byMonth.map(x => x.month)); s.add(thisMonth);
    return [...s].sort().reverse();
  }, [byMonth, thisMonth]);

  // Previous-month comparison
  const prevMonth = month ? (() => { const d = new Date(month + "-01T00:00:00"); d.setMonth(d.getMonth()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })() : "";
  const prevRev = prevMonth ? monthMoney({ bookings: scoped, revenues, month: prevMonth }).collected : 0;
  const revDelta = prevRev > 0 ? Math.round((mm.collected - prevRev) / prevRev * 100) : null;

  const [grain, setGrain] = useState("daily");
  const dayRows = useMemo(() => revenueByDay(scoped, revenues, month), [scoped, revenues, month]);

  const series = useMemo(() => {
    if (grain === "monthly") return byMonth.map(x => ({ label: monthLabel(x.month), amount: x.amount }));
    if (grain === "weekly")  return revenueByWeek(scoped, revenues, month).map(x => ({ label: x.label, amount: x.amount }));
    const wd = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });
    // Every day of the month, so a day that earned nothing still shows as zero —
    // BUT the month in progress stops at today. Days that have not happened are
    // not days you earned nothing on, and drawing them made "days with no income"
    // report the rest of the calendar (17, on the 14th of a 31-day month).
    if (month) {
      const days = daysShownIn(month);
      const byDay = new Map(dayRows.map(r => [r.day, r.amount]));
      return Array.from({ length: days }, (_, i) => {
        const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
        return { label: String(i + 1), sub: wd(iso), amount: byDay.get(iso) || 0, iso };
      });
    }
    return dayRows.map(x => ({ label: x.day.slice(8), sub: wd(x.day), amount: x.amount, iso: x.day }));
  }, [grain, dayRows, month, byMonth, scoped, revenues]);

  // The month being compared against. null = not chosen, so fall back to the
  // previous month; "" = the owner explicitly turned the comparison OFF. Reading
  // "" as "unset" meant picking "no comparison" snapped straight back on.
  const [cmpMonth, setCmpMonth] = useState(null);
  const compareMonth = cmpMonth === null ? prevMonth : cmpMonth;
  const cmpDayRows = useMemo(
    () => (grain === "daily" && month && compareMonth) ? revenueByDay(scoped, revenues, compareMonth) : [],
    [grain, month, compareMonth, scoped, revenues]);

  // The 12 months before the selected one, plus any month with data. The old list
  // held only months that had earned something, so the previous month could be
  // missing and the box would show one thing while the chart compared another.
  const compareChoices = useMemo(() => {
    if (!month) return [];
    const out = new Set(allMonths.filter(m => m !== month));
    const [yy, mm] = month.split("-").map(Number);
    for (let k = 1; k <= 12; k++) {
      const d = new Date(yy, mm - 1 - k, 1);
      out.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return [...out].sort().reverse();
  }, [allMonths, month]);

  // Like for like: on the 14th, compare 1–14 against 1–14 of the other month, not
  // against its whole 31 days, or the month in progress always looks like a slump.
  const compare = useMemo(() => {
    if (!cmpDayRows.length && !compareMonth) return null;
    const n = series.length;
    const byDay = new Map(cmpDayRows.map(r => [r.day, r.amount]));
    const bars = Array.from({ length: n }, (_, i) =>
      byDay.get(`${compareMonth}-${String(i + 1).padStart(2, "0")}`) || 0);
    const cmpTotal = bars.reduce((s, v) => s + v, 0);
    const total = series.reduce((s, d) => s + d.amount, 0);
    const pct = cmpTotal > 0 ? Math.round((total - cmpTotal) / cmpTotal * 100) : null;
    return { bars, cmpTotal, pct, month: compareMonth, days: n };
  }, [cmpDayRows, compareMonth, series]);

  // Period summary shown beside the chart title
  const seriesStats = useMemo(() => {
    const withMoney = series.filter(d => d.amount > 0);
    const total = series.reduce((s, d) => s + d.amount, 0);
    const best  = withMoney.length ? withMoney.reduce((a, b) => b.amount > a.amount ? b : a) : null;
    const quiet = withMoney.length ? withMoney.reduce((a, b) => b.amount < a.amount ? b : a) : null;
    return { total, avg: series.length ? total / series.length : 0,
      best, quiet, emptyDays: series.length - withMoney.length, shown: series.length };
  }, [series]);

  const bestDay = useMemo(
    () => dayRows.length ? dayRows.reduce((a, b) => b.amount > a.amount ? b : a) : null,
    [dayRows]);

  // ── Which weekday earns most — own period picker, independent of the page month
  const [wdRange, setWdRange] = useState("3");
  const wdMonths = useMemo(() => {
    const all = byMonth.map(x => x.month).sort();
    if (wdRange === "all") return all;
    if (/^\d{4}-\d{2}$/.test(wdRange)) return [wdRange];
    return all.slice(-parseInt(wdRange, 10));
  }, [byMonth, wdRange]);
  const wd = useMemo(() => weekdayStats(scoped, revenues, wdMonths), [scoped, revenues, wdMonths]);

  // ── Where bookings come from — channel (invoice "source") + who referred them
  const chan = useMemo(() => sourceStats(scoped, month), [scoped, month]);
  const ref = useMemo(() => referrerStats(scoped, month), [scoped, month]);
  const [refAll, setRefAll] = useState(false);
  const refShown = refAll ? ref.rows : ref.rows.slice(0, 5);

  if (curRole !== "admin") {
    return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
        <i className="ti ti-lock" style={{ fontSize:40, display:"block", marginBottom:12 }} />
        <div style={{ fontSize:16, fontWeight:600 }}>Access restricted</div>
        <div style={{ fontSize:13 }}>Accounts are only available to administrators.</div>
      </div>
    );
  }

  const TABS = [["overview","Overview"],["rooms","Rooms"]];

  return (
    <div style={{ padding:"22px 24px", width:"100%", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      {/* Header + period */}
      <div style={{ display:"flex", alignItems:"center", gap:11, flexWrap:"wrap", marginBottom:12 }}>
        <span style={{ width:30, height:30, borderRadius:9, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className="ti ti-report-analytics" style={{ color:"var(--gold2)", fontSize:16 }} />
        </span>
        <div style={{ flex:1, minWidth:120 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>Accounts</div>
          <div style={{ fontSize:11, color:"var(--text3)" }}>
            Business performance — {monthLabel(month)}
            {loading && <span style={{ marginLeft:8 }}><i className="ti ti-loader ti-spin" /> loading history…</span>}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:7, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"5px 9px" }}>
          <i className="ti ti-calendar" style={{ fontSize:14, color:"var(--text3)" }} />
          <select value={month} onChange={e=>setMonth(e.target.value)}
            style={{ border:"none", background:"transparent", fontSize:12.5, fontWeight:600, fontFamily:"inherit", color:"var(--text)", cursor:"pointer", outline:"none" }}>
            <option value="">All time</option>
            {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:"var(--text3)" }}>From
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
            style={{ padding:"6px 8px", border:"1px solid var(--border)", borderRadius:8, fontSize:12, fontFamily:"inherit" }} /></label>
        <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:"var(--text3)" }}>To
          <input type="date" value={to} onChange={e=>setTo(e.target.value)}
            style={{ padding:"6px 8px", border:"1px solid var(--border)", borderRadius:8, fontSize:12, fontFamily:"inherit" }} /></label>
        {(from||to) && <button onClick={()=>{setFrom("");setTo("");}}
          style={{ padding:"6px 11px", border:"1px solid var(--border)", background:"var(--bg2)", borderRadius:8, fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"var(--text2)" }}>Clear dates</button>}
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:4, borderBottom:"1px solid var(--border)", paddingBottom:8, marginBottom:12, flexWrap:"wrap" }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:"5px 13px", borderRadius:7, border:"none", cursor:"pointer", fontFamily:"inherit",
            fontSize:11.5, fontWeight:600,
            background: tab===k ? "var(--navy)" : "transparent",
            color: tab===k ? "#fff" : "var(--text2)" }}>{l}</button>
        ))}
      </div>

      {/* KPI row — always visible */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(104px,1fr))", gap:6, marginBottom:10 }}>
        <Tile label="Revenue" value={money(mm.collected)} color="#2f7d4f"
          sub={revDelta === null ? null : `${revDelta>=0?"▲":"▼"} ${Math.abs(revDelta)}% vs ${monthLabel(prevMonth)}`} />
        <Tile label="Nights sold" value={occ.sold} sub={occ.available ? `of ${occ.available}` : null} />
        <Tile label="Occupancy" value={occ.available ? occ.pct+"%" : "—"} />
        <Tile label="Avg rate" value={occ.sold ? money(Math.round(mm.collected/occ.sold)) : "—"} sub="per night" />
        <Tile label="Costs" value={money(costTotal)} color="#b5322a" />
        <Tile label="Net profit" value={money(netProfit)} color={netProfit>=0?"#2f7d4f":"#b5322a"}
          sub={mm.collected>0 ? Math.round(netProfit/mm.collected*100)+"% margin" : null} />
        <Tile label="Outstanding" value={money(mm.outstanding)} color={mm.outstanding>0?"#b5322a":"var(--text3)"} />
        <Tile label="Cash in hand" value={money(Math.round(cashInHand))} accent
          color={cashInHand>=0?"#a6832c":"#b5322a"} />
      </div>

      {/* ── OVERVIEW ── */}
      {tab==="overview" && (<>
        <FullHousePanel stats={fullHouse} month={month} />

        {/* Revenue trend — was its own tab, now lives here */}
        <div style={{ ...card, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
            {/* "Money received", never "Revenue". This series follows the PAYMENT
                DATE, while revenue follows the night stayed, so the two months
                genuinely differ. Labelling them apart is what stops the screen
                looking like it contradicts itself — see CLAUDE.md §1. */}
            <span style={capLbl}>Money received</span>
            <span style={{ fontSize:11, color:"var(--text3)" }}>
              {monthLabel(month)}{grain === "daily" && month && seriesStats.shown ? ` 1–${seriesStats.shown}` : ""}
              {" · total "}<strong style={{ color:"var(--text)", ...num }}>{money(Math.round(seriesStats.total))}</strong>
              {grain === "daily" && <> · avg <strong style={{ color:"var(--text)", ...num }}>{money(Math.round(seriesStats.avg))}</strong>/day</>}
            </span>
            <span style={{ marginLeft:"auto", display:"inline-flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              {grain === "daily" && month && (
                <select value={compareMonth} onChange={e => setCmpMonth(e.target.value)}
                  style={{ fontFamily:"inherit", fontSize:11, padding:"3px 7px", borderRadius:7,
                    border:"1px solid var(--border)", background:"var(--bg2)", color:"var(--text2)" }}>
                  <option value="">no comparison</option>
                  {/* Every month around, not only the ones that earned — comparing
                      against a quiet month is exactly when you want to. */}
                  {compareChoices.map(m => (
                    <option key={m} value={m}>vs {monthLabel(m)}</option>
                  ))}
                </select>
              )}
              <span style={{ display:"inline-flex", border:"1px solid var(--border)", borderRadius:7, overflow:"hidden" }}>
                {["daily","weekly","monthly"].map(g => (
                  <button key={g} onClick={()=>setGrain(g)} style={{ padding:"4px 11px", border:"none", cursor:"pointer", fontFamily:"inherit",
                    fontSize:11, fontWeight:600, textTransform:"capitalize",
                    background: grain===g ? "var(--navy)" : "transparent", color: grain===g ? "#fff" : "var(--text2)" }}>{g}</button>
                ))}
              </span>
            </span>
          </div>
          {grain === "daily" && month && compare && compare.cmpTotal > 0 && (
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:7, fontSize:11 }}>
              <span style={{ borderRadius:20, padding:"2px 9px", ...num,
                background: compare.pct >= 0 ? "var(--green-bg)" : "#FEF2F2",
                color: compare.pct >= 0 ? "#356010" : "#9B1C1C" }}>
                {compare.pct >= 0 ? "▲" : "▼"} {Math.abs(compare.pct)}% vs the same {compare.days} days of {monthLabel(compare.month)}
              </span>
              <span style={{ color:"var(--text3)" }}>
                {monthLabel(compare.month)} 1–{compare.days} was <strong style={{ color:"var(--text2)", ...num }}>{money(Math.round(compare.cmpTotal))}</strong>
              </span>
            </div>
          )}
          {series.length
            ? <BarChart data={series} compare={grain === "daily" && compare && compare.cmpTotal > 0 ? compare : null} height={168} />
            : <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>Nothing received in this period.</div>}
          {series.length > 0 && (
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:10.5, color:"var(--text3)", marginTop:6, paddingTop:6, borderTop:"1px solid var(--border)" }}>
              {seriesStats.best  && <span>Best <strong style={{ color:"#2f7d4f" }}>{seriesStats.best.label}{seriesStats.best.sub?" "+seriesStats.best.sub:""} · {money(Math.round(seriesStats.best.amount))}</strong></span>}
              {seriesStats.quiet && seriesStats.quiet !== seriesStats.best &&
                <span>Quietest <strong style={{ color:"#b5322a" }}>{seriesStats.quiet.label}{seriesStats.quiet.sub?" "+seriesStats.quiet.sub:""} · {money(Math.round(seriesStats.quiet.amount))}</strong></span>}
              {grain === "daily" && (
                <span>No income <strong style={{ color:"var(--text)" }}>{seriesStats.emptyDays} day{seriesStats.emptyDays===1?"":"s"}</strong>
                  {month && <span style={{ color:"var(--border2)" }}> (of {seriesStats.shown} so far)</span>}</span>
              )}
              {grain === "daily" && compare && compare.cmpTotal > 0 && (
                <span style={{ display:"inline-flex", gap:10 }}>
                  <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:CUR_COLOR, verticalAlign:-1 }} /> {monthLabel(month)}</span>
                  <span><span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:CMP_COLOR, verticalAlign:-1 }} /> {monthLabel(compare.month)}</span>
                </span>
              )}
              <span style={{ marginLeft:"auto" }}>payment dates, not the night stayed · hover a bar for its amount</span>
            </div>
          )}
        </div>

        {/* Which weekday earns most (wide) + revenue vs cost by month (narrow) */}
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.6fr) minmax(0,1fr)", gap:12, marginBottom:12 }}>

        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            <span style={capLbl}>Which day earns most</span>
            <select value={wdRange} onChange={e=>setWdRange(e.target.value)}
              style={{ marginLeft:"auto", padding:"3px 8px", border:"1px solid var(--border)", borderRadius:7,
                fontSize:11, fontFamily:"inherit", background:"var(--bg2)", color:"var(--text)", cursor:"pointer" }}>
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="all">All time</option>
              {byMonth.map(x => x.month).slice().reverse().map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          {wd.best ? (<>
            <div style={{ background:"#edf3f1", border:"1px solid #cfe2d5", borderRadius:9, padding:"9px 11px", marginBottom:10 }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:"#2f5f4d" }}>
                {WEEKDAY_FULL[wd.best.wd]} is your strongest day
              </div>
              <div style={{ fontSize:10.5, color:"var(--text2)", marginTop:3, lineHeight:1.55 }}>
                {money(Math.round(wd.best.avg))} average
                {wd.ratio && wd.worst && wd.worst.wd !== wd.best.wd ? <> — {wd.ratio.toFixed(1)}× a {WEEKDAY_FULL[wd.worst.wd]}</> : null}
                {wd.monthCount > 1 && <> · top day in <strong>{wd.topCount} of {wd.monthCount}</strong> months</>}
                {wd.second && wd.second.avg > 0 && <> · {WEEKDAY_FULL[wd.second.wd]} second at {money(Math.round(wd.second.avg))}</>}
              </div>
            </div>

            {(() => {
              const max = Math.max(1, ...wd.rows.map(r => r.avg));
              const W = 560, H = 96, base = 76;
              const bw = W / 7 - 12;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height:100 }}>
                  <line x1="0" y1={base} x2={W} y2={base} stroke="#e4e4e8" />
                  {wd.overallAvg > 0 && (
                    <line x1="0" y1={base - (wd.overallAvg / max) * 56} x2={W}
                      y2={base - (wd.overallAvg / max) * 56} stroke="#d9a441" strokeDasharray="4 4" />
                  )}
                  {wd.rows.map((r, i) => {
                    const h = Math.max(2, Math.round((r.avg / max) * 56));
                    const isBest = wd.best && r.wd === wd.best.wd;
                    const x0 = i * (W / 7) + 6;
                    return (
                      <g key={r.wd}>
                        <rect x={x0} y={base - h} width={bw} height={h} rx="2"
                          fill={isBest ? "#2f7d4f" : r.avg >= wd.overallAvg ? "#5f8f86" : "#b9c9c5"}>
                          <title>{`${WEEKDAY_FULL[r.wd]} — ${money(Math.round(r.avg))} average over ${r.days} day${r.days===1?"":"s"}`}</title>
                        </rect>
                        {isBest && (
                          <text x={x0 + bw/2} y={base - h - 5} textAnchor="middle"
                            style={{ fontSize:9, fontWeight:600, fill:"#2f7d4f" }}>{money(Math.round(r.avg))}</text>
                        )}
                        <text x={x0 + bw/2} y={H - 4} textAnchor="middle"
                          style={{ fontSize:8.5, fontWeight: isBest ? 600 : 400, fill: isBest ? "var(--text)" : "var(--text3)" }}>{r.label}</text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {wd.perMonth.length > 1 && (
              <div style={{ marginTop:9, paddingTop:8, borderTop:"1px solid var(--border)" }}>
                {wd.perMonth.filter(p => p.bestWd != null).slice(-4).map(p => (
                  <div key={p.month} style={{ display:"flex", alignItems:"center", gap:8, padding:"3px 0", fontSize:10.5 }}>
                    <span style={{ flex:"0 0 78px", color:"var(--text3)" }}>{monthLabel(p.month)}</span>
                    <span style={{ flex:1, fontWeight:600 }}>{WEEKDAY_FULL[p.bestWd]}</span>
                    <span style={{ ...num }}>{money(Math.round(p.bestAmount))}</span>
                    <span style={{ flex:"0 0 92px", textAlign:"right", color:"var(--text3)" }}>
                      {p.quietWd != null && p.quietWd !== p.bestWd ? `quietest ${WEEKDAYS_SHORT[p.quietWd]}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>) : (
            <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>Not enough revenue yet to show a weekday trend.</div>
          )}
        </div>

        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            <span style={capLbl}>Revenue vs cost by month</span>
            <span style={{ marginLeft:"auto", fontSize:10, color:"var(--text3)" }}>
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:SERIES[0], marginRight:4 }} />revenue
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:SERIES[1], margin:"0 4px 0 10px" }} />cost
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:SERIES[2], margin:"0 4px 0 10px" }} />profit
            </span>
          </div>
          {byMonth.length ? (
            <div style={{ display:"flex", alignItems:"flex-end", gap:14, height:170, paddingTop:8, overflowX:"auto" }}>
              {byMonth.slice(-6).map(m => {
                const cost = expByMonth.get(m.month) || 0;
                const profit = m.amount - cost;
                const max = Math.max(1, ...byMonth.slice(-6).map(x => Math.max(x.amount, expByMonth.get(x.month)||0)));
                const bar = v => Math.max(2, Math.round(Math.abs(v) / max * 120));
                return (
                  <div key={m.month} style={{ flex:"1 0 90px", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:130 }}>
                      <div title={`Revenue ${money(Math.round(m.amount))}`} style={{ width:16, height:bar(m.amount), background:SERIES[0], borderRadius:3 }} />
                      <div title={`Cost ${money(Math.round(cost))}`} style={{ width:16, height:bar(cost), background:SERIES[1], borderRadius:3 }} />
                      <div title={`Profit ${money(Math.round(profit))}`} style={{ width:16, height:bar(profit), background:profit>=0?SERIES[2]:"#c96a63", borderRadius:3 }} />
                    </div>
                    <div style={{ fontSize:10, color:"var(--text2)", fontWeight:600 }}>{monthLabel(m.month)}</div>
                    <div style={{ fontSize:9.5, color:"var(--text3)", ...num }}>{money(Math.round(m.amount))}</div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>No revenue recorded yet.</div>}
        </div>

        </div>

        {/* Where bookings come from — channel on the left, the people who refer on the right */}
        <div style={{ ...card, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, flexWrap:"wrap" }}>
            <span style={capLbl}>Where bookings come from</span>
            <span style={{ marginLeft:"auto", fontSize:10, color:"var(--text3)" }}>{monthLabel(month)}</span>
          </div>

          {chan.top ? (
            <div style={{ background:"#edf3f1", border:"1px solid #cfe2d5", borderRadius:9, padding:"8px 11px", marginBottom:11 }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:"#2f5f4d" }}>
                {chan.top.source} brings most bookings — {chan.top.bookings} of {chan.totalBookings}
              </div>
              <div style={{ fontSize:10.5, color:"var(--text2)", marginTop:3, lineHeight:1.55 }}>
                {chan.second && <>{chan.second.source} is second at {chan.second.bookings}. </>}
                {chan.richest && chan.richest.source !== chan.top.source
                  ? <>{chan.richest.source} pays best — {money(chan.richest.avgPerBooking)} a booking vs {money(chan.top.avgPerBooking)} for {chan.top.source.toLowerCase()}.</>
                  : <>It also pays best at {money(chan.top.avgPerBooking)} a booking.</>}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12, color:"var(--text3)", padding:"10px 0 14px" }}>
              No bookings in this period yet.
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:16 }}>
            <div>
              <div style={{ fontSize:9.5, letterSpacing:.5, textTransform:"uppercase", color:"var(--text3)", marginBottom:7 }}>By source</div>
              {chan.rows.map(r => {
                const w = chan.top && chan.top.bookings ? Math.round(r.bookings / chan.top.bookings * 100) : 0;
                const lead = chan.top && r.source === chan.top.source;
                return (
                  <div key={r.source} style={{ marginBottom:7 }}>
                    <div style={{ display:"flex", fontSize:11, marginBottom:3, gap:8 }}>
                      <span style={{ fontWeight: lead ? 600 : 400, color: r.bookings ? "var(--text)" : "var(--text3)" }}>{r.source}</span>
                      <span style={{ marginLeft:"auto", color:"var(--text3)", ...num }}>
                        {r.bookings ? <>{r.bookings} · {money(Math.round(r.revenue))}</> : "—"}
                      </span>
                    </div>
                    <div style={{ height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden" }}>
                      <div title={`${r.pct}% of bookings · ${money(r.avgPerBooking)} each`}
                        style={{ height:"100%", width:w+"%", borderRadius:3,
                          background: lead ? "#2f7d4f" : r.bookings ? "#8fb3aa" : "transparent" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderLeft:"1px solid var(--border)", paddingLeft:16 }}>
              <div style={{ display:"flex", alignItems:"center", marginBottom:7 }}>
                <span style={{ fontSize:9.5, letterSpacing:.5, textTransform:"uppercase", color:"var(--text3)" }}>Who refers most</span>
                <span style={{ marginLeft:"auto", fontSize:9.5, color:"var(--text3)" }}>
                  {ref.people ? `${ref.people} ${ref.people===1?"person":"people"} · ${money(Math.round(ref.revenue))}` : ""}
                </span>
              </div>

              {ref.rows.length === 0 ? (
                <div style={{ fontSize:11, color:"var(--text3)", padding:"6px 0", lineHeight:1.6 }}>
                  Nobody recorded yet. Fill “Referred by” on the invoice when a guest is sent by someone.
                </div>
              ) : (<>
                {refShown.map((r, i) => (
                  <div key={r.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"3.5px 0",
                    borderBottom: i === refShown.length-1 ? "none" : "1px solid var(--border)", fontSize:11 }}>
                    <span style={{ width:12, color:"var(--text3)", ...num }}>{i+1}</span>
                    <span style={{ fontWeight: i === 0 ? 600 : 400, minWidth:0, overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                      title={r.spellings > 1 ? `${r.spellings} spellings of this name merged` : r.name}>
                      {r.name}{r.spellings > 1 && <span style={{ color:"var(--text3)" }}> ·{r.spellings}</span>}
                    </span>
                    <span style={{ marginLeft:"auto", color:"var(--text3)", ...num }}>{money(Math.round(r.revenue))}</span>
                    <span style={{ background:"var(--bg3)", color:"var(--text2)", borderRadius:20,
                      padding:"1px 7px", fontSize:10, fontWeight:600, ...num }}>{r.count}</span>
                  </div>
                ))}
                {ref.rows.length > 5 && (
                  <button onClick={() => setRefAll(v => !v)}
                    style={{ width:"100%", marginTop:7, padding:"4px 0", borderRadius:7,
                      border:"1px solid var(--border)", background:"var(--bg2)", color:"var(--text2)",
                      fontSize:10.5, fontFamily:"inherit", cursor:"pointer" }}>
                    {refAll ? "Show top 5 only" : `Show all ${ref.rows.length} referrers`}
                  </button>
                )}
              </>)}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12 }}>
          <div style={{ ...card, border:"1px solid "+(disc.total>0 ? "#e0b3b0" : "var(--border)") }}>
            <div style={{ ...capLbl, color: disc.total>0 ? "#8f2323" : "var(--text2)", marginBottom:8 }}>Discounts given</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
              <span style={{ fontSize:22, fontWeight:600, color:"#b5322a", ...num }}>{money(Math.round(disc.total))}</span>
              <span style={{ fontSize:11, color:"var(--text3)" }}>across {disc.count} booking{disc.count===1?"":"s"}</span>
            </div>
            {disc.total>0 && (
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:7, lineHeight:1.6 }}>
                That is <strong>{disc.pctOfGross}%</strong> of gross room value. Gross {money(Math.round(disc.gross))} → billed {money(Math.round(disc.billed))}.
              </div>
            )}
            {disc.biggest && (
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:8, paddingTop:8, borderTop:"1px solid var(--border)" }}>
                Biggest: <strong>Rm {disc.biggest.room} — {money(disc.biggest.amount)}</strong> · Avg per booking: <strong>{money(disc.avg)}</strong>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ ...capLbl, marginBottom:9 }}>Booking pattern</div>
            {[["Bookings", pattern.bookings],["Avg length of stay", pattern.avgStay+" nights"],
              ["Multi-room bookings", pattern.multiRoom],["Busiest check-in day", pattern.busiestWeekday],
              ["Revenue from extensions", money(Math.round(pattern.extensionRevenue))]].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid var(--border)", fontSize:11.5 }}>
                <span style={{ color:"var(--text2)" }}>{l}</span><strong style={num}>{v}</strong>
              </div>
            ))}
          </div>

          {/* Salary summary — the Salary tab is gone, this keeps who-was-paid-what */}
          <div style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, flexWrap:"wrap" }}>
              <span style={capLbl}>Salary</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)" }}>
                {salary.count} staff · <strong style={{ color:"var(--text)" }}>{money(Math.round(salary.total))}</strong>
              </span>
            </div>
            {salary.staff.length ? (<>
              {salary.staff.slice(0, 6).map(p => (
                <div key={p.name} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ width:24, height:24, borderRadius:"50%", background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"var(--text2)", fontWeight:600, flexShrink:0 }}>
                    {p.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11.5, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                    {p.role && <div style={{ fontSize:9.5, color:"var(--text3)" }}>{p.role}</div>}
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:600, ...num }}>{money(Math.round(p.amount))}</span>
                </div>
              ))}
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:8 }}>
                <strong>{costTotal>0 ? Math.round(salary.total/costTotal*100) : 0}%</strong> of costs
                {occ.sold>0 && <> · {money(Math.round(salary.total/occ.sold))} per night sold</>}
              </div>
            </>) : (
              <div style={{ fontSize:11.5, color:"var(--text3)" }}>
                No salary recorded for this period. Add it under Expenses &amp; Cash with the category “Salaries”.
              </div>
            )}
          </div>
        </div>
      </>)}

      {/* ── ROOMS ── */}
      {tab==="rooms" && (<>
        <div style={{ ...card, marginBottom:12 }}>
          <div style={{ ...capLbl, marginBottom:10 }}>Room performance — {monthLabel(month)}</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5, minWidth:560 }}>
              <thead><tr style={{ color:"var(--text3)" }}>
                {["Room","Bookings","Nights","Share of revenue","Avg rate","Revenue"].map((h,i)=>(
                  <th key={h} style={{ textAlign: i===0?"left":i===3?"center":"right", padding:"5px 6px", fontSize:9, letterSpacing:.5, textTransform:"uppercase", fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rStats.map((r, i) => {
                  const max = Math.max(1, ...rStats.map(x => x.revenue));
                  return (
                    <tr key={r.number} style={{ borderTop:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px" }}>
                        <strong>{r.number}</strong> <span style={{ color:"var(--text3)" }}>{r.name}</span>
                        {i===0 && r.revenue>0 && <span style={{ fontSize:9, background:"#edf3f1", color:"#2f7d4f", borderRadius:20, padding:"1px 6px", marginLeft:5 }}>top</span>}
                        {i===rStats.length-1 && rStats.length>1 && <span style={{ fontSize:9, background:"#fdf1f0", color:"#b5322a", borderRadius:20, padding:"1px 6px", marginLeft:5 }}>lowest</span>}
                      </td>
                      <td style={{ textAlign:"right", padding:"6px", ...num }}>{r.bookings}</td>
                      <td style={{ textAlign:"right", padding:"6px", ...num }}>{r.nights}</td>
                      <td style={{ padding:"6px", minWidth:110 }}>
                        <div style={{ height:6, background:"var(--bg3)", borderRadius:20 }}>
                          <div style={{ width:Math.round(r.revenue/max*100)+"%", height:"100%", background:SERIES[0], borderRadius:20 }} />
                        </div>
                      </td>
                      <td style={{ textAlign:"right", padding:"6px", ...num }}>{money(r.avgRate)}</td>
                      <td style={{ textAlign:"right", padding:"6px", fontWeight:600, ...num }}>{money(Math.round(r.revenue))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={card}>
          <div style={{ ...capLbl, marginBottom:10 }}>AC vs Non-AC</div>
          {(() => {
            const total = ac.AC.nights + ac["Non-AC"].nights + ac["Not set"].nights;
            const rows = [["AC", ac.AC, SERIES[0]], ["Non-AC", ac["Non-AC"], "#c9b06a"], ["Not set", ac["Not set"], "#b9bec8"]]
              .filter(([,v]) => v.nights > 0);
            return (
              <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
                <svg viewBox="0 0 42 42" style={{ width:110, height:110, flexShrink:0 }}>
                  <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--bg3)" strokeWidth="6" />
                  {(() => { let off = 25; return rows.map(([label,v,color]) => {
                    const pct = total ? v.nights/total*100 : 0;
                    const el = <circle key={label} cx="21" cy="21" r="15.9155" fill="none" stroke={color} strokeWidth="6"
                      strokeDasharray={`${pct} ${100-pct}`} strokeDashoffset={off}><title>{`${label} — ${v.nights} nights`}</title></circle>;
                    off -= pct; return el; }); })()}
                  <text x="21" y="22.5" textAnchor="middle" style={{ fontSize:3.6, fill:"var(--text2)" }}>{total} nights</text>
                </svg>
                <div style={{ flex:1, minWidth:230 }}>
                  {rows.map(([label,v,color]) => (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ width:9, height:9, borderRadius:3, background:color }} />
                      <span style={{ flex:1, fontSize:11.5 }}>{label}</span>
                      <span style={{ fontSize:10, color:"var(--text3)" }}>{v.nights} nights</span>
                      <span style={{ fontSize:11.5, fontWeight:600, width:78, textAlign:"right", ...num }}>{money(v.avgRate)}/n</span>
                      <span style={{ fontSize:11.5, fontWeight:600, width:78, textAlign:"right", ...num }}>{money(Math.round(v.revenue))}</span>
                    </div>
                  ))}
                  {ac.AC.nights>0 && ac["Non-AC"].nights>0 && (
                    <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:8, lineHeight:1.5 }}>
                      AC is <strong style={{ color:"var(--text)" }}>{Math.round(ac.AC.nights/total*100)}%</strong> of nights sold and earns{" "}
                      <strong style={{ color: ac.AC.avgRate>=ac["Non-AC"].avgRate ? "#2f7d4f" : "#b5322a" }}>
                        {money(Math.abs(ac.AC.avgRate - ac["Non-AC"].avgRate))} {ac.AC.avgRate>=ac["Non-AC"].avgRate ? "more" : "less"}
                      </strong> per night.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Room settings — moved here from the Admin panel */}
        <div style={{ ...card, marginTop:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:11, flexWrap:"wrap" }}>
            <span style={{ width:22, height:22, borderRadius:6, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <i className="ti ti-settings" style={{ fontSize:12, color:"var(--text2)" }} />
            </span>
            <span style={capLbl}>Room settings</span>
            <span style={{ marginLeft:"auto", fontSize:9.5, background:"var(--bg3)", color:"var(--text3)", borderRadius:20, padding:"2px 9px" }}>moved from Admin</span>
          </div>
          <AdminRooms />
        </div>
      </>)}
    </div>
  );
}

