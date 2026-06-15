const fs = require('fs');
const path = require('path');
const base = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Admin';

fs.mkdirSync(base, { recursive: true });

// ── AdminFinance.jsx ─────────────────────────────────────────────────────────
fs.writeFileSync(base+'/AdminFinance.jsx', `import { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { money, todayStr, maxId } from "../../utils/helpers";

const REV_SOURCES = ["Room Rent","Food & Beverage","Laundry","Parking","Other"];

export default function AdminFinance() {
  const { curUser, bookings, updateBookings, revenues, updateRevenues, expenses, updateExpenses, notify } = useApp();
  const today = todayStr();
  const thisMonth = today.slice(0,7);
  const [tab, setTab] = useState("overview");
  const [addRev, setAddRev] = useState(false);
  const [rSrc,  setRSrc]  = useState("Room Rent");
  const [rAmt,  setRAmt]  = useState(0);
  const [rDate, setRDate] = useState(today);
  const [rNote, setRNote] = useState("");

  const mRev = revenues.filter(r=>r.date?.startsWith(thisMonth)).reduce((s,r)=>s+r.amount,0);
  const mExp = expenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const allRev = revenues.reduce((s,r)=>s+r.amount,0);
  const allExp = expenses.reduce((s,e)=>s+e.amount,0);
  const todayRev = revenues.filter(r=>r.date===today).reduce((s,r)=>s+r.amount,0);
  const todayExp = expenses.filter(e=>e.date===today).reduce((s,e)=>s+e.amount,0);

  function saveRev() {
    const a = parseFloat(rAmt)||0;
    if (a<=0) { notify("Enter a valid amount","error"); return; }
    updateRevenues([...revenues, { id:maxId(revenues), source:rSrc, amount:a, date:rDate, note:rNote.trim(), by:curUser||"staff" }]);
    notify("Revenue entry added","success");
    setAddRev(false); setRAmt(0); setRNote("");
  }

  function dangerReset() {
    const pw = window.prompt("Enter admin password to reset ALL finance records (bookings, revenues, expenses):");
    if (pw !== "admin123") { notify("Incorrect password","error"); return; }
    if (!window.confirm("This will permanently delete ALL bookings, revenues, and expenses. Cannot be undone.")) return;
    updateBookings([]); updateRevenues([]); updateExpenses([]);
    notify("All finance records have been reset","error");
  }

  const bySource = useMemo(()=>{
    const map={};
    revenues.filter(r=>r.date?.startsWith(thisMonth)).forEach(r=>{ map[r.source]=(map[r.source]||0)+r.amount; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[revenues,thisMonth]);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:18 }}>
        {[
          ["Today Revenue",   money(todayRev),   "ti-sun",          "var(--gold2)"],
          ["Month Revenue",   money(mRev),       "ti-currency-taka","var(--navy)"],
          ["Month Profit",    money(mRev-mExp),  "ti-trending-up",  (mRev-mExp)>=0?"var(--green)":"var(--red)"],
          ["Today Expenses",  money(todayExp),   "ti-receipt",      "var(--red)"],
          ["Month Expenses",  money(mExp),       "ti-minus-vertical","var(--red)"],
          ["All-time Profit", money(allRev-allExp),"ti-chart-line", (allRev-allExp)>=0?"var(--green)":"var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <i className={"ti "+ic} style={{ fontSize:20, color:c, flexShrink:0 }} />
            <div><div style={{ fontSize:10, color:"var(--text3)" }}>{l}</div><div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {["overview","revenues","expenses"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"6px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .15s",
            background:tab===t?"var(--navy)":"transparent",color:tab===t?"#fff":"var(--text3)",borderColor:tab===t?"var(--navy)":"var(--border)" }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <button className="btn sm primary" style={{ marginLeft:"auto" }} onClick={()=>setAddRev(true)}><i className="ti ti-plus" /> Add Revenue</button>
      </div>

      {tab==="overview" && (
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>Revenue by Source (This Month)</div>
          {bySource.length===0&&<div style={{ color:"var(--text3)",fontSize:13,padding:14 }}>No revenue entries this month</div>}
          {bySource.map(([s,a])=>(
            <div key={s} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:13 }}>
              <span>{s}</span><strong style={{ color:"var(--green)" }}>{money(a)}</strong>
            </div>
          ))}
          <div style={{ display:"flex",justifyContent:"space-between",padding:"10px 12px",fontWeight:800,fontSize:14,borderTop:"2px solid var(--border)",marginTop:4 }}>
            <span>Total</span><span style={{ color:"var(--gold2)" }}>{money(mRev)}</span>
          </div>
        </div>
      )}

      {tab==="revenues" && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
              {["Date","Source","Amount","Note","By"].map(h=><th key={h} style={{ padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {revenues.length===0&&<tr><td colSpan={5} style={{ textAlign:"center",padding:20,color:"var(--text3)" }}>No revenue entries</td></tr>}
              {[...revenues].reverse().map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:"1px solid var(--border)",background:i%2===0?"":"var(--panel-alt)" }}>
                  <td style={{ padding:"8px 10px",color:"var(--text3)",fontSize:12 }}>{r.date}</td>
                  <td style={{ padding:"8px 10px" }}>{r.source}</td>
                  <td style={{ padding:"8px 10px",fontWeight:700,color:"var(--green)" }}>{money(r.amount)}</td>
                  <td style={{ padding:"8px 10px",color:"var(--text2)",fontSize:12 }}>{r.note||"-"}</td>
                  <td style={{ padding:"8px 10px",fontSize:11,color:"var(--text3)" }}>{r.by||"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="expenses" && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
              {["Date","Category","Amount","Method","Note","By"].map(h=><th key={h} style={{ padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.length===0&&<tr><td colSpan={6} style={{ textAlign:"center",padding:20,color:"var(--text3)" }}>No expenses</td></tr>}
              {[...expenses].reverse().map((e,i)=>(
                <tr key={e.id} style={{ borderBottom:"1px solid var(--border)",background:i%2===0?"":"var(--panel-alt)" }}>
                  <td style={{ padding:"8px 10px",color:"var(--text3)",fontSize:12 }}>{e.date}</td>
                  <td style={{ padding:"8px 10px" }}>{e.category}</td>
                  <td style={{ padding:"8px 10px",fontWeight:700,color:"var(--red)" }}>{money(e.amount)}</td>
                  <td style={{ padding:"8px 10px",fontSize:12,color:"var(--text3)" }}>{e.method||"Cash"}</td>
                  <td style={{ padding:"8px 10px",color:"var(--text2)",fontSize:12 }}>{e.note||"-"}</td>
                  <td style={{ padding:"8px 10px",fontSize:11,color:"var(--text3)" }}>{e.by||"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addRev && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setAddRev(false)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-plus" style={{ color:"var(--gold)" }} /> Add Revenue Entry</div>
              <button className="modal-close" onClick={()=>setAddRev(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-group"><label>Source</label>
              <select value={rSrc} onChange={e=>setRSrc(e.target.value)}>{REV_SOURCES.map(s=><option key={s}>{s}</option>)}</select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Amount (BDT) *</label><input type="number" value={rAmt} min="0" onChange={e=>setRAmt(e.target.value)} /></div>
              <div className="form-group"><label>Date *</label><input type="date" value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Note</label><input value={rNote} onChange={e=>setRNote(e.target.value)} placeholder="Optional description" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setAddRev(false)}>Cancel</button>
              <button className="btn primary" onClick={saveRev}><i className="ti ti-device-floppy" /> Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:28, padding:16, border:"1.5px solid #fca5a5", borderRadius:10, background:"#fff1f2" }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#991b1b", marginBottom:8 }}><i className="ti ti-alert-triangle" /> Danger Zone</div>
        <div style={{ fontSize:12, color:"#7f1d1d", marginBottom:12 }}>Reset all finance records — this permanently deletes ALL bookings, revenues, and expenses and cannot be undone.</div>
        <button className="btn danger sm" onClick={dangerReset}><i className="ti ti-trash" /> Reset All Finance Records</button>
      </div>
    </div>
  );
}
`, 'utf8');

