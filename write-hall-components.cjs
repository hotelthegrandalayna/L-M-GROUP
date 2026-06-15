const fs = require('fs');
const base = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/hall/components';

// ── HallLogin.jsx ────────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallLogin.jsx', `
import { useState } from "react";
import { useHall, hallLogin } from "../HallContext";

export default function HallLogin({ onSwitchApp }) {
  const { login } = useHall();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err,  setErr]  = useState("");

  function doLogin(e) {
    e?.preventDefault();
    if (!user.trim()) { setErr("Enter your username."); return; }
    const result = hallLogin(user, pass);
    if (result) { login(result.user, result.role); }
    else { setErr("Invalid username or password."); }
  }

  return (
    <div id="loginScreen" className="screen active">
      <div className="login-box">
        <div className="login-monogram">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="90" height="43">
            <polygon points="8,78 19,78 46,18 35,18" fill="#f2dfc0"/>
            <polygon points="35,18 46,18 71,78 60,78" fill="#f2dfc0"/>
            <rect x="24" y="49" width="30" height="7" fill="#f2dfc0"/>
            <polygon points="36,18 40,3 44,18" fill="#f2dfc0"/>
            <rect x="4" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <rect x="56" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <circle cx="95" cy="44" r="5" fill="#c9a84c"/>
            <rect x="112" y="18" width="11" height="60" fill="#f2dfc0"/>
            <rect x="149" y="18" width="11" height="60" fill="#f2dfc0"/>
            <rect x="112" y="42" width="48" height="8" fill="#f2dfc0"/>
            <polygon points="113,18 117,3 122,18" fill="#f2dfc0"/>
            <polygon points="150,18 154,3 159,18" fill="#f2dfc0"/>
            <rect x="108" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <rect x="145" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
          </svg>
        </div>
        <div className="login-logo">Amelia</div>
        <div className="login-sub">Convention Hall</div>
        <h2>Sign In</h2>
        <form onSubmit={doLogin} style={{ width:"100%" }}>
          <input type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="Username" autoComplete="off" />
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" />
          <button type="submit">Sign In</button>
        </form>
        {err && <div className="login-err">{err}</div>}
        <div className="login-hint">Use your assigned username and password to sign in.</div>
        <button onClick={onSwitchApp} style={{ marginTop:14, background:"transparent", border:"1px solid rgba(201,168,76,.4)", color:"#c9a84c", borderRadius:8, padding:"7px 16px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
          ⇄ Switch to Hotel
        </button>
      </div>
    </div>
  );
}
`, 'utf8');

// ── HallNavbar.jsx ───────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallNavbar.jsx', `
import { useHall } from "../HallContext";

const TABS = [
  { id:"invoice",  icon:"🧾", label:"Invoice"  },
  { id:"calendar", icon:"📅", label:"Calendar" },
  { id:"crm",      icon:"🤝", label:"CRM"      },
  { id:"expenses", icon:"💸", label:"Expenses" },
  { id:"insights", icon:"📊", label:"Insights" },
  { id:"admin",    icon:"⚙",  label:"Admin"    },
];

export default function HallNavbar({ onSwitchApp }) {
  const { curUser, curRole, activeTab, setActiveTab, logout } = useHall();
  return (
    <nav>
      <div className="nav-brand">
        <div className="nav-brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="50" height="24">
            <polygon points="8,78 19,78 46,18 35,18" fill="#f2dfc0"/>
            <polygon points="35,18 46,18 71,78 60,78" fill="#f2dfc0"/>
            <rect x="24" y="49" width="30" height="7" fill="#f2dfc0"/>
            <rect x="4" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <rect x="56" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <circle cx="95" cy="44" r="5" fill="#c9a84c"/>
            <rect x="112" y="18" width="11" height="60" fill="#f2dfc0"/>
            <rect x="149" y="18" width="11" height="60" fill="#f2dfc0"/>
            <rect x="112" y="42" width="48" height="8" fill="#f2dfc0"/>
            <rect x="108" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
            <rect x="145" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
          </svg>
        </div>
        <div className="nav-brand-text">
          <span className="nav-brand-name">Amelia Convention Hall</span>
          <span className="nav-brand-sub">Management System</span>
        </div>
      </div>
      <div className="nav-tabs">
        {TABS.map(t => (
          <button key={t.id} className={"nav-tab" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="nav-right">
        <div className="nav-user-wrap">
          <span className="nav-user-name">{curUser}</span>
          <span className={"role-badge " + curRole}>{curRole}</span>
        </div>
        <button onClick={onSwitchApp} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid rgba(201,168,76,.35)", background:"rgba(201,168,76,.1)", color:"#f0d080", fontSize:11, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>⇄ Switch</button>
        <button className="logout-btn" onClick={logout}><i className="ti ti-power" /></button>
      </div>
    </nav>
  );
}
`, 'utf8');

// ── HallNotification.jsx ─────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallNotification.jsx', `
import { useHall } from "../HallContext";
export default function HallNotification() {
  const { notification } = useHall();
  if (!notification) return null;
  return <div className={"notif " + notification.type + " show"}>{notification.msg}</div>;
}
`, 'utf8');

// ── HallCalendar.jsx ─────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallCalendar.jsx', `
import { useState } from "react";
import { useHall, EV_TYPES } from "../HallContext";

const EV_COLOR = {
  Wedding:"#fae8a0", Holud:"#faebc0", "Wedding + Holud":"#e8d8ff",
  Reception:"#c8e8f8", Engagement:"#f8d0e8", Birthday:"#fcc8c8",
  "Corporate Event":"#c8e8f8", Others:"#b8e8c8",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function HallCalendar() {
  const { invoices } = useHall();
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [filter, setFilter] = useState("");

  const days = new Date(yr, mo+1, 0).getDate();
  const startDay = new Date(yr, mo, 1).getDay();
  const pad = (yr*12+mo)*100;

  function getInvForDate(d) {
    const ds = yr+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    return invoices.filter(inv => (inv.evDate===ds||inv.h2Date===ds||inv.hDate===ds) && (!filter||inv.evType===filter));
  }

  function prev() { if (mo===0) { setMo(11); setYr(y=>y-1); } else setMo(m=>m-1); }
  function next() { if (mo===11) { setMo(0); setYr(y=>y+1); } else setMo(m=>m+1); }

  const upcoming = invoices
    .filter(inv => inv.evDate >= new Date().toISOString().split("T")[0] && (!filter||inv.evType===filter))
    .sort((a,b) => a.evDate > b.evDate ? 1 : -1)
    .slice(0,15);

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Booking Calendar</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Visual overview of all bookings</div>
      </div>

      <div className="panel" style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button className="btn sm" onClick={prev}>‹</button>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--navy)", minWidth:140, textAlign:"center" }}>{MONTHS[mo]} {yr}</div>
            <button className="btn sm" onClick={next}>›</button>
          </div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ padding:"6px 10px", fontSize:12, borderRadius:8, border:"1.5px solid var(--border)" }}>
            <option value="">All Events</option>
            {EV_TYPES.map(t=><option key={t.v}>{t.v}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {Object.entries(EV_COLOR).map(([k,c]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:c }} />
              <span style={{ color:"var(--text3)" }}>{k}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"var(--text3)", padding:"4px 0" }}>{d}</div>
          ))}
          {Array.from({length:startDay}).map((_,i) => <div key={"e"+i} />)}
          {Array.from({length:days}).map((_,i) => {
            const d = i+1;
            const invs = getInvForDate(d);
            const isToday = yr===now.getFullYear()&&mo===now.getMonth()&&d===now.getDate();
            return (
              <div key={d} style={{ minHeight:70, border:"1px solid var(--border)", borderRadius:6, padding:"4px 5px", background:isToday?"#fffbee":"var(--bg4)", position:"relative" }}>
                <div style={{ fontSize:11, fontWeight:isToday?800:500, color:isToday?"var(--gold2)":"var(--text3)", marginBottom:3 }}>{d}</div>
                {invs.slice(0,3).map((inv,j) => (
                  <div key={j} style={{ fontSize:9, fontWeight:700, padding:"2px 4px", borderRadius:3, marginBottom:2, background:EV_COLOR[inv.evType]||"#eee", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {inv.client}
                  </div>
                ))}
                {invs.length>3&&<div style={{ fontSize:9, color:"var(--text3)" }}>+{invs.length-3} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="panel-title">📋 Upcoming Bookings</div></div>
        {upcoming.length===0&&<div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:20 }}>No upcoming bookings</div>}
        {upcoming.map(inv => (
          <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderBottom:"1px solid var(--border)", fontSize:13 }}>
            <div style={{ width:44, textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--navy)" }}>{inv.evDate?.slice(8)}</div>
              <div style={{ fontSize:10, color:"var(--text3)" }}>{MONTHS[parseInt(inv.evDate?.slice(5,7))-1]} {inv.evDate?.slice(0,4)}</div>
            </div>
            <div style={{ width:8, height:40, borderRadius:4, background:EV_COLOR[inv.evType]||"#eee", flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700 }}>{inv.client}</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>{inv.evType} · {inv.guests} guests · {inv.phone}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontWeight:800, color:"var(--gold2)" }}>৳{Number(inv.grand||0).toLocaleString()}</div>
              <div style={{ fontSize:10, color:inv.payStatus==="Paid"?"var(--green)":inv.payStatus==="Partial"?"var(--gold2)":"var(--red)", fontWeight:700 }}>{inv.payStatus}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`, 'utf8');

// ── HallCRM.jsx ───────────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallCRM.jsx', `
import { useState, useMemo } from "react";
import { useHall } from "../HallContext";

export default function HallCRM() {
  const { invoices } = useHall();
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);

  const clients = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const k = inv.phone || inv.client;
      if (!map[k]) map[k] = { name:inv.client, phone:inv.phone, email:inv.email||"", bookings:[], totalBilled:0, totalPaid:0, lastEvent:"" };
      const g = map[k];
      g.bookings.push(inv);
      g.totalBilled += inv.grand||0;
      g.totalPaid   += inv.adv||0;
      if (!g.lastEvent || inv.evDate > g.lastEvent) g.lastEvent = inv.evDate;
    });
    return Object.values(map).sort((a,b)=>b.bookings.length-a.bookings.length);
  }, [invoices]);

  const filtered = search.trim()
    ? clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search))
    : clients;

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Client CRM</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>{clients.length} unique clients</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:18 }}>
        {[
          ["Total Clients",   clients.length,                                              "👥","var(--navy)"],
          ["Total Billed",    "৳"+clients.reduce((s,c)=>s+c.totalBilled,0).toLocaleString(),"💰","var(--gold2)"],
          ["Repeat Clients",  clients.filter(c=>c.bookings.length>1).length,               "🔄","var(--blue)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"14px 16px", textAlign:"center" }}>
            <div style={{ fontSize:24 }}>{ic}</div>
            <div style={{ fontSize:19, fontWeight:800, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ position:"relative", marginBottom:14 }}>
        <i className="ti ti-search" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:14 }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client name or phone..." style={{ paddingLeft:32,width:"100%",boxSizing:"border-box" }} />
      </div>
      <div className="panel" style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
            {["Client","Phone","Events","Last Event","Billed","Paid","Balance"].map(h=>(
              <th key={h} style={{ padding:"9px 12px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:.5 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={7} style={{ textAlign:"center",padding:24,color:"var(--text3)" }}>No clients found</td></tr>}
            {filtered.map((c,i)=>{
              const bal = Math.max(0,c.totalBilled-c.totalPaid);
              return (
                <tr key={c.phone||c.name} style={{ borderBottom:"1px solid var(--border)",background:i%2?"var(--panel-alt)":"", cursor:"pointer" }} onClick={()=>setSel(c)}>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--navy)",color:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,flexShrink:0 }}>{c.name.charAt(0)}</div>
                      <div><div style={{ fontWeight:700 }}>{c.name}</div>{c.bookings.length>1&&<span style={{ fontSize:10,fontWeight:700,color:"#3b82f6" }}>Repeat</span>}</div>
                    </div>
                  </td>
                  <td style={{ padding:"10px 12px",color:"var(--text3)",fontSize:12 }}>{c.phone||"-"}</td>
                  <td style={{ padding:"10px 12px",textAlign:"center",fontWeight:700 }}>{c.bookings.length}</td>
                  <td style={{ padding:"10px 12px",fontSize:12 }}>{c.lastEvent||"-"}</td>
                  <td style={{ padding:"10px 12px",fontWeight:700 }}>৳{c.totalBilled.toLocaleString()}</td>
                  <td style={{ padding:"10px 12px",color:"var(--green)",fontWeight:700 }}>৳{c.totalPaid.toLocaleString()}</td>
                  <td style={{ padding:"10px 12px",color:bal>0?"var(--red)":"var(--green)",fontWeight:700 }}>{bal>0?"৳"+bal.toLocaleString():"Clear"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setSel(null)}>
          <div className="modal-box" style={{ maxWidth:560 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">👤 {sel.name}</div>
                <div className="modal-sub">{sel.phone} {sel.email?"· "+sel.email:""}</div>
              </div>
              <button className="modal-close" onClick={()=>setSel(null)}><i className="ti ti-x" /></button>
            </div>
            <div style={{ fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",marginBottom:8 }}>Booking History</div>
            {sel.bookings.sort((a,b)=>b.id-a.id).map(inv=>(
              <div key={inv.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:"1px solid var(--border)",fontSize:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>#{inv.num||inv.id} · {inv.evType}</div>
                  <div style={{ fontSize:11,color:"var(--text3)" }}>{inv.evDate} · {inv.guests} guests</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:800 }}>৳{(inv.grand||0).toLocaleString()}</div>
                  <div style={{ fontSize:10,color:inv.payStatus==="Paid"?"var(--green)":inv.payStatus==="Partial"?"var(--gold2)":"var(--red)",fontWeight:700 }}>{inv.payStatus}</div>
                </div>
              </div>
            ))}
            <div className="modal-actions"><button className="btn" onClick={()=>setSel(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// ── HallInsights.jsx ──────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallInsights.jsx', `
import { useMemo } from "react";
import { useHall, EV_TYPES } from "../HallContext";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function HallInsights() {
  const { invoices, expenses } = useHall();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0,7);
  const thisYear  = today.slice(0,4);

  const mInv  = invoices.filter(inv=>inv.invDate?.startsWith(thisMonth));
  const mExp  = expenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const mBilled = mInv.reduce((s,i)=>s+(i.grand||0),0);
  const mPaid   = mInv.reduce((s,i)=>s+(i.adv||0),0);
  const allPaid = invoices.reduce((s,i)=>s+(i.adv||0),0);
  const allExp  = expenses.reduce((s,e)=>s+e.amount,0);

  const byType = useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{ map[inv.evType]=(map[inv.evType]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[invoices]);

  const last6 = useMemo(()=>{
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(); d.setMonth(d.getMonth()-i);
      const m=d.toISOString().slice(0,7);
      const label=MONTHS[d.getMonth()]+" "+String(d.getFullYear()).slice(2);
      const inv=invoices.filter(x=>x.invDate?.startsWith(m));
      const billed=inv.reduce((s,x)=>s+(x.grand||0),0);
      const paid=inv.reduce((s,x)=>s+(x.adv||0),0);
      const exp=expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+e.amount,0);
      months.push({label,billed,paid,exp,cnt:inv.length});
    }
    return months;
  },[invoices,expenses]);

  const maxBar = Math.max(...last6.map(x=>x.billed),1);

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Insights</div>
        <div style={{ fontSize:12,color:"var(--text3)" }}>Business performance overview</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22 }}>
        {[
          ["This Month Billed","৳"+mBilled.toLocaleString(),"💰","var(--gold2)"],
          ["This Month Paid","৳"+mPaid.toLocaleString(),"✅","var(--green)"],
          ["This Month Expenses","৳"+mExp.toLocaleString(),"💸","var(--red)"],
          ["Net Profit (Month)","৳"+(mPaid-mExp).toLocaleString(),"📈",(mPaid-mExp)>=0?"var(--green)":"var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"14px 16px",textAlign:"center" }}>
            <div style={{ fontSize:22 }}>{ic}</div>
            <div style={{ fontSize:17,fontWeight:800,color:c }}>{v}</div>
            <div style={{ fontSize:11,color:"var(--text3)",marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:18 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">📊 Revenue vs Expenses — Last 6 Months</div></div>
          <div style={{ padding:"0 14px 14px" }}>
            {last6.map(x=>(
              <div key={x.label} style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)",marginBottom:5 }}>
                  <span style={{ fontWeight:700,color:"var(--navy)" }}>{x.label}</span>
                  <span>{x.cnt} bookings · Net: <strong style={{ color:x.paid-x.exp>=0?"var(--green)":"var(--red)" }}>৳{(x.paid-x.exp).toLocaleString()}</strong></span>
                </div>
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  <div style={{ flex:1,height:10,background:"var(--border)",borderRadius:5,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(x.billed/maxBar*100)+"%",background:"var(--gold2)",borderRadius:5 }} />
                  </div>
                  <span style={{ fontSize:11,fontWeight:700,color:"var(--gold2)",width:80,textAlign:"right" }}>৳{x.billed.toLocaleString()}</span>
                </div>
                <div style={{ display:"flex",gap:4,alignItems:"center",marginTop:3 }}>
                  <div style={{ flex:1,height:6,background:"var(--border)",borderRadius:5,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(x.exp/maxBar*100)+"%",background:"var(--red)",borderRadius:5,opacity:.7 }} />
                  </div>
                  <span style={{ fontSize:11,color:"var(--red)",width:80,textAlign:"right" }}>৳{x.exp.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">🎭 Events by Type</div></div>
          <div style={{ padding:"0 14px 14px" }}>
            {byType.length===0&&<div style={{ color:"var(--text3)",fontSize:13,textAlign:"center",padding:14 }}>No data</div>}
            {byType.map(([t,n])=>{
              const et=EV_TYPES.find(x=>x.v===t);
              return (
                <div key={t} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4 }}>
                    <span>{et?.i} {t}</span><span style={{ fontWeight:700 }}>{n}</span>
                  </div>
                  <div style={{ height:6,background:"var(--border)",borderRadius:3,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(n/invoices.length*100)+"%",background:et?.accent||"var(--navy)",borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
`, 'utf8');

// ── HallAdmin.jsx ─────────────────────────────────────────────────────────────
fs.writeFileSync(base + '/HallAdmin.jsx', `
import { useState } from "react";
import { useHall, EXP_CATS, checkHallAdminPass } from "../HallContext";

export default function HallAdmin() {
  const { curRole, invoices, setInvoices, expenses, setExpenses, revenues, setRevenues, notify } = useHall();
  const [tab, setTab] = useState("finance");
  const [addRev, setAddRev] = useState(false);
  const [rSrc,  setRSrc]  = useState("Hall Rental");
  const [rAmt,  setRAmt]  = useState(0);
  const [rDate, setRDate] = useState(new Date().toISOString().split("T")[0]);
  const [rNote, setRNote] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0,7);
  const mPaid = invoices.filter(i=>i.invDate?.startsWith(thisMonth)).reduce((s,i)=>s+(i.adv||0),0);
  const mExp  = expenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const allPaid = invoices.reduce((s,i)=>s+(i.adv||0),0);
  const allExp  = expenses.reduce((s,e)=>s+e.amount,0);

  function saveRev() {
    const a = parseFloat(rAmt)||0;
    if (a<=0) { notify("Enter valid amount","error"); return; }
    const id = String(Date.now());
    setRevenues(prev => [...prev, { id, source:rSrc, amount:a, date:rDate, note:rNote.trim() }]);
    notify("Revenue added","success");
    setAddRev(false); setRAmt(0); setRNote("");
  }

  function dangerReset() {
    const pw = window.prompt("Enter admin password to reset ALL data:");
    if (!checkHallAdminPass(pw||"")) { notify("Incorrect password","error"); return; }
    if (!window.confirm("Permanently delete ALL invoices, expenses, and revenues? Cannot be undone.")) return;
    setInvoices([]); setExpenses([]); setRevenues([]);
    notify("All data has been reset","error");
  }

  function exportData() {
    const data = { invoices, expenses, revenues, exportedAt: new Date().toISOString() };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.download = "amelia_backup_"+today+".json";
    a.click();
    notify("Data exported","success");
  }

  function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (!window.confirm("Replace all data with imported file?")) return;
        if (d.invoices) setInvoices(d.invoices);
        if (d.expenses) setExpenses(d.expenses);
        if (d.revenues) setRevenues(d.revenues);
        notify("Data imported","success");
      } catch { notify("Invalid file","error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (curRole !== "admin") return (
    <div style={{ padding:40,textAlign:"center",color:"var(--text3)" }}>
      <i className="ti ti-lock" style={{ fontSize:40,display:"block",marginBottom:12 }} />
      <div style={{ fontSize:16,fontWeight:700 }}>Admin Only</div>
    </div>
  );

  return (
    <div style={{ padding:"22px 24px", maxWidth:1000, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Admin Panel</div>
      </div>
      <div style={{ display:"flex",gap:4,borderBottom:"2px solid var(--border)",marginBottom:20 }}>
        {["finance","data"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            color:tab===t?"var(--navy)":"var(--text3)",borderBottom:tab===t?"3px solid var(--gold)":"3px solid transparent",marginBottom:-2 }}>
            {t==="finance"?"💰 Finance":"💾 Data"}
          </button>
        ))}
      </div>

      {tab==="finance" && (
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18 }}>
            {[["Month Collected","৳"+mPaid.toLocaleString(),"var(--gold2)"],["Month Expenses","৳"+mExp.toLocaleString(),"var(--red)"],["Month Profit","৳"+(mPaid-mExp).toLocaleString(),(mPaid-mExp)>=0?"var(--green)":"var(--red)"],["All-time Profit","৳"+(allPaid-allExp).toLocaleString(),(allPaid-allExp)>=0?"var(--green)":"var(--red)"]].map(([l,v,c])=>(
              <div key={l} className="panel" style={{ padding:"12px 14px",textAlign:"center" }}>
                <div style={{ fontSize:16,fontWeight:800,color:c }}>{v}</div>
                <div style={{ fontSize:11,color:"var(--text3)" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:12 }}>
            <button className="btn primary sm" onClick={()=>setAddRev(true)}><i className="ti ti-plus" /> Add Revenue</button>
          </div>
          {revenues.length>0 && (
            <div className="panel" style={{ padding:0,overflowX:"auto",marginBottom:14 }}>
              <div style={{ padding:"10px 14px",fontSize:11,fontWeight:800,color:"var(--text3)",textTransform:"uppercase" }}>Manual Revenue Entries</div>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
                  {["Date","Source","Amount","Note"].map(h=><th key={h} style={{ padding:"8px 12px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>{[...revenues].reverse().map((r,i)=>(
                  <tr key={r.id} style={{ borderBottom:"1px solid var(--border)",background:i%2?"var(--panel-alt)":"" }}>
                    <td style={{ padding:"8px 12px",fontSize:12,color:"var(--text3)" }}>{r.date}</td>
                    <td style={{ padding:"8px 12px" }}>{r.source}</td>
                    <td style={{ padding:"8px 12px",fontWeight:700,color:"var(--green)" }}>৳{r.amount.toLocaleString()}</td>
                    <td style={{ padding:"8px 12px",color:"var(--text2)",fontSize:12 }}>{r.note||"-"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop:18,padding:16,border:"1.5px solid #fca5a5",borderRadius:10,background:"#fff1f2" }}>
            <div style={{ fontSize:12,fontWeight:800,color:"#991b1b",marginBottom:8 }}>⚠️ Danger Zone</div>
            <div style={{ fontSize:12,color:"#7f1d1d",marginBottom:12 }}>Reset all data — permanently deletes ALL invoices, expenses and revenues.</div>
            <button className="btn danger sm" onClick={dangerReset}>🗑 Reset All Data</button>
          </div>
        </div>
      )}

      {tab==="data" && (
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
          <div className="panel" style={{ padding:18 }}>
            <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-download" /> Export Backup</div>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Download all invoices, expenses and revenues as a JSON file.</div>
            <button className="btn primary sm" onClick={exportData}><i className="ti ti-download" /> Export All Data</button>
          </div>
          <div className="panel" style={{ padding:18 }}>
            <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-upload" /> Import Backup</div>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Restore from a previously exported JSON backup. Replaces current data.</div>
            <label className="btn sm" style={{ cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
              <i className="ti ti-upload" /> Import Backup
              <input type="file" accept=".json" style={{ display:"none" }} onChange={importData} />
            </label>
          </div>
          <div className="panel" style={{ padding:14, gridColumn:"1/-1" }}>
            <div style={{ fontSize:12,color:"var(--text3)" }}>
              Invoices: <strong>{invoices.length}</strong> &nbsp;·&nbsp;
              Expenses: <strong>{expenses.length}</strong> &nbsp;·&nbsp;
              Revenue entries: <strong>{revenues.length}</strong> &nbsp;·&nbsp;
              Storage: ~<strong>{((JSON.stringify({invoices,expenses,revenues}).length)/1024).toFixed(1)} KB</strong>
            </div>
          </div>
        </div>
      )}

      {addRev && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setAddRev(false)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">💰 Add Revenue Entry</div>
              <button className="modal-close" onClick={()=>setAddRev(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-group"><label>Source</label>
              <select value={rSrc} onChange={e=>setRSrc(e.target.value)}>
                {["Hall Rental","Catering","Decoration","Photography","Other"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Amount (৳) *</label><input type="number" value={rAmt} min="0" onChange={e=>setRAmt(e.target.value)} /></div>
              <div className="form-group"><label>Date *</label><input type="date" value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Note</label><input value={rNote} onChange={e=>setRNote(e.target.value)} placeholder="Optional" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setAddRev(false)}>Cancel</button>
              <button className="btn primary" onClick={saveRev}><i className="ti ti-device-floppy" /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

console.log('Hall components (Login, Navbar, Notification, Calendar, CRM, Insights, Admin) written OK');
