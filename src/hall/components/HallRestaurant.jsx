// Coffee house books. Deliberately small: five sections, no product catalogue,
// no stock quantities. The manager counts the shelf and types one number.
//
// Every figure shown here comes from lib/restaurantMoney.js — nothing is
// computed in this file, so the screen and the tests can never disagree.
import { useState, useMemo } from "react";
import { useHall } from "../HallContext";
import useIsMobile from "../useIsMobile";
import {
  monthSummary, dailyCloses, monthsWithData, prevMonth, nextMonth, emptyRestaurant,
} from "../lib/restaurantMoney";

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b", blue:"#1a56cb" };

const MONTHS_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EXP_CATS = ["Rent","Electricity","Water","Internet","Salary","Delivery","Repairs","Cleaning","Marketing","Card & bank fees","Tax","Other"];
const PAY_METHODS = ["Cash","Card","Bank"];

const money = n => "৳" + Math.round(n || 0).toLocaleString();
const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + "৳" + Math.abs(Math.round(n || 0)).toLocaleString();
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const monthLabel = m => { const [y,mo] = m.split("-"); return MONTHS_LABEL[parseInt(mo,10)-1] + " " + y; };
const fmtDate = iso => { if (!iso) return "—"; const [y,m,d] = iso.split("-");
  return parseInt(d,10) + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m,10)-1]; };
const nid = () => Date.now() + "_" + Math.random().toString(36).slice(2, 7);

const card   = { background:"#fff", border:"1px solid "+C.border, borderRadius:11, overflow:"hidden" };
const chead  = { padding:"11px 14px", borderBottom:"1px solid "+C.border, fontSize:11, fontWeight:800, letterSpacing:.9, textTransform:"uppercase", color:C.maroon, display:"flex", alignItems:"center", gap:8 };
const inp    = { border:"1.5px solid "+C.border, borderRadius:8, padding:"7px 10px", fontSize:12.5, background:"#fff", fontFamily:"inherit", color:"#2b2b2b", width:"100%" };
const lbl    = { fontSize:9.5, fontWeight:800, letterSpacing:.7, textTransform:"uppercase", color:C.dim, display:"block", marginBottom:4 };
const btn    = { background:C.maroon, color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontWeight:800, fontSize:12.5, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" };
const th     = { padding:"9px 13px", textAlign:"left", fontSize:9.5, textTransform:"uppercase", letterSpacing:.8, color:C.dim, fontWeight:800, background:"#fbf8f1", borderBottom:"1px solid "+C.border };
const td     = { padding:"9px 13px", borderBottom:"1px solid #efe6d4", fontSize:12.5 };
const tdN    = { ...td, textAlign:"right", fontVariantNumeric:"tabular-nums" };
const numF   = { fontFamily:"'Playfair Display',serif", fontWeight:800, fontVariantNumeric:"tabular-nums" };
const formWrap = { display:"grid", gap:10, padding:"13px 14px", background:"#fbf8f1", borderBottom:"1px solid "+C.border };

function PayPicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", gap:5 }}>
      {PAY_METHODS.map(m => (
        <button key={m} type="button" onClick={() => onChange(m)}
          style={{ flex:1, padding:"7px 6px", border:"1.5px solid "+(value===m?C.maroon:C.border), borderRadius:8,
            fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            background:value===m?C.maroon:"#fff", color:value===m?"#fff":C.dim }}>{m}</button>
      ))}
    </div>
  );
}

const Pill = ({ children, bg, color }) => (
  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:bg, color, whiteSpace:"nowrap" }}>{children}</span>
);
const methodPill = m => m === "Card" ? <Pill bg="#e8f1fd" color={C.blue}>Card</Pill>
  : m === "Bank" ? <Pill bg="#eef2f7" color="#3a6ea5">Bank</Pill>
  : <Pill bg="#e8f5ec" color={C.green}>Cash</Pill>;

const Empty = ({ children }) => (
  <div style={{ padding:"22px 14px", textAlign:"center", color:C.dim, fontSize:12.5 }}>{children}</div>
);

