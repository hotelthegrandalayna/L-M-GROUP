import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { saveConfig, loadConfig } from "../../utils/supabaseSync";

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

  function save(list) {
    setUsers(list);
    localStorage.setItem("ga_staff", JSON.stringify(list));
    saveConfig("hotel_staff", list).catch(() => {});
  }

  useEffect(() => {
    loadConfig("hotel_staff").then(v => {
      if (Array.isArray(v) && v.length) {
        setUsers(v);
        localStorage.setItem("ga_staff", JSON.stringify(v));
      }
    }).catch(() => {});
  }, []);

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
          <div className="modal-box" style={{ }}>
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
