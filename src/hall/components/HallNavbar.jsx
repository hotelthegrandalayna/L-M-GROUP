
import { useState } from "react";
import { useHall } from "../HallContext";

const TABS = [
  { id:"invoice",  icon:"🧾", label:"Invoice"  },
  { id:"calendar", icon:"📅", label:"Calendar" },
  { id:"crm",      icon:"🤝", label:"CRM"      },
  { id:"cutlery",  icon:"🍽", label:"Cutlery"  },
  { id:"expenses", icon:"💸", label:"Expenses" },
  { id:"insights", icon:"📊", label:"Insights" },
  { id:"admin",    icon:"⚙️",  label:"Admin"    },
];

export default function HallNavbar({ onSwitchApp }) {
  const { curUser, curRole, activeTab, setActiveTab, logout, bumpInvoiceJump } = useHall();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleTabs = TABS.filter(t => curRole === "admin" || (t.id !== "insights" && t.id !== "admin"));

  function handleTab(id) {
    if (id === "invoice") bumpInvoiceJump();
    setActiveTab(id);
    setMenuOpen(false);
  }

  return (
    <>
      <nav className="hall-nav">
        {/* Brand */}
        <div className="nav-brand">
          <div className="nav-brand-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="46" height="22">
              <polygon points="8,78 19,78 46,18 35,18" fill="#e8d5ff"/>
              <polygon points="35,18 46,18 71,78 60,78" fill="#e8d5ff"/>
              <rect x="24" y="49" width="30" height="7" fill="#e8d5ff"/>
              <rect x="4" y="74" width="19" height="5" rx="1" fill="#e8d5ff"/>
              <rect x="56" y="74" width="19" height="5" rx="1" fill="#e8d5ff"/>
              <circle cx="95" cy="44" r="5" fill="#c9a84c"/>
              <rect x="112" y="18" width="11" height="60" fill="#e8d5ff"/>
              <rect x="149" y="18" width="11" height="60" fill="#e8d5ff"/>
              <rect x="112" y="42" width="48" height="8" fill="#e8d5ff"/>
              <rect x="108" y="74" width="19" height="5" rx="1" fill="#e8d5ff"/>
              <rect x="145" y="74" width="19" height="5" rx="1" fill="#e8d5ff"/>
            </svg>
          </div>
          <div className="nav-brand-text">
            <span className="nav-brand-name">Amelia Convention Hall</span>
            <span className="nav-brand-sub">Management System</span>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="nav-tabs">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              className={"nav-tab" + (activeTab === t.id ? " active" : "")}
              onClick={() => handleTab(t.id)}
            >
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
              {activeTab === t.id && <span className="tab-pip" />}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="nav-right">
          <div className="nav-user-wrap">
            <div className="nav-avatar">{(curUser||"?")[0].toUpperCase()}</div>
            <div className="nav-user-info">
              <div className="nav-user-name">{curUser}</div>
              <span className={"role-badge " + curRole}>{curRole}</span>
            </div>
          </div>
          <button className="nav-switch-btn" onClick={onSwitchApp}>⇄ Switch</button>
          <button className="logout-btn" onClick={logout} title="Logout">⏻</button>

          {/* Hamburger — mobile only */}
          <button
            id="hall-hamburger"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display:"none",
              flexDirection:"column", justifyContent:"center", alignItems:"center",
              gap:5, width:36, height:36, borderRadius:9,
              background: menuOpen ? "rgba(201,168,76,.2)" : "rgba(255,255,255,.08)",
              border:"1px solid rgba(180,130,255,.25)",
              cursor:"pointer", padding:0, flexShrink:0,
            }}
            aria-label="Menu"
          >
            <span style={{ display:"block", width:18, height:2, background:menuOpen?"#c9a84c":"#e8d5ff", borderRadius:2, transition:".2s", transform: menuOpen?"rotate(45deg) translate(5px,5px)":"" }} />
            <span style={{ display:"block", width:18, height:2, background:menuOpen?"#c9a84c":"#e8d5ff", borderRadius:2, transition:".2s", opacity: menuOpen?0:1 }} />
            <span style={{ display:"block", width:18, height:2, background:menuOpen?"#c9a84c":"#e8d5ff", borderRadius:2, transition:".2s", transform: menuOpen?"rotate(-45deg) translate(5px,-5px)":"" }} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          id="hall-mobile-menu"
          style={{
            position:"fixed", top:52, left:0, right:0, zIndex:200,
            background:"linear-gradient(180deg,#2D1B69,#1a0f40)",
            borderBottom:"2px solid rgba(201,168,76,.3)",
            boxShadow:"0 8px 32px rgba(0,0,0,.5)",
            padding:"8px 10px 12px",
          }}
        >
          {/* Active tab indicator */}
          <div style={{ fontSize:9, color:"rgba(201,168,76,.6)", textTransform:"uppercase", letterSpacing:2, fontWeight:700, padding:"4px 6px 8px" }}>
            {visibleTabs.find(t=>t.id===activeTab)?.icon} {visibleTabs.find(t=>t.id===activeTab)?.label}
          </div>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              className={activeTab===t.id ? "hmob-active" : ""}
              onClick={() => handleTab(t.id)}
            >
              <span style={{ fontSize:20, minWidth:28 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          {/* User info + actions */}
          <div style={{ marginTop:10, padding:"10px 14px", borderTop:"1px solid rgba(201,168,76,.15)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#f2dfc0" }}>{curUser}</div>
              <span className={"role-badge " + curRole} style={{ marginTop:2, display:"inline-block" }}>{curRole}</span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { onSwitchApp(); setMenuOpen(false); }} style={{ background:"rgba(201,168,76,.12)", border:"1px solid rgba(201,168,76,.35)", borderRadius:8, color:"#f0d080", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                ⇄ Switch
              </button>
              <button onClick={() => { logout(); setMenuOpen(false); }} style={{ background:"rgba(255,80,80,.12)", border:"1px solid rgba(255,80,80,.3)", borderRadius:8, color:"#fca5a5", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                ⏻ Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position:"fixed", inset:0, top:52, zIndex:199, background:"rgba(0,0,0,.3)" }}
        />
      )}
    </>
  );
}
