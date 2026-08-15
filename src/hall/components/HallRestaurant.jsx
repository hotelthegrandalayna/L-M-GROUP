// Coffee house books. Deliberately small: four sections, no product catalogue,
// no stock quantities. The manager counts the shelf and types one number.
//
// Every figure shown here comes from lib/restaurantMoney.js — nothing is
// computed in this file, so the screen and the tests can never disagree.
//
// EVERY COMPONENT IN THIS FILE IS DECLARED AT MODULE SCOPE. Declared inside a
// parent, a component is a new type on every render, so React throws the input
// away and builds a fresh one after each keystroke — the field loses focus and
// appears to freeze after one character. That bug shipped once.
import { useState, useMemo, useRef } from "react";
import { useHall } from "../HallContext";
import useIsMobile from "../useIsMobile";
import {
  monthSummary, dailyCloses, monthsWithData, prevMonth, nextMonth, emptyRestaurant, normalise,
} from "../lib/restaurantMoney";
import { compressImage, saveReceipt, loadReceipt, newReceiptId, forgetReceiptLocally, MAX_STORED_BYTES } from "../lib/receiptStore";

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b", blue:"#3a6ea5" };

const MONTHS_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * The ONE gate for changing anything already recorded.
 *
 * The manager enters the day's work — sales, what was bought, the drawer count,
 * the shelf count — and none of that goes through here. Correcting or removing
 * something already saved, changing the starting figures, closing the month
 * (which is the owner taking the money out) and clearing the books all do.
 *
 * If a password is ever wanted on top of the role, it goes HERE and every one of
 * those actions is behind it at once. Nothing else has to change.
 */
export function canEdit(role) { return role === "admin"; }

const LockPill = () => <Pill bg="#eef2f7" color={C.blue}>🔒 admin only</Pill>;

const money  = n => "৳" + Math.round(n || 0).toLocaleString();
const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + "৳" + Math.abs(Math.round(n || 0)).toLocaleString();
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const monthLabel = m => { const [y,mo] = String(m).split("-"); return MONTHS_LABEL[parseInt(mo,10)-1] + " " + y; };
const fmtDate = iso => { if (!iso) return "—"; const [y,m,d] = String(iso).split("-");
  return parseInt(d,10) + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m,10)-1]; };
const nid = () => Date.now() + "_" + Math.random().toString(36).slice(2, 7);

// ── shared styles — sized to be read across a counter, not squinted at ───────
const card  = { background:"#fff", border:"1px solid "+C.border, borderRadius:12, overflow:"hidden" };
const chead = { padding:"13px 16px", borderBottom:"1px solid "+C.border, fontSize:12, fontWeight:800, letterSpacing:.9, textTransform:"uppercase", color:C.maroon, display:"flex", alignItems:"center", gap:8 };
const cheadR= { marginLeft:"auto", fontSize:11.5, fontWeight:700, letterSpacing:0, textTransform:"none", color:C.dim };
const inp   = { border:"1.5px solid "+C.border, borderRadius:8, padding:"9px 11px", fontSize:13.5, background:"#fff", fontFamily:"inherit", color:"#2b2b2b", width:"100%" };
const lbl   = { fontSize:10.5, fontWeight:800, letterSpacing:.7, textTransform:"uppercase", color:C.dim, display:"block", marginBottom:5 };
const btn   = { background:C.maroon, color:"#fff", border:"none", borderRadius:8, padding:"10px 17px", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" };
const btnO  = { ...btn, background:"#fff", color:C.maroon, border:"1.5px solid "+C.border };
const btnSm = { padding:"5px 11px", fontSize:12, borderRadius:7 };
const th    = { padding:"11px 16px", textAlign:"left", fontSize:10.5, textTransform:"uppercase", letterSpacing:.8, color:C.dim, fontWeight:800, background:"#fbf8f1", borderBottom:"1px solid "+C.border };
const td    = { padding:"13px 16px", borderBottom:"1px solid #efe6d4", fontSize:14 };
const tdN   = { ...td, textAlign:"right", fontVariantNumeric:"tabular-nums" };
const numF  = { fontFamily:"'Playfair Display',serif", fontWeight:800, fontVariantNumeric:"tabular-nums" };
const formWrap = { display:"grid", gap:11, padding:"15px 16px", background:"#fbf8f1", borderBottom:"1px solid "+C.border };

const Pill = ({ children, bg, color }) => (
  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:bg, color, whiteSpace:"nowrap" }}>{children}</span>
);
const Empty = ({ children }) => (
  <div style={{ padding:"26px 16px", textAlign:"center", color:C.dim, fontSize:13.5 }}>{children}</div>
);

function OpeningEditor({ value, setValue, onSave, label, onDone }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:4 }}>
      <input type="number" min="0" style={inp} placeholder={label} value={value}
        onChange={e=>setValue(e.target.value)} onWheel={e=>e.target.blur()} />
      <button style={btnO} onClick={() => { if (value !== "") { onSave(parseFloat(value)||0); setValue(""); onDone && onDone(); } }}>Set</button>
    </div>
  );
}

// ── Receipt: attach button, thumbnail, full-size viewer ──────────────────────
function ReceiptButton({ onPicked, name, busy }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" style={{ display:"none" }}
        onChange={e => { const f = e.target.files && e.target.files[0]; if (f) onPicked(f); e.target.value = ""; }} />
      <button type="button" style={{ ...btnO, width:"100%", overflow:"hidden", textOverflow:"ellipsis" }}
        onClick={() => ref.current && ref.current.click()} disabled={busy}>
        {busy ? "…" : name ? "🧾 " + (name.length > 14 ? name.slice(0,13) + "…" : name) : "📎 Attach"}
      </button>
    </>
  );
}

