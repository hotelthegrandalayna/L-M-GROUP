const fs = require('fs');
const hallDir = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/hall';
const srcDir  = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src';

// ── HallApp.jsx ───────────────────────────────────────────────────────────────
fs.writeFileSync(hallDir + '/HallApp.jsx', `
import { HallProvider, useHall } from "./HallContext";
import HallLogin         from "./components/HallLogin";
import HallNavbar        from "./components/HallNavbar";
import HallNotification  from "./components/HallNotification";
import HallInvoice       from "./components/HallInvoice";
import HallCalendar      from "./components/HallCalendar";
import HallCRM           from "./components/HallCRM";
import HallExpenses      from "./components/HallExpenses";
import HallInsights      from "./components/HallInsights";
import HallAdmin         from "./components/HallAdmin";
import "../../src/styles/hall.css";

function HallInner({ onSwitchApp }) {
  const { curUser, activeTab } = useHall();

  if (!curUser) return <HallLogin onSwitchApp={onSwitchApp} />;

  return (
    <div id="hallApp" style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <HallNavbar onSwitchApp={onSwitchApp} />
      <HallNotification />
      <main style={{ flex:1, overflowY:"auto" }}>
        {activeTab === "invoice"  && <HallInvoice  />}
        {activeTab === "calendar" && <HallCalendar />}
        {activeTab === "crm"      && <HallCRM      />}
        {activeTab === "expenses" && <HallExpenses />}
        {activeTab === "insights" && <HallInsights />}
        {activeTab === "admin"    && <HallAdmin    />}
      </main>
    </div>
  );
}

export default function HallApp({ onSwitchApp }) {
  return (
    <HallProvider>
      <HallInner onSwitchApp={onSwitchApp} />
    </HallProvider>
  );
}
`, 'utf8');