export default function HallRestaurant() {
  const { restaurant, setRestaurant, curUser, notify } = useHall();
  const isMobile = useIsMobile();
  const data = restaurant || emptyRestaurant();

  const today = todayStr();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [tab, setTab] = useState("dash");

  const sum = useMemo(() => monthSummary(data, month), [data, month]);
  const closes = useMemo(() => dailyCloses(data, month), [data, month]);
  const known = useMemo(() => monthsWithData(data), [data]);

  const inMonth = rows => (rows || []).filter(r => String(r.date).slice(0,7) === month)
    .slice().sort((a,b) => String(b.date).localeCompare(String(a.date)));

  // ── writers ───────────────────────────────────────────────────────────────
  const addRow = (key, row) => setRestaurant(p => ({ ...p, [key]: [...(p[key]||[]), { id:nid(), by:curUser||"", ...row }] }));
  const delRow = (key, id) => setRestaurant(p => ({ ...p, [key]: (p[key]||[]).filter(r => String(r.id) !== String(id)) }));
  const setMonthField = (field, value) => setRestaurant(p => ({
    ...p, months: { ...(p.months||{}), [month]: { ...((p.months||{})[month]||{}), [field]: value } },
  }));
  const saveCount = (date, counted) => setRestaurant(p => ({
    ...p, counts: [...(p.counts||[]).filter(c => c.date !== date), { date, counted, by:curUser||"" }],
  }));

  const SUBS = [
    { id:"dash",  icon:"📊", label:"Dashboard" },
    { id:"sales", icon:"💰", label:"Sales" },
    { id:"buy",   icon:"🛒", label:"Purchases" },
    { id:"exp",   icon:"💸", label:"Expenses" },
    { id:"close", icon:"📦", label:"Close Month" },
  ];

  return (
    <div style={{ padding: isMobile ? "12px 12px 30px" : "16px 20px 34px", maxWidth:1400, margin:"0 auto" }}>

      {/* Section switcher */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:13 }}>
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setTab(s.id)}
            style={{ padding:"8px 15px", borderRadius:9, border:"1.5px solid "+(tab===s.id?C.maroon:C.border),
              background:tab===s.id?C.maroon:"#fff", color:tab===s.id?"#fff":C.dim,
              fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* Month picker — every section shows the same month */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ ...btn, background:"#fff", color:C.maroon, border:"1.5px solid "+C.border, padding:"6px 11px" }}>◀</button>
        <span style={{ ...numF, fontSize:17, color:C.maroon, minWidth:150, textAlign:"center" }}>{monthLabel(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ ...btn, background:"#fff", color:C.maroon, border:"1.5px solid "+C.border, padding:"6px 11px" }}>▶</button>
        {month !== today.slice(0,7) && (
          <button onClick={() => setMonth(today.slice(0,7))} style={{ ...btn, background:"#fff", color:C.dim, border:"1.5px solid "+C.border, padding:"6px 11px", fontSize:11.5 }}>This month</button>
        )}
        <span style={{ marginLeft:"auto", fontSize:11, color:C.dim }}>
          {sum.daysEntered} day{sum.daysEntered===1?"":"s"} of sales entered
          {known.length ? ` · records from ${monthLabel(known[0])}` : ""}
        </span>
      </div>

      {tab === "dash"  && <Dashboard sum={sum} isMobile={isMobile} onGo={setTab} />}
      {tab === "sales" && <Sales rows={inMonth(data.sales)} sum={sum} today={today} month={month} isMobile={isMobile}
        onAdd={r => { addRow("sales", r); notify("Day saved ✓"); }} onDel={id => delRow("sales", id)} />}
      {tab === "buy"   && <Purchases rows={inMonth(data.purchases)} sum={sum} today={today} month={month} isMobile={isMobile}
        onAdd={r => { addRow("purchases", r); notify("Purchase added ✓"); }} onDel={id => delRow("purchases", id)} />}
      {tab === "exp"   && <Expenses rows={inMonth(data.expenses)} sum={sum} today={today} month={month} isMobile={isMobile}
        onAdd={r => { addRow("expenses", r); notify("Expense added ✓"); }} onDel={id => delRow("expenses", id)} />}
      {tab === "close" && <CloseMonth sum={sum} closes={closes} owner={inMonth(data.ownerMoves)} today={today} month={month} isMobile={isMobile}
        isFirstMonth={known.length === 0 || month <= known[0]}
        onMonthField={setMonthField} onCount={(d,v) => { saveCount(d,v); notify("Cash count saved ✓"); }}
        onOwner={r => { addRow("ownerMoves", r); notify("Owner money recorded ✓"); }} onDelOwner={id => delRow("ownerMoves", id)} />}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ sum, isMobile, onGo }) {
  const kpi = (l, v, color, s) => (
    <div style={{ background:"#fff", border:"1px solid "+C.border, borderRadius:11, padding:"12px 14px" }}>
      <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:.9, textTransform:"uppercase", color:C.dim }}>{l}</div>
      <div style={{ ...numF, fontSize:21, marginTop:5, color }}>{money(v)}</div>
      <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{s}</div>
    </div>
  );
  const row = (label, val, opts = {}) => (
    <tr style={opts.strong ? { background:"#fbf8f1" } : undefined}>
      <td style={{ ...td, paddingLeft: opts.indent ? 30 : 13, fontWeight: opts.strong ? 800 : 400,
        fontSize: opts.indent ? 11 : 12.5, color: opts.indent ? C.dim : undefined }}>{label}</td>
      <td style={{ ...tdN, fontWeight: opts.strong ? 800 : 400, fontSize: opts.indent ? 11 : 12.5,
        color: opts.color, ...(opts.strong ? numF : {}) }}>{money(val)}</td>
    </tr>
  );

  return (<>
    <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:12 }}>
      {kpi("Revenue", sum.revenue, C.green, "cash · card · mobile")}
      {kpi("Cost of goods used", sum.cogs, C.red, sum.closeStockSet ? "what you consumed" : "not counted yet")}
      {kpi("Other expenses", sum.otherExpenses, C.red, "rent, salary, bills")}
      {kpi("Net profit", sum.net, sum.net >= 0 ? C.green : C.red, "after everything")}
    </div>

    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.35fr 1fr", gap:12 }}>
      <div style={card}>
        <div style={chead}>📈 Profit for the month</div>
        <table style={{ borderCollapse:"collapse", width:"100%" }}><tbody>
          {row("Revenue", sum.revenue, { color:C.green })}
          {row("Opening stock", sum.openStock, { indent:true })}
          {row("+ Purchases (stock)", sum.stockPurchases, { indent:true })}
          {row("− Closing stock", sum.closeStock, { indent:true })}
          {row("− Cost of goods used", sum.cogs, { strong:true, color:C.red })}
          {row("= Gross profit", sum.gross, { strong:true, color:C.green })}
          {row("− Other expenses", sum.otherExpenses, { color:C.red })}
          {sum.nonStockPurchases > 0 && row("includes non-stock purchases", sum.nonStockPurchases, { indent:true })}
          <tr style={{ background:"#f4efe2" }}>
            <td style={{ ...td, fontSize:14, fontWeight:800, borderTop:"2px solid "+C.border }}>= Net profit</td>
            <td style={{ ...tdN, ...numF, fontSize:15, borderTop:"2px solid "+C.border, color:sum.net>=0?C.green:C.red }}>{money(sum.net)}</td>
          </tr>
        </tbody></table>
        {!sum.closeStockSet && (
          <div style={{ padding:"10px 13px", fontSize:11.5, background:"#fff8e6", borderTop:"1px solid "+C.gold, color:"#5c4500" }}>
            The shelf has not been counted for this month yet, so nothing is treated as consumed and the
            profit above is too high. <button onClick={() => onGo("close")} style={{ background:"none", border:"none", padding:0, color:C.maroon, fontWeight:800, cursor:"pointer", fontFamily:"inherit", fontSize:11.5, textDecoration:"underline" }}>Count it now →</button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={chead}>💵 Cash check</div>
        <table style={{ borderCollapse:"collapse", width:"100%" }}><tbody>
          {row("Opening cash", sum.openCash)}
          {row("+ Cash sales", sum.cashSales, { color:C.green })}
          {sum.refunds > 0 && row("− Refunds given", sum.refunds, { color:C.red })}
          {row("− Cash purchases", sum.cashPurchases, { color:C.red })}
          {row("− Cash expenses", sum.cashExpenses, { color:C.red })}
          {sum.ownerIn  > 0 && row("+ Owner put in", sum.ownerIn, { color:C.green })}
          {sum.ownerOut > 0 && row("− Owner took out", sum.ownerOut, { color:C.red })}
          {row("Expected in the drawer", sum.expectedCash, { strong:true })}
          {sum.countedCash === null ? (
            <tr><td style={{ ...td, color:C.dim, fontSize:11.5 }} colSpan={2}>Drawer not counted this month yet.</td></tr>
          ) : (<>
            {row("Actually counted", sum.countedCash)}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontSize:14, fontWeight:800, borderTop:"2px solid "+C.border }}>
                {sum.cashDiff === 0 ? "Matches" : sum.cashDiff > 0 ? "Over" : "Short"}
              </td>
              <td style={{ ...tdN, ...numF, fontSize:15, borderTop:"2px solid "+C.border, color:sum.cashDiff===0?C.green:C.red }}>
                {sum.cashDiff === 0 ? "৳0" : signed(sum.cashDiff)}
              </td>
            </tr>
          </>)}
        </tbody></table>
        <div style={{ padding:"10px 13px", fontSize:11, color:C.dim, borderTop:"1px solid "+C.border }}>
          Card ({money(sum.cardSales)}) and mobile ({money(sum.mobileSales)}) are revenue but never reach the drawer,
          so they are not counted here.
        </div>
      </div>
    </div>
  </>);
}