function ReceiptViewer({ receipt, onClose }) {
  if (!receipt) return null;
  const isPdf = /^data:application\/pdf/.test(receipt.data || "");
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:12, maxWidth:"92vw", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ ...chead, justifyContent:"space-between" }}>
          <span>🧾 {receipt.name || "Invoice"}</span>
          <button style={{ ...btnO, ...btnSm }} onClick={onClose}>Close</button>
        </div>
        <div style={{ overflow:"auto", padding:10, background:"#f4efe2" }}>
          {isPdf
            ? <object data={receipt.data} type="application/pdf" style={{ width:"80vw", height:"75vh" }}>
                <a href={receipt.data} download={receipt.name || "invoice.pdf"}>Open the PDF</a>
              </object>
            : <img src={receipt.data} alt={receipt.name || "Invoice"} style={{ maxWidth:"88vw", maxHeight:"78vh", display:"block" }} />}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function HallRestaurant() {
  const { restaurant, setRestaurant, curUser, curRole, notify } = useHall();
  const isMobile = useIsMobile();
  const isAdmin = canEdit(curRole);
  const data = useMemo(() => normalise(restaurant || emptyRestaurant()), [restaurant]);

  const today = todayStr();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [tab, setTab] = useState("dash");
  const [viewing, setViewing] = useState(null);

  const sum    = useMemo(() => monthSummary(data, month), [data, month]);
  const closes = useMemo(() => dailyCloses(data, month), [data, month]);
  const known  = useMemo(() => monthsWithData(data), [data]);

  const inMonth = rows => (rows || []).filter(r => String(r.date).slice(0,7) === month)
    .slice().sort((a,b) => String(b.date).localeCompare(String(a.date)));

  // ── writers ───────────────────────────────────────────────────────────────
  const addRow = (key, row) => setRestaurant(p => ({ ...normalise(p), [key]: [...normalise(p)[key], { id:nid(), by:curUser||"", ...row }] }));
  const editRow = (key, id, patch) => {
    if (!isAdmin) { notify("Only an admin can change a saved row", "error"); return; }
    setRestaurant(p => ({ ...normalise(p), [key]: normalise(p)[key].map(r => String(r.id) === String(id) ? { ...r, ...patch } : r) }));
  };
  const delRow = (key, id) => {
    if (!isAdmin) { notify("Only an admin can delete a row", "error"); return; }
    setRestaurant(p => ({ ...normalise(p), [key]: normalise(p)[key].filter(r => String(r.id) !== String(id)) }));
  };
  /** Wipe every Restaurant record. The hall's own books are untouched. */
  const resetAll = () => {
    if (!isAdmin) { notify("Only an admin can clear the records", "error"); return; }
    const ids = data.spend.map(r => r.receiptId).filter(Boolean);
    ids.forEach(forgetReceiptLocally);
    setRestaurant(emptyRestaurant());
    notify("All Restaurant records cleared — starting fresh ✓");
  };
  const setMonthField = (field, value) => setRestaurant(p => {
    const n = normalise(p);
    return { ...n, months: { ...n.months, [month]: { ...(n.months[month]||{}), [field]: value } } };
  });
  const setMonthFields = patch => setRestaurant(p => {
    const n = normalise(p);
    return { ...n, months: { ...n.months, [month]: { ...(n.months[month]||{}), ...patch } } };
  });
  const saveCount = (date, counted) => setRestaurant(p => {
    const n = normalise(p);
    return { ...n, counts: [...n.counts.filter(c => c.date !== date), { date, counted, by:curUser||"" }] };
  });

  const openReceipt = async id => {
    const r = await loadReceipt(id);
    if (r) setViewing(r); else notify("That invoice photo is not on this device yet", "error");
  };

  const SUBS = [
    { id:"dash",  icon:"📊", label:"Dashboard" },
    { id:"sales", icon:"💰", label:"Sales" },
    { id:"spend", icon:"💸", label:"Expenses" },
    { id:"close", icon:"📦", label:"Close Month" },
  ];

  return (
    <div style={{ padding: isMobile ? "12px 12px 30px" : "18px 22px 36px", maxWidth:1500, margin:"0 auto" }}>

      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setTab(s.id)}
            style={{ padding:"10px 18px", borderRadius:9, border:"1.5px solid "+(tab===s.id?C.maroon:C.border),
              background:tab===s.id?C.maroon:"#fff", color:tab===s.id?"#fff":C.dim,
              fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:7 }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14, flexWrap:"wrap" }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ ...btnO, padding:"7px 13px" }}>◀</button>
        <span style={{ ...numF, fontSize:20, color:C.maroon, minWidth:170, textAlign:"center" }}>{monthLabel(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ ...btnO, padding:"7px 13px" }}>▶</button>
        {month !== today.slice(0,7) && (
          <button onClick={() => setMonth(today.slice(0,7))} style={{ ...btnO, padding:"7px 13px", color:C.dim }}>This month</button>
        )}
        {sum.closed && <Pill bg="#eaf6ee" color={C.green}>✓ CLOSED · owner took {money(sum.ownerTook)}</Pill>}
        <span style={{ marginLeft:"auto", fontSize:12, color:C.dim }}>
          {sum.daysEntered} day{sum.daysEntered===1?"":"s"} of sales entered
        </span>
      </div>

      {tab === "dash"  && <Dashboard sum={sum} isMobile={isMobile} onGo={setTab} />}
      {tab === "sales" && <Sales rows={inMonth(data.sales)} sum={sum} today={today} month={month} isMobile={isMobile} isAdmin={isAdmin}
        onAdd={r => { addRow("sales", r); notify("Day saved ✓"); }}
        onEdit={(id,patch) => { editRow("sales", id, patch); notify("Day updated ✓"); }}
        onDel={id => delRow("sales", id)} />}
      {tab === "spend" && <Spend rows={inMonth(data.spend)} sum={sum} today={today} month={month} isMobile={isMobile} isAdmin={isAdmin}
        notify={notify} onView={openReceipt}
        onAdd={r => { addRow("spend", r); notify("Saved ✓"); }}
        onEdit={(id,patch) => { editRow("spend", id, patch); notify("Updated ✓"); }}
        onDel={id => delRow("spend", id)} />}
      {tab === "close" && <CloseMonth sum={sum} closes={closes} owner={inMonth(data.ownerMoves)} today={today} month={month} isMobile={isMobile}
        isAdmin={isAdmin} counts={data} isFirstMonth={known.length === 0 || month <= known[0]}
        onMonthField={setMonthField} onMonthFields={setMonthFields}
        onCount={(d,v) => { saveCount(d,v); notify("Cash count saved ✓"); }}
        onOwner={r => { addRow("ownerMoves", r); notify("Owner money recorded ✓"); }}
        onDelOwner={id => delRow("ownerMoves", id)} onReset={resetAll} notify={notify} />}

      <ReceiptViewer receipt={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Kpi({ label, value, color, sub, accent, tint }) {
  return (
    <div style={{ background:tint||"#fff", border:"1px solid "+C.border, borderLeft:"5px solid "+(accent||C.border), borderRadius:13, padding:"17px 19px" }}>
      <div style={{ fontSize:11.5, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:C.dim }}>{label}</div>
      <div style={{ ...numF, fontSize:33, marginTop:7, lineHeight:1, color }}>{value}</div>
      <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>{sub}</div>
    </div>
  );
}
const RowMain  = ({ label, value, color }) => (
  <tr><td style={td}>{label}</td><td style={{ ...tdN, fontWeight:600, color }}>{value}</td></tr>
);
const RowInset = ({ label, value }) => (
  <tr><td style={{ ...td, background:"#fbf8f1", fontSize:13, color:"#6b6b6b", padding:"9px 18px 9px 34px", borderBottom:"1px solid #f4eddd" }}>{label}</td>
      <td style={{ ...tdN, background:"#fbf8f1", fontSize:13, color:"#6b6b6b", fontWeight:500, padding:"9px 18px", borderBottom:"1px solid #f4eddd" }}>{value}</td></tr>
);
const RowTotal = ({ label, value, color }) => (
  <tr><td style={{ ...td, background:"#f4efe2", fontWeight:800, fontSize:16, borderTop:"2px solid "+C.border, borderBottom:"none" }}>{label}</td>
      <td style={{ ...tdN, background:"#f4efe2", ...numF, fontSize:16, borderTop:"2px solid "+C.border, borderBottom:"none", color }}>{value}</td></tr>
);
const CashTile = ({ label, value, color, tone }) => (
  <div style={{ border:"1.5px solid "+(tone==="good"?"#9ccfae":tone==="bad"?"#e8a49c":C.border), borderRadius:11, padding:14,
    textAlign:"center", background:tone==="good"?"#f1f9f4":tone==="bad"?"#fdf1f0":"#fbf8f1" }}>
    <div style={{ fontSize:11, fontWeight:800, letterSpacing:.8, textTransform:"uppercase", color:C.dim }}>{label}</div>
    <div style={{ ...numF, fontSize:26, marginTop:6, color }}>{value}</div>
  </div>
);

function Dashboard({ sum, isMobile, onGo }) {
  return (<>
    <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:12, marginBottom:14 }}>
      <Kpi label="Revenue" value={money(sum.revenue)} color={C.green} accent={C.green}
        sub={`${sum.daysEntered} day${sum.daysEntered===1?"":"s"} entered`} />
      <Kpi label="Goods used" value={money(sum.cogs)} color={C.red} accent={C.red}
        sub={sum.closeStockSet ? "what you consumed" : "shelf not counted yet"} />
      <Kpi label="Expenses" value={money(sum.otherExpenses)} color={C.red} accent={C.red} sub="rent, salary, bills" />
      <Kpi label="Net profit" value={money(sum.net)} color={sum.net>=0?C.green:C.red}
        accent={sum.net>=0?C.green:C.red} tint={sum.net>=0?"#f6fbf7":"#fdf1f0"} sub="after everything" />
    </div>

    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.3fr 1fr", gap:12 }}>
      <div style={card}>
        <div style={chead}>📈 Profit for the month</div>
        <table style={{ borderCollapse:"collapse", width:"100%", fontSize:15 }}><tbody>
          <RowMain  label="Revenue" value={money(sum.revenue)} color={C.green} />
          <RowInset label="Opening stock" value={money(sum.openStock)} />
          <RowInset label="+ Bought for the shelf" value={money(sum.stockPurchases)} />
          <RowInset label="− Closing stock" value={money(sum.closeStock)} />
          <RowTotal label="− Cost of goods used" value={money(sum.cogs)} color={C.red} />
          <RowTotal label="= Gross profit" value={money(sum.gross)} color={C.green} />
          <RowMain  label="− Other expenses" value={money(sum.otherExpenses)} color={C.red} />
          <tr>
            <td style={{ ...td, background:"linear-gradient(90deg,#eef8f1,#f6fbf7)", fontWeight:800, fontSize:19,
              borderTop:"3px solid #9ccfae", padding:18, borderBottom:"none" }}>Net profit</td>
            <td style={{ ...tdN, background:"linear-gradient(90deg,#eef8f1,#f6fbf7)", ...numF, fontSize:22,
              borderTop:"3px solid #9ccfae", padding:18, borderBottom:"none", color:sum.net>=0?C.green:C.red }}>{money(sum.net)}</td>
          </tr>
        </tbody></table>
        {!sum.closeStockSet && (
          <div style={{ padding:"12px 16px", fontSize:12.5, background:"#fff8e6", borderTop:"1px solid "+C.gold, color:"#5c4500", lineHeight:1.6 }}>
            The shelf has not been counted for this month yet, so nothing counts as consumed and the profit
            above is too high.{" "}
            <button onClick={() => onGo("close")} style={{ background:"none", border:"none", padding:0, color:C.maroon, fontWeight:800, cursor:"pointer", fontFamily:"inherit", fontSize:12.5, textDecoration:"underline" }}>Count it now →</button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={chead}>💵 Cash check</div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, padding:16 }}>
          <CashTile label="Expected" value={money(sum.expectedCash)} />
          <CashTile label="Counted" value={sum.countedCash === null ? "—" : money(sum.countedCash)} />
          <CashTile label={sum.cashDiff === null ? "Difference" : sum.cashDiff === 0 ? "Matches" : sum.cashDiff > 0 ? "Over by" : "Short by"}
            value={sum.cashDiff === null ? "—" : sum.cashDiff === 0 ? "৳0" : signed(sum.cashDiff)}
            color={sum.cashDiff ? C.red : C.green}
            tone={sum.cashDiff === null ? "" : sum.cashDiff === 0 ? "good" : "bad"} />
        </div>
        <table style={{ borderCollapse:"collapse", width:"100%", borderTop:"1px solid "+C.border }}><tbody>
          <RowInset label="Opening cash" value={money(sum.openCash)} />
          <RowInset label="+ Cash taken" value={money(sum.cashSales)} />
          {sum.refunds > 0 && <RowInset label="− Refunds given" value={money(sum.refunds)} />}
          <RowInset label="− Bought & paid out" value={money(sum.cashSpend)} />
          {sum.ownerIn  > 0 && <RowInset label="+ Owner put in" value={money(sum.ownerIn)} />}
          {sum.ownerOut > 0 && <RowInset label="− Owner took out" value={money(sum.ownerOut)} />}
        </tbody></table>
        {sum.countedCash === null && (
          <div style={{ padding:"12px 16px", fontSize:12.5, color:C.dim, borderTop:"1px solid "+C.border }}>
            The drawer has not been counted this month.{" "}
            <button onClick={() => onGo("close")} style={{ background:"none", border:"none", padding:0, color:C.maroon, fontWeight:800, cursor:"pointer", fontFamily:"inherit", fontSize:12.5, textDecoration:"underline" }}>Count it →</button>
          </div>
        )}
      </div>
    </div>
  </>);
}