// ── hall.css ─────────────────────────────────────────────────────────────────
fs.writeFileSync(srcDir + '/styles/hall.css', `
/* Hall App — Amelia Convention Hall */
/* Uses same design tokens as hotel app via :root but scoped to #hallApp */

#hallApp {
  font-family: 'DM Sans', sans-serif;
  background: var(--bg, #F4F3F0);
  color: var(--text, #1A1A2E);
}

/* Login screen */
#loginScreen.screen { display:flex; align-items:center; justify-content:center; min-height:100vh; background:linear-gradient(135deg,#1a1a2e 0%,#2d1b4e 100%); }
.login-box { background:rgba(255,255,255,.07); border:1px solid rgba(201,168,76,.25); border-radius:20px; padding:36px 32px; width:100%; max-width:360px; text-align:center; backdrop-filter:blur(12px); }
.login-monogram { margin-bottom:10px; }
.login-logo { font-size:28px; font-weight:800; color:#f2dfc0; font-family:'Playfair Display',serif; letter-spacing:2px; margin-bottom:2px; }
.login-sub { font-size:12px; color:#c9a84c; letter-spacing:4px; text-transform:uppercase; margin-bottom:18px; }
.login-box h2 { color:#f0e8d8; font-size:16px; font-weight:600; margin-bottom:16px; }
.login-box input { display:block; width:100%; box-sizing:border-box; padding:11px 14px; margin-bottom:10px; background:rgba(255,255,255,.1); border:1px solid rgba(201,168,76,.3); border-radius:10px; color:#f0e8d8; font-size:14px; font-family:inherit; outline:none; }
.login-box input::placeholder { color:rgba(240,232,216,.4); }
.login-box input:focus { border-color:#c9a84c; background:rgba(255,255,255,.15); }
.login-box button[type=submit] { width:100%; padding:12px; background:linear-gradient(135deg,#c9a84c,#e8c96c); border:none; border-radius:10px; font-weight:800; font-size:14px; color:#1a1a2e; cursor:pointer; font-family:inherit; margin-top:4px; }
.login-err  { color:#fca5a5; font-size:12px; margin-top:10px; }
.login-hint { color:rgba(201,168,76,.5); font-size:11px; margin-top:12px; }

/* Hall Navbar */
#hallApp nav { background:linear-gradient(135deg,#1a1a2e 0%,#2d1b4e 100%); padding:0 20px; display:flex; align-items:center; gap:12px; height:56px; flex-shrink:0; position:sticky; top:0; z-index:100; }
#hallApp .nav-brand { display:flex; align-items:center; gap:10px; min-width:0; }
#hallApp .nav-brand-text { min-width:0; }
#hallApp .nav-brand-name { font-size:13px; font-weight:800; color:#f2dfc0; font-family:'Playfair Display',serif; white-space:nowrap; display:block; }
#hallApp .nav-brand-sub  { font-size:9px; color:#c9a84c; letter-spacing:1px; text-transform:uppercase; display:block; }
#hallApp .nav-tabs { display:flex; flex:1; overflow-x:auto; scrollbar-width:none; }
#hallApp .nav-tabs::-webkit-scrollbar { display:none; }
#hallApp .nav-tab { display:flex; flex-direction:column; align-items:center; padding:0 12px; height:56px; background:none; border:none; cursor:pointer; font-family:inherit; border-bottom:3px solid transparent; transition:.15s; flex-shrink:0; }
#hallApp .nav-tab:hover  { border-bottom-color:rgba(201,168,76,.4); }
#hallApp .nav-tab.active { border-bottom-color:#c9a84c; }
#hallApp .tab-icon  { font-size:15px; margin-top:10px; }
#hallApp .tab-label { font-size:9px; font-weight:700; color:#c9a84c; letter-spacing:.5px; text-transform:uppercase; margin-bottom:8px; }
#hallApp .nav-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
#hallApp .nav-user-wrap { display:flex; align-items:center; gap:6px; }
#hallApp .nav-user-name { font-size:12px; font-weight:700; color:#f2dfc0; }
#hallApp .logout-btn { background:none; border:none; cursor:pointer; color:#c9a84c; font-size:18px; padding:4px 6px; }

/* Notification */
#hallApp .notif { position:fixed; top:70px; right:20px; z-index:9999; padding:12px 18px; border-radius:10px; font-weight:700; font-size:13px; box-shadow:0 4px 20px rgba(0,0,0,.15); display:none; }
#hallApp .notif.show   { display:block; animation:slideIn .3s ease; }
#hallApp .notif.success { background:#dcfce7; color:#166534; border:1px solid #86efac; }
#hallApp .notif.error   { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
#hallApp .notif.info    { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }

/* Shared Panel / form styles scoped to #hallApp */
#hallApp .panel { background:#fff; border-radius:14px; border:1px solid rgba(0,0,0,.07); box-shadow:0 1px 4px rgba(0,0,0,.06); overflow:hidden; }
#hallApp .panel-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.06); }
#hallApp .panel-title  { font-size:13px; font-weight:800; color:#1a1a2e; }
#hallApp .form-group   { display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
#hallApp .form-group label { font-size:11px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:.5px; }
#hallApp .form-group input,
#hallApp .form-group select,
#hallApp .form-group textarea { width:100%; padding:9px 12px; border:1.5px solid #e5e3de; border-radius:8px; font-size:13px; font-family:inherit; background:#fafaf9; color:#1a1a2e; transition:.15s; outline:none; box-sizing:border-box; }
#hallApp .form-group input:focus,
#hallApp .form-group select:focus,
#hallApp .form-group textarea:focus { border-color:#c9a84c; background:#fff; box-shadow:0 0 0 3px rgba(201,168,76,.1); }
#hallApp .form-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
#hallApp .btn { display:inline-flex; align-items:center; gap:5px; padding:8px 14px; border-radius:9px; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; border:1.5px solid #e5e3de; background:#fff; color:#1a1a2e; transition:.15s; }
#hallApp .btn:hover { background:#f4f3f0; }
#hallApp .btn.primary { background:linear-gradient(135deg,#c9a84c,#e8c96c); border-color:#c9a84c; color:#1a1a2e; }
#hallApp .btn.primary:hover { opacity:.9; }
#hallApp .btn.danger  { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
#hallApp .btn.sm      { padding:5px 10px; font-size:11px; }
#hallApp .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:1000; padding:16px; }
#hallApp .modal-overlay.open { display:flex; }
#hallApp .modal-box { background:#fff; border-radius:16px; padding:24px; width:100%; max-width:640px; margin:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); max-height:90vh; overflow-y:auto; }
#hallApp .modal-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px; }
#hallApp .modal-title  { font-size:15px; font-weight:800; color:#1a1a2e; }
#hallApp .modal-sub    { font-size:11px; color:#888; margin-top:3px; }
#hallApp .modal-close  { background:none; border:none; cursor:pointer; color:#888; font-size:18px; padding:2px; }
#hallApp .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
#hallApp .role-badge { font-size:9px; font-weight:800; padding:2px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:.5px; }
#hallApp .role-badge.admin { background:rgba(201,168,76,.2); color:#8a6200; border:1px solid rgba(201,168,76,.4); }
#hallApp .role-badge.staff { background:rgba(37,99,235,.1); color:#1e40af; border:1px solid rgba(37,99,235,.2); }

@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
`, 'utf8');

