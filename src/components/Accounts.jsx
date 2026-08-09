// Accounts — admin-only business view. Money and rooms only.
// Every figure comes from lib/accounts.js and lib/hotelMoney.js, so it always
// agrees with the Desk, Expenses and Invoices screens.
import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { money } from "../utils/helpers";
import { hotelBusinessOnly } from "../utils/expenseType";
import { monthMoney, bookingMonthlyParts } from "../lib/hotelMoney";
import { hasHotelSupabaseConfig, loadHotelBookingsForRange } from "../lib/hotelSupabase";
import {
  roomStats, acStats, occupancy, discountStats, paymentStats, patternStats,
  revenueByDay, revenueByWeek, revenueByMonth, costByCategoryOverMonths, salaryStats,
} from "../lib/accounts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthLabel = m => m ? `${MONTHS[+m.slice(5,7)-1]} ${m.slice(0,4)}` : "All time";
const SERIES = ["#5f8f86","#c96a63","#d9a441","#7d93b5","#9b8bbf","#89a06f","#c98fa8","#b08968"];

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

// Simple bar chart — no external library
function Bars({ data, height = 130, colorFor, labelFor, valueFor }) {
  const max = Math.max(1, ...data.map(valueFor));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height, paddingTop:6 }}>
      {data.map((d, i) => {
        const v = valueFor(d);
        const h = Math.max(2, Math.round(v / max * (height - 26)));
        return (
          <div key={i} style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }} title={`${labelFor(d)} — ${money(Math.round(v))}`}>
            <div style={{ fontSize:8.5, color:"var(--text3)", ...num }}>{v ? Math.round(v/1000)+"k" : ""}</div>
            <div style={{ width:"100%", height:h, background:colorFor(d, i), borderRadius:3, transition:"height .3s" }} />
            <div style={{ fontSize:8.5, color:"var(--text3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{labelFor(d)}</div>
          </div>
        );
      })}
    </div>
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
    const live = (bookings || []).filter(b => !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? "")));
    if (!allRows.length) return live;
    const have = new Set(live.map(b => String(b.supabaseBookingId ?? b.id)));
    const add = allRows.filter(b => !have.has(String(b.supabaseBookingId ?? b.id))
      && !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? "")));
    return add.length ? [...live, ...add] : live;
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

  const costTotal   = monthExpenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const netProfit   = mm.collected - costTotal;
  const occ         = occupancy(scoped, (rooms||[]).length, month);
  const rStats      = useMemo(() => roomStats(scoped, rooms, month), [scoped, rooms, month]);
  const ac          = useMemo(() => acStats(scoped, month), [scoped, month]);
  const disc        = useMemo(() => discountStats(scoped, month), [scoped, month]);
  const pay         = useMemo(() => paymentStats(scoped, month, bizExpenses), [scoped, month, bizExpenses]);
  // All-time cash position — the number that actually matters when asking the
  // manager for money, since a single month is misleading if nothing was remitted.
  const payAll      = useMemo(() => paymentStats(scoped, "", bizExpenses), [scoped, bizExpenses]);
  const timingGap   = pay.totalIn - mm.collected;
  const pattern     = useMemo(() => patternStats(scoped, month), [scoped, month]);
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
  const series = useMemo(() => {
    if (grain === "monthly") return byMonth.map(x => ({ label: monthLabel(x.month), amount: x.amount }));
    if (grain === "weekly")  return revenueByWeek(scoped, revenues, month).map(x => ({ label: x.label, amount: x.amount }));
    return revenueByDay(scoped, revenues, month).map(x => ({ label: x.day.slice(8), amount: x.amount }));
  }, [grain, scoped, revenues, month, byMonth]);
  const bestDay = useMemo(() => {
    const d = revenueByDay(scoped, revenues, month);
    return d.length ? d.reduce((a, b) => b.amount > a.amount ? b : a) : null;
  }, [scoped, revenues, month]);

  if (curRole !== "admin") {
    return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
        <i className="ti ti-lock" style={{ fontSize:40, display:"block", marginBottom:12 }} />
        <div style={{ fontSize:16, fontWeight:600 }}>Access restricted</div>
        <div style={{ fontSize:13 }}>Accounts are only available to administrators.</div>
      </div>
    );
  }

  const TABS = [["overview","Overview"],["revenue","Revenue"],["rooms","Rooms"],["costs","Costs"],["salary","Salary"]];

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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))", gap:7, marginBottom:12 }}>
        <Tile label="Revenue" value={money(mm.collected)} color="#2f7d4f"
          sub={revDelta === null ? "collected" : `${revDelta>=0?"▲":"▼"} ${Math.abs(revDelta)}% vs ${monthLabel(prevMonth)}`} />
        <Tile label="Nights sold" value={occ.sold} sub={occ.available ? `of ${occ.available} available` : "room-nights"} />
        <Tile label="Occupancy" value={occ.available ? occ.pct+"%" : "—"} sub="rooms filled" />
        <Tile label="Avg rate" value={occ.sold ? money(Math.round(mm.collected/occ.sold)) : "—"} sub="per night" />
        <Tile label="Costs" value={money(costTotal)} color="#b5322a" sub="business expenses" />
        <Tile label="Net profit" value={money(netProfit)} color={netProfit>=0?"#2f7d4f":"#b5322a"}
          sub={mm.collected>0 ? Math.round(netProfit/mm.collected*100)+"% margin" : ""} />
        <Tile label="Outstanding" value={money(mm.outstanding)} color={mm.outstanding>0?"#b5322a":"var(--text3)"} sub="still owed" />
        <Tile label="Cash held (all time)" value={money(Math.round(payAll.cashExpected))} accent sub="all cash in − all cash out" />
      </div>

      {/* ── OVERVIEW ── */}
      {tab==="overview" && (<>
        <div style={{ ...card, marginBottom:12 }}>
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
              {byMonth.slice(-8).map(m => {
                const cost = expByMonth.get(m.month) || 0;
                const profit = m.amount - cost;
                const max = Math.max(1, ...byMonth.slice(-8).map(x => Math.max(x.amount, expByMonth.get(x.month)||0)));
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

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
          <div style={card}>
            <div style={{ ...capLbl, marginBottom:3 }}>Money actually received — {monthLabel(month)}</div>
            <div style={{ fontSize:10, color:"var(--text3)", marginBottom:9, lineHeight:1.5 }}>
              Counted on the day the guest <strong>paid</strong>. Revenue above is counted on the night the guest <strong>stayed</strong> — so these two can differ.
            </div>
            {pay.rows.length ? pay.rows.map((r,i) => (
              <div key={r.method} style={{ display:"flex", alignItems:"center", gap:9, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                <span style={{ width:9, height:9, borderRadius:3, background:SERIES[i%SERIES.length] }} />
                <span style={{ flex:1, fontSize:11.5 }}>{r.method}</span>
                <span style={{ fontSize:11.5, fontWeight:600, ...num }}>{money(Math.round(r.amount))}</span>
              </div>
            )) : <div style={{ fontSize:11.5, color:"var(--text3)" }}>No payments recorded.</div>}

            {/* Total received, so the rows above visibly add up */}
            <div style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 0", borderTop:"1.5px solid var(--border)", marginTop:2 }}>
              <span style={{ flex:1, fontSize:11.5, fontWeight:600 }}>Total received (all methods)</span>
              <span style={{ fontSize:12, fontWeight:600, ...num }}>{money(Math.round(pay.totalIn))}</span>
            </div>

            {/* Why received ≠ revenue */}
            {month && Math.abs(timingGap) > 1 && (
              <div style={{ fontSize:10.5, color:"var(--text2)", marginTop:8, background:"var(--bg3)", borderRadius:8, padding:"8px 10px", lineHeight:1.6 }}>
                Received {money(Math.round(pay.totalIn))} but revenue is {money(Math.round(mm.collected))} — a difference of{" "}
                <strong>{money(Math.abs(Math.round(timingGap)))}</strong>.{" "}
                {timingGap > 0
                  ? "That extra was paid this month for nights stayed in another month."
                  : "That much of this month's nights was paid in another month."}
              </div>
            )}

            {/* Cash drawer — cash only, stated as such, every step shown */}
            <div style={{ marginTop:10, paddingTop:9, borderTop:"1px solid var(--border)" }}>
              <div style={{ ...capLbl, marginBottom:6 }}>Cash drawer <span style={{ color:"var(--text3)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>— notes and coins only, not bKash/card</span></div>
              {[
                [`Cash received (${monthLabel(month)})`, pay.cashIn, null],
                [`Cash spent (${monthLabel(month)})`, -pay.cashOut, null],
                ["Cash added this period", pay.cashExpected, true],
              ].map(([l, v, bold]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontSize:11,
                  borderTop: bold ? "1px solid var(--border)" : "none", marginTop: bold ? 3 : 0, paddingTop: bold ? 5 : 3 }}>
                  <span style={{ color:"var(--text2)", fontWeight: bold ? 600 : 400 }}>{l}</span>
                  <span style={{ fontWeight: bold ? 600 : 400, ...num }}>{money(Math.round(v))}</span>
                </div>
              ))}
              <div style={{ marginTop:8, paddingTop:7, borderTop:"1px dashed var(--border)" }}>
                {[
                  ["All cash ever received", payAll.cashIn],
                  ["All cash ever spent", -payAll.cashOut],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontSize:11 }}>
                    <span style={{ color:"var(--text2)" }}>{l}</span><span style={num}>{money(Math.round(v))}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0 0", marginTop:3, borderTop:"1px solid var(--border)", fontSize:12 }}>
                  <span style={{ fontWeight:600, color:"#a6832c" }}>Cash the manager should hold</span>
                  <span style={{ fontWeight:600, color:"#a6832c", ...num }}>{money(Math.round(payAll.cashExpected))}</span>
                </div>
                <div style={{ fontSize:9.5, color:"var(--text3)", marginTop:3 }}>Before anything already handed over to you.</div>
              </div>
            </div>
          </div>

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
        </div>
      </>)}

      {/* ── REVENUE ── */}
      {tab==="revenue" && (
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            <span style={capLbl}>Revenue detail</span>
            <span style={{ marginLeft:"auto", display:"inline-flex", border:"1px solid var(--border)", borderRadius:7, overflow:"hidden" }}>
              {["daily","weekly","monthly"].map(g => (
                <button key={g} onClick={()=>setGrain(g)} style={{ padding:"4px 11px", border:"none", cursor:"pointer", fontFamily:"inherit",
                  fontSize:11, fontWeight:600, textTransform:"capitalize",
                  background: grain===g ? "var(--navy)" : "transparent", color: grain===g ? "#fff" : "var(--text2)" }}>{g}</button>
              ))}
            </span>
          </div>
          {series.length ? (
            <Bars data={series} height={190} colorFor={(_,i)=>SERIES[0]} labelFor={d=>d.label} valueFor={d=>d.amount} />
          ) : <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>No revenue in this period.</div>}
          {bestDay && (
            <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:8 }}>
              Best day: <strong style={{ color:"#2f7d4f" }}>{bestDay.day} — {money(Math.round(bestDay.amount))}</strong>
            </div>
          )}
        </div>
      )}

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
      </>)}

      {/* ── COSTS ── */}
      {tab==="costs" && (
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={capLbl}>Cost by category — month over month</span>
            <span style={{ marginLeft:"auto", fontSize:10.5, color:"var(--text3)" }}>{money(Math.round(costTotal))} this period</span>
          </div>
          {catOverTime.length ? (<>
            {catOverTime.map((row, i) => {
              const max = Math.max(1, ...catOverTime.flatMap(r => lastMonths.map(m => r.byMonth[m] || 0)));
              return (
                <div key={row.cat} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderTop:"1px solid var(--border)" }}>
                  <span style={{ flex:"0 0 120px", fontSize:11.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.cat}</span>
                  <div style={{ flex:1, display:"flex", gap:3, alignItems:"flex-end", height:30 }}>
                    {lastMonths.map(m => {
                      const v = row.byMonth[m] || 0;
                      return <div key={m} title={`${monthLabel(m)} — ${money(Math.round(v))}`}
                        style={{ flex:1, height:Math.max(2, Math.round(v/max*30)), background: v ? SERIES[i%SERIES.length] : "var(--bg3)", borderRadius:2 }} />;
                    })}
                  </div>
                  <span style={{ flex:"0 0 74px", textAlign:"right", fontSize:11.5, fontWeight:600, ...num }}>{money(Math.round(row.total))}</span>
                </div>
              );
            })}
            <div style={{ fontSize:9.5, color:"var(--text3)", marginTop:7, textAlign:"right" }}>
              {lastMonths.map(m => MONTHS[+m.slice(5,7)-1]).join(" · ")}
            </div>
          </>) : <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>No business expenses recorded.</div>}
        </div>
      )}

      {/* ── SALARY ── */}
      {tab==="salary" && (
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:11, flexWrap:"wrap" }}>
            <span style={{ width:22, height:22, borderRadius:6, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <i className="ti ti-users" style={{ fontSize:12, color:"var(--text2)" }} />
            </span>
            <span style={capLbl}>Salary — {monthLabel(month)}</span>
            <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)" }}>
              {salary.count} staff · <strong style={{ color:"var(--text)" }}>{money(Math.round(salary.total))}</strong> paid
            </span>
          </div>
          {salary.staff.length ? (<>
            {salary.staff.map(p => (
              <div key={p.name} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderTop:"1px solid var(--border)" }}>
                <span style={{ width:26, height:26, borderRadius:"50%", background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9.5, color:"var(--text2)", fontWeight:600 }}>
                  {p.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div>
                  <div style={{ fontSize:10, color:"var(--text3)" }}>{[p.role, p.period].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span style={{ fontSize:12, fontWeight:600, ...num }}>{money(Math.round(p.amount))}</span>
              </div>
            ))}
            <div style={{ fontSize:10, color:"var(--text3)", marginTop:9, paddingTop:8, borderTop:"1px solid var(--border)", lineHeight:1.6 }}>
              Salary is <strong>{costTotal>0 ? Math.round(salary.total/costTotal*100) : 0}%</strong> of this period's costs
              {occ.sold>0 && <> · staff cost per night sold: <strong>{money(Math.round(salary.total/occ.sold))}</strong></>}
            </div>
          </>) : (
            <div style={{ fontSize:12, color:"var(--text3)", padding:"14px 0" }}>
              No salary records for this period. Record them under Expenses &amp; Cash with the category “Salaries”.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