// ── Sales ────────────────────────────────────────────────────────────────────
function Sales({ rows, sum, today, month, isMobile, onAdd, onDel }) {
  const blank = { date: month === today.slice(0,7) ? today : month + "-01", cash:"", card:"", mobile:"", refunds:"", note:"" };
  const [f, setF] = useState(blank);
  const n = v => parseFloat(v) || 0;
  const total = n(f.cash) + n(f.card) + n(f.mobile) - n(f.refunds);
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));

  const submit = () => {
    if (!f.date) return;
    if (!n(f.cash) && !n(f.card) && !n(f.mobile)) return;
    onAdd({ date:f.date, cash:n(f.cash), card:n(f.card), mobile:n(f.mobile), refunds:n(f.refunds), note:f.note.trim() });
    setF(blank);
  };

  return (
    <div style={card}>
      <div style={chead}>💰 Daily sales <span style={{ marginLeft:"auto", fontSize:10.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim }}>{monthLabel(month)} · {money(sum.revenue)}</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1.1fr .8fr .8fr .8fr .8fr 1.3fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={e=>set("date",e.target.value)} /></div>
        <div><label style={lbl}>Cash ৳</label><input type="number" min="0" style={inp} value={f.cash} onChange={e=>set("cash",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Card ৳</label><input type="number" min="0" style={inp} value={f.card} onChange={e=>set("card",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Mobile ৳</label><input type="number" min="0" style={inp} value={f.mobile} onChange={e=>set("mobile",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Refunds ৳</label><input type="number" min="0" style={inp} value={f.refunds} onChange={e=>set("refunds",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Note (optional)</label><input style={inp} value={f.note} onChange={e=>set("note",e.target.value)} placeholder="rainy, slow morning" /></div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
          <button style={btn} onClick={submit}>+ Save day</button>
        </div>
        {total !== 0 && <div style={{ gridColumn:"1/-1", fontSize:12, color:C.dim }}>Day total: <b style={{ ...numF, color:C.green, fontSize:14 }}>{money(total)}</b></div>}
      </div>
      {rows.length === 0 ? <Empty>No sales entered for {monthLabel(month)} yet.</Empty> : (
        <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:640 }}>
          <thead><tr>
            <th style={th}>Date</th><th style={{...th,textAlign:"right"}}>Cash</th><th style={{...th,textAlign:"right"}}>Card</th>
            <th style={{...th,textAlign:"right"}}>Mobile</th><th style={{...th,textAlign:"right"}}>Refunds</th>
            <th style={{...th,textAlign:"right"}}>Total</th><th style={th}>Note</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const t = (r.cash||0)+(r.card||0)+(r.mobile||0)-(r.refunds||0);
              return (
                <tr key={r.id}>
                  <td style={td}>{fmtDate(r.date)}</td>
                  <td style={tdN}>{r.cash ? money(r.cash) : "—"}</td>
                  <td style={tdN}>{r.card ? money(r.card) : "—"}</td>
                  <td style={tdN}>{r.mobile ? money(r.mobile) : "—"}</td>
                  <td style={{ ...tdN, color:r.refunds?C.red:undefined }}>{r.refunds ? "−"+money(r.refunds) : "—"}</td>
                  <td style={{ ...tdN, ...numF }}>{money(t)}</td>
                  <td style={{ ...td, color:C.dim, fontSize:11 }}>{r.note || "—"}</td>
                  <td style={{ ...td, textAlign:"right" }}>
                    <button onClick={()=>onDel(r.id)} title="Delete" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:13 }}>✕</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontWeight:800 }}>Month total</td>
              <td style={{ ...tdN, ...numF }}>{money(sum.cashSales)}</td>
              <td style={{ ...tdN, ...numF }}>{money(sum.cardSales)}</td>
              <td style={{ ...tdN, ...numF }}>{money(sum.mobileSales)}</td>
              <td style={{ ...tdN, ...numF, color:C.red }}>{sum.refunds ? "−"+money(sum.refunds) : "৳0"}</td>
              <td style={{ ...tdN, ...numF, fontSize:14, color:C.green }}>{money(sum.revenue)}</td>
              <td style={td} colSpan={2}></td>
            </tr>
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

// ── Purchases ────────────────────────────────────────────────────────────────
function Purchases({ rows, sum, today, month, isMobile, onAdd, onDel }) {
  const blank = { date: month === today.slice(0,7) ? today : month + "-01", what:"", supplier:"", amount:"", method:"Cash", isStock:true };
  const [f, setF] = useState(blank);
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));
  const submit = () => {
    const amt = parseFloat(f.amount) || 0;
    if (!f.date || !f.what.trim() || amt <= 0) return;
    onAdd({ date:f.date, what:f.what.trim(), supplier:f.supplier.trim(), amount:amt, method:f.method, isStock:!!f.isStock });
    setF({ ...blank, date:f.date, method:f.method });
  };

  return (<>
    <div style={card}>
      <div style={chead}>🛒 Purchases <span style={{ marginLeft:"auto", fontSize:10.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim }}>{monthLabel(month)} · {money(sum.purchasesTotal)}</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1.3fr 1.1fr .9fr 1.3fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={e=>set("date",e.target.value)} /></div>
        <div><label style={lbl}>What</label><input style={inp} value={f.what} onChange={e=>set("what",e.target.value)} placeholder="Coffee beans" /></div>
        <div><label style={lbl}>Supplier (optional)</label><input style={inp} value={f.supplier} onChange={e=>set("supplier",e.target.value)} /></div>
        <div><label style={lbl}>Amount ৳</label><input type="number" min="0" style={inp} value={f.amount} onChange={e=>set("amount",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Paid by</label><PayPicker value={f.method} onChange={v=>set("method",v)} /></div>
        <div style={{ display:"flex", alignItems:"flex-end" }}><button style={btn} onClick={submit}>+ Add</button></div>
        <label style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:9, fontSize:12.5, cursor:"pointer", color:"#2b2b2b" }}>
          <input type="checkbox" checked={f.isStock} onChange={e=>set("isStock",e.target.checked)} style={{ width:16, height:16, accentColor:C.maroon }} />
          <span><b>Counts as stock</b> — it sits on the shelf and will be in the month-end count
            <span style={{ color:C.dim }}> (beans, milk, cups, syrup). Untick for things used up like cleaning liquid.</span></span>
        </label>
      </div>
      {rows.length === 0 ? <Empty>No purchases for {monthLabel(month)} yet.</Empty> : (
        <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:640 }}>
          <thead><tr><th style={th}>Date</th><th style={th}>What</th><th style={th}>Supplier</th><th style={th}>Paid by</th><th style={th}></th><th style={{...th,textAlign:"right"}}>Amount</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={{ ...td, fontWeight:600 }}>{r.what}</td>
                <td style={{ ...td, color:C.dim, fontSize:11 }}>{r.supplier || "—"}</td>
                <td style={td}>{methodPill(r.method)}</td>
                <td style={td}>{r.isStock === false
                  ? <span style={{ fontSize:10.5, color:C.dim }}>not stock</span>
                  : <Pill bg="#fff3d9" color="#7a5c00">counts as stock</Pill>}</td>
                <td style={{ ...tdN, ...numF }}>{money(r.amount)}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  <button onClick={()=>onDel(r.id)} title="Delete" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:13 }}>✕</button>
                </td>
              </tr>
            ))}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontWeight:800 }} colSpan={5}>Total purchases</td>
              <td style={{ ...tdN, ...numF, fontSize:14 }}>{money(sum.purchasesTotal)}</td><td style={td}></td>
            </tr>
          </tbody>
        </table>
        </div>
      )}
    </div>
    <div style={{ background:"#fff8e6", border:"1px solid "+C.gold, borderRadius:9, padding:"10px 13px", fontSize:12, color:"#5c4500", lineHeight:1.55, marginTop:10 }}>
      <b>Why the tick matters.</b> Anything marked <b>counts as stock</b> must also be included when the manager
      counts the shelf at month end — otherwise the app treats it as consumed and the profit comes out too low.
      Things that get used up and never sit on the shelf as sellable stock are safest left unticked; they are
      then counted as a running cost, so no money is ever lost either way.
    </div>
  </>);
}