// ── Welcome.jsx ────────────────────────────────────────────────────────────────
fs.writeFileSync(srcDir + '/components/Welcome.jsx', `
export default function Welcome({ onChoose }) {
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a1a2e 0%,#2d1b4e 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="120" height="57" style={{ display:"block", margin:"0 auto 16px" }}>
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
        <div style={{ fontSize:32, fontWeight:800, color:"#f2dfc0", fontFamily:"'Playfair Display',serif", letterSpacing:2 }}>Grand Alayna</div>
        <div style={{ fontSize:12, color:"#c9a84c", letterSpacing:6, textTransform:"uppercase", marginTop:4 }}>Hospitality Group</div>
      </div>
      <div style={{ fontSize:13, color:"rgba(240,232,216,.6)", marginBottom:32 }}>Select a system to continue</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, maxWidth:560, width:"100%" }}>
        <button onClick={()=>onChoose("hotel")} style={{ padding:"28px 20px", background:"rgba(255,255,255,.06)", border:"1px solid rgba(201,168,76,.3)", borderRadius:18, cursor:"pointer", textAlign:"center", transition:".2s", fontFamily:"inherit" }}
          onMouseOver={e=>{e.currentTarget.style.background="rgba(201,168,76,.12)";e.currentTarget.style.borderColor="rgba(201,168,76,.6)"}}
          onMouseOut={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.borderColor="rgba(201,168,76,.3)"}}>
          <div style={{ fontSize:36, marginBottom:12 }}>🏨</div>
          <div style={{ fontSize:16, fontWeight:800, color:"#f2dfc0", fontFamily:"'Playfair Display',serif", marginBottom:4 }}>Hotel</div>
          <div style={{ fontSize:11, color:"#c9a84c", letterSpacing:2, textTransform:"uppercase" }}>The Grand Alayna</div>
        </button>
        <button onClick={()=>onChoose("hall")} style={{ padding:"28px 20px", background:"rgba(255,255,255,.06)", border:"1px solid rgba(201,168,76,.3)", borderRadius:18, cursor:"pointer", textAlign:"center", transition:".2s", fontFamily:"inherit" }}
          onMouseOver={e=>{e.currentTarget.style.background="rgba(201,168,76,.12)";e.currentTarget.style.borderColor="rgba(201,168,76,.6)"}}
          onMouseOut={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.borderColor="rgba(201,168,76,.3)"}}>
          <div style={{ fontSize:36, marginBottom:12 }}>🎊</div>
          <div style={{ fontSize:16, fontWeight:800, color:"#f2dfc0", fontFamily:"'Playfair Display',serif", marginBottom:4 }}>Convention Hall</div>
          <div style={{ fontSize:11, color:"#c9a84c", letterSpacing:2, textTransform:"uppercase" }}>Amelia</div>
        </button>
      </div>
    </div>
  );
}
`, 'utf8');

// ── App.jsx — root with welcome + app switcher ─────────────────────────────────
fs.writeFileSync(srcDir + '/App.jsx', `
import { useState } from "react";
import Welcome  from "./components/Welcome";
import HallApp  from "./hall/HallApp";
import HotelApp from "./HotelApp";

export default function App() {
  const [app, setApp] = useState(null); // null | "hotel" | "hall"

  if (!app)            return <Welcome onChoose={setApp} />;
  if (app === "hall")  return <HallApp  onSwitchApp={()=>setApp(null)} />;
  return                      <HotelApp onSwitchApp={()=>setApp(null)} />;
}
`, 'utf8');

console.log('HallApp.jsx, hall.css, Welcome.jsx, App.jsx written OK');
