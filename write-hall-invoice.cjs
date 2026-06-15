const fs = require('fs');
const base = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/hall/components';

// ── HallExpenses.jsx ─────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallExpenses.jsx', `
import { useState, useMemo } from "react";
import { useHall, EXP_CATS, PERSONAL_CATS, checkHallAdminPass } from "../HallContext";

const PERIODS = [
  { label:"Today",      fn:(d,t) => d === t },
  { label:"This Week",  fn:(d,t) => { const n=new Date(t),s=new Date(n); s.setDate(n.getDate()-6); return d>=s.toISOString().slice(0,10)&&d<=t; } },
  { label:"This Month", fn:(d,t) => d.startsWith(t.slice(0,7)) },
  { label:"All Time",   fn:()    => true },
];

export default function HallExpenses() {
  const { expenses, setExpenses, curRole, notify } = useHall();
  const today = new Date().toISOString().split("T")[0];
  const [period, setPeriod] = useState(2);
  const [showPersonal, setShowPersonal] = useState(false);
  const [modal, setModal] = useState(null); // null | "add" | expense-obj
  const [cat,  setCat]  = useState("Salary");
  const [amt,  setAmt]  = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [delPass, setDelPass] = useState("");
  const [delTarget, setDelTarget] = useState(null);

  const fn = PERIODS[period].fn;
  const filtered = useMemo(() => expenses.filter(e => {
    if (!fn(e.date||"", today)) return false;
    if (!showPersonal && PERSONAL_CATS.includes(e.cat)) return false;
    return true;
  }), [expenses, period, showPersonal, today]);

  const totalAmt = filtered.reduce((s,e) => s+e.amount, 0);
  const byCat = useMemo(() => {
    const m = {};
    filtered.forEach(e => { m[e.cat] = (m[e.cat]||0) + e.amount; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [filtered]);

  function openAdd() {
    if (modal && modal !== "add") return;
    setCat("Salary"); setAmt(0); setDate(today); setNote("");
    setModal("add");
  }
  function openEdit(e) { setCat(e.cat); setAmt(e.amount); setDate(e.date); setNote(e.note||""); setModal(e); }

  function save() {
    const a = parseFloat(amt)||0;
    if (a <= 0) { notify("Enter valid amount","error"); return; }
    if (modal === "add") {
      const id = String(Date.now());
      setExpenses(prev => [...prev, { id, cat, amount:a, date, note:note.trim() }]);
      notify("Expense added","success");
    } else {
      setExpenses(prev => prev.map(e => e.id === modal.id ? { ...e, cat, amount:a, date, note:note.trim() } : e));
      notify("Expense updated","success");
    }
    setModal(null);
  }

  function startDelete(e) { setDelTarget(e); setDelPass(""); }
  function confirmDelete() {
    if (curRole !== "admin") { notify("Admin only","error"); return; }
    if (!checkHallAdminPass(delPass)) { notify("Incorrect password","error"); return; }
    setExpenses(prev => prev.filter(e => e.id !== delTarget.id));
    notify("Expense deleted","success");
    setDelTarget(null);
  }

  const catList = Object.keys(EXP_CATS);

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <div>
          <div style={{ fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Expenses</div>
          <div style={{ fontSize:12,color:"var(--text3)" }}>{filtered.length} entries · ৳{totalAmt.toLocaleString()}</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
          <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer" }}>
            <input type="checkbox" checked={showPersonal} onChange={e=>setShowPersonal(e.target.checked)} />
            Show Personal
          </label>
          <div style={{ display:"flex",gap:2 }}>
            {PERIODS.map((p,i) => (
              <button key={p.label} onClick={()=>setPeriod(i)} style={{ padding:"6px 11px",fontSize:11,fontWeight:700,borderRadius:7,border:"1.5px solid var(--border)",background:period===i?"var(--navy)":"transparent",color:period===i?"var(--gold)":"var(--text2)",cursor:"pointer" }}>{p.label}</button>
            ))}
          </div>
          <button className="btn primary sm" onClick={openAdd}><i className="ti ti-plus" /> Add Expense</button>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 280px",gap:16,alignItems:"start" }}>
        <div>
          {filtered.length===0&&<div className="panel" style={{ padding:32,textAlign:"center",color:"var(--text3)" }}>No expenses for this period</div>}
          {filtered.slice().reverse().map(e => {
            const cd = EXP_CATS[e.cat]||EXP_CATS["Other"];
            return (
              <div key={e.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderBottom:"1px solid var(--border)",background:"var(--panel)",borderRadius:i=>i===0?"10px 10px 0 0":"0" }}>
                <div style={{ width:38,height:38,borderRadius:9,background:cd.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{cd.i}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,fontSize:13 }}>{e.cat}</div>
                  <div style={{ fontSize:11,color:"var(--text3)" }}>{e.date}{e.note?" · "+e.note:""}</div>
                </div>
                <div style={{ fontWeight:800,color:"var(--red)",marginRight:8 }}>৳{e.amount.toLocaleString()}</div>
                <button className="btn sm" onClick={()=>openEdit(e)} style={{ fontSize:11 }}>✏️</button>
                {curRole==="admin"&&<button className="btn danger sm" onClick={()=>startDelete(e)} style={{ fontSize:11 }}>🗑</button>}
              </div>
            );
          })}
        </div>

        <div className="panel" style={{ padding:14,position:"sticky",top:80 }}>
          <div style={{ fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",marginBottom:10 }}>By Category</div>
          {byCat.length===0&&<div style={{ color:"var(--text3)",fontSize:12,textAlign:"center",padding:12 }}>No data</div>}
          {byCat.map(([c,a]) => {
            const cd = EXP_CATS[c]||EXP_CATS["Other"];
            return (
              <div key={c} style={{ marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4 }}>
                  <span>{cd.i} {c}</span>
                  <span style={{ fontWeight:700,color:cd.c }}>৳{a.toLocaleString()}</span>
                </div>
                <div style={{ height:5,background:"var(--border)",borderRadius:3,overflow:"hidden" }}>
                  <div style={{ height:"100%",width:(a/totalAmt*100)+"%",background:cd.c,borderRadius:3 }} />
                </div>
              </div>
            );
          })}
          {byCat.length>0&&<div style={{ borderTop:"1px solid var(--border)",marginTop:10,paddingTop:10,fontSize:12,fontWeight:800,display:"flex",justifyContent:"space-between" }}>
            <span>Total</span><span style={{ color:"var(--red)" }}>৳{totalAmt.toLocaleString()}</span>
          </div>}
        </div>
      </div>

      {(modal==="add"||typeof modal==="object"&&modal!==null) && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">{modal==="add"?"➕ Add Expense":"✏️ Edit Expense"}</div>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-group"><label>Category *</label>
              <select value={cat} onChange={e=>setCat(e.target.value)}>
                {catList.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Amount (৳) *</label><input type="number" min="0" value={amt} onChange={e=>setAmt(e.target.value)} /></div>
              <div className="form-group"><label>Date *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Note</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={save}><i className="ti ti-device-floppy" /> Save</button>
            </div>
          </div>
        </div>
      )}

      {delTarget && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setDelTarget(null)}>
          <div className="modal-box" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete Expense</div>
              <button className="modal-close" onClick={()=>setDelTarget(null)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ fontSize:13,marginBottom:14 }}>Delete <strong>{delTarget.cat}</strong> · ৳{delTarget.amount.toLocaleString()} on {delTarget.date}?</div>
            <div className="form-group"><label>Admin Password *</label>
              <input type="password" value={delPass} onChange={e=>setDelPass(e.target.value)} placeholder="Enter admin password" />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setDelTarget(null)}>Cancel</button>
              <button className="btn danger" onClick={confirmDelete}><i className="ti ti-trash" /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// ── HallInvoice.jsx ───────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallInvoice.jsx', `
import { useState, useMemo } from "react";
import { useHall, EV_TYPES, checkHallAdminPass } from "../HallContext";

const SOURCES = ["Direct Visit","Phone Call","Facebook","Instagram","WhatsApp","Friend Referral","Past Client","Agent","Other"];
const PAY_METHODS = ["Cash","Bank Transfer","bKash","Nagad","Cheque","Other"];
const PAY_STATUS_OPTS = ["Pending","Partial","Paid","Cancelled"];

function emptyInv(num) {
  const today = new Date().toISOString().split("T")[0];
  return { id:"", num, client:"", phone:"", email:"", address:"", evType:"Wedding", evDate:today,
    guests:"", wGroomName:"", wBrideName:"", wGroomPhone:"", wBridePhone:"", wGroomAddr:"", wBrideAddr:"",
    hDate:"", h2Date:"", hGroomName:"", hBrideName:"", hNote:"",
    genTitle:"", genNote:"",
    services:[], stage:"", stageImg:"",
    adv:0, advMethod:"Cash", advDate:today, advNote:"",
    balance:0, payStatus:"Pending",
    source:"Direct Visit", note:"", invDate:today,
    grand:0, isLead:false };
}

function calcGrand(services) {
  return services.reduce((s,r) => s + (parseFloat(r.qty||1) * parseFloat(r.rate||0)), 0);
}

const EV_COLOR = { Wedding:"#9B1212", Holud:"#8a6200", "Wedding + Holud":"#6030b0", Reception:"#1a5fa0", Engagement:"#a03070", Birthday:"#b05010", "Corporate Event":"#204090", Others:"#1a7040" };

export default function HallInvoice() {
  const { invoices, setInvoices, notify } = useHall();
  const [view, setView] = useState("list"); // list | form | detail
  const [editInv, setEditInv] = useState(null);
  const [detailInv, setDetailInv] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [delPass, setDelPass] = useState("");

  function newNum() {
    if (!invoices.length) return "A-001";
    const nums = invoices.map(i => parseInt(i.num?.replace(/\\D/g,""))||0);
    return "A-" + String(Math.max(...nums)+1).padStart(3,"0");
  }

  function openNew() { setEditInv(emptyInv(newNum())); setView("form"); }
  function openEdit(inv) { setEditInv({...inv, services: inv.services ? [...inv.services.map(s=>({...s}))] : []}); setView("form"); }
  function openDetail(inv) { setDetailInv(inv); setView("detail"); }
  function backToList() { setView("list"); setEditInv(null); setDetailInv(null); }

  function saveInv(inv) {
    const grand = calcGrand(inv.services);
    const bal   = Math.max(0, grand - (parseFloat(inv.adv)||0));
    const payStatus = grand===0?"Pending": bal===0?"Paid": (parseFloat(inv.adv)||0)>0?"Partial":"Pending";
    const final = { ...inv, grand, balance:bal, payStatus };
    if (inv.id) {
      setInvoices(prev => prev.map(i => i.id===inv.id ? final : i));
      notify("Invoice updated","success");
    } else {
      const id = String(Date.now());
      setInvoices(prev => [...prev, { ...final, id }]);
      notify("Invoice saved","success");
    }
    backToList();
  }

  function startDelete(inv) { setDeleteModal(inv); setDelPass(""); }
  function confirmDelete() {
    if (!checkHallAdminPass(delPass)) { notify("Incorrect password","error"); return; }
    setInvoices(prev => prev.filter(i => i.id !== deleteModal.id));
    notify("Invoice deleted","success");
    setDeleteModal(null);
    if (view==="detail") backToList();
  }

  const filtered = useMemo(() => {
    let list = [...invoices].sort((a,b) => (b.id||"") > (a.id||"") ? 1 : -1);
    if (search) list = list.filter(i => i.client?.toLowerCase().includes(search.toLowerCase()) || i.phone?.includes(search) || i.num?.includes(search));
    if (filterType) list = list.filter(i => i.evType===filterType);
    if (filterStatus) list = list.filter(i => i.payStatus===filterStatus);
    return list;
  }, [invoices, search, filterType, filterStatus]);

  if (view==="form")  return <InvForm inv={editInv} onSave={saveInv} onCancel={backToList} />;
  if (view==="detail") return <InvDetail inv={detailInv} onEdit={()=>openEdit(detailInv)} onDelete={()=>startDelete(detailInv)} onBack={backToList} onDelete2={startDelete} deleteModal={deleteModal} delPass={delPass} setDelPass={setDelPass} confirmDelete={confirmDelete} setDeleteModal={setDeleteModal} notify={notify} setInvoices={setInvoices} invoices={invoices} />;

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <div>
          <div style={{ fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Invoices</div>
          <div style={{ fontSize:12,color:"var(--text3)" }}>{invoices.length} total</div>
        </div>
        <button className="btn primary" onClick={openNew}><i className="ti ti-plus" /> New Invoice</button>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18 }}>
        {[
          ["Total Invoices",invoices.length,"📄","var(--navy)"],
          ["Total Billed","৳"+invoices.reduce((s,i)=>s+(i.grand||0),0).toLocaleString(),"💰","var(--gold2)"],
          ["Collected","৳"+invoices.reduce((s,i)=>s+(i.adv||0),0).toLocaleString(),"✅","var(--green)"],
          ["Outstanding","৳"+invoices.reduce((s,i)=>s+Math.max(0,(i.grand||0)-(i.adv||0)),0).toLocaleString(),"⏳","var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"12px 14px",textAlign:"center" }}>
            <div style={{ fontSize:20 }}>{ic}</div>
            <div style={{ fontSize:15,fontWeight:800,color:c }}>{v}</div>
            <div style={{ fontSize:10,color:"var(--text3)" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" }}>
        <div style={{ position:"relative",flex:1,minWidth:160 }}>
          <i className="ti ti-search" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:13 }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, phone, #..." style={{ paddingLeft:30,width:"100%",boxSizing:"border-box" }} />
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ padding:"7px 10px",fontSize:12,borderRadius:8,border:"1.5px solid var(--border)" }}>
          <option value="">All Types</option>
          {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.i} {t.v}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:"7px 10px",fontSize:12,borderRadius:8,border:"1.5px solid var(--border)" }}>
          <option value="">All Status</option>
          {PAY_STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="panel" style={{ padding:0 }}>
        {filtered.length===0&&<div style={{ padding:32,textAlign:"center",color:"var(--text3)" }}>No invoices found</div>}
        {filtered.map((inv,i)=>{
          const et = EV_TYPES.find(t=>t.v===inv.evType);
          const bal = Math.max(0,(inv.grand||0)-(inv.adv||0));
          const sc = { Paid:"var(--green)", Partial:"var(--gold2)", Pending:"var(--red)", Cancelled:"var(--text3)" };
          return (
            <div key={inv.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)",background:i%2?"var(--panel-alt)":"",cursor:"pointer" }} onClick={()=>openDetail(inv)}>
              <div style={{ width:42,height:42,borderRadius:10,background:et?.bg||"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:"1.5px solid "+(et?.border||"#ccc") }}>{et?.i}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>{inv.client} <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>#{inv.num}</span></div>
                <div style={{ fontSize:11,color:"var(--text3)" }}>{inv.evType} · {inv.evDate} · {inv.guests} guests</div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontWeight:800,fontSize:13 }}>৳{(inv.grand||0).toLocaleString()}</div>
                <div style={{ fontSize:10,fontWeight:700,color:sc[inv.payStatus]||"var(--text3)" }}>{inv.payStatus}</div>
              </div>
              <button className="btn sm" onClick={e=>{e.stopPropagation();openEdit(inv)}} style={{ fontSize:11 }}>✏️</button>
            </div>
          );
        })}
      </div>

      {deleteModal && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setDeleteModal(null)}>
          <div className="modal-box" style={{ maxWidth:370 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete Invoice</div>
              <button className="modal-close" onClick={()=>setDeleteModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ fontSize:13,marginBottom:14 }}>Delete invoice <strong>#{deleteModal.num}</strong> for <strong>{deleteModal.client}</strong>?</div>
            <div className="form-group"><label>Admin Password *</label>
              <input type="password" value={delPass} onChange={e=>setDelPass(e.target.value)} placeholder="Enter admin password" autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setDeleteModal(null)}>Cancel</button>
              <button className="btn danger" onClick={confirmDelete}><i className="ti ti-trash" /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Form ──────────────────────────────────────────────────────────────
function InvForm({ inv, onSave, onCancel }) {
  const [d, setD] = useState({...inv, services: inv.services?.length ? inv.services : [{ desc:"Hall Rental", qty:1, rate:0 }]});

  const set = (k,v) => setD(p => ({ ...p, [k]:v }));
  const grand = calcGrand(d.services);
  const balance = Math.max(0, grand - (parseFloat(d.adv)||0));

  function addService() { setD(p => ({ ...p, services:[...p.services,{desc:"",qty:1,rate:0}] })); }
  function removeService(i) { setD(p => ({ ...p, services:p.services.filter((_,j)=>j!==i) })); }
  function setService(i,k,v) { setD(p => { const s=[...p.services]; s[i]={...s[i],[k]:v}; return {...p,services:s}; }); }

  const et = EV_TYPES.find(t=>t.v===d.evType);
  const isWedding = et?.g==="wedding" || et?.g==="wh";
  const isHolud   = et?.v==="Holud"||et?.v==="Wedding + Holud";
  const isWH      = et?.v==="Wedding + Holud";
  const isGeneric = et?.g==="generic";

  return (
    <div style={{ padding:"22px 24px", maxWidth:860, margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>{d.id?"Edit Invoice":"New Invoice"} — #{d.num}</div>
          <div style={{ fontSize:12,color:"var(--text3)" }}>Amelia Convention Hall</div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={()=>onSave(d)}><i className="ti ti-device-floppy" /> Save</button>
        </div>
      </div>

      {/* Client Info */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header"><div className="panel-title">👤 Client Information</div></div>
        <div className="form-row">
          <div className="form-group"><label>Client Name *</label><input value={d.client} onChange={e=>set("client",e.target.value)} placeholder="Full name" /></div>
          <div className="form-group"><label>Phone *</label><input value={d.phone} onChange={e=>set("phone",e.target.value)} placeholder="01XXXXXXXXX" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email</label><input value={d.email||""} onChange={e=>set("email",e.target.value)} placeholder="Optional" /></div>
          <div className="form-group"><label>No. of Guests</label><input type="number" value={d.guests||""} onChange={e=>set("guests",e.target.value)} placeholder="Approx. guests" /></div>
        </div>
        <div className="form-group"><label>Address</label><input value={d.address||""} onChange={e=>set("address",e.target.value)} placeholder="Client address" /></div>
      </div>

      {/* Event Type */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header"><div className="panel-title">🎭 Event Type</div></div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:14 }}>
          {EV_TYPES.map(t=>(
            <button key={t.v} onClick={()=>set("evType",t.v)} style={{ padding:"8px 14px",borderRadius:10,border:"2px solid "+(d.evType===t.v?t.accent:t.border),background:d.evType===t.v?t.bg:"transparent",fontWeight:700,fontSize:12,cursor:"pointer",color:d.evType===t.v?t.accent:"var(--text2)",transition:".15s" }}>
              {t.i} {t.v}
            </button>
          ))}
        </div>
        <div className="form-row">
          {(isWedding||isWH) && <div className="form-group"><label>{isWH?"Wedding Date":"Event Date"} *</label><input type="date" value={d.evDate||""} onChange={e=>set("evDate",e.target.value)} /></div>}
          {(isHolud||isWH)  && <div className="form-group"><label>Holud Date *</label><input type="date" value={d.hDate||""} onChange={e=>set("hDate",e.target.value)} /></div>}
          {isGeneric && <div className="form-group"><label>Event Date *</label><input type="date" value={d.evDate||""} onChange={e=>set("evDate",e.target.value)} /></div>}
        </div>
      </div>

      {/* Wedding Details */}
      {(isWedding||isWH) && (
        <div className="panel" style={{ marginBottom:14,borderLeft:"3px solid #9B1212" }}>
          <div className="panel-header"><div className="panel-title">💒 Wedding Details</div></div>
          <div className="form-row">
            <div className="form-group"><label>Groom Name</label><input value={d.wGroomName||""} onChange={e=>set("wGroomName",e.target.value)} /></div>
            <div className="form-group"><label>Bride Name</label><input value={d.wBrideName||""} onChange={e=>set("wBrideName",e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Groom Phone</label><input value={d.wGroomPhone||""} onChange={e=>set("wGroomPhone",e.target.value)} /></div>
            <div className="form-group"><label>Bride Phone</label><input value={d.wBridePhone||""} onChange={e=>set("wBridePhone",e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Groom Address</label><input value={d.wGroomAddr||""} onChange={e=>set("wGroomAddr",e.target.value)} /></div>
            <div className="form-group"><label>Bride Address</label><input value={d.wBrideAddr||""} onChange={e=>set("wBrideAddr",e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* Holud Details */}
      {(isHolud||isWH) && (
        <div className="panel" style={{ marginBottom:14,borderLeft:"3px solid #d4a800" }}>
          <div className="panel-header"><div className="panel-title">🌼 Holud Details</div></div>
          <div className="form-row">
            <div className="form-group"><label>Groom Name</label><input value={d.hGroomName||""} onChange={e=>set("hGroomName",e.target.value)} /></div>
            <div className="form-group"><label>Bride Name</label><input value={d.hBrideName||""} onChange={e=>set("hBrideName",e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Additional Notes</label><textarea value={d.hNote||""} onChange={e=>set("hNote",e.target.value)} rows={2} /></div>
        </div>
      )}

      {/* Generic Details */}
      {isGeneric && (
        <div className="panel" style={{ marginBottom:14 }}>
          <div className="panel-header"><div className="panel-title">📋 Event Details</div></div>
          <div className="form-group"><label>Event Title</label><input value={d.genTitle||""} onChange={e=>set("genTitle",e.target.value)} placeholder="e.g. Birthday Party — 30th" /></div>
          <div className="form-group"><label>Notes</label><textarea value={d.genNote||""} onChange={e=>set("genNote",e.target.value)} rows={2} /></div>
        </div>
      )}

      {/* Services & Charges */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header">
          <div className="panel-title">💼 Services & Charges</div>
          <button className="btn sm" onClick={addService}><i className="ti ti-plus" /> Add Row</button>
        </div>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:8 }}>
          <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
            <th style={{ padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>Description</th>
            <th style={{ padding:"8px 10px",textAlign:"center",width:70,fontSize:10,textTransform:"uppercase" }}>Qty</th>
            <th style={{ padding:"8px 10px",textAlign:"right",width:100,fontSize:10,textTransform:"uppercase" }}>Rate (৳)</th>
            <th style={{ padding:"8px 10px",textAlign:"right",width:100,fontSize:10,textTransform:"uppercase" }}>Amount</th>
            <th style={{ width:36 }}></th>
          </tr></thead>
          <tbody>
            {d.services.map((s,i)=>(
              <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"6px 8px" }}><input value={s.desc||""} onChange={e=>setService(i,"desc",e.target.value)} style={{ width:"100%",border:"1.5px solid var(--border)",borderRadius:6,padding:"5px 8px",fontSize:12 }} placeholder="Service description" /></td>
                <td style={{ padding:"6px 8px" }}><input type="number" min="0" value={s.qty||1} onChange={e=>setService(i,"qty",e.target.value)} style={{ width:"100%",border:"1.5px solid var(--border)",borderRadius:6,padding:"5px 8px",fontSize:12,textAlign:"center" }} /></td>
                <td style={{ padding:"6px 8px" }}><input type="number" min="0" value={s.rate||0} onChange={e=>setService(i,"rate",e.target.value)} style={{ width:"100%",border:"1.5px solid var(--border)",borderRadius:6,padding:"5px 8px",fontSize:12,textAlign:"right" }} /></td>
                <td style={{ padding:"6px 10px",textAlign:"right",fontWeight:700 }}>৳{((parseFloat(s.qty)||1)*(parseFloat(s.rate)||0)).toLocaleString()}</td>
                <td style={{ padding:"6px 6px" }}><button onClick={()=>removeService(i)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:16 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:20,fontSize:13,fontWeight:700,paddingRight:40 }}>
          <span>Grand Total:</span>
          <span style={{ color:"var(--gold2)",fontSize:15 }}>৳{grand.toLocaleString()}</span>
        </div>
      </div>

      {/* Stage */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header"><div className="panel-title">🎤 Stage / Setup</div></div>
        <div className="form-group"><label>Stage Description</label><input value={d.stage||""} onChange={e=>set("stage",e.target.value)} placeholder="e.g. Royal Stage, LED backdrop, flower decoration" /></div>
        <div className="form-group"><label>Stage Image URL</label><input value={d.stageImg||""} onChange={e=>set("stageImg",e.target.value)} placeholder="https://... (optional)" /></div>
        {d.stageImg && <img src={d.stageImg} alt="stage" style={{ maxWidth:"100%",maxHeight:160,borderRadius:8,marginTop:6 }} onError={e=>e.target.style.display="none"} />}
      </div>

      {/* Payment */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header"><div className="panel-title">💳 Payment</div></div>
        <div className="form-row">
          <div className="form-group"><label>Advance Paid (৳)</label><input type="number" min="0" value={d.adv||0} onChange={e=>set("adv",parseFloat(e.target.value)||0)} /></div>
          <div className="form-group"><label>Payment Method</label>
            <select value={d.advMethod||"Cash"} onChange={e=>set("advMethod",e.target.value)}>
              {PAY_METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Payment Date</label><input type="date" value={d.advDate||""} onChange={e=>set("advDate",e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Payment Note</label><input value={d.advNote||""} onChange={e=>set("advNote",e.target.value)} placeholder="Transaction ID, ref, etc." /></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:8,padding:"12px",background:"var(--bg4)",borderRadius:10 }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:13,fontWeight:800,color:"var(--gold2)" }}>৳{grand.toLocaleString()}</div><div style={{ fontSize:10,color:"var(--text3)" }}>Grand Total</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:13,fontWeight:800,color:"var(--green)" }}>৳{(parseFloat(d.adv)||0).toLocaleString()}</div><div style={{ fontSize:10,color:"var(--text3)" }}>Advance</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:13,fontWeight:800,color:"var(--red)" }}>৳{balance.toLocaleString()}</div><div style={{ fontSize:10,color:"var(--text3)" }}>Balance Due</div></div>
        </div>
      </div>

      {/* How did you hear */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-header"><div className="panel-title">📣 How Did You Hear About Us?</div></div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
          {SOURCES.map(s=>(
            <button key={s} onClick={()=>set("source",s)} style={{ padding:"7px 13px",fontSize:12,fontWeight:700,borderRadius:9,border:"1.5px solid var(--border)",background:d.source===s?"var(--navy)":"transparent",color:d.source===s?"var(--gold)":"var(--text2)",cursor:"pointer" }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Notes & Invoice Date */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="form-row">
          <div className="form-group"><label>Invoice Date</label><input type="date" value={d.invDate||""} onChange={e=>set("invDate",e.target.value)} /></div>
          <div className="form-group"><label>Internal Note</label><input value={d.note||""} onChange={e=>set("note",e.target.value)} placeholder="Internal note (not printed)" /></div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <input type="checkbox" id="isLead" checked={!!d.isLead} onChange={e=>set("isLead",e.target.checked)} />
          <label htmlFor="isLead" style={{ fontSize:12,cursor:"pointer" }}>Save as Lead (tentative, not confirmed)</label>
        </div>
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" onClick={()=>onSave(d)}><i className="ti ti-device-floppy" /> Save Invoice</button>
      </div>
    </div>
  );
}

// ─── Invoice Detail / Print View ───────────────────────────────────────────────
function InvDetail({ inv, onEdit, onBack, startDelete, deleteModal, delPass, setDelPass, confirmDelete, setDeleteModal, onDelete, notify, setInvoices, invoices }) {
  const [payModal, setPayModal] = useState(false);
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);

  const et = EV_TYPES.find(t=>t.v===inv.evType);
  const grand = inv.grand||0;
  const paid  = inv.adv||0;
  const bal   = Math.max(0,grand-paid);

  function collectPayment() {
    const a = parseFloat(payAmt)||0;
    if (a<=0) { notify("Enter valid amount","error"); return; }
    const newPaid = paid + a;
    const newBal  = Math.max(0,grand-newPaid);
    const ps      = newBal===0?"Paid":"Partial";
    setInvoices(prev=>prev.map(i=>i.id===inv.id?{...i,adv:newPaid,balance:newBal,payStatus:ps}:i));
    notify("Payment recorded","success");
    setPayModal(false);
  }

  function printInvoice() {
    const w = window.open("","_blank");
    const isWedding = et?.g==="wedding"||et?.g==="wh";
    const isHolud   = inv.evType==="Holud"||inv.evType==="Wedding + Holud";
    w.document.write(\`<!DOCTYPE html><html><head><title>Invoice #\${inv.num}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;} body{font-family:'Segoe UI',sans-serif;font-size:12px;color:#1a1a2e;padding:24px;}
      .header{text-align:center;border-bottom:3px double #9B1212;padding-bottom:16px;margin-bottom:16px;}
      .logo-title{font-size:26px;font-weight:800;color:#9B1212;letter-spacing:2px;}
      .sub{font-size:12px;color:#555;} .inv-meta{display:flex;justify-content:space-between;margin-bottom:14px;}
      .section{margin-bottom:12px;} .section-title{font-size:11px;font-weight:800;text-transform:uppercase;color:#9B1212;border-bottom:1px solid #e0c8c8;padding-bottom:4px;margin-bottom:7px;}
      .row{display:flex;gap:20px;} .col{flex:1;}
      table{width:100%;border-collapse:collapse;} th{background:#1a1a2e;color:#f2dfc0;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;}
      td{padding:6px 8px;border-bottom:1px solid #e5e5e5;}
      .total-row{font-weight:800;border-top:2px solid #1a1a2e;}
      .pay-box{background:#f8f8f8;padding:10px;border-radius:6px;margin-top:10px;}
      @media print{body{padding:10px;}}
    </style></head><body>
    <div class="header">
      <div class="logo-title">Amelia Convention Hall</div>
      <div class="sub">Invoice #\${inv.num} &nbsp;|&nbsp; Date: \${inv.invDate}</div>
    </div>
    <div class="inv-meta">
      <div><strong>Client:</strong> \${inv.client}<br><small>\${inv.phone||""} \${inv.email?"| "+inv.email:""}</small><br><small>\${inv.address||""}</small></div>
      <div style="text-align:right"><strong>Event:</strong> \${inv.evType}<br><small>\${inv.evDate||""}</small><br><strong>Guests:</strong> \${inv.guests||"-"}</div>
    </div>
    \${isWedding?\`<div class="section"><div class="section-title">Wedding Details</div><div class="row"><div class="col"><strong>Groom:</strong> \${inv.wGroomName||"-"} \${inv.wGroomPhone?"("+inv.wGroomPhone+")":""}</div><div class="col"><strong>Bride:</strong> \${inv.wBrideName||"-"} \${inv.wBridePhone?"("+inv.wBridePhone+")":""}</div></div></div>\`:""}
    \${isHolud?\`<div class="section"><div class="section-title">Holud Details</div><div class="row"><div class="col"><strong>Groom:</strong> \${inv.hGroomName||"-"}</div><div class="col"><strong>Bride:</strong> \${inv.hBrideName||"-"}</div></div></div>\`:""}
    <div class="section"><div class="section-title">Services & Charges</div>
    <table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>\${(inv.services||[]).map(s=>\`<tr><td>\${s.desc||""}</td><td style="text-align:center">\${s.qty||1}</td><td style="text-align:right">৳\${(parseFloat(s.rate)||0).toLocaleString()}</td><td style="text-align:right">৳\${((parseFloat(s.qty)||1)*(parseFloat(s.rate)||0)).toLocaleString()}</td></tr>\`).join("")}
    <tr class="total-row"><td colspan="3" style="text-align:right">Grand Total</td><td style="text-align:right">৳\${grand.toLocaleString()}</td></tr></tbody></table>
    <div class="pay-box"><strong>Advance Paid:</strong> ৳\${paid.toLocaleString()} (\${inv.advMethod||"Cash"})<br><strong>Balance Due:</strong> ৳\${bal.toLocaleString()}<br><strong>Status:</strong> \${inv.payStatus}</div></div>
    \${inv.note?\`<div style="font-size:10px;color:#777;margin-top:8px;"><em>Note: \${inv.note}</em></div>\`:""}
    <div style="text-align:center;margin-top:20px;font-size:10px;color:#999">Thank you for choosing Amelia Convention Hall &bull; \${inv.source?"Referred via: "+inv.source:""}</div>
    <script>window.print();<\/script></body></html>\`);
    w.document.close();
  }

  return (
    <div style={{ padding:"22px 24px",maxWidth:800,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <button className="btn" onClick={onBack}>‹ Back</button>
        <div style={{ display:"flex",gap:8 }}>
          {bal>0&&<button className="btn primary sm" onClick={()=>setPayModal(true)}>💳 Collect Payment</button>}
          <button className="btn sm" onClick={onEdit}>✏️ Edit</button>
          <button className="btn sm" onClick={printInvoice}>🖨 Print</button>
          <button className="btn danger sm" onClick={onDelete}>🗑 Delete</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom:14 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
          <div>
            <div style={{ fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Invoice #{inv.num}</div>
            <div style={{ fontSize:12,color:"var(--text3)" }}>Date: {inv.invDate}</div>
            {inv.isLead&&<span style={{ fontSize:10,fontWeight:800,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:20,border:"1px solid #fcd34d" }}>LEAD</span>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end" }}>
              <div style={{ width:32,height:32,borderRadius:8,background:et?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:"1.5px solid "+(et?.border||"#ccc") }}>{et?.i}</div>
              <div style={{ fontSize:14,fontWeight:800,color:et?.accent }}>{inv.evType}</div>
            </div>
            <div style={{ fontSize:11,color:"var(--text3)",marginTop:4 }}>{inv.evDate}</div>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12 }}>
          <div><div style={{ fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",marginBottom:5 }}>Client</div>
            <div style={{ fontWeight:700 }}>{inv.client}</div>
            <div style={{ fontSize:12,color:"var(--text3)" }}>{inv.phone}</div>
            {inv.email&&<div style={{ fontSize:12,color:"var(--text3)" }}>{inv.email}</div>}
            {inv.address&&<div style={{ fontSize:12,color:"var(--text3)" }}>{inv.address}</div>}
          </div>
          <div><div style={{ fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",marginBottom:5 }}>Event</div>
            <div style={{ fontWeight:700 }}>{inv.guests} guests</div>
            {inv.stage&&<div style={{ fontSize:12,color:"var(--text3)" }}>Stage: {inv.stage}</div>}
            {inv.source&&<div style={{ fontSize:12,color:"var(--text3)" }}>Via: {inv.source}</div>}
          </div>
        </div>
        {(inv.wGroomName||inv.wBrideName)&&<div style={{ background:"#fff0f0",padding:10,borderRadius:8,marginBottom:8,fontSize:12 }}>
          <strong style={{ color:"#9B1212" }}>💒 Wedding:</strong> {inv.wGroomName} & {inv.wBrideName}
          {inv.wGroomPhone&&<span style={{ color:"var(--text3)" }}> · G: {inv.wGroomPhone}</span>}
          {inv.wBridePhone&&<span style={{ color:"var(--text3)" }}> · B: {inv.wBridePhone}</span>}
        </div>}
        {(inv.hGroomName||inv.hBrideName)&&<div style={{ background:"#fffbe8",padding:10,borderRadius:8,marginBottom:8,fontSize:12 }}>
          <strong style={{ color:"#8a6200" }}>🌼 Holud:</strong> {inv.hGroomName} & {inv.hBrideName}
        </div>}
        {inv.genTitle&&<div style={{ fontSize:13,fontWeight:700,marginBottom:6 }}>{inv.genTitle}</div>}
        {(inv.genNote||inv.hNote)&&<div style={{ fontSize:12,color:"var(--text3)",marginBottom:8 }}>{inv.genNote||inv.hNote}</div>}
        {inv.stageImg&&<img src={inv.stageImg} alt="stage" style={{ maxWidth:"100%",maxHeight:160,borderRadius:8,marginBottom:8 }} onError={e=>e.target.style.display="none"} />}
      </div>

      <div className="panel" style={{ padding:0,marginBottom:14 }}>
        <div className="panel-header" style={{ padding:"12px 16px" }}><div className="panel-title">💼 Services & Charges</div></div>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
          <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
            <th style={{ padding:"8px 12px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>Description</th>
            <th style={{ padding:"8px 12px",textAlign:"center",fontSize:10,textTransform:"uppercase",width:60 }}>Qty</th>
            <th style={{ padding:"8px 12px",textAlign:"right",fontSize:10,textTransform:"uppercase",width:100 }}>Rate</th>
            <th style={{ padding:"8px 12px",textAlign:"right",fontSize:10,textTransform:"uppercase",width:110 }}>Amount</th>
          </tr></thead>
          <tbody>
            {(inv.services||[]).map((s,i)=>(
              <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"9px 12px" }}>{s.desc}</td>
                <td style={{ padding:"9px 12px",textAlign:"center" }}>{s.qty||1}</td>
                <td style={{ padding:"9px 12px",textAlign:"right" }}>৳{(parseFloat(s.rate)||0).toLocaleString()}</td>
                <td style={{ padding:"9px 12px",textAlign:"right",fontWeight:700 }}>৳{((parseFloat(s.qty)||1)*(parseFloat(s.rate)||0)).toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ background:"var(--bg4)",fontWeight:800 }}>
              <td colSpan={3} style={{ padding:"10px 12px",textAlign:"right" }}>Grand Total</td>
              <td style={{ padding:"10px 12px",textAlign:"right",color:"var(--gold2)",fontSize:15 }}>৳{grand.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="panel-title">💳 Payment Summary</div></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:8 }}>
          <div style={{ textAlign:"center",padding:"12px 0" }}>
            <div style={{ fontSize:17,fontWeight:800,color:"var(--gold2)" }}>৳{grand.toLocaleString()}</div>
            <div style={{ fontSize:10,color:"var(--text3)" }}>Grand Total</div>
          </div>
          <div style={{ textAlign:"center",padding:"12px 0" }}>
            <div style={{ fontSize:17,fontWeight:800,color:"var(--green)" }}>৳{paid.toLocaleString()}</div>
            <div style={{ fontSize:10,color:"var(--text3)" }}>Advance Paid ({inv.advMethod||"Cash"})</div>
          </div>
          <div style={{ textAlign:"center",padding:"12px 0" }}>
            <div style={{ fontSize:17,fontWeight:800,color:bal>0?"var(--red)":"var(--green)" }}>৳{bal.toLocaleString()}</div>
            <div style={{ fontSize:10,color:"var(--text3)" }}>Balance Due</div>
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <span style={{ padding:"4px 14px",borderRadius:20,fontSize:11,fontWeight:800,
            background:inv.payStatus==="Paid"?"rgba(22,163,74,.12)":inv.payStatus==="Partial"?"rgba(201,168,76,.15)":"rgba(220,38,38,.1)",
            color:inv.payStatus==="Paid"?"var(--green)":inv.payStatus==="Partial"?"var(--gold2)":"var(--red)" }}>
            {inv.payStatus}
          </span>
        </div>
        {inv.advNote&&<div style={{ fontSize:12,color:"var(--text3)",marginTop:8,textAlign:"center" }}>Ref: {inv.advNote}</div>}
      </div>

      {payModal&&(
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setPayModal(false)}>
          <div className="modal-box" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <div className="modal-title">💳 Collect Payment</div>
              <button className="modal-close" onClick={()=>setPayModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14,padding:10,background:"var(--bg4)",borderRadius:8,fontSize:12 }}>
              <div>Grand Total<br/><strong>৳{grand.toLocaleString()}</strong></div>
              <div>Balance Due<br/><strong style={{ color:"var(--red)" }}>৳{bal.toLocaleString()}</strong></div>
            </div>
            <div className="form-group"><label>Amount Received (৳) *</label><input type="number" min="0" max={bal} value={payAmt} onChange={e=>setPayAmt(e.target.value)} autoFocus /></div>
            <div className="form-row">
              <div className="form-group"><label>Method</label>
                <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
                  {PAY_METHODS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Date</label><input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setPayModal(false)}>Cancel</button>
              <button className="btn primary" onClick={collectPayment}><i className="ti ti-check" /> Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal&&(
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setDeleteModal(null)}>
          <div className="modal-box" style={{ maxWidth:370 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete Invoice</div>
              <button className="modal-close" onClick={()=>setDeleteModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ fontSize:13,marginBottom:14 }}>Delete invoice <strong>#{deleteModal.num}</strong>?</div>
            <div className="form-group"><label>Admin Password *</label>
              <input type="password" value={delPass} onChange={e=>setDelPass(e.target.value)} placeholder="Enter admin password" autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setDeleteModal(null)}>Cancel</button>
              <button className="btn danger" onClick={confirmDelete}><i className="ti ti-trash" /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

console.log('HallExpenses.jsx and HallInvoice.jsx written OK');
