const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Expenses.jsx';

const code = `import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, maxId } from "../utils/helpers";

const CATEGORIES = ["Food & Beverage","Maintenance","Utilities","Salaries","Supplies","Marketing","Transport","Miscellaneous"];

const CAT_ICONS = {
  "Food & Beverage": "ti-bowl",
  "Maintenance":     "ti-tool",
  "Utilities":       "ti-bolt",
  "Salaries":        "ti-users",
  "Supplies":        "ti-package",
  "Marketing":       "ti-speakerphone",
  "Transport":       "ti-car",
  "Miscellaneous":   "ti-dots-circle-horizontal",
};

const CAT_COLORS = {
  "Food & Beverage": "#f97316",
  "Maintenance":     "#8b5cf6",
  "Utilities":       "#3b82f6",
  "Salaries":        "#10b981",
  "Supplies":        "#ec4899",
  "Marketing":       "#f59e0b",
  "Transport":       "#06b6d4",
  "Miscellaneous":   "#6b7280",
};

function ExpenseModal({ expense, onClose }) {
  const { expenses, updateExpenses, notify, curUser } = useApp();
  const e = expense;
  const [cat,  setCat]  = useState(e.category || "Miscellaneous");
  const [amt,  setAmt]  = useState(e.amount || 0);
  const [date, setDate] = useState(e.date || todayStr());
  const [note, setNote] = useState(e.note || "");
  const [mtd,  setMtd]  = useState(e.method || "Cash");

  function save() {
    const a = parseFloat(amt) || 0;
    if (a <= 0) { notify("Enter a valid amount", "error"); return; }
    if (!date)  { notify("Date required", "error"); return; }
    const updated = { ...e, category: cat, amount: a, date, note: note.trim(), method: mtd, by: curUser || "staff" };
    if (e.id) {
      updateExpenses(expenses.map(x => x.id === e.id ? updated : x));
      notify("Expense updated", "success");
    } else {
      updateExpenses([...expenses, { ...updated, id: maxId(expenses), createdAt: new Date().toISOString() }]);
      notify("Expense added", "success");
    }
    onClose();
  }

  function del() {
    if (!window.confirm("Delete this expense?")) return;
    updateExpenses(expenses.filter(x => x.id !== e.id));
    notify("Expense deleted", "success");
    onClose();
  }

  return (
    <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:440 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-receipt" style={{ color:"var(--gold)" }} /> {e.id ? "Edit Expense" : "Add Expense"}</div>
            {e.id && <div className="modal-sub">Entry #{e.id}</div>}
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="form-group">
          <label>Category</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginTop:4 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                padding:"8px 4px", borderRadius:8, border:"1.5px solid", cursor:"pointer", textAlign:"center",
                background: cat===c ? CAT_COLORS[c]+"22" : "transparent",
                borderColor: cat===c ? CAT_COLORS[c] : "var(--border)",
                color: cat===c ? CAT_COLORS[c] : "var(--text3)",
                fontSize:10, fontWeight:700, lineHeight:1.3,
              }}>
                <i className={"ti "+(CAT_ICONS[c]||"ti-tag")} style={{ display:"block", fontSize:16, marginBottom:2 }} />
                {c.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Amount (BDT) *</label>
            <input type="number" value={amt} min="0" onChange={e => setAmt(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Payment Method</label>
          <select value={mtd} onChange={e => setMtd(e.target.value)}>
            {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Description / Note</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What was this expense for?" />
        </div>

        <div className="modal-actions">
          {e.id && <button className="btn danger" style={{ marginRight:"auto" }} onClick={del}><i className="ti ti-trash" /> Delete</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}><i className="ti ti-device-floppy" /> {e.id ? "Update" : "Add Expense"}</button>
        </div>
      </div>
    </div>
  );
}

const PERIODS = [
  { key:"today",  label:"Today" },
  { key:"week",   label:"This Week" },
  { key:"month",  label:"This Month" },
  { key:"all",    label:"All Time" },
];

export default function Expenses() {
  const { expenses } = useApp();
  const today = todayStr();
  const [period, setPeriod] = useState("month");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  function inPeriod(e) {
    if (period === "all") return true;
    const d = e.date;
    if (period === "today") return d === today;
    if (period === "week") {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      return d >= w.toISOString().split("T")[0] && d <= today;
    }
    if (period === "month") return d.startsWith(today.slice(0,7));
    return true;
  }

  const filtered = useMemo(() => {
    let arr = expenses.filter(inPeriod);
    if (catFilter !== "all") arr = arr.filter(e => e.category === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(e => e.note?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q));
    }
    arr.sort((a,b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase(), vb = (vb||"").toLowerCase();
      if (va < vb) return sortDir==="asc" ? -1 : 1;
      if (va > vb) return sortDir==="asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [expenses, period, catFilter, search, sortKey, sortDir]);

  const total = filtered.reduce((s,e) => s+e.amount, 0);

  const byCategory = CATEGORIES.map(c => ({
    cat: c,
    amt: filtered.filter(e => e.category===c).reduce((s,e)=>s+e.amount,0),
    cnt: filtered.filter(e => e.category===c).length,
  })).filter(x => x.amt > 0).sort((a,b) => b.amt-a.amt);

  function toggleSort(key) {
    if (sortKey===key) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }) {
    if (sortKey!==k) return <i className="ti ti-selector" style={{ opacity:.3, fontSize:11 }} />;
    return <i className={"ti ti-sort-"+(sortDir==="asc"?"ascending":"descending")+"-letters"} style={{ fontSize:11, color:"var(--gold2)" }} />;
  }

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Expenses</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{expenses.length} total entries</div>
        </div>
        <button className="btn primary" onClick={() => setModal({})}>
          <i className="ti ti-plus" /> Add Expense
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding:"6px 14px", borderRadius:20, border:"1.5px solid", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all .15s",
            background: period===p.key ? "var(--navy)" : "transparent",
            color:      period===p.key ? "#fff" : "var(--text3)",
            borderColor: period===p.key ? "var(--navy)" : "var(--border)",
          }}>{p.label}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:18, marginBottom:18 }}>
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:"1 1 180px" }}>
              <i className="ti ti-search" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:14 }} />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes or category..." style={{ paddingLeft:32, width:"100%", boxSizing:"border-box" }} />
            </div>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ flex:"0 0 160px" }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            {(search||catFilter!=="all") && <button className="btn sm" onClick={()=>{setSearch("");setCatFilter("all");}}>Clear</button>}
          </div>

          <div className="panel" style={{ padding:0, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
                  {[["date","Date",100],["category","Category",160],["amount","Amount",110],["method","Method",110],["note","Description",null],["","",70]].map(([k,l,w]) => (
                    <th key={l} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, textTransform:"uppercase",
                      letterSpacing:.5, width:w||undefined, whiteSpace:"nowrap", cursor:k?"pointer":"default" }}
                      onClick={() => k && toggleSort(k)}>
                      {l} {k && <SortIcon k={k} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:"center", padding:28, color:"var(--text3)" }}>No expenses found</td></tr>
                )}
                {filtered.map((e,i) => (
                  <tr key={e.id} style={{ borderBottom:"1px solid var(--border)", background: i%2===0?"":"var(--panel-alt)", cursor:"pointer" }}
                    onClick={() => setModal(e)}>
                    <td style={{ padding:"10px 12px", color:"var(--text3)", fontSize:12 }}>{e.date}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 8px", borderRadius:10,
                        fontSize:11, fontWeight:700, background:(CAT_COLORS[e.category]||"#888")+"18", color:CAT_COLORS[e.category]||"#888" }}>
                        <i className={"ti "+(CAT_ICONS[e.category]||"ti-tag")} style={{ fontSize:11 }} />{e.category}
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"var(--red)" }}>{money(e.amount)}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"var(--text3)" }}>{e.method||"Cash"}</td>
                    <td style={{ padding:"10px 12px", color:"var(--text2)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.note||"-"}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <button className="btn sm" onClick={ev=>{ev.stopPropagation();setModal(e);}} style={{ fontSize:11 }}>
                        <i className="ti ti-pencil" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12, color:"var(--text3)" }}>
            <span><i className="ti ti-list" /> {filtered.length} entries</span>
            <span style={{ fontWeight:700, color:"var(--red)" }}><i className="ti ti-currency-taka" /> Total: {money(total)}</span>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-chart-donut" /> By Category</div></div>
            {byCategory.length === 0 && <div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:14 }}>No data</div>}
            {byCategory.map(x => (
              <div key={x.cat} style={{ padding:"8px 14px", borderBottom:"1px solid var(--border)", cursor:"pointer" }}
                onClick={() => setCatFilter(catFilter===x.cat?"all":x.cat)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5, color:CAT_COLORS[x.cat]||"#888" }}>
                    <i className={"ti "+(CAT_ICONS[x.cat]||"ti-tag")} />{x.cat}
                  </span>
                  <span style={{ fontSize:12, fontWeight:800, color:"var(--red)" }}>{money(x.amt)}</span>
                </div>
                <div style={{ height:4, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:CAT_COLORS[x.cat]||"#888", width: total>0?(x.amt/total*100)+"%":"0%", borderRadius:3, transition:"width .4s" }} />
                </div>
                <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{x.cnt} entries &bull; {total>0?Math.round(x.amt/total*100):0}%</div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-calendar-stats" /> Summary</div></div>
            <div style={{ padding:"10px 14px" }}>
              {[
                ["Period Total", money(total), "var(--red)"],
                ["Entries",      filtered.length, "var(--navy)"],
                ["Avg/Entry",    filtered.length ? money(Math.round(total/filtered.length)) : money(0), "var(--text2)"],
                ["Largest",      filtered.length ? money(Math.max(...filtered.map(e=>e.amount))) : money(0), "var(--red)"],
              ].map(([l,v,c]) => (
                <div key={l} className="pl-row">
                  <span>{l}</span><span style={{ fontWeight:700, color:c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal !== null && <ExpenseModal expense={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