// ── Expenses ─────────────────────────────────────────────────────────────────
function Expenses({ rows, sum, today, month, isMobile, onAdd, onDel }) {
  const blank = { date: month === today.slice(0,7) ? today : month + "-01", cat:"Rent", desc:"", amount:"", method:"Cash" };
  const [f, setF] = useState(blank);
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));
  const submit = () => {
    const amt = parseFloat(f.amount) || 0;
    if (!f.date || !f.cat || amt <= 0) return;
    onAdd({ date:f.date, cat:f.cat, desc:f.desc.trim(), amount:amt, method:f.method });
    setF({ ...blank, date:f.date, cat:f.cat, method:f.method });
  };
  const logged = rows.reduce((s,r) => s + (r.amount||0), 0);

  return (
    <div style={card}>
      <div style={chead}>💸 Other expenses <span style={{ marginLeft:"auto", fontSize:10.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim }}>{monthLabel(month)} · {money(logged)}</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1.1fr 1.5fr .9fr 1.3fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={e=>set("date",e.target.value)} /></div>
        <div><label style={lbl}>Category</label>
          <select style={inp} value={f.cat} onChange={e=>set("cat",e.target.value)}>
            {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Description</label><input style={inp} value={f.desc} onChange={e=>set("desc",e.target.value)} placeholder="July bill" /></div>
        <div><label style={lbl}>Amount ৳</label><input type="number" min="0" style={inp} value={f.amount} onChange={e=>set("amount",e.target.value)} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Paid by</label><PayPicker value={f.method} onChange={v=>set("method",v)} /></div>
        <div style={{ display:"flex", alignItems:"flex-end" }}><button style={btn} onClick={submit}>+ Add</button></div>
      </div>
      {rows.length === 0 ? <Empty>No expenses for {monthLabel(month)} yet.</Empty> : (
        <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:560 }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Category</th><th style={th}>Description</th><th style={th}>Paid by</th><th style={{...th,textAlign:"right"}}>Amount</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={{ ...td, fontWeight:600 }}>{r.cat}</td>
                <td style={{ ...td, color:C.dim, fontSize:11 }}>{r.desc || "—"}</td>
                <td style={td}>{methodPill(r.method)}</td>
                <td style={{ ...tdN, ...numF }}>{money(r.amount)}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  <button onClick={()=>onDel(r.id)} title="Delete" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:13 }}>✕</button>
                </td>
              </tr>
            ))}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontWeight:800 }} colSpan={4}>Total logged here</td>
              <td style={{ ...tdN, ...numF, fontSize:14 }}>{money(logged)}</td><td style={td}></td>
            </tr>
          </tbody>
        </table>
        </div>
      )}
      {sum.nonStockPurchases > 0 && (
        <div style={{ padding:"10px 13px", fontSize:11.5, color:C.dim, borderTop:"1px solid "+C.border }}>
          Plus {money(sum.nonStockPurchases)} of non-stock purchases from the Purchases screen —
          the dashboard counts {money(sum.otherExpenses)} of other expenses in total.
        </div>
      )}
    </div>
  );
}

