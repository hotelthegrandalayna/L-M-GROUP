
import { useState, useMemo, useRef } from "react";
import { useHall, EXP_CATS, PERSONAL_CATS, checkHallAdminPass } from "../HallContext";
import useIsMobile from "../useIsMobile";

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b" };

const PAY_METHODS = [
  { v:"Cash",          i:"💵" },
  { v:"bKash",         i:"📱" },
  { v:"Nagad",         i:"📲" },
  { v:"Bank Transfer", i:"🏦" },
  { v:"Cheque",        i:"📄" },
];

const EXP_CAT_OPTIONS = [
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
  { v:"Donation",       l:"🤲 Donation" },
  { v:"Personal Salary",l:"💼 Personal Salary" },
  { v:"Personal Other", l:"👤 Personal Other" },
  { v:"Other",          l:"📌 Other" },
];

const MONTHS_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`;
}

const blankForm = (today) => ({
  type:"public", cat:"", date:today, amount:"", desc:"",
  payMethod:"Cash", empName:"", empRole:"", payPeriod:"",
  billNo:"", billPeriod:"", fileData:"", fileName:"",
});

export default function HallExpenses() {
  const { expenses, setExpenses, deleteExpense, curRole, notify } = useHall();
  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm]       = useState(() => blankForm(today));
  const [editId, setEditId]   = useState(null);
  const [errors, setErrors]   = useState({});
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => today.slice(0, 7));
  const [delTarget, setDelTarget] = useState(null);
  const [delPass, setDelPass] = useState("");
  const fileRef = useRef();

  const setF = (k,v) => setForm(p => ({ ...p, [k]:v }));

  // ── Stats ────────────────────────────────────────────────────────────────────
  const isAdmin = curRole === "admin";
  const publicExp  = expenses.filter(e => !PERSONAL_CATS.includes(e.cat));
  const thisMonthExp = publicExp.filter(e => (e.date||"").startsWith(today.slice(0,7)));
  const totalAll   = publicExp.reduce((s,e)=>s+(e.amount||0),0);
  const totalMonth = thisMonthExp.reduce((s,e)=>s+(e.amount||0),0);

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = isAdmin ? [...expenses] : expenses.filter(e => !PERSONAL_CATS.includes(e.cat));
    if (search) list = list.filter(e => (e.cat||"").toLowerCase().includes(search.toLowerCase()) || (e.desc||"").toLowerCase().includes(search.toLowerCase()) || (e.empName||"").toLowerCase().includes(search.toLowerCase()));
    if (filterCat)   list = list.filter(e => e.cat === filterCat);
    if (filterMonth) list = list.filter(e => (e.date||"").startsWith(filterMonth));
    return list.slice().reverse();
  }, [expenses, search, filterCat, filterMonth, isAdmin]);

  const filteredTotal = filtered.reduce((s,e)=>s+(e.amount||0),0);

  const topCat = useMemo(() => {
    const m = {};
    filtered.forEach(e => { m[e.cat] = (m[e.cat]||0)+(e.amount||0); });
    const top = Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
    return top ? top[0] : "—";
  }, [filtered]);

  // All months in expenses for dropdown
  const allMonths = useMemo(() => {
    const s = new Set(expenses.map(e=>(e.date||"").slice(0,7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [expenses]);

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
      setExpenses(prev => prev.map(e => e.id===editId ? { ...e, ...rec } : e));
      notify("Expense updated", "success");
    } else {
      setExpenses(prev => [...prev, { id: String(Date.now()), ...rec }]);
      notify("Expense saved!", "success");
    }
    clearForm();
  }

  function startEdit(e) {
    setForm({
      type: e.expType||"public", cat: e.cat||"", date: e.date||today,
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
    deleteExpense(delTarget.id);
    notify("Expense deleted","success");
    setDelTarget(null);
  }

  function exportCSV() {
    const headers = ["Date","Category","Description","Amount","Payment","Employee","Type"];
    const rows = filtered.map(e => [e.date,e.cat,e.desc,e.amount,e.payMethod,e.empName,e.expType].map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`));
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="expenses.csv"; a.click();
  }

  const inp = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #e5e3de", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fafaf9", width:"100%", boxSizing:"border-box", outline:"none", ...s });
  const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };
  const errT = { fontSize:11, color:C.red, marginTop:3 };

  const isSalary = form.cat === "Salary" || form.cat === "Personal Salary";
  const isBill   = form.cat === "Electricity" || form.cat === "Internet";

  const cd = form.cat ? (EXP_CATS[form.cat]||EXP_CATS["Other"]) : null;

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1100, margin:"0 auto", width:"100%" }}>

      {/* ── Page title ── */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.maroon }}>Hall Expenses</div>
        <div style={{ fontSize:12, color:C.dim, marginTop:4 }}>Track all running costs — salaries, utilities, supplies &amp; more.</div>
      </div>

      {/* ── Stat bar ── */}
      <div className="hall-stat-grid" style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          ["Total Expenses", "৳"+filteredTotal.toLocaleString(), C.red],
          ["No. of Records", filtered.length, C.maroon],
          ["Top Category",   topCat !== "undefined" ? topCat : "—", C.dim],
          ["Month", filterMonth ? new Date(filterMonth+"-01").toLocaleString("en-GB",{month:"long",year:"numeric"}) : "All Time", C.navy||"#1e3a5f"],
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"15px 17px" }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:C.dim, marginBottom:8 }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Inline form card ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.maroon}`, borderRadius:12, padding:"20px 22px", marginBottom:18 }}>

        {/* Form header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
          <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", fontWeight:700, color:"#fff", background:C.maroon, padding:"5px 12px", borderRadius:7 }}>
            ➕ {editId ? "Edit Expense" : "Record New Expense"}
          </div>
        </div>

        {/* Hall / Personal toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 13px", background:form.type==="public"?"#fdf0cc":"#fafaf9", border:`1.5px solid ${form.type==="public"?C.gold+"80":"#e5e3de"}`, borderRadius:8, cursor:"pointer", fontSize:12, color:form.type==="public"?C.gold:C.dim, fontWeight:700 }}>
            <input type="radio" name="expType" value="public" checked={form.type==="public"} onChange={()=>setF("type","public")} style={{ accentColor:C.gold }} />
            🏢 Hall Expense
          </label>
          {isAdmin && (
            <label style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 13px", background:form.type==="personal"?"#f5f0ff":"#fafaf9", border:`1.5px solid ${form.type==="personal"?"#9370db40":"#e5e3de"}`, borderRadius:8, cursor:"pointer", fontSize:12, color:form.type==="personal"?"#6c3483":C.dim, fontWeight:700 }}>
              <input type="radio" name="expType" value="personal" checked={form.type==="personal"} onChange={()=>setF("type","personal")} style={{ accentColor:"#9370db" }} />
              🔒 Personal
            </label>
          )}
        </div>
        {form.type==="personal" && (
          <div style={{ background:"#f0e8ff", border:"1.5px solid #d2b4de", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#6c3483", marginBottom:12 }}>
            🔒 Personal costs are only visible to <strong>Admin</strong>.
          </div>
        )}

        {/* Main fields row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
          <div>
            <label style={lbl}>Category *</label>
            <select value={form.cat} onChange={e=>setF("cat",e.target.value)} style={inp(errors.cat?{borderColor:C.red}:{})}>
              <option value="">— Select —</option>
              {EXP_CAT_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
            <div><label style={lbl}>Employee Name</label><input value={form.empName} onChange={e=>setF("empName",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Role</label><input value={form.empRole} onChange={e=>setF("empRole",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Pay Period</label><input value={form.payPeriod} onChange={e=>setF("payPeriod",e.target.value)} placeholder="e.g. May 2026" style={inp()} /></div>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
          <div><label style={lbl}>Description</label><input value={form.desc} onChange={e=>setF("desc",e.target.value)} style={inp()} /></div>
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={form.payMethod} onChange={e=>setF("payMethod",e.target.value)} style={inp()}>
              {PAY_METHODS.map(p=><option key={p.v} value={p.v}>{p.i} {p.v}</option>)}
            </select>
          </div>
        </div>

        {/* File attachment */}
        <div style={{ background:"#fafaf8", border:"1.5px dashed #e0d0b0", borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:C.gold, marginBottom:9, fontWeight:700 }}>📎 Attach Invoice / Receipt</div>
          <div className="hall-filter-bar" style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
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

        {/* Actions */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={clearForm} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>Cancel</button>
          <button onClick={saveExpense} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>
            💾 {editId ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="hall-filter-bar" style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...inp(), flex:1, minWidth:160 }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...inp(), maxWidth:220 }}>
          <option value="">All Categories</option>
          {EXP_CAT_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ ...inp(), maxWidth:180 }}>
          <option value="">All Months</option>
          {allMonths.map(m=>{
            const [y,mo]=m.split("-");
            return <option key={m} value={m}>{MONTHS_LABEL[parseInt(mo)-1]} {y}</option>;
          })}
        </select>
        <button onClick={exportCSV} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>⬇ CSV</button>
      </div>

      {/* ── Expenses table ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:620 }}>
          <thead>
            <tr style={{ background:"#fafaf8" }}>
              {["Date","Category","Description","Amount","Payment","Receipt","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:"center", padding:28, color:C.dim, fontSize:13 }}>No expenses found.</td></tr>
            ) : filtered.map(e => {
              const cd = EXP_CATS[e.cat]||EXP_CATS["Other"];
              return (
                <tr key={e.id} style={{ borderBottom:"1px solid #f0ede8" }}>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    <div style={{ fontWeight:700 }}>{fmtDate(e.date)}</div>
                    {e.payPeriod && <div style={{ fontSize:10, color:C.dim }}>{e.payPeriod}</div>}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:28, height:28, borderRadius:7, background:cd.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{cd.i}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:12 }}>{e.cat}</div>
                        {e.empName && <div style={{ fontSize:10, color:C.dim }}>{e.empName}{e.empRole?" · "+e.empRole:""}</div>}
                        {e.expType==="personal" && <span style={{ fontSize:9, fontWeight:700, color:"#6c3483", background:"#f0e8ff", padding:"1px 5px", borderRadius:4 }}>Personal</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:C.dim }}>{e.desc || "—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:800, color:C.red, fontFamily:"'Playfair Display',serif", fontSize:14 }}>৳{(e.amount||0).toLocaleString()}</div>
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