// ── Sales ────────────────────────────────────────────────────────────────────
function Sales({ rows, sum, today, month, isMobile, isAdmin, onAdd, onEdit, onDel }) {
  const blank = { date: month === today.slice(0,7) ? today : month + "-01", cash:"", refunds:"", note:"" };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [e, setE] = useState({});
  const n = v => parseFloat(v) || 0;
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));

  const submit = () => {
    if (!f.date || !n(f.cash)) return;
    onAdd({ date:f.date, cash:n(f.cash), refunds:n(f.refunds), note:f.note.trim() });
    setF({ ...blank, date:f.date });
  };
  const startEdit = r => { setEditId(r.id); setE({ date:r.date, cash:r.cash ?? "", refunds:r.refunds ?? "", note:r.note || "" }); };
  const saveEdit = () => { onEdit(editId, { date:e.date, cash:n(e.cash), refunds:n(e.refunds), note:(e.note||"").trim() }); setEditId(null); };

  return (
    <div style={card}>
      <div style={chead}>💰 Daily sales <span style={cheadR}>{monthLabel(month)} · {money(sum.revenue)}</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1.1fr 1fr 1fr 1.8fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={ev=>set("date",ev.target.value)} /></div>
        <div><label style={lbl}>Cash taken ৳</label><input type="number" min="0" style={inp} value={f.cash} onChange={ev=>set("cash",ev.target.value)} onWheel={ev=>ev.target.blur()} /></div>
        <div><label style={lbl}>Refunds ৳</label><input type="number" min="0" style={inp} value={f.refunds} onChange={ev=>set("refunds",ev.target.value)} onWheel={ev=>ev.target.blur()} /></div>
        <div><label style={lbl}>Note (optional)</label><input style={inp} value={f.note} onChange={ev=>set("note",ev.target.value)} placeholder="rainy, slow morning" /></div>
        <div style={{ display:"flex", alignItems:"flex-end" }}><button style={btn} onClick={submit}>+ Save day</button></div>
        {(n(f.cash) - n(f.refunds)) !== 0 && (
          <div style={{ gridColumn:"1/-1", fontSize:13 }}>Day total: <b style={{ ...numF, color:C.green, fontSize:16 }}>{money(n(f.cash)-n(f.refunds))}</b></div>
        )}
      </div>
      {rows.length === 0 ? <Empty>No sales entered for {monthLabel(month)} yet.</Empty> : (
        <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:600 }}>
          <thead><tr>
            <th style={th}>Date</th><th style={{...th,textAlign:"right"}}>Cash taken</th>
            <th style={{...th,textAlign:"right"}}>Refunds</th><th style={{...th,textAlign:"right"}}>Total</th>
            <th style={th}>Note</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map(r => editId === r.id ? (
              <tr key={r.id} style={{ background:"#fff8e6" }}>
                <td style={td}><input type="date" style={inp} value={e.date} onChange={ev=>setE(p=>({...p,date:ev.target.value}))} /></td>
                <td style={td}><input type="number" style={{...inp,textAlign:"right"}} value={e.cash} onChange={ev=>setE(p=>({...p,cash:ev.target.value}))} onWheel={ev=>ev.target.blur()} /></td>
                <td style={td}><input type="number" style={{...inp,textAlign:"right"}} value={e.refunds} onChange={ev=>setE(p=>({...p,refunds:ev.target.value}))} onWheel={ev=>ev.target.blur()} /></td>
                <td style={tdN}>—</td>
                <td style={td}><input style={inp} value={e.note} onChange={ev=>setE(p=>({...p,note:ev.target.value}))} /></td>
                <td style={{ ...td, textAlign:"right", whiteSpace:"nowrap" }}>
                  <button style={{ ...btn, ...btnSm, background:C.green }} onClick={saveEdit}>Save</button>{" "}
                  <button style={{ ...btnO, ...btnSm }} onClick={()=>setEditId(null)}>Cancel</button>{" "}
                  <button style={{ ...btnO, ...btnSm, color:C.red, borderColor:"#e8a49c" }} onClick={()=>{ onDel(r.id); setEditId(null); }}>Delete</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={{ ...tdN, ...numF }}>{money(r.cash)}</td>
                <td style={{ ...tdN, color:r.refunds?C.red:undefined }}>{r.refunds ? "−"+money(r.refunds) : "—"}</td>
                <td style={{ ...tdN, ...numF }}>{money((r.cash||0)+(r.card||0)+(r.mobile||0)-(r.refunds||0))}</td>
                <td style={{ ...td, color:C.dim, fontSize:12.5 }}>{r.note || "—"}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  {isAdmin ? <button style={{ ...btnO, ...btnSm }} onClick={()=>startEdit(r)}>✏️ Edit</button> : <LockPill />}
                </td>
              </tr>
            ))}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontWeight:800 }}>Month total</td>
              <td style={{ ...tdN, ...numF }}>{money(sum.cashSales)}</td>
              <td style={{ ...tdN, ...numF, color:C.red }}>{sum.refunds ? "−"+money(sum.refunds) : "৳0"}</td>
              <td style={{ ...tdN, ...numF, fontSize:16, color:C.green }}>{money(sum.revenue)}</td>
              <td style={td} colSpan={2}></td>
            </tr>
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

