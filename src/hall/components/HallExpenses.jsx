
import { useState, useMemo, useRef } from "react";
import { useHall, EXP_CATS, checkHallAdminPass, invBilled, invCollected, invOutstanding, invInMonth, sumBy, expenseType } from "../HallContext";
import useIsMobile from "../useIsMobile";
import CostAnalysis from "../../components/CostAnalysis";

// Emoji per category for the cost analysis panel (EXP_CATS icons + non-business cats)
const HALL_CAT_EMOJI = {
  ...Object.fromEntries(Object.entries(EXP_CATS).map(([k,v]) => [k, v.i])),
  "Bank Transfer":"🏦", "Owner Withdrawal":"💸", "Lending":"🤝", "Personal Use":"👤", "Other Transfer":"📌",
};

// Expense types are stored in Supabase app_config (key "hall_exp_types") via
// HallContext — synced to all devices. No local storage dependency here.
const resolveType = expenseType;

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b", orange:"#e67e22", navy:"#1e3a5f" };

const PAY_METHODS = [
  { v:"Cash",          i:"💵" },
  { v:"bKash",         i:"📱" },
  { v:"Nagad",         i:"📲" },
  { v:"Bank Transfer", i:"🏦" },
  { v:"Cheque",        i:"📄" },
];

const BUSINESS_CAT_OPTIONS = [
  { v:"Salary",         l:"👤 Employee Salary" },
  { v:"Electricity",    l:"⚡ Electricity" },
  { v:"Generator Oil",  l:"🛢️ Generator Oil" },
  { v:"Internet",       l:"🌐 Internet/Phone" },
  { v:"Food & Kitchen", l:"🍳 Food & Kitchen" },
  { v:"Cleaning",       l:"🧹 Cleaning" },
  { v:"Maintenance",    l:"🔧 Maintenance" },
  { v:"Equipment",      l:"📦 Equipment" },
  { v:"Security",       l:"🔐 Security" },
  { v:"Marketing",      l:"📣 Marketing" },
  { v:"Tax",            l:"📋 Tax" },
  { v:"Other",          l:"📌 Other" },
];

const NONBUSINESS_CAT_OPTIONS = [
  { v:"Bank Transfer",      l:"🏦 Bank Transfer" },
  { v:"Owner Withdrawal",   l:"💸 Owner Withdrawal" },
  { v:"Donation",           l:"🤲 Donation" },
  { v:"Lending",            l:"🤝 Lending / Loan Given" },
  { v:"Personal Use",       l:"👤 Owner Personal Use" },
  { v:"Other Transfer",     l:"📌 Other" },
];