// ── AdminRooms.jsx ──────────────────────────────────────────────────────────
fs.writeFileSync(base+'/AdminRooms.jsx', `import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { money } from "../../utils/helpers";

const ROOM_TYPES = ["Standard","Deluxe","Suite","Family","Executive","Presidential"];
const AMENITIES  = ["AC","WiFi","TV","Hot Water","Mini Bar","Balcony","Sea View","City View","Bathtub","Kitchenette"];

export default function AdminRooms() {
  const { rooms, setRooms, notify } = useApp();
  const [modal, setModal] = useState(null);
  const [num,   setNum]   = useState("");
  const [name,  setName]  = useState("");
  const [type,  setType]  = useState("Standard");
  const [rate,  setRate]  = useState(0);
  const [floor, setFloor] = useState(1);
  const [amen,  setAmen]  = useState([]);
  const [notes, setNotes] = useState("");

  function openNew() {
    setNum(""); setName(""); setType("Standard"); setRate(0); setFloor(1); setAmen([]); setNotes("");
    setModal("new");
  }

  function openEdit(r) {
    setNum(r.number||""); setName(r.name||""); setType(r.type||"Standard");
    setRate(r.rate||0); setFloor(r.floor||1); setAmen(r.amenities||[]); setNotes(r.notes||"");
    setModal(r);
  }

  function save() {
    if (!num) { notify("Room number required","error"); return; }
    const r2 = parseFloat(rate)||0;
    if (r2<=0)  { notify("Rate must be > 0","error"); return; }
    const updated = { number:num, name:name.trim(), type, rate:r2, floor:parseInt(floor)||1, amenities:amen, notes:notes.trim() };
    if (modal==="new") {
      if (rooms.find(r=>r.number===num)) { notify("Room number already exists","error"); return; }
      const newId = rooms.length ? Math.max(...rooms.map(r=>r.id||0))+1 : 1;
      setRooms([...rooms, { ...updated, id:newId }]);
      notify("Room "+num+" added","success");
    } else {
      setRooms(rooms.map(r=>r.id===modal.id?{...r,...updated}:r));
      notify("Room "+num+" updated","success");
    }
    setModal(null);
  }

  function del(r) {
    if (!window.confirm("Delete Room "+r.number+"? This cannot be undone.")) return;
    setRooms(rooms.filter(x=>x.id!==r.id));
    notify("Room "+r.number+" deleted","success");
  }

  function toggleAmen(a) {
    setAmen(prev=>prev.includes(a)?prev.filter(x=>x!==a):[...prev,a]);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn primary sm" onClick={openNew}><i className="ti ti-plus" /> Add Room</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {rooms.map(r=>(
          <div key={r.id} className="panel" style={{ padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--navy)" }}>Rm {r.number}</div>
                <div style={{ fontSize:12, color:"var(--text3)" }}>{r.name||r.type} · Floor {r.floor||1}</div>
              </div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--gold2)" }}>{money(r.rate)}<span style={{ fontSize:10,fontWeight:400 }}>/n</span></div>
            </div>
            <div style={{ fontSize:11, marginBottom:8, display:"flex", flexWrap:"wrap", gap:4 }}>
              {(r.amenities||[]).map(a=>(
                <span key={a} style={{ padding:"2px 7px",borderRadius:8,background:"var(--navy2)",color:"var(--gold)",fontSize:10,fontWeight:600 }}>{a}</span>
              ))}
            </div>
            {r.notes&&<div style={{ fontSize:11,color:"var(--text3)",marginBottom:8 }}>{r.notes}</div>}
            <div style={{ display:"flex", gap:6 }}>
              <button className="btn sm" style={{ flex:1 }} onClick={()=>openEdit(r)}><i className="ti ti-pencil" /> Edit</button>
              <button className="btn sm danger" onClick={()=>del(r)}><i className="ti ti-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal!==null && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-building" style={{ color:"var(--gold)" }} /> {modal==="new"?"Add Room":"Edit Room "+(modal.number||"")}</div>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Room Number *</label><input value={num} onChange={e=>setNum(e.target.value)} placeholder="e.g. 101" /></div>
              <div className="form-group"><label>Room Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ocean Suite" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Type</label>
                <select value={type} onChange={e=>setType(e.target.value)}>{ROOM_TYPES.map(t=><option key={t}>{t}</option>)}</select>
              </div>
              <div className="form-group"><label>Floor</label><input type="number" value={floor} min="1" onChange={e=>setFloor(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Rate per Night (BDT) *</label><input type="number" value={rate} min="0" onChange={e=>setRate(e.target.value)} /></div>
            <div className="form-group">
              <label>Amenities</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
                {AMENITIES.map(a=>(
                  <button key={a} type="button" onClick={()=>toggleAmen(a)} style={{
                    padding:"4px 10px",borderRadius:16,border:"1.5px solid",cursor:"pointer",fontSize:11,fontWeight:600,
                    background:amen.includes(a)?"var(--navy)":"transparent",
                    color:amen.includes(a)?"var(--gold)":"var(--text3)",
                    borderColor:amen.includes(a)?"var(--navy)":"var(--border)",
                  }}>{a}</button>
                ))}
              </div>
            </div>
            <div className="form-group"><label>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special notes about this room" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={save}><i className="ti ti-device-floppy" /> {modal==="new"?"Add Room":"Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// ── AdminStaff.jsx ──────────────────────────────────────────────────────────
fs.writeFileSync(base+'/AdminStaff.jsx', `import { useState } from "react";
import { useApp } from "../../context/AppContext";

const ROLES = ["admin","manager","receptionist","accountant"];
const DEFAULT_USERS = [
  { id:1, username:"admin",        role:"admin",         active:true },
  { id:2, username:"manager",      role:"manager",       active:true },
  { id:3, username:"receptionist", role:"receptionist",  active:true },
  { id:4, username:"accountant",   role:"accountant",    active:true },
];

export default function AdminStaff() {
  const { notify } = useApp();
  const [users, setUsers] = useState(()=>{
    try { return JSON.parse(localStorage.getItem("ga_staff")||"null")||DEFAULT_USERS; } catch { return DEFAULT_USERS; }
  });
  const [modal, setModal] = useState(null);
  const [uname, setUname] = useState("");
  const [urole, setUrole] = useState("receptionist");
  const [pw1,   setPw1]   = useState("");
  const [pw2,   setPw2]   = useState("");

  function save(list) { setUsers(list); localStorage.setItem("ga_staff", JSON.stringify(list)); }

  function openNew()  { setUname(""); setUrole("receptionist"); setPw1(""); setPw2(""); setModal("new"); }
  function openEdit(u){ setUname(u.username); setUrole(u.role); setPw1(""); setPw2(""); setModal(u); }

  function saveUser() {
    if (!uname.trim()) { notify("Username required","error"); return; }
    if (modal==="new") {
      if (!pw1) { notify("Password required","error"); return; }
      if (pw1!==pw2) { notify("Passwords do not match","error"); return; }
      if (users.find(u=>u.username===uname.trim())) { notify("Username already exists","error"); return; }
      const next = [...users, { id:Date.now(), username:uname.trim(), role:urole, active:true }];
      save(next);
      localStorage.setItem("ga_pw_"+uname.trim(), pw1);
      notify("Staff account created","success");
    } else {
      if (pw1 && pw1!==pw2) { notify("Passwords do not match","error"); return; }
      const next = users.map(u=>u.id===modal.id?{...u,username:uname.trim(),role:urole}:u);
      save(next);
      if (pw1) localStorage.setItem("ga_pw_"+uname.trim(), pw1);
      notify("Staff account updated","success");
    }
    setModal(null);
  }

  function toggleActive(u) {
    save(users.map(x=>x.id===u.id?{...x,active:!x.active}:x));
    notify(u.username+(u.active?" deactivated":" activated"),"success");
  }

  function del(u) {
    if (!window.confirm("Delete account: "+u.username+"?")) return;
    save(users.filter(x=>x.id!==u.id));
    localStorage.removeItem("ga_pw_"+u.username);
    notify("Account deleted","success");
  }

  const ROLE_COLOR = { admin:"#ef4444", manager:"#f59e0b", receptionist:"#3b82f6", accountant:"#10b981" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn primary sm" onClick={openNew}><i className="ti ti-user-plus" /> Add Staff</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {users.map(u=>(
          <div key={u.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 14px",border:"1.5px solid var(--border)",borderRadius:9,background:u.active?"transparent":"var(--panel)",opacity:u.active?1:.6 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",background:(ROLE_COLOR[u.role]||"#888")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:ROLE_COLOR[u.role]||"#888",flexShrink:0 }}>
              {u.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700 }}>{u.username}</div>
              <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,background:(ROLE_COLOR[u.role]||"#888")+"18",color:ROLE_COLOR[u.role]||"#888" }}>{u.role}</span>
            </div>
            <span style={{ fontSize:11,padding:"3px 9px",borderRadius:10,fontWeight:700,background:u.active?"#dcfce7":"#f1f5f9",color:u.active?"#166534":"#64748b",border:"1px solid "+(u.active?"#86efac":"#cbd5e1") }}>{u.active?"Active":"Inactive"}</span>
            <div style={{ display:"flex",gap:6 }}>
              <button className="btn sm" onClick={()=>openEdit(u)}><i className="ti ti-pencil" /></button>
              <button className="btn sm" onClick={()=>toggleActive(u)}><i className={"ti "+(u.active?"ti-eye-off":"ti-eye")} /></button>
              <button className="btn sm danger" onClick={()=>del(u)}><i className="ti ti-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal!==null && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-user" style={{ color:"var(--gold)" }} /> {modal==="new"?"Add Staff Account":"Edit Account"}</div>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-group"><label>Username *</label><input value={uname} onChange={e=>setUname(e.target.value)} /></div>
            <div className="form-group"><label>Role</label>
              <select value={urole} onChange={e=>setUrole(e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>
            </div>
            <div className="form-group"><label>{modal==="new"?"Password *":"New Password (leave blank to keep)"}</label><input type="password" value={pw1} onChange={e=>setPw1(e.target.value)} /></div>
            {pw1&&<div className="form-group"><label>Confirm Password</label><input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} /></div>}
            <div className="modal-actions">
              <button className="btn" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={saveUser}><i className="ti ti-device-floppy" /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// ── AdminData.jsx ───────────────────────────────────────────────────────────
fs.writeFileSync(base+'/AdminData.jsx', `import { useApp } from "../../context/AppContext";

export default function AdminData() {
  const { bookings, updateBookings, revenues, updateRevenues, expenses, updateExpenses, rooms, setRooms, notify } = useApp();

  function exportAll() {
    const data = { bookings, revenues, expenses, rooms, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "grand_alayna_backup_"+new Date().toISOString().slice(0,10)+".json";
    a.click();
    notify("Data exported successfully","success");
  }

  function importAll(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!window.confirm("This will REPLACE all current data with the imported file. Continue?")) return;
        if (data.bookings) updateBookings(data.bookings);
        if (data.revenues) updateRevenues(data.revenues);
        if (data.expenses) updateExpenses(data.expenses);
        if (data.rooms)    setRooms(data.rooms);
        notify("Data imported successfully","success");
      } catch { notify("Invalid backup file","error"); }
    };
    reader.readAsText(file);
    e.target.value="";
  }

  const totalSize = JSON.stringify({bookings,revenues,expenses,rooms}).length;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
        {[["Bookings",bookings.length,"ti-calendar"],["Revenues",revenues.length,"ti-currency-taka"],["Expenses",expenses.length,"ti-receipt"],["Rooms",rooms.length,"ti-building"]].map(([l,v,ic])=>(
          <div key={l} className="panel" style={{ padding:"12px 14px",textAlign:"center" }}>
            <i className={"ti "+ic} style={{ fontSize:22,color:"var(--navy)",display:"block",marginBottom:4 }} />
            <div style={{ fontSize:20,fontWeight:800,color:"var(--navy)" }}>{v}</div>
            <div style={{ fontSize:11,color:"var(--text3)" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12,color:"var(--text3)",marginBottom:18 }}>Storage used: ~{(totalSize/1024).toFixed(1)} KB</div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div className="panel" style={{ flex:"1 1 220px", padding:18 }}>
          <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-download" /> Export Backup</div>
          <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Download all data as a JSON backup file. Keep this safe — it contains all your hotel records.</div>
          <button className="btn primary sm" onClick={exportAll}><i className="ti ti-download" /> Export All Data</button>
        </div>
        <div className="panel" style={{ flex:"1 1 220px", padding:18 }}>
          <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-upload" /> Import Backup</div>
          <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Restore from a previously exported JSON backup. This will replace all current data.</div>
          <label className="btn sm" style={{ cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
            <i className="ti ti-upload" /> Import Backup
            <input type="file" accept=".json" style={{ display:"none" }} onChange={importAll} />
          </label>
        </div>
      </div>
    </div>
  );
}
`, 'utf8');

// ── AdminPanel.jsx ──────────────────────────────────────────────────────────
fs.writeFileSync(base+'/AdminPanel.jsx', `import { useState } from "react";
import { useApp } from "../../context/AppContext";
import AdminFinance from "./AdminFinance";
import AdminRooms   from "./AdminRooms";
import AdminStaff   from "./AdminStaff";
import AdminData    from "./AdminData";

const TABS = [
  { key:"finance", label:"Finance",  icon:"ti-currency-taka" },
  { key:"rooms",   label:"Rooms",    icon:"ti-building"      },
  { key:"staff",   label:"Staff",    icon:"ti-users"         },
  { key:"data",    label:"Data",     icon:"ti-database"      },
];

export default function AdminPanel() {
  const { curRole } = useApp();
  const [tab, setTab] = useState("finance");

  if (curRole !== "admin" && curRole !== "manager") {
    return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
        <i className="ti ti-lock" style={{ fontSize:40, display:"block", marginBottom:12 }} />
        <div style={{ fontSize:16, fontWeight:700 }}>Access Restricted</div>
        <div style={{ fontSize:13 }}>Admin panel is only available to administrators and managers.</div>
      </div>
    );
  }

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Admin Panel</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Hotel management settings</div>
      </div>

      <div style={{ display:"flex", gap:4, borderBottom:"2px solid var(--border)", marginBottom:20 }}>
        {TABS.filter(t=>!(t.key==="staff"&&curRole!=="admin")).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"10px 18px",border:"none",background:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,transition:"all .15s",
            color:tab===t.key?"var(--navy)":"var(--text3)",
            borderBottom:tab===t.key?"3px solid var(--gold)":"3px solid transparent",
            marginBottom:-2,
          }}>
            <i className={"ti "+t.icon} style={{ fontSize:15 }} />{t.label}
          </button>
        ))}
      </div>

      {tab==="finance" && <AdminFinance />}
      {tab==="rooms"   && <AdminRooms />}
      {tab==="staff"   && curRole==="admin" && <AdminStaff />}
      {tab==="data"    && <AdminData />}
    </div>
  );
}
`, 'utf8');

console.log('Admin files written OK');