// ── Expenses (everything the shop spends money on) ───────────────────────────
function Spend({ rows, sum, today, month, isMobile, isAdmin, onAdd, onEdit, onDel, onView, notify }) {
  const blank = { date: month === today.slice(0,7) ? today : month + "-01", what:"", amount:"", isStock:true, receiptId:"", receiptName:"" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [e, setE] = useState({});
  const set = (k,v) => setF(p => ({ ...p, [k]:v }));

  const attach = async (file, apply) => {
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl.length > MAX_STORED_BYTES) {
        notify("That file is too big even after shrinking — try a photo instead of a scan", "error");
        return;
      }
      const id = newReceiptId();
      await saveReceipt(id, dataUrl, file.name);
      apply(id, file.name);
    } catch {
      notify("Could not read that file", "error");
    } finally { setBusy(false); }
  };

  const submit = () => {
    const amt = parseFloat(f.amount) || 0;
    if (!f.date || !f.what.trim() || amt <= 0) return;
    onAdd({ date:f.date, what:f.what.trim(), amount:amt, isStock:!!f.isStock, receiptId:f.receiptId, receiptName:f.receiptName });
    setF({ ...blank, date:f.date, isStock:f.isStock });
  };
  const startEdit = r => { setEditId(r.id); setE({ date:r.date, what:r.what||"", amount:r.amount ?? "", isStock:r.isStock !== false, receiptId:r.receiptId||"", receiptName:r.receiptName||"" }); };
  const saveEdit = () => {
    onEdit(editId, { date:e.date, what:(e.what||"").trim(), amount:parseFloat(e.amount)||0, isStock:!!e.isStock, receiptId:e.receiptId, receiptName:e.receiptName });
    setEditId(null);
  };

  return (<>
    <div style={card}>
      <div style={chead}>💸 Expenses <span style={cheadR}>{monthLabel(month)} · {money(sum.spendTotal)}</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1.1fr 1.8fr 1fr 1.2fr auto" }}>
        <div><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={ev=>set("date",ev.target.value)} /></div>
        <div><label style={lbl}>What</label><input style={inp} value={f.what} onChange={ev=>set("what",ev.target.value)} placeholder="Coffee beans / Rent — August" /></div>
        <div><label style={lbl}>Amount ৳</label><input type="number" min="0" style={inp} value={f.amount} onChange={ev=>set("amount",ev.target.value)} onWheel={ev=>ev.target.blur()} /></div>
        <div><label style={lbl}>Invoice photo</label>
          <ReceiptButton busy={busy} name={f.receiptName}
            onPicked={file => attach(file, (id,name) => setF(p => ({ ...p, receiptId:id, receiptName:name })))} /></div>
        <div style={{ display:"flex", alignItems:"flex-end" }}><button style={btn} onClick={submit}>+ Add</button></div>
        <label style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:9, fontSize:13.5, cursor:"pointer" }}>
          <input type="checkbox" checked={f.isStock} onChange={ev=>set("isStock",ev.target.checked)} style={{ width:17, height:17, accentColor:C.maroon }} />
          <span><b>Goes on the shelf</b> <span style={{ color:C.dim }}>— beans, milk, cups. Untick for rent, salary, electricity, cleaning.</span></span>
        </label>
      </div>
      {rows.length === 0 ? <Empty>Nothing spent in {monthLabel(month)} yet.</Empty> : (
        <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:680 }}>
          <thead><tr>
            <th style={th}>Date</th><th style={th}>What</th><th style={th}>Type</th><th style={th}>Invoice</th>
            <th style={{...th,textAlign:"right"}}>Amount</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map(r => editId === r.id ? (
              <tr key={r.id} style={{ background:"#fff8e6" }}>
                <td style={td}><input type="date" style={inp} value={e.date} onChange={ev=>setE(p=>({...p,date:ev.target.value}))} /></td>
                <td style={td}><input style={inp} value={e.what} onChange={ev=>setE(p=>({...p,what:ev.target.value}))} /></td>
                <td style={td}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, whiteSpace:"nowrap" }}>
                    <input type="checkbox" checked={!!e.isStock} onChange={ev=>setE(p=>({...p,isStock:ev.target.checked}))} style={{ accentColor:C.maroon }} />shelf
                  </label>
                </td>
                <td style={td}><ReceiptButton busy={busy} name={e.receiptName}
                  onPicked={file => attach(file, (id,name) => setE(p => ({ ...p, receiptId:id, receiptName:name })))} /></td>
                <td style={td}><input type="number" style={{...inp,textAlign:"right"}} value={e.amount} onChange={ev=>setE(p=>({...p,amount:ev.target.value}))} onWheel={ev=>ev.target.blur()} /></td>
                <td style={{ ...td, textAlign:"right", whiteSpace:"nowrap" }}>
                  <button style={{ ...btn, ...btnSm, background:C.green }} onClick={saveEdit}>Save</button>{" "}
                  <button style={{ ...btnO, ...btnSm }} onClick={()=>setEditId(null)}>Cancel</button>{" "}
                  <button style={{ ...btnO, ...btnSm, color:C.red, borderColor:"#e8a49c" }} onClick={()=>{ onDel(r.id); setEditId(null); }}>Delete</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={{ ...td, fontWeight:600 }}>{r.what}</td>
                <td style={td}>{r.isStock === false
                  ? <Pill bg="#eef2f7" color={C.blue}>running cost</Pill>
                  : <Pill bg="#fff3d9" color="#7a5c00">shelf</Pill>}</td>
                <td style={td}>{r.receiptId
                  ? <button title={r.receiptName || "View invoice"} onClick={()=>onView(r.receiptId)}
                      style={{ width:36, height:36, borderRadius:7, background:"#f4efe2", border:"1.5px solid "+C.border, cursor:"pointer", fontSize:16 }}>🧾</button>
                  : <span style={{ color:C.dim, fontSize:12.5 }}>—</span>}</td>
                <td style={{ ...tdN, ...numF }}>{money(r.amount)}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  {isAdmin ? <button style={{ ...btnO, ...btnSm }} onClick={()=>startEdit(r)}>✏️ Edit</button> : <LockPill />}
                </td>
              </tr>
            ))}
            <tr style={{ background:"#f4efe2" }}>
              <td style={{ ...td, fontWeight:800 }} colSpan={4}>Total spent
                <span style={{ fontWeight:400, fontSize:12.5, color:C.dim }}> · shelf {money(sum.stockPurchases)} · running {money(sum.otherExpenses)}</span>
              </td>
              <td style={{ ...tdN, ...numF, fontSize:16 }}>{money(sum.spendTotal)}</td><td style={td}></td>
            </tr>
          </tbody>
        </table>
        </div>
      )}
    </div>
    <div style={{ background:"#fff8e6", border:"1px solid "+C.gold, borderRadius:9, padding:"12px 15px", fontSize:12.5, color:"#5c4500", lineHeight:1.6, marginTop:11 }}>
      <b>Why the tick matters.</b> Ticked means it sits on the shelf and must be included when the manager
      counts at month end — otherwise the app treats it as consumed and profit comes out too low. Things that
      get used up and never sit on the shelf as sellable stock are safest left unticked; they are then a
      running cost. Either way the money reaches net profit exactly once.
    </div>
  </>);
}