// ── Close Month ──────────────────────────────────────────────────────────────
function CloseMonth({ sum, closes, owner, today, month, isMobile, onMonthField, onCount, onOwner, onDelOwner, isFirstMonth }) {
  const [stock, setStock] = useState("");
  const [cash, setCash] = useState("");
  const [countDate, setCountDate] = useState(month === today.slice(0,7) ? today : month + "-01");
  const [ow, setOw] = useState({ date: month === today.slice(0,7) ? today : month + "-01", dir:"out", amount:"", note:"" });
  // On the very first month there is no previous count to carry, so the owner
  // has to be able to type what was on the shelf and in the drawer on day one.
  const [editOpen, setEditOpen] = useState(false);
  const [oStock, setOStock] = useState("");
  const [oCash, setOCash] = useState("");
  const showOpeningEditor = editOpen || (isFirstMonth && sum.openStockAuto && sum.openCashAuto && sum.openStock === 0 && sum.openCash === 0);

  const OpeningEditor = ({ field, value, setValue, onSave, label }) => (
    <div style={{ display:"flex", gap:8, marginBottom:4 }}>
      <input type="number" min="0" style={inp} placeholder={label} value={value}
        onChange={e=>setValue(e.target.value)} onWheel={e=>e.target.blur()} />
      <button style={{ ...btn, background:"#fff", color:C.maroon, border:"1.5px solid "+C.border }}
        onClick={() => { if (value !== "") { onSave(parseFloat(value)||0); setValue(""); setEditOpen(false); } }}>Set</button>
    </div>
  );

  const expectedThatDay = closes.find(c => c.date === countDate);

  return (<>
    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>

      <div style={card}>
        <div style={chead}>📦 Inventory value</div>
        <div style={{ padding:"13px 14px" }}>
          <label style={lbl}>Opening — start of {monthLabel(month)}</label>
          {showOpeningEditor
            ? <OpeningEditor value={oStock} setValue={setOStock} label="value on the shelf on day one"
                onSave={v => onMonthField("openStock", v)} />
            : <div style={{ ...inp, background:"#f4efe2", ...numF, fontSize:15 }}>{money(sum.openStock)}</div>}
          <div style={{ fontSize:11, color:C.dim, margin:"4px 0 14px" }}>
            {showOpeningEditor ? "First month — type what was already on the shelf when you started. After this it carries over on its own."
              : sum.openStockAuto ? "Carried over automatically from the previous month's count. Never typed twice."
              : "Set by hand for this month."}
            {!showOpeningEditor && (
              <button onClick={()=>setEditOpen(true)} style={{ background:"none", border:"none", padding:"0 0 0 5px", color:C.maroon, fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:11, textDecoration:"underline" }}>change</button>
            )}
          </div>
          <label style={lbl}>Closing — the manager counts the shelf</label>
          <div style={{ display:"flex", gap:8 }}>
            <input type="number" min="0" style={inp} placeholder={sum.closeStockSet ? String(sum.closeStock) : "total value on the shelf"}
              value={stock} onChange={e=>setStock(e.target.value)} onWheel={e=>e.target.blur()} />
            <button style={btn} onClick={() => { if (stock !== "") { onMonthField("closeStock", parseFloat(stock)||0); setStock(""); } }}>Save</button>
          </div>
          <div style={{ fontSize:11, color:C.dim, marginTop:5 }}>
            One number — the total value of everything on the shelf. No product list, no quantities.
          </div>
          {sum.closeStockSet && (
            <div style={{ marginTop:11, paddingTop:10, borderTop:"1px solid "+C.border, fontSize:12.5, display:"flex", justifyContent:"space-between" }}>
              <span>Counted <b style={numF}>{money(sum.closeStock)}</b></span>
              <span>Goods used <b style={{ ...numF, color:C.red }}>{money(sum.cogs)}</b></span>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={chead}>💵 Cash count</div>
        <div style={{ padding:"13px 14px" }}>
          <label style={lbl}>Opening cash — start of {monthLabel(month)}</label>
          {showOpeningEditor
            ? <OpeningEditor value={oCash} setValue={setOCash} label="cash in the drawer on day one"
                onSave={v => onMonthField("openCash", v)} />
            : <div style={{ ...inp, background:"#f4efe2", ...numF, fontSize:15 }}>{money(sum.openCash)}</div>}
          <div style={{ fontSize:11, color:C.dim, margin:"4px 0 14px" }}>
            {showOpeningEditor ? "First month — type the cash you started with."
              : sum.openCashAuto ? "Carried over from the previous month's counted drawer." : "Set by hand for this month."}
            {!showOpeningEditor && (
              <button onClick={()=>setEditOpen(true)} style={{ background:"none", border:"none", padding:"0 0 0 5px", color:C.maroon, fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:11, textDecoration:"underline" }}>change</button>
            )}
          </div>
          <label style={lbl}>Count the drawer</label>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input type="date" style={{ ...inp, maxWidth:150 }} value={countDate} onChange={e=>setCountDate(e.target.value)} />
            <input type="number" min="0" style={inp} placeholder="counted" value={cash} onChange={e=>setCash(e.target.value)} onWheel={e=>e.target.blur()} />
            <button style={{ ...btn, background:C.green }} onClick={() => { if (cash !== "") { onCount(countDate, parseFloat(cash)||0); setCash(""); } }}>Save</button>
          </div>
          <div style={{ paddingTop:10, borderTop:"1px solid "+C.border, display:"flex", justifyContent:"space-between", fontSize:12.5, flexWrap:"wrap", gap:8 }}>
            <span>Expected <b style={numF}>{money(sum.expectedCash)}</b></span>
            <span>Counted <b style={numF}>{sum.countedCash === null ? "—" : money(sum.countedCash)}</b></span>
            <span style={{ color:sum.cashDiff ? C.red : C.green }}>
              {sum.cashDiff === null ? "not counted" : sum.cashDiff === 0 ? "matches ✓" : (sum.cashDiff > 0 ? "over " : "short ") + money(Math.abs(sum.cashDiff))}
            </span>
          </div>
          {expectedThatDay && (
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>
              On {fmtDate(countDate)} the drawer should hold {money(expectedThatDay.expected)}.
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Daily closes */}
    <div style={{ ...card, marginTop:12 }}>
      <div style={chead}>🌙 Daily close <span style={{ marginLeft:"auto", fontSize:10.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim }}>which day the money went missing</span></div>
      {closes.length === 0 ? <Empty>No drawer counts yet for {monthLabel(month)}. Counting every evening takes ten seconds and shows exactly which day is short.</Empty> : (
        <table style={{ borderCollapse:"collapse", width:"100%" }}>
          <thead><tr><th style={th}>Date</th><th style={{...th,textAlign:"right"}}>Expected</th><th style={{...th,textAlign:"right"}}>Counted</th><th style={{...th,textAlign:"right"}}>Difference</th><th style={th}></th></tr></thead>
          <tbody>
            {closes.map(c => (
              <tr key={c.date}>
                <td style={td}>{fmtDate(c.date)}</td>
                <td style={{ ...tdN, ...numF }}>{money(c.expected)}</td>
                <td style={{ ...tdN, ...numF }}>{money(c.counted)}</td>
                <td style={{ ...tdN, ...numF, color:c.diff===0?C.green:C.red }}>{c.diff===0?"৳0":signed(c.diff)}</td>
                <td style={{ ...td, fontSize:11, color:c.diff===0?C.green:C.red }}>{c.diff===0?"✓ matched":c.diff>0?"⚠ over":"⚠ short"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Owner money */}
    <div style={{ ...card, marginTop:12 }}>
      <div style={chead}>🤝 Owner money <span style={{ marginLeft:"auto", fontSize:10.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim }}>moves cash, never touches profit</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1.2fr .9fr 1.5fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={ow.date} onChange={e=>setOw(p=>({...p,date:e.target.value}))} /></div>
        <div><label style={lbl}>Direction</label>
          <select style={inp} value={ow.dir} onChange={e=>setOw(p=>({...p,dir:e.target.value}))}>
            <option value="out">Owner took out</option><option value="in">Owner put in</option>
          </select>
        </div>
        <div><label style={lbl}>Amount ৳</label><input type="number" min="0" style={inp} value={ow.amount} onChange={e=>setOw(p=>({...p,amount:e.target.value}))} onWheel={e=>e.target.blur()} /></div>
        <div><label style={lbl}>Note (optional)</label><input style={inp} value={ow.note} onChange={e=>setOw(p=>({...p,note:e.target.value}))} /></div>
        <div style={{ display:"flex", alignItems:"flex-end" }}>
          <button style={btn} onClick={() => {
            const amt = parseFloat(ow.amount)||0;
            if (!ow.date || amt <= 0) return;
            onOwner({ date:ow.date, dir:ow.dir, amount:amt, note:ow.note.trim() });
            setOw(p => ({ ...p, amount:"", note:"" }));
          }}>+ Add</button>
        </div>
      </div>
      {owner.length === 0 ? <Empty>Nothing recorded for {monthLabel(month)}.</Empty> : (
        <table style={{ borderCollapse:"collapse", width:"100%" }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Direction</th><th style={th}>Note</th><th style={{...th,textAlign:"right"}}>Amount</th><th style={th}></th></tr></thead>
          <tbody>
            {owner.map(r => (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={td}>{r.dir === "in"
                  ? <Pill bg="#e8f5ec" color={C.green}>Owner put in</Pill>
                  : <Pill bg="#fdecea" color={C.red}>Owner took out</Pill>}</td>
                <td style={{ ...td, color:C.dim, fontSize:11 }}>{r.note || "—"}</td>
                <td style={{ ...tdN, ...numF, color:r.dir==="in"?C.green:C.red }}>{r.dir==="in" ? "+" : "−"}{money(r.amount)}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  <button onClick={()=>onDelOwner(r.id)} title="Delete" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:13 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ padding:"10px 13px", fontSize:11.5, color:C.dim, borderTop:"1px solid "+C.border }}>
        Owner money changes what is in the drawer but is not a business cost — counting a withdrawal as an
        expense would make a profitable shop look like it is losing money.
      </div>
    </div>
  </>);
}
