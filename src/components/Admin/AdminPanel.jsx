import { useState } from "react";
import { useApp } from "../../context/AppContext";
import AdminStaff from "./AdminStaff";
import AdminSMS   from "./AdminSMS";

// Admin is deliberately small. Everything that reports on money or rooms lives
// in Accounts; Rooms moved to Accounts › Rooms and Invoices to their own tab.
// Finance, Reports, Audit Log, Data and Sync Cloud were removed on request —
// their code still exists, so any of them can be brought back by adding a row
// here and its import above.
const TABS = [
  { key:"sms",   label:"Messages", icon:"ti-message-circle" },
  { key:"staff", label:"Staff",    icon:"ti-users"          },
];

export default function AdminPanel() {
  const { curRole } = useApp();
  const [tab, setTab] = useState("sms");

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
    <div style={{ padding:"22px 24px", margin:"0 auto", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Admin Panel</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Hotel management settings</div>
      </div>

      <div style={{ display:"flex", gap:4, borderBottom:"2px solid var(--border)", marginBottom:20, flexWrap:"wrap" }}>
        {TABS.filter(t=>!(t.key==="staff"&&curRole!=="admin")).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,transition:"all .15s",
            background: tab===t.key ? "var(--bg4)" : "none",
            color: tab===t.key ? "var(--navy)" : "#555",
            borderBottom: tab===t.key ? "3px solid var(--gold)" : "3px solid transparent",
            borderRadius:"6px 6px 0 0",
            marginBottom:-2 }}>
            <i className={"ti "+t.icon} style={{ fontSize:15, color: tab===t.key ? "var(--gold)" : "#777" }} />{t.label}
          </button>
        ))}
      </div>

      {tab==="sms"   && <AdminSMS />}
      {tab==="staff" && curRole==="admin" && <AdminStaff />}
    </div>
  );
}