// ── Close Month ──────────────────────────────────────────────────────────────
function StartingPoint({ sum, month, isMobile, isAdmin, isFirstMonth, onMonthField }) {
  const [open, setOpen] = useState(false);
  const [oStock, setOStock] = useState("");
  const [oCash, setOCash] = useState("");
  const firstRun = isFirstMonth && sum.openStockAuto && sum.openCashAuto && sum.openStock === 0 && sum.openCash === 0;
  const editing = firstRun || open;

  const half = { padding:"18px 20px" };
  const lab  = { fontSize:11, fontWeight:800, letterSpacing:.9, textTransform:"uppercase", color:C.dim };
  const val  = { ...numF, fontSize:30, marginTop:8, lineHeight:1 };
  const src  = { fontSize:12, color:C.dim, marginTop:8 };

  return (
    <div style={{ ...card, marginBottom:12 }}>
      <div style={chead}>🚩 What {monthLabel(month)} started with</div>
      {firstRun && (
        <div style={{ background:"#fff8e6", borderBottom:"1px solid "+C.gold, padding:"12px 20px", fontSize:12.5, color:"#5c4500", lineHeight:1.55 }}>
          This is your first month, so there is nothing to carry over. Tell the app what the shop already had
          on day one — then you never type these again.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr" }}>
        <div style={{ ...half, borderRight:isMobile?"none":"1px solid "+C.border, borderBottom:isMobile?"1px solid "+C.border:"none" }}>
          <div style={lab}>Cash in the drawer</div>
          {editing
            ? <div style={{ marginTop:8 }}><OpeningEditor value={oCash} setValue={setOCash} label="cash on day one"
                onSave={v => onMonthField("openCash", v)} onDone={() => setOpen(false)} /></div>
            : <>
                <div style={val}>{money(sum.openCash)}</div>
                <div style={src}>{sum.openCashAuto
                  ? <><span style={{ color:C.gold, fontWeight:800 }}>←</span> what {monthLabel(prevMonth(month))} left behind after the owner took their money</>
                  : "set by hand"}</div>
              </>}
        </div>
        <div style={half}>
          <div style={lab}>Value on the shelf</div>
          {editing
            ? <div style={{ marginTop:8 }}><OpeningEditor value={oStock} setValue={setOStock} label="shelf value on day one"
                onSave={v => onMonthField("openStock", v)} onDone={() => setOpen(false)} /></div>
            : <>
                <div style={val}>{money(sum.openStock)}</div>
                <div style={src}>{sum.openStockAuto
                  ? <><span style={{ color:C.gold, fontWeight:800 }}>←</span> the shelf count from the end of {monthLabel(prevMonth(month))}</>
                  : "set by hand"}</div>
              </>}
        </div>
      </div>
      {!firstRun && (
        <div style={{ padding:"11px 20px", borderTop:"1px solid "+C.border, fontSize:12.5, color:C.dim, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          Both carry over on their own — you never type them.
          {isAdmin
            ? <button style={{ ...btnO, ...btnSm, marginLeft:"auto" }} onClick={()=>setOpen(o=>!o)}>{open ? "Done" : "✏️ Set by hand"}</button>
            : <span style={{ marginLeft:"auto" }}><LockPill /></span>}
        </div>
      )}
    </div>
  );
}

function DangerZone({ data, isMobile, onReset }) {
  const [typed, setTyped] = useState("");
  const counts = {
    "Days of sales": data.sales.length,
    "Things bought and spent": data.spend.length,
    "Owner money records": data.ownerMoves.length,
    "Drawer counts": data.counts.length,
    "Invoice photos": data.spend.filter(r => r.receiptId).length,
  };
  const total = data.sales.length + data.spend.length + data.ownerMoves.length + data.counts.length + Object.keys(data.months).length;
  const armed = typed.trim().toUpperCase() === "DELETE" && total > 0;

  return (
    <div style={{ border:"1.5px solid #e8a49c", borderRadius:12, overflow:"hidden", background:"#fff", marginTop:12 }}>
      <div style={{ background:"#fdf1f0", padding:"13px 16px", borderBottom:"1px solid #e8a49c", fontSize:12, fontWeight:800, letterSpacing:.9, textTransform:"uppercase", color:C.red }}>
        ⚠ Start fresh
      </div>
      <div style={{ padding:16 }}>
        <div style={{ fontSize:13.5, lineHeight:1.6, marginBottom:14 }}>
          Deletes <b>every</b> Restaurant record — all sales, everything spent, owner money, drawer counts,
          shelf counts and closed months. The hall's own invoices, expenses and CRM are not touched.
        </div>
        <table style={{ borderCollapse:"collapse", width:"100%", border:"1px solid "+C.border, borderRadius:8, marginBottom:14 }}><tbody>
          {Object.entries(counts).map(([k,v]) => (
            <tr key={k}><td style={{ ...td, fontSize:13 }}>{k}</td><td style={{ ...tdN, ...numF, fontSize:13 }}>{v}</td></tr>
          ))}
          <tr style={{ background:"#fdf1f0" }}>
            <td style={{ ...td, fontWeight:800, borderBottom:"none" }}>Will be deleted</td>
            <td style={{ ...tdN, ...numF, fontWeight:800, color:C.red, borderBottom:"none" }}>{total} record{total===1?"":"s"}</td>
          </tr>
        </tbody></table>
        {total === 0 ? (
          <div style={{ fontSize:13, color:C.dim }}>There is nothing to clear — the books are already empty.</div>
        ) : (<>
          <div style={{ fontSize:13, marginBottom:7 }}>Type <b>DELETE</b> to confirm.</div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <input style={{ ...inp, maxWidth:220 }} placeholder="type DELETE" value={typed} onChange={e=>setTyped(e.target.value)} />
            <button disabled={!armed} onClick={() => { onReset(); setTyped(""); }}
              style={{ ...btn, background:C.red, opacity:armed?1:.4, cursor:armed?"pointer":"not-allowed" }}>
              Delete all Restaurant records
            </button>
            <span style={{ fontSize:12, color:C.dim }}>Cannot be undone.</span>
          </div>
        </>)}
      </div>
    </div>
  );
}

function CloseMonth({ sum, closes, owner, today, month, isMobile, isAdmin, counts, onMonthField, onMonthFields, onCount, onOwner, onDelOwner, onReset, isFirstMonth, notify }) {
  const [stock, setStock] = useState("");
  const [cash, setCash] = useState("");
  const [countDate, setCountDate] = useState(month === today.slice(0,7) ? today : month + "-01");
  const [ow, setOw] = useState({ date: month === today.slice(0,7) ? today : month + "-01", dir:"out", amount:"", note:"" });
  const [took, setTook] = useState("");

  const tookNum = parseFloat(took);
  const takeAmount = Number.isFinite(tookNum) ? tookNum : 0;
  const leaves = sum.inDrawer - takeAmount;

  const doClose = () => {
    // Closing is the owner taking the month's money out, so it is theirs alone.
    if (!isAdmin) { notify("Only an admin can close the month", "error"); return; }
    if (takeAmount < 0 || takeAmount > sum.inDrawer) { notify("The owner cannot take more than is in the drawer", "error"); return; }
    onMonthFields({ closed:true, ownerTook:takeAmount, closedAt:new Date().toISOString() });
    setTook("");
    notify(`${monthLabel(month)} closed · ${money(leaves)} carries into ${monthLabel(nextMonth(month))} ✓`);
  };
  const reopen = () => {
    if (!isAdmin) { notify("Only an admin can reopen a month", "error"); return; }
    onMonthFields({ closed:false, ownerTook:0, closedAt:"" });
    notify(`${monthLabel(month)} reopened`);
  };

  return (<>
    <StartingPoint sum={sum} month={month} isMobile={isMobile} isAdmin={isAdmin}
      isFirstMonth={isFirstMonth} onMonthField={onMonthField} />

    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>

      <div style={card}>
        <div style={chead}>📦 Count the shelf <span style={cheadR}>end of {monthLabel(month)}</span></div>
        <div style={{ padding:"15px 16px" }}>
          <label style={lbl}>Total value of everything on the shelf</label>
          <div style={{ display:"flex", gap:8 }}>
            <input type="number" min="0" style={inp} placeholder={sum.closeStockSet ? String(sum.closeStock) : "total value on the shelf"}
              value={stock} onChange={e=>setStock(e.target.value)} onWheel={e=>e.target.blur()} />
            <button style={btn} onClick={() => { if (stock !== "") { onMonthField("closeStock", parseFloat(stock)||0); setStock(""); } }}>Save</button>
          </div>
          <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>One number. No product list, no quantities.</div>
          {sum.closeStockSet && (
            <div style={{ marginTop:13, paddingTop:12, borderTop:"1px solid "+C.border, fontSize:13.5, display:"flex", justifyContent:"space-between" }}>
              <span>Counted <b style={numF}>{money(sum.closeStock)}</b></span>
              <span>Goods used <b style={{ ...numF, color:C.red }}>{money(sum.cogs)}</b></span>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={chead}>💵 Count the drawer</div>
        <div style={{ padding:"15px 16px" }}>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input type="date" style={{ ...inp, maxWidth:160 }} value={countDate} onChange={e=>setCountDate(e.target.value)} />
            <input type="number" min="0" style={inp} placeholder="counted" value={cash} onChange={e=>setCash(e.target.value)} onWheel={e=>e.target.blur()} />
            <button style={{ ...btn, background:C.green }} onClick={() => { if (cash !== "") { onCount(countDate, parseFloat(cash)||0); setCash(""); } }}>Save</button>
          </div>
          <div style={{ paddingTop:12, borderTop:"1px solid "+C.border, display:"flex", justifyContent:"space-between", fontSize:13.5, flexWrap:"wrap", gap:8 }}>
            <span>Expected <b style={numF}>{money(sum.expectedCash)}</b></span>
            <span>Counted <b style={numF}>{sum.countedCash === null ? "—" : money(sum.countedCash)}</b></span>
            <span style={{ color:sum.cashDiff ? C.red : C.green, fontWeight:700 }}>
              {sum.cashDiff === null ? "not counted" : sum.cashDiff === 0 ? "matches ✓" : (sum.cashDiff > 0 ? "over " : "short ") + money(Math.abs(sum.cashDiff))}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Finish the month */}
    <div style={{ ...card, marginTop:12, borderColor: sum.closed ? "#9ccfae" : C.border }}>
      <div style={chead}>🏁 Finish {monthLabel(month)}
        {sum.closed && <span style={cheadR}><Pill bg="#eaf6ee" color={C.green}>✓ CLOSED</Pill></span>}
      </div>
      {sum.closed ? (
        <div style={{ padding:"15px 16px" }}>
          <table style={{ borderCollapse:"collapse", width:"100%" }}><tbody>
            <RowMain label="Cash in the drawer at the end" value={money(sum.inDrawer)} />
            <RowMain label="Owner took" value={money(sum.ownerTook)} color={C.red} />
            <RowTotal label={`Opened ${monthLabel(nextMonth(month))} with`} value={money(sum.carriesForward)} color={C.green} />
          </tbody></table>
          <div style={{ marginTop:13, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {isAdmin
              ? <><button style={btnO} onClick={reopen}>Reopen the month</button>
                  <span style={{ fontSize:12, color:C.dim }}>Use this if the month was closed too early.</span></>
              : <><LockPill /><span style={{ fontSize:12, color:C.dim }}>Only an admin can reopen a closed month.</span></>}
          </div>
        </div>
      ) : (
        <div style={{ padding:"15px 16px" }}>
          <table style={{ borderCollapse:"collapse", width:"100%" }}><tbody>
            <RowMain label={sum.countedCash === null ? "Expected in the drawer (not counted yet)" : "Cash counted in the drawer"} value={money(sum.inDrawer)} />
            {isAdmin && (
              <tr>
                <td style={td}>Owner takes</td>
                <td style={{ ...tdN, paddingTop:8, paddingBottom:8 }}>
                  <input type="number" min="0" max={sum.inDrawer} style={{ ...inp, maxWidth:170, textAlign:"right", display:"inline-block" }}
                    placeholder="0" value={took} onChange={e=>setTook(e.target.value)} onWheel={e=>e.target.blur()} />
                </td>
              </tr>
            )}
            {isAdmin && (
              <RowTotal label={`Stays in the shop → opening cash for ${monthLabel(nextMonth(month))}`}
                value={money(leaves)} color={leaves >= 0 ? C.green : C.red} />
            )}
          </tbody></table>
          <div style={{ marginTop:13, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {isAdmin
              ? <><button style={{ ...btn, background:C.green }} onClick={doClose}>✓ Close {monthLabel(month)} — month complete</button>
                  <span style={{ fontSize:12, color:C.dim }}>Records what the owner took and carries the rest forward on its own.</span></>
              : <><LockPill /><span style={{ fontSize:12, color:C.dim }}>
                  Count the shelf and the drawer above — the admin closes the month and takes the money.</span></>}
          </div>
          {isAdmin && sum.countedCash === null && (
            <div style={{ marginTop:11, fontSize:12.5, color:"#5c4500", background:"#fff8e6", border:"1px solid "+C.gold, borderRadius:8, padding:"10px 13px", lineHeight:1.6 }}>
              Count the drawer first. Without a count this uses the expected figure, and any cash that went
              missing during the month would be carried into next month as if it were still there.
            </div>
          )}
        </div>
      )}
    </div>

    {/* Daily closes */}
    <div style={{ ...card, marginTop:12 }}>
      <div style={chead}>🌙 Daily close <span style={cheadR}>which day the money went missing</span></div>
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
                <td style={{ ...td, fontSize:12.5, color:c.diff===0?C.green:C.red }}>{c.diff===0?"✓ matched":c.diff>0?"⚠ over":"⚠ short"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Owner money */}
    <div style={{ ...card, marginTop:12 }}>
      <div style={chead}>🤝 Owner money <span style={cheadR}>moves cash, never touches profit</span></div>
      <div style={{ ...formWrap, gridTemplateColumns:isMobile?"1fr 1fr":"1.1fr 1.3fr 1fr 1.7fr auto" }}>
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
                <td style={{ ...td, color:C.dim, fontSize:12.5 }}>{r.note || "—"}</td>
                <td style={{ ...tdN, ...numF, color:r.dir==="in"?C.green:C.red }}>{r.dir==="in" ? "+" : "−"}{money(r.amount)}</td>
                <td style={{ ...td, textAlign:"right" }}>
                  {isAdmin
                    ? <button style={{ ...btnO, ...btnSm, color:C.red, borderColor:"#e8a49c" }} onClick={()=>onDelOwner(r.id)}>Delete</button>
                    : <LockPill />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ padding:"12px 16px", fontSize:12.5, color:C.dim, borderTop:"1px solid "+C.border, lineHeight:1.6 }}>
        Money taken during the month goes here. What the owner takes when the month is finished goes in the
        box above — that is what sets next month's opening cash.
      </div>
    </div>

    {/* Kept last on the page, well away from anything pressed daily. */}
    {isAdmin && <DangerZone data={counts} isMobile={isMobile} onReset={onReset} />}
  </>);
}