const MONTHS_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`;
}

function money(n) { return "৳" + (n||0).toLocaleString(); }

const blankForm = (today) => ({
  type:"business", cat:"", date:today, amount:"", desc:"",
  payMethod:"Cash", empName:"", empRole:"", payPeriod:"",
  billNo:"", billPeriod:"", fileData:"", fileName:"",
});

export default function HallExpenses() {
  const { expenses, setExpenses, deleteExpense, expTypes, setExpenseType, removeExpenseType, invoices, curRole, notify } = useHall();
  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0,7);

  const [form, setForm]       = useState(() => blankForm(today));
  const [editId, setEditId]   = useState(null);
  const [errors, setErrors]   = useState({});
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterType, setFilterType] = useState(""); // "" | "business" | "nonbusiness"
  const [filterMonth, setFilterMonth] = useState(() => thisMonth);
  const [delTarget, setDelTarget] = useState(null);
  const [delPass, setDelPass] = useState("");
  const [showRecords, setShowRecords] = useState(false);
  const fileRef = useRef();

  // Types come from HallContext (Supabase-synced) — reactive, no local copy
  const typesMap = expTypes;

  const setF = (k,v) => setForm(p => ({ ...p, [k]:v }));
  const isAdmin = curRole === "admin";

  // ── Normalize expenses — use separate typesMap so Supabase reloads don't wipe type
  const normalizedExpenses = useMemo(() => expenses.map(e => ({
    ...e, expType: resolveType(e, typesMap),
  })), [expenses, typesMap]);

  // ── Billing row — same shared formulas as Invoice History ────────────────────
  const { monthBilled, monthRevenue, monthOutstanding } = useMemo(() => {
    const m = filterMonth || thisMonth;
    const monthInv = invoices.filter(inv => invInMonth(inv, m));
    return {
      monthBilled:      sumBy(monthInv, invBilled),
      monthRevenue:     sumBy(monthInv, invCollected),
      monthOutstanding: sumBy(monthInv, invOutstanding),
    };
  }, [invoices, filterMonth, thisMonth]);

  // ── Expense stats ─────────────────────────────────────────────────────────────
  const { businessTotal, nonBusinessTotal } = useMemo(() => {
    const mExp = normalizedExpenses.filter(e => (e.date||"").startsWith(filterMonth || thisMonth));
    return {
      businessTotal:    mExp.filter(e => e.expType === "business").reduce((s,e) => s+(e.amount||0), 0),
      nonBusinessTotal: mExp.filter(e => e.expType === "nonbusiness").reduce((s,e) => s+(e.amount||0), 0),
    };
  }, [normalizedExpenses, filterMonth, thisMonth]);

  const netProfit   = monthRevenue - businessTotal;
  const cashInHand  = monthRevenue - businessTotal - nonBusinessTotal;

  // ── Cost analysis inputs — business expenses only, normalized to {cat, amount, date}
  const allBizItems = useMemo(() =>
    normalizedExpenses.filter(e => e.expType === "business")
      .map(e => ({ cat: e.cat, amount: e.amount, date: e.date })),
  [normalizedExpenses]);
  const monthBizItems = useMemo(() =>
    allBizItems.filter(e => (e.date||"").startsWith(filterMonth || thisMonth)),
  [allBizItems, filterMonth, thisMonth]);

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...normalizedExpenses];
    if (search)      list = list.filter(e => (e.cat||"").toLowerCase().includes(search.toLowerCase()) || (e.desc||"").toLowerCase().includes(search.toLowerCase()) || (e.empName||"").toLowerCase().includes(search.toLowerCase()));
    if (filterCat)   list = list.filter(e => e.cat === filterCat);
    if (filterType)  list = list.filter(e => e.expType === filterType);
    if (filterMonth) list = list.filter(e => (e.date||"").startsWith(filterMonth));
    return list.slice().reverse();
  }, [normalizedExpenses, search, filterCat, filterType, filterMonth]);

  const filteredTotal = filtered.reduce((s,e)=>s+(e.amount||0),0);

  const topCat = useMemo(() => {
    const m = {};
    filtered.forEach(e => { m[e.cat] = (m[e.cat]||0)+(e.amount||0); });
    const top = Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
    return top ? top[0] : "—";
  }, [filtered]);

  const allMonths = useMemo(() => {
    const s = new Set([
      ...normalizedExpenses.map(e=>(e.date||"").slice(0,7)),
      ...invoices.map(i=>(i.evDate||i.invDate||"").slice(0,7)),
      thisMonth,
    ].filter(Boolean));
    return [...s].sort().reverse();
  }, [normalizedExpenses, invoices, thisMonth]);

  // ── Current category options based on type ───────────────────────────────────
  const catOptions = form.type === "nonbusiness" ? NONBUSINESS_CAT_OPTIONS : BUSINESS_CAT_OPTIONS;

  // ── Form actions ─────────────────────────────────────────────────────────────
  function clearForm() {
    setForm(blankForm(today));
    setEditId(null);
    setErrors({});
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setF("fileData", ev.target.result);
    reader.readAsDataURL(file);
    setF("fileName", file.name);
  }

  function clearFile() {
    setF("fileData",""); setF("fileName","");
    if (fileRef.current) fileRef.current.value="";
  }

  function saveExpense() {
    const errs = {};
    if (!form.cat) errs.cat = "Category is required.";
    if (!form.date) errs.date = "Date is required.";
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Enter valid amount.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const rec = {
      cat: form.cat, date: form.date, amount: parseFloat(form.amount),
      desc: form.desc, payMethod: form.payMethod,
      expType: form.type,
      empName: form.empName, empRole: form.empRole, payPeriod: form.payPeriod,
      billNo: form.billNo, billPeriod: form.billPeriod,
      fileData: form.fileData, fileName: form.fileName,
    };

    if (editId) {
      setExpenseType(editId, form.type);
      setExpenses(prev => prev.map(e => e.id===editId ? { ...e, ...rec } : e));
      notify("Expense updated", "success");
    } else {
      const newId = String(Date.now());
      setExpenseType(newId, form.type);
      setExpenses(prev => [...prev, { id: newId, ...rec }]);
      notify("Expense saved!", "success");
    }
    clearForm();
  }

  function startEdit(e) {
    const type = resolveType(e, typesMap);
    setForm({
      type, cat: e.cat||"", date: e.date||today,
      amount: String(e.amount||""), desc: e.desc||"", payMethod: e.payMethod||"Cash",
      empName: e.empName||"", empRole: e.empRole||"", payPeriod: e.payPeriod||"",
      billNo: e.billNo||"", billPeriod: e.billPeriod||"",
      fileData: e.fileData||"", fileName: e.fileName||"",
    });
    setEditId(e.id);
    setErrors({});
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  function confirmDelete() {
    if (!checkHallAdminPass(delPass)) { notify("Incorrect password","error"); return; }
    removeExpenseType(delTarget.id);
    deleteExpense(delTarget.id);
    notify("Expense deleted","success");
    setDelTarget(null);
  }

  function exportCSV() {
    const headers = ["Date","Type","Category","Description","Amount","Payment","Employee"];
    const rows = filtered.map(e => [e.date,e.expType,e.cat,e.desc,e.amount,e.payMethod,e.empName].map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`));
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="expenses.csv"; a.click();
  }

  const inp = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #e5e3de", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fff", width:"100%", boxSizing:"border-box", outline:"none", ...s });
  const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };
  const errT = { fontSize:11, color:C.red, marginTop:3 };

  const isSalary = form.cat === "Salary";
  const isBill   = form.cat === "Electricity" || form.cat === "Internet";
  const isNonBusiness = form.type === "nonbusiness";

  const monthLabel = filterMonth
    ? new Date(filterMonth+"-01").toLocaleString("en-GB",{month:"long",year:"numeric"})
    : "All Time";

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1100, margin:"0 auto", width:"100%" }}>

      {/* ── Page title + month selector (synced with the filter bar below) ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:10, marginBottom:18 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.maroon }}>Expenses & Cash</div>
          <div style={{ fontSize:12, color:C.dim, marginTop:4 }}>Money overview — {monthLabel}</div>
        </div>
        <div>
          <label style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:.8, display:"block", marginBottom:4 }}>📅 Report Month</label>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            style={{ padding:"9px 14px", border:`2px solid ${C.maroon}`, borderRadius:9, fontSize:13, fontWeight:700, fontFamily:"inherit", background:"#fff", color:C.maroon, cursor:"pointer", outline:"none" }}>
            <option value="">All Months</option>
            {allMonths.map(m=>{
              const [y,mo]=m.split("-");
              return <option key={m} value={m}>{MONTHS_LABEL[parseInt(mo)-1]} {y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* ── Row 1: Billing (same formulas as Invoice History) ── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr 1fr":"repeat(3,1fr)", gap:12, marginBottom:12 }}>
        {[
          ["💰","Total Billed", monthBilled, "#7d6608", "#fdf8ee", "#f0e0b0"],
          ["✅","Collected",    monthRevenue, "#1a7040", "#f0fdf4", "#86efac"],
          ["⏳","Outstanding",  monthOutstanding, "#c0392b", "#fff5f5", "#fca5a5"],
        ].map(([icon,label,val,color,bg,border])=>(
          <div key={label} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:"14px 16px", textAlign:"center" }}>
            <div style={{ fontSize:18 }}>{icon}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color }}>{money(val)}</div>
            <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Profit and cash ── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:12, marginBottom:20 }}>

        {/* Business Expenses */}
        <div style={{ background:"#fff5f5", border:"1.5px solid #fca5a5", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:C.red, marginBottom:6 }}>🏢 Business Expenses</div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:C.red }}>{money(businessTotal)}</div>
          <div style={{ fontSize:11, color:C.red, marginTop:4, opacity:.7 }}>Salary, utilities, ops</div>
        </div>

        {/* Non-Business Expenses */}
        <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:C.orange, marginBottom:6 }}>💸 Non-Business</div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:C.orange }}>{money(nonBusinessTotal)}</div>
          <div style={{ fontSize:11, color:C.orange, marginTop:4, opacity:.7 }}>Transfers, withdrawals</div>
        </div>

        {/* Net Profit */}
        <div style={{ background: netProfit >= 0 ? "#f0fdf4":"#fff5f5", border:`1.5px solid ${netProfit>=0?"#86efac":"#fca5a5"}`, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:netProfit>=0?C.green:C.red, marginBottom:6 }}>📊 Net Profit</div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:netProfit>=0?C.green:C.red }}>{money(netProfit)}</div>
          <div style={{ fontSize:11, color:C.dim, marginTop:4, opacity:.7 }}>Collected − Business Exp.</div>
        </div>

        {/* Cash in Hand */}
        <div style={{ background: cashInHand >= 0 ? "#fffbeb":"#fff5f5", border:`1.5px solid ${cashInHand>=0?"#fcd34d":"#fca5a5"}`, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:cashInHand>=0?C.gold:C.red, marginBottom:6 }}>💰 Cash in Hand</div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:cashInHand>=0?C.gold:C.red }}>{money(cashInHand)}</div>
          <div style={{ fontSize:11, color:C.dim, marginTop:4, opacity:.7 }}>After all expenses & transfers</div>
        </div>

      </div>

      {/* ── Cost analysis — where did the money go? ── */}
      <CostAnalysis
        items={monthBizItems}
        allItems={allBizItems}
        monthKey={filterMonth || thisMonth}
        monthLabel={monthLabel}
        catEmoji={HALL_CAT_EMOJI}
        accent={C.maroon}
        onPickCategory={cat => { setFilterCat(prev => prev === cat ? "" : cat); setShowRecords(true); }}
      />

      {/* ── Record Expense Form — whole panel tints with the selected type ── */}
      <div style={{ background: isNonBusiness ? "#ffe3c4" : "#f6d7d7", border:`3px solid ${isNonBusiness?C.orange:C.maroon}`, borderRadius:12, padding:"20px 22px", marginBottom:18, transition:"all .2s" }}>

        {editId && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", fontWeight:700, color:"#fff", background:isNonBusiness?C.orange:C.maroon, padding:"5px 12px", borderRadius:7 }}>
              ✏️ Editing Expense
            </div>
          </div>
        )}

        {/* Business / Non-Business toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <button type="button" onClick={()=>{ setF("type","business"); setF("cat",""); }}
            style={{ flex:1, padding:"12px 10px", borderRadius:10, border:`2px solid ${form.type==="business"?C.maroon:"#e5e3de"}`,
              background:form.type==="business"?"#7B1212":"#fff",
              color:form.type==="business"?"#fff":C.dim,
              cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13, transition:"all .15s" }}>
            🏢 Business Expense
            <div style={{ fontSize:10, fontWeight:500, marginTop:3, opacity:.85 }}>Affects profit &amp; cash</div>
          </button>
          <button type="button" onClick={()=>{ setF("type","nonbusiness"); setF("cat",""); }}
            style={{ flex:1, padding:"12px 10px", borderRadius:10, border:`2px solid ${form.type==="nonbusiness"?C.orange:"#e5e3de"}`,
              background:form.type==="nonbusiness"?"#e67e22":"#fff",
              color:form.type==="nonbusiness"?"#fff":C.dim,
              cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13, transition:"all .15s" }}>
            💸 Non-Business Transfer
            <div style={{ fontSize:10, fontWeight:500, marginTop:3, opacity:.85 }}>Affects cash only</div>
          </button>
        </div>

        {/* Info banner */}
        <div style={{ background: isNonBusiness?"#fff7ed":"#fdf8ee", border:`1.5px solid ${isNonBusiness?"#fed7aa":"#f0e0b0"}`, borderRadius:8, padding:"8px 13px", fontSize:11, color: isNonBusiness?C.orange:C.gold, marginBottom:14, fontWeight:600 }}>
          {isNonBusiness
            ? "💸 Non-business transfers (bank, donation, lending, owner use) reduce cash in hand but do NOT affect profit."
            : "🏢 Business expenses (salary, electricity, supplies) reduce both profit and cash in hand."}
        </div>

        {/* Main fields */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
          <div>
            <label style={lbl}>Category *</label>
            <select value={form.cat} onChange={e=>setF("cat",e.target.value)} style={inp(errors.cat?{borderColor:C.red}:{})}>
              <option value="">— Select —</option>
              {catOptions.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            {errors.cat && <div style={errT}>{errors.cat}</div>}
          </div>
          <div>
            <label style={lbl}>Date *</label>
            <input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={inp(errors.date?{borderColor:C.red}:{})} />
            {errors.date && <div style={errT}>{errors.date}</div>}
          </div>
          <div>
            <label style={lbl}>Amount (৳) *</label>
            <input type="number" value={form.amount} onChange={e=>setF("amount",e.target.value)} placeholder="0" min="0" style={inp(errors.amount?{borderColor:C.red}:{})} />
            {errors.amount && <div style={errT}>{errors.amount}</div>}
          </div>
        </div>

        {/* Salary extra fields */}
        {isSalary && (
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
            <div><label style={lbl}>Employee Name</label><input value={form.empName} onChange={e=>setF("empName",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Role</label><input value={form.empRole} onChange={e=>setF("empRole",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Pay Period</label><input value={form.payPeriod} onChange={e=>setF("payPeriod",e.target.value)} placeholder="e.g. July 2026" style={inp()} /></div>
          </div>
        )}

        {/* Bill extra fields */}
        {isBill && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
            <div><label style={lbl}>Bill / Account No</label><input value={form.billNo} onChange={e=>setF("billNo",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Billing Period</label><input value={form.billPeriod} onChange={e=>setF("billPeriod",e.target.value)} style={inp()} /></div>
          </div>
        )}

        {/* Description + Payment */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:12 }}>
          <div><label style={lbl}>Description / Note</label><input value={form.desc} onChange={e=>setF("desc",e.target.value)} placeholder="Optional details..." style={inp()} /></div>
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={form.payMethod} onChange={e=>setF("payMethod",e.target.value)} style={inp()}>
              {PAY_METHODS.map(p=><option key={p.v} value={p.v}>{p.i} {p.v}</option>)}
            </select>
          </div>
        </div>

        {/* File attachment */}
        <div style={{ background:"#fff", border:"1.5px dashed #e0d0b0", borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:C.gold, marginBottom:9, fontWeight:700 }}>📎 Attach Invoice / Receipt</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <label htmlFor="expFile" style={{ display:"inline-block", padding:"7px 13px", background:"#f0ede8", border:`1.5px solid ${C.gold}80`, borderRadius:8, cursor:"pointer", fontSize:11, color:C.gold, fontWeight:600 }}>
              📁 Choose File
            </label>
            <input id="expFile" type="file" ref={fileRef} accept="image/*,.pdf" onChange={handleFile} style={{ display:"none" }} />
            <span style={{ fontSize:11, color:C.dim }}>{form.fileName || "No file chosen"}</span>
            {form.fileName && (
              <button onClick={clearFile} style={{ padding:"4px 9px", background:"transparent", border:`1.5px solid ${C.red}`, borderRadius:6, color:C.red, fontSize:10, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>✕ Remove</button>
            )}
          </div>
          {form.fileData && form.fileData.startsWith("data:image") && (
            <img src={form.fileData} alt="receipt" style={{ maxWidth:180, maxHeight:120, borderRadius:8, border:`1.5px solid ${C.border}`, marginTop:8 }} />
          )}
          {form.fileData && form.fileData.startsWith("data:application/pdf") && (
            <div style={{ marginTop:8, padding:"7px 11px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:11, color:C.dim }}>📄 PDF attached: {form.fileName}</div>
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={clearForm} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>Cancel</button>
          <button onClick={saveExpense} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:isNonBusiness?C.orange:C.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>
            💾 {editId ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>

      {/* ── Collapsible records section ── */}
      <button onClick={()=>setShowRecords(v=>!v)} style={{
        width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"14px 18px", marginBottom:12, borderRadius:12, cursor:"pointer",
        border:`1.5px solid ${C.border}`, background:"#fff", fontFamily:"inherit" }}>
        <span style={{ fontSize:14, fontWeight:800, color:C.maroon }}>📋 All Expense Records ({filtered.length}) · {money(filteredTotal)}</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.dim }}>{showRecords ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {showRecords && (<>
      {/* ── Filter bar ── */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...inp(), flex:1, minWidth:140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...inp(), maxWidth:190 }}>
          <option value="">All Types</option>
          <option value="business">🏢 Business</option>
          <option value="nonbusiness">💸 Non-Business</option>
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...inp(), maxWidth:200 }}>
          <option value="">All Categories</option>
          {[...BUSINESS_CAT_OPTIONS,...NONBUSINESS_CAT_OPTIONS].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ ...inp(), maxWidth:170 }}>
          <option value="">All Months</option>
          {allMonths.map(m=>{
            const [y,mo]=m.split("-");
            return <option key={m} value={m}>{MONTHS_LABEL[parseInt(mo)-1]} {y}</option>;
          })}
        </select>
        <button onClick={exportCSV} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>⬇ CSV</button>
      </div>

      {/* ── Filtered total bar ── */}
      <div style={{ display:"flex", gap:12, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:12, color:C.dim }}>
          <strong style={{ color:"#333" }}>{filtered.length}</strong> records &nbsp;·&nbsp;
          Total: <strong style={{ color:C.red }}>{money(filteredTotal)}</strong>
        </div>
      </div>

      {/* ── Expenses table ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
          <thead>
            <tr style={{ background:"#fafaf8" }}>
              {["Date","Type","Category","Description","Amount","Payment","Receipt","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:C.dim, fontSize:13 }}>No expenses found.</td></tr>
            ) : filtered.map(e => {
              const isBiz = e.expType === "business";
              const cd = EXP_CATS[e.cat] || EXP_CATS["Other"];
              return (
                <tr key={e.id} style={{ borderBottom:"1px solid #f0ede8" }}>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    <div style={{ fontWeight:700 }}>{fmtDate(e.date)}</div>
                    {e.payPeriod && <div style={{ fontSize:10, color:C.dim }}>{e.payPeriod}</div>}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:6,
                      background: isBiz?"#fee2e2":"#fff7ed",
                      color: isBiz?C.red:C.orange, whiteSpace:"nowrap" }}>
                      {isBiz ? "🏢 Business" : "💸 Non-Business"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:28, height:28, borderRadius:7, background:cd?.bg||"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{cd?.i||"📌"}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:12 }}>{e.cat}</div>
                        {e.empName && <div style={{ fontSize:10, color:C.dim }}>{e.empName}{e.empRole?" · "+e.empRole:""}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:C.dim }}>{e.desc || "—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:800, color:isBiz?C.red:C.orange, fontFamily:"'Playfair Display',serif", fontSize:14 }}>৳{(e.amount||0).toLocaleString()}</div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>{e.payMethod || "Cash"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    {e.fileData && e.fileData.startsWith("data:image") ? (
                      <img src={e.fileData} alt="receipt" onClick={()=>window.open(e.fileData)} style={{ width:36, height:36, borderRadius:6, objectFit:"cover", cursor:"pointer", border:`1px solid ${C.border}` }} title="Click to view" />
                    ) : e.fileData ? (
                      <button onClick={()=>window.open(e.fileData)} style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:"#fafaf8", cursor:"pointer" }}>📄 PDF</button>
                    ) : <span style={{ color:"#ccc", fontSize:11 }}>—</span>}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {isAdmin && <button onClick={()=>startEdit(e)} style={{ padding:"4px 8px", borderRadius:7, border:"1.5px solid #ddd", background:"#fff", cursor:"pointer", fontSize:12 }}>✏️</button>}
                      {isAdmin && <button onClick={()=>{setDelTarget(e);setDelPass("");}} style={{ padding:"4px 8px", borderRadius:7, border:`1.5px solid ${C.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:12 }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}

      {/* ── Delete confirm modal ── */}
      {delTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setDelTarget(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.maroon, marginBottom:12 }}>🗑 Delete Expense</div>
            <div style={{ fontSize:13, marginBottom:14, color:C.dim }}>
              Delete <strong>{delTarget.cat}</strong> · ৳{(delTarget.amount||0).toLocaleString()} on {fmtDate(delTarget.date)}?
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Admin Password *</label>
              <input type="password" value={delPass} onChange={e=>setDelPass(e.target.value)} placeholder="Enter admin password" style={inp()} />
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>setDelTarget(null)} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800 }}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
